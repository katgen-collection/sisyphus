"use client";

import { useEffect, useRef, useState } from "react";
import * as Comlink from "comlink";
import type { AcceptedFile } from "@/modules/_shared";
import { downloadResult, downloadResultZip } from "../lib/downloadResults";
import { makeOutputName } from "../lib/naming";
import type {
  ImageBatchItem,
  ImageBatchState,
  ImageOptions,
  ImageStage,
  PixelCrop,
  UseImageBatchReturn,
} from "../types";
import { getImageWorker, terminateImageWorker } from "../workerClient";

const STAGE_PROGRESS: Record<ImageStage, number> = {
  queued: 0,
  validating: 8,
  decoding: 24,
  orienting: 38,
  cropping: 50,
  resizing: 65,
  encoding: 82,
  finalizing: 95,
  complete: 100,
  failed: 100,
  cancelled: 100,
};

export function useImageBatch(): UseImageBatchReturn {
  const [items, setItems] = useState<ImageBatchItem[]>([]);
  const [state, setState] = useState<ImageBatchState>("idle");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      terminateImageWorker();
    };
  }, []);

  const patchItem = (id: string, patch: Partial<ImageBatchItem>) => {
    if (!mountedRef.current) return;
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addFiles = (files: AcceptedFile[]) => {
    setBatchError(null);
    setItems((current) => [
      ...current,
      ...files.map(({ file }) => ({
        id: crypto.randomUUID(),
        file,
        stage: "queued" as const,
        progress: 0,
        crop: null,
        sourceDimensions: null,
        result: null,
        error: null,
      })),
    ]);
    setState("idle");
  };

  const removeItem = (id: string) => {
    if (state !== "idle") return;
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const setItemCrop = (id: string, crop: PixelCrop | null) => patchItem(id, { crop });
  const setSourceDimensions = (id: string, sourceDimensions: { width: number; height: number }) => patchItem(id, { sourceDimensions });

  const process = async (baseOptions: Omit<ImageOptions, "crop">) => {
    if (state === "processing" || state === "creating-zip") return;
    const queue = items.filter((item) => item.stage === "queued");
    if (queue.length === 0) return;
    const generation = ++generationRef.current;
    const usedNames = new Set(
      items.flatMap((item) => item.result ? [item.result.filename.toLowerCase()] : [])
    );
    let hasFailures = items.some((item) => item.stage === "failed");
    setBatchError(null);
    setState("processing");

    for (const item of queue) {
      if (!mountedRef.current || generationRef.current !== generation) return;
      setActiveItemId(item.id);
      patchItem(item.id, { stage: "validating", progress: STAGE_PROGRESS.validating, error: null });
      try {
        const source = await item.file.arrayBuffer();
        if (!mountedRef.current || generationRef.current !== generation) return;
        const worker = getImageWorker();
        const response = await worker.processImage(
          Comlink.transfer({
            source,
            sourceName: item.file.name,
            declaredMimeType: item.file.type,
            options: { ...baseOptions, crop: item.crop },
          }, [source]),
          Comlink.proxy((stage: ImageStage) => patchItem(item.id, { stage, progress: STAGE_PROGRESS[stage] }))
        );
        if (!mountedRef.current || generationRef.current !== generation) return;
        if (response.ok) {
          const filename = makeOutputName(item.file.name, baseOptions.outputFormat, usedNames);
          usedNames.add(filename.toLowerCase());
          patchItem(item.id, {
            stage: "complete",
            progress: 100,
            result: { ...response.result, filename },
            error: null,
          });
        } else {
          hasFailures = true;
          patchItem(item.id, { stage: "failed", progress: 100, error: response.error });
        }
      } catch (error) {
        if (!mountedRef.current || generationRef.current !== generation) return;
        hasFailures = true;
        patchItem(item.id, {
          stage: "failed",
          progress: 100,
          error: { code: "decode-failed", message: error instanceof Error ? error.message : "Image processing failed." },
        });
      }
    }

    if (!mountedRef.current || generationRef.current !== generation) return;
    setActiveItemId(null);
    terminateImageWorker();
    setState(hasFailures ? "done-with-errors" : "done");
  };

  const downloadItem = (id: string) => {
    const result = items.find((item) => item.id === id)?.result;
    if (result) downloadResult(result);
  };

  const downloadAll = async () => {
    if (state === "processing" || state === "creating-zip") return;
    const results = items.flatMap((item) => item.result ? [item.result] : []);
    const finalState = items.some((item) => item.error) ? "done-with-errors" : "done";
    setState("creating-zip");
    setBatchError(null);
    try {
      await downloadResultZip(results);
      setState(finalState);
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "The ZIP could not be created.");
      setState(finalState);
    }
  };

  const reset = () => {
    generationRef.current += 1;
    terminateImageWorker();
    setItems([]);
    setActiveItemId(null);
    setBatchError(null);
    setState("idle");
  };

  const progress = items.length === 0
    ? 0
    : items.reduce((sum, item) => sum + item.progress, 0) / items.length;

  return {
    items, state, progress, activeItemId, batchError,
    addFiles, removeItem, setItemCrop, setSourceDimensions,
    process, downloadItem, downloadAll, reset,
  };
}

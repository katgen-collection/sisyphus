"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as Comlink from "comlink";
import type { ProcessingState } from "@/modules/_shared";
import type {
  FFmpegProgress,
  VideoOutputFormat,
  AudioOutputFormat,
  CompressionLevel,
  ConversionResult,
} from "../types";
import { getFFmpegWorker, terminateFFmpegWorker } from "../workerClient";

/** Files larger than this (bytes) show a warning in the UI. */
export const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500 MB

interface UseFFmpegReturn {
  state: ProcessingState;
  progress: number;
  error: string | null;
  logs: string[];
  isMultiThreaded: boolean;
  loadFFmpeg: () => Promise<void>;
  convert: (
    file: File,
    outputFormat: VideoOutputFormat,
    options?: {
      resolution?: { width: number; height: number };
      compression?: CompressionLevel;
      fps?: number;
    }
  ) => Promise<ConversionResult | null>;
  extractAudio: (
    file: File,
    outputFormat: AudioOutputFormat
  ) => Promise<ConversionResult | null>;
  reset: () => void;
}

/**
 * Hook to interface with FFmpeg worker.
 * Manages loading, conversion, and cleanup lifecycle.
 */
export function useFFmpegWorker(): UseFFmpegReturn {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isMultiThreaded, setIsMultiThreaded] = useState(false);
  const loadedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminateFFmpegWorker();
    };
  }, []);

  const loadFFmpeg = useCallback(async () => {
    if (loadedRef.current) return;

    setState("loading");
    setProgress(0);
    setError(null);
    setLogs([]);

    try {
      const worker = getFFmpegWorker();
      await worker.load();
      loadedRef.current = true;

      // Query threading capability from the worker
      const mt = await worker.isMultiThreaded();
      setIsMultiThreaded(mt);

      setState("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load FFmpeg";
      setError(message);
      setState("error");
    }
  }, []);

  const convert = useCallback(
    async (
      file: File,
      outputFormat: VideoOutputFormat,
      options?: {
        resolution?: { width: number; height: number };
        compression?: CompressionLevel;
        fps?: number;
      }
    ): Promise<ConversionResult | null> => {
      if (!loadedRef.current) {
        setError("FFmpeg not loaded");
        setState("error");
        return null;
      }

      setState("processing");
      setProgress(0);
      setError(null);
      setLogs([]);

      try {
        const worker = getFFmpegWorker();
        const inputData = new Uint8Array(await file.arrayBuffer());

        const result = await worker.convert(
          inputData,
          file.name,
          outputFormat,
          options,
          Comlink.proxy((prog: FFmpegProgress) => {
            setProgress(Math.round(prog.ratio * 100));
          }),
          Comlink.proxy((message: string) => {
            setLogs((prev) => [...prev.slice(-99), message]);
          })
        );

        setState("done");
        setProgress(100);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Conversion failed";
        setError(message);
        setState("error");
        return null;
      }
    },
    []
  );

  const extractAudio = useCallback(
    async (file: File, outputFormat: AudioOutputFormat): Promise<ConversionResult | null> => {
      if (!loadedRef.current) {
        setError("FFmpeg not loaded");
        setState("error");
        return null;
      }

      setState("processing");
      setProgress(0);
      setError(null);
      setLogs([]);

      try {
        const worker = getFFmpegWorker();
        const inputData = new Uint8Array(await file.arrayBuffer());

        const result = await worker.extractAudio(
          inputData,
          file.name,
          outputFormat,
          Comlink.proxy((prog: FFmpegProgress) => {
            setProgress(Math.round(prog.ratio * 100));
          }),
          Comlink.proxy((message: string) => {
            setLogs((prev) => [...prev.slice(-99), message]);
          })
        );

        setState("done");
        setProgress(100);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Audio extraction failed";
        setError(message);
        setState("error");
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState("idle");
    setProgress(0);
    setError(null);
    // Don't clear logs on reset so user can still see them
  }, []);

  return {
    state,
    progress,
    error,
    logs,
    isMultiThreaded,
    loadFFmpeg,
    convert,
    extractAudio,
    reset,
  };
}

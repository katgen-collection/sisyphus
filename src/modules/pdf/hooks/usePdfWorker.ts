"use client";

import { useCallback, useEffect } from "react";
import { useProcessingState } from "@/modules/_shared";
import type { PdfOptimizeOptions, PdfResult, SignaturePlacement } from "../types";
import { getPdfWorker, terminatePdfWorker } from "../workerClient";

interface UsePdfWorkerReturn {
  state: ReturnType<typeof useProcessingState>["state"];
  progress: number;
  error: string | null;
  optimizePdf: (file: File, options?: PdfOptimizeOptions) => Promise<PdfResult | null>;
  imagesToPdf: (
    images: Array<{ file: File; order: number }>
  ) => Promise<PdfResult | null>;
  reorderPdf: (file: File, order: number[]) => Promise<PdfResult | null>;
  signPdf: (
    pdfData: Uint8Array,
    signatures: SignaturePlacement[],
    outputName?: string
  ) => Promise<PdfResult | null>;
  reset: () => void;
}

/**
 * Hook to interface with PDF worker.
 */
export function usePdfWorker(): UsePdfWorkerReturn {
  const {
    state,
    progress,
    error,
    setProcessing,
    setDone,
    setError,
    setProgress,
    reset,
  } = useProcessingState();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminatePdfWorker();
    };
  }, []);

  const optimizePdf = useCallback(
    async (file: File, options?: PdfOptimizeOptions): Promise<PdfResult | null> => {
      setProcessing();
      setProgress(10);

      try {
        const worker = getPdfWorker();
        const pdfData = new Uint8Array(await file.arrayBuffer());
        setProgress(30);

        const result = await worker.optimize(pdfData, options);
        setProgress(100);
        setDone();

        return {
          ...result,
          filename: file.name.replace(/\.pdf$/i, "_optimized.pdf"),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "PDF optimization failed";
        setError(message);
        return null;
      }
    },
    [setProcessing, setProgress, setDone, setError]
  );

  const imagesToPdf = useCallback(
    async (images: Array<{ file: File; order: number }>): Promise<PdfResult | null> => {
      setProcessing();
      setProgress(5);

      try {
        const worker = getPdfWorker();

        // Sort images by order, then convert to data
        const sorted = [...images].sort((a, b) => a.order - b.order);
        const imageData: Array<{ data: Uint8Array; name: string; type: string }> = [];

        for (let i = 0; i < sorted.length; i++) {
          const { file } = sorted[i];
          const data = new Uint8Array(await file.arrayBuffer());
          imageData.push({ data, name: file.name, type: file.type });
          setProgress(5 + Math.round((i / sorted.length) * 45));
        }

        setProgress(55);
        const result = await worker.imagesToPdf(imageData, "images.pdf");
        setProgress(100);
        setDone();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create PDF";
        setError(message);
        return null;
      }
    },
    [setProcessing, setProgress, setDone, setError]
  );

    const reorderPdf = useCallback(
      async (file: File, order: number[]): Promise<PdfResult | null> => {
        setProcessing();
        setProgress(10);

        try {
          const worker = getPdfWorker();
          const pdfData = new Uint8Array(await file.arrayBuffer());
          setProgress(40);

          const outputName = file.name.replace(/\.pdf$/i, "_reordered.pdf");
          const result = await worker.reorderPages(pdfData, order, outputName);
          setProgress(100);
          setDone();

          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to reorder PDF";
          setError(message);
          return null;
        }
      },
      [setProcessing, setProgress, setDone, setError]
    );

  const signPdf = useCallback(
    async (
      pdfData: Uint8Array,
      signatures: SignaturePlacement[],
      outputName?: string
    ): Promise<PdfResult | null> => {
      setProcessing();
      setProgress(10);

      try {
        const worker = getPdfWorker();

        // Convert signature placements to worker format
        const signaturesForWorker: Array<{
          pageIndex: number;
          x: number;
          y: number;
          width: number;
          height: number;
          imageData: Uint8Array;
        }> = [];

        for (let i = 0; i < signatures.length; i++) {
          const sig = signatures[i];
          // Convert base64 data URL to Uint8Array
          const base64 = sig.imageDataUrl.split(",")[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j);
          }

          signaturesForWorker.push({
            pageIndex: sig.pageIndex,
            x: sig.x,
            y: sig.y,
            width: sig.width,
            height: sig.height,
            imageData: bytes,
          });

          setProgress(10 + Math.round((i / signatures.length) * 40));
        }

        setProgress(55);
        const result = await worker.addSignatures(
          pdfData,
          signaturesForWorker,
          outputName ?? "signed.pdf"
        );
        setProgress(100);
        setDone();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to sign PDF";
        setError(message);
        return null;
      }
    },
    [setProcessing, setProgress, setDone, setError]
  );

  return {
    state,
    progress,
    error,
    optimizePdf,
    imagesToPdf,
    reorderPdf,
    signPdf,
    reset,
  };
}

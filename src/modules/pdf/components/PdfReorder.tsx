"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Loader2, AlertCircle, GripVertical, RotateCcw } from "lucide-react";
import {
  FileUploader,
  Button,
  downloadUint8Array,
  type AcceptedFile,
} from "@/modules/_shared";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { LoadingSpinner } from "@/components";

// Type for pdfjs-dist (we'll import it dynamically)
type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => void;
};

type PDFPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

type PDFJSLib = {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
};

// Lazy load PDF.js via CDN script to avoid bundler/runtime issues
let pdfjsLib: PDFJSLib | null = null;
let pdfjsLoading: Promise<PDFJSLib> | null = null;

async function loadPdfjs(): Promise<PDFJSLib> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser");
  }
  if (pdfjsLib) return pdfjsLib;
  if (pdfjsLoading) return pdfjsLoading;

  pdfjsLoading = new Promise<PDFJSLib>((resolve, reject) => {
    const existing = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
    if (existing) {
      existing.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js";
      pdfjsLib = existing;
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.min.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
      if (!lib) {
        reject(new Error("PDF.js failed to load"));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@2.16.105/legacy/build/pdf.worker.min.js";
      pdfjsLib = lib;
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });

  return pdfjsLoading;
}

interface PageItem {
  id: string;
  pageIndex: number; // 0-based
  preview: string;
}

/**
 * Reorder PDF pages with draggable previews.
 */
export function PdfReorder() {
  const { state, progress, error, reorderPdf, reset } = usePdfWorker();

  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) pdfDocRef.current.destroy();
    };
  }, []);

  const cleanupPreviews = useCallback((items: PageItem[]) => {
    items.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  const handleFilesAccepted = useCallback(
    async (files: AcceptedFile[]) => {
      const newFile = files[0] ?? null;
      setFile(newFile);
      reset();
      setPreviewError(null);

      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      if (pages.length > 0) cleanupPreviews(pages);
      setPages([]);

      if (!newFile) return;

      setIsLoading(true);
      try {
        const pdfjs = await loadPdfjs();
        const arrayBuffer = await newFile.file.arrayBuffer();
        const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdfDoc;

        const nextPages: PageItem[] = [];
        const scale = 1.35;

        for (let i = 0; i < pdfDoc.numPages; i++) {
          const pageNumber = i + 1;
          const page = await pdfDoc.getPage(pageNumber);
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas context not available");

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport, canvas }).promise;

          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, "image/png", 0.9);
          });

          if (!blob) continue;
          const url = URL.createObjectURL(blob);
          nextPages.push({
            id: `${newFile.id}-${pageNumber}`,
            pageIndex: i,
            preview: url,
          });
        }

        setPages(nextPages);
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Failed to load PDF previews");
      } finally {
        setIsLoading(false);
      }
    },
    [cleanupPreviews, pages, reset]
  );

  // Drag-and-drop reordering
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;

      setPages((prev) => {
        const items = [...prev];
        const draggedIdx = items.findIndex((i) => i.id === draggedId);
        const targetIdx = items.findIndex((i) => i.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return prev;

        const [dragged] = items.splice(draggedIdx, 1);
        items.splice(targetIdx, 0, dragged);
        return items;
      });
    },
    [draggedId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleResetOrder = useCallback(() => {
    setPages((prev) => [...prev].sort((a, b) => a.pageIndex - b.pageIndex));
  }, []);

  const handleReorder = useCallback(async () => {
    if (!file || pages.length === 0) return;

    try {
      const order = pages.map((p) => p.pageIndex);
      const result = await reorderPdf(file.file, order);
      if (result) {
        downloadUint8Array(result.data, result.filename, "application/pdf");
      }
    } catch (err) {
      console.error(err);
    }
  }, [file, pages, reorderPdf]);

  const isProcessing = state === "processing";
  const canProcess = file && pages.length > 0 && !isProcessing && !isLoading;

  return (
    <div className="space-y-6">
      <FileUploader
        accept=".pdf"
        onFilesAccepted={handleFilesAccepted}
        disabled={isProcessing}
        compact={!!file}
      >
        {file ? (
          <div className="text-center">
            <div className="mb-2 w-12 h-12 mx-auto rounded-lg bg-stone-200 flex items-center justify-center">
              <FileText className="w-6 h-6 text-stone-600" />
            </div>
            <p className="text-stone-700 font-medium truncate max-w-xs">{file.file.name}</p>
            {isLoading ? (
              <p className="text-stone-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Rendering previews...
              </p>
            ) : pages.length ? (
              <p className="text-stone-400 text-sm">
                {pages.length} page{pages.length !== 1 ? "s" : ""}
              </p>
            ) : null}
          </div>
        ) : undefined}
      </FileUploader>

      {pages.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-stone-500 flex items-center gap-2">
            <GripVertical className="w-4 h-4" /> Drag pages to rearrange
          </p>
          <button
            onClick={handleResetOrder}
            disabled={isProcessing}
            className="text-sm text-stone-500 hover:text-stone-700 underline inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset order
          </button>
        </div>
      )}

      {pages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page, idx) => (
            <div
              key={page.id}
              draggable={!isProcessing}
              onDragStart={() => handleDragStart(page.id)}
              onDragOver={(e) => handleDragOver(e, page.id)}
              onDragEnd={handleDragEnd}
              className={`
                relative rounded-xl overflow-hidden border-2 bg-white shadow-sm cursor-move
                transition-all duration-150
                ${draggedId === page.id ? "opacity-60 border-stone-400" : "border-stone-200 hover:border-stone-400"}
              `}
            >
              <div className="aspect-3/4 bg-stone-50">
                <img
                  src={page.preview}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-stone-900/70 text-stone-50 text-xs font-medium">
                Page {idx + 1}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPages((prev) => {
                    const removed = prev.find((p) => p.id === page.id);
                    if (removed) URL.revokeObjectURL(removed.preview);
                    return prev.filter((p) => p.id !== page.id);
                  });
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isProcessing}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-stone-900/70 text-stone-50 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                aria-label={`Remove page ${idx + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Generating previews..." />
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text={`Reordering... ${progress}%`} />
        </div>
      )}

      {state === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {previewError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {previewError}
        </div>
      )}

      {state === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
          PDF reordered! Download started.
        </div>
      )}

      <Button onClick={handleReorder} disabled={!canProcess} loading={isProcessing} className="w-full">
        Save Rearranged PDF
      </Button>
    </div>
  );
}

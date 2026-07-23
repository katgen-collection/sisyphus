"use client";

import { useState, useCallback } from "react";
import {
  FileUploader,
  Button,
  downloadUint8Array,
  type AcceptedFile,
} from "@/modules/_shared";
import { LoadingSpinner } from "@/components";
import { usePdfWorker } from "../hooks/usePdfWorker";

interface OrderedImage {
  file: File;
  id: string;
  order: number;
  preview: string;
}

/**
 * Images to PDF converter.
 * Drag to reorder, then combine into a single PDF.
 */
export function ImagesToPdf() {
  const { state, progress, error, imagesToPdf, reset } = usePdfWorker();
  const [images, setImages] = useState<OrderedImage[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleFilesAccepted = useCallback((files: AcceptedFile[]) => {
    const newImages: OrderedImage[] = files.map((f, i) => ({
      file: f.file,
      id: f.id,
      order: images.length + i,
      preview: URL.createObjectURL(f.file),
    }));
    setImages((prev) => [...prev, ...newImages]);
    reset();
  }, [images.length, reset]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((img) => img.id !== id).map((img, i) => ({ ...img, order: i }));
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    reset();
  }, [images, reset]);

  // Drag-and-drop reordering
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    setImages((prev) => {
      const items = [...prev];
      const draggedIdx = items.findIndex((i) => i.id === draggedId);
      const targetIdx = items.findIndex((i) => i.id === targetId);
      if (draggedIdx === -1 || targetIdx === -1) return prev;

      const [dragged] = items.splice(draggedIdx, 1);
      items.splice(targetIdx, 0, dragged);
      return items.map((img, i) => ({ ...img, order: i }));
    });
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleConvert = useCallback(async () => {
    if (images.length === 0) return;

    const result = await imagesToPdf(images.map((img) => ({ file: img.file, order: img.order })));

    if (result) {
      downloadUint8Array(result.data, result.filename, "application/pdf");
    }
  }, [images, imagesToPdf]);

  const isProcessing = state === "processing";
  const canProcess = images.length > 0 && !isProcessing;

  return (
    <div className="space-y-6">
      <FileUploader
        accept=".jpg,.jpeg,.png"
        multiple
        onFilesAccepted={handleFilesAccepted}
        disabled={isProcessing}
      />

      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-secondary">
              {images.length} image{images.length !== 1 ? "s" : ""} — drag to reorder
            </p>
            <button
              onClick={clearAll}
              disabled={isProcessing}
              className="text-sm text-secondary hover:text-primary underline"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id}
                draggable={!isProcessing}
                onDragStart={() => handleDragStart(img.id)}
                onDragOver={(e) => handleDragOver(e, img.id)}
                onDragEnd={handleDragEnd}
                className={`
                  relative aspect-square rounded-lg overflow-hidden border-2 cursor-move
                  transition-all duration-150
                  ${draggedId === img.id ? "opacity-50 border-border-strong" : "border-border hover:border-border-strong"}
                `}
              >
                <img
                  src={img.preview}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Page number badge */}
                <span className="absolute bottom-1 left-1 bg-primary/80 text-canvas text-xs px-1.5 py-0.5 rounded">
                  {idx + 1}
                </span>
                {/* Remove button */}
                <button
                  onClick={() => removeImage(img.id)}
                  disabled={isProcessing}
                  className="absolute top-1 right-1 w-5 h-5 bg-primary/80 hover:bg-red-600 text-canvas rounded-full flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Creating PDF..." />
        </div>
      )}

      {state === "error" && (
        <div className="bg-error-bg border border-error-border rounded-lg px-4 py-3 text-error-text">
          {error}
        </div>
      )}

      {state === "done" && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text">
          PDF created successfully!
        </div>
      )}

      <Button onClick={handleConvert} disabled={!canProcess} loading={isProcessing} className="w-full">
        Create PDF
      </Button>
    </div>
  );
}

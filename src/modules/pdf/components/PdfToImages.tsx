"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import JSZip from "jszip";
import {
  FileUploader,
  Button,
  downloadBlob,
  useProcessingState,
  type AcceptedFile,
} from "@/modules/_shared";
import { LoadingSpinner } from "@/components";
import { loadPdfjs, type PDFDocumentProxy } from "../lib/pdfjs";

/**
 * PDF to Images converter using pdf-lib directly.
 * Renders each page to canvas, zips them, downloads.
 */
export function PdfToImages() {
  const { state, progress, error, setProcessing, setProgress, setDone, setError, reset } =
    useProcessingState();

  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(2);
  const [isLoading, setIsLoading] = useState(false);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, []);

  const handleFilesAccepted = useCallback(async (files: AcceptedFile[]) => {
    const newFile = files[0] ?? null;
    setFile(newFile);
    setNumPages(null);
    reset();

    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }

    if (!newFile) return;

    setIsLoading(true);
    try {
      // Load pdfjs dynamically
      const pdfjs = await loadPdfjs();
      const arrayBuffer = await newFile.file.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdfDoc;
      setNumPages(pdfDoc.numPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setIsLoading(false);
    }
  }, [reset, setError]);

  const handleConvert = useCallback(async () => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !numPages) return;

    setProcessing();
    setProgress(0);

    try {
      const zip = new JSZip();

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // Create canvas for this page
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas context not available");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, "image/png");
        });

        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          zip.file(`page_${pageNum.toString().padStart(3, "0")}.png`, arrayBuffer);
        }

        setProgress(Math.round((pageNum / numPages) * 90));
      }

      setProgress(95);
      const zipBlob = await zip.generateAsync({ type: "blob" });
      setProgress(100);

      const fileName = file?.file.name.replace(/\.pdf$/i, "") || "pdf";
      downloadBlob(zipBlob, `${fileName}_images.zip`);
      setDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed";
      setError(message);
    }
  }, [numPages, scale, file, setProcessing, setProgress, setDone, setError]);

  const isProcessing = state === "processing";
  const canProcess = file && numPages && numPages > 0 && !isProcessing && !isLoading;

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
            <div className="mb-2 w-12 h-12 mx-auto rounded-lg bg-surface-muted flex items-center justify-center">
              <FileText className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-primary font-medium truncate max-w-xs">{file.file.name}</p>
            {isLoading ? (
              <p className="text-muted text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </p>
            ) : numPages ? (
              <p className="text-muted text-sm">{numPages} page{numPages !== 1 ? "s" : ""}</p>
            ) : null}
          </div>
        ) : undefined}
      </FileUploader>

      {/* Scale selector */}
      {file && numPages && (
        <div className="bg-surface-subtle rounded-xl p-5">
          <label className="block text-sm font-medium text-primary mb-2">
            Output Quality
          </label>
          <div className="flex gap-2">
            {[
              { value: 1, label: "Standard" },
              { value: 2, label: "High" },
              { value: 3, label: "Maximum" },
            ].map((s) => (
              <button
                key={s.value}
                onClick={() => setScale(s.value)}
                disabled={isProcessing}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  scale === s.value
                    ? "bg-primary text-canvas"
                    : "bg-surface-muted text-secondary hover:bg-border-strong"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-2">
            Higher quality = larger file sizes
          </p>
        </div>
      )}

      {/* Preview info */}
      {numPages && numPages > 0 && (
        <div className="bg-surface-subtle rounded-xl p-4">
          <p className="text-sm text-secondary mb-3">
            {numPages} page{numPages !== 1 ? "s" : ""} will be exported as PNG images
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: Math.min(numPages, 4) }, (_, i) => (
              <div
                key={i + 1}
                className="aspect-3/4 bg-surface rounded border border-border flex items-center justify-center text-muted text-sm"
              >
                {i + 1}
              </div>
            ))}
            {numPages > 4 && (
              <div className="aspect-3/4 bg-surface-subtle rounded flex items-center justify-center text-muted text-sm">
                +{numPages - 4}
              </div>
            )}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text={`Rendering pages... ${progress}%`} />
        </div>
      )}

      {state === "error" && (
        <div className="bg-error-bg border border-error-border rounded-lg px-4 py-3 text-error-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {state === "done" && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text">
          Images exported! ZIP download started.
        </div>
      )}

      <Button onClick={handleConvert} disabled={!canProcess} loading={isProcessing} className="w-full">
        Export as Images
      </Button>
    </div>
  );
}

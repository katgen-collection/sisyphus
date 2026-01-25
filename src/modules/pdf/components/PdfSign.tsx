"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  FileText,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PenTool,
  Download,
  Trash2,
  Plus,
} from "lucide-react";
import {
  FileUploader,
  Button,
  downloadUint8Array,
  type AcceptedFile,
} from "@/modules/_shared";
import { usePdfWorker } from "../hooks/usePdfWorker";
import { LoadingSpinner } from "@/components";
import { SignatureCanvas } from "./SignatureCanvas";

// Type for pdfjs-dist
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

// Lazy load PDF.js
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

/** Signature placement information */
interface SignaturePlacement {
  id: string;
  pageIndex: number; // 0-based
  x: number; // percentage of page width
  y: number; // percentage of page height
  width: number; // percentage of page width
  height: number; // percentage of page height
  imageDataUrl: string;
}

/** Page preview data */
interface PagePreview {
  pageIndex: number;
  preview: string;
  width: number;
  height: number;
}

type Step = "upload" | "select-page" | "place-signature" | "draw" | "review";

/**
 * PDF Signing tool - allows users to add signature images to PDF pages.
 */
export function PdfSign() {
  const { state, progress, error, signPdf, reset } = usePdfWorker();

  // Core state
  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [signatures, setSignatures] = useState<SignaturePlacement[]>([]);
  
  // UI state
  const [step, setStep] = useState<Step>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  
  // Signature placement state
  const [placementBox, setPlacementBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [placementStart, setPlacementStart] = useState<{ x: number; y: number } | null>(null);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pdfDocRef.current) pdfDocRef.current.destroy();
      pages.forEach((p) => URL.revokeObjectURL(p.preview));
    };
  }, []);

  const handleFilesAccepted = useCallback(
    async (files: AcceptedFile[]) => {
      const newFile = files[0] ?? null;
      setFile(newFile);
      reset();
      setPreviewError(null);
      setSignatures([]);
      setPlacementBox(null);
      setSelectedPageIndex(0);

      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      pages.forEach((p) => URL.revokeObjectURL(p.preview));
      setPages([]);

      if (!newFile) {
        setStep("upload");
        return;
      }

      setIsLoading(true);
      try {
        const pdfjs = await loadPdfjs();
        const arrayBuffer = await newFile.file.arrayBuffer();
        setPdfData(new Uint8Array(arrayBuffer));
        
        const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        pdfDocRef.current = pdfDoc;

        const nextPages: PagePreview[] = [];
        const scale = 1.5;

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
            pageIndex: i,
            preview: url,
            width: viewport.width,
            height: viewport.height,
          });
        }

        setPages(nextPages);
        setStep("select-page");
      } catch (err) {
        setPreviewError(err instanceof Error ? err.message : "Failed to load PDF");
        setStep("upload");
      } finally {
        setIsLoading(false);
      }
    },
    [pages, reset]
  );

  // Get coordinates from mouse/touch event
  const getEventCoords = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const container = pageContainerRef.current;
      if (!container) return null;

      const rect = container.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      // Convert to percentage of container
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
    },
    []
  );

  const handlePlacementStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const coords = getEventCoords(e);
      if (coords) {
        setIsPlacing(true);
        setPlacementStart(coords);
        setPlacementBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
      }
    },
    [getEventCoords]
  );

  const handlePlacementMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isPlacing || !placementStart) return;
      e.preventDefault();
      const coords = getEventCoords(e);
      if (coords) {
        const x = Math.min(placementStart.x, coords.x);
        const y = Math.min(placementStart.y, coords.y);
        const width = Math.abs(coords.x - placementStart.x);
        const height = Math.abs(coords.y - placementStart.y);
        setPlacementBox({ x, y, width, height });
      }
    },
    [isPlacing, placementStart, getEventCoords]
  );

  const handlePlacementEnd = useCallback(() => {
    setIsPlacing(false);
    setPlacementStart(null);
    // Don't auto-advance - let user confirm the placement box
  }, []);

  const handleSignatureConfirm = useCallback(
    (dataUrl: string) => {
      if (!placementBox) return;

      const newSignature: SignaturePlacement = {
        id: `sig-${Date.now()}`,
        pageIndex: selectedPageIndex,
        x: placementBox.x,
        y: placementBox.y,
        width: placementBox.width,
        height: placementBox.height,
        imageDataUrl: dataUrl,
      };

      setSignatures((prev) => [...prev, newSignature]);
      setPlacementBox(null);
      setStep("review");
    },
    [placementBox, selectedPageIndex]
  );

  const handleRemoveSignature = useCallback((id: string) => {
    setSignatures((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!file || !pdfData || signatures.length === 0) return;

    try {
      // Generate output filename from original
      const originalName = file.file.name.replace(/\.pdf$/i, "");
      const outputName = `${originalName}_signed.pdf`;
      
      const result = await signPdf(pdfData, signatures, outputName);
      if (result) {
        downloadUint8Array(result.data, result.filename, "application/pdf");
      }
    } catch (err) {
      console.error(err);
    }
  }, [file, pdfData, signatures, signPdf]);

  const handleBack = useCallback(() => {
    switch (step) {
      case "select-page":
        setFile(null);
        setPdfData(null);
        pages.forEach((p) => URL.revokeObjectURL(p.preview));
        setPages([]);
        setSignatures([]);
        setStep("upload");
        break;
      case "place-signature":
        setPlacementBox(null);
        setStep("select-page");
        break;
      case "draw":
        setPlacementBox(null);
        setStep("place-signature");
        break;
      case "review":
        setStep("select-page");
        break;
    }
  }, [step, pages]);

  const isProcessing = state === "processing";
  const currentPage = pages[selectedPageIndex];
  const pageSignatures = signatures.filter((s) => s.pageIndex === selectedPageIndex);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      {step !== "upload" && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="text-stone-400">
            {step === "select-page" && "Select a page to sign"}
            {step === "place-signature" && (placementBox && placementBox.width > 5 ? "Confirm placement or redraw" : "Draw a box where you want to sign")}
            {step === "draw" && "Draw your signature"}
            {step === "review" && `${signatures.length} signature${signatures.length !== 1 ? "s" : ""} added`}
          </div>
        </div>
      )}

      {/* Upload step */}
      {step === "upload" && (
        <FileUploader
          accept=".pdf"
          onFilesAccepted={handleFilesAccepted}
          disabled={isProcessing || isLoading}
        >
          {isLoading ? (
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto text-stone-400 animate-spin mb-2" />
              <p className="text-stone-500">Loading PDF...</p>
            </div>
          ) : undefined}
        </FileUploader>
      )}

      {/* Page selection step */}
      {step === "select-page" && pages.length > 0 && (
        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg">
            <FileText className="w-5 h-5 text-stone-500" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-700 truncate">{file?.file.name}</p>
              <p className="text-xs text-stone-400">{pages.length} page{pages.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {/* Page grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pages.map((page, idx) => {
              const hasSignatures = signatures.some((s) => s.pageIndex === idx);
              return (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedPageIndex(idx);
                    setStep("place-signature");
                  }}
                  className={`
                    relative aspect-3/4 rounded-lg overflow-hidden border-2 transition-all
                    ${hasSignatures
                      ? "border-emerald-400 ring-2 ring-emerald-100"
                      : "border-stone-200 hover:border-stone-400"
                    }
                  `}
                >
                  <img
                    src={page.preview}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain bg-white"
                  />
                  <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-stone-900/70 text-white text-xs">
                    {idx + 1}
                  </div>
                  {hasSignatures && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <PenTool className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          {signatures.length > 0 && (
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setSignatures([])}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
              <Button onClick={handleDownload} disabled={isProcessing} loading={isProcessing} className="flex-1">
                <Download className="w-4 h-4" />
                Download Signed PDF
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Signature placement step */}
      {step === "place-signature" && currentPage && (
        <div className="space-y-4">
          {/* Page navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedPageIndex((i) => Math.max(0, i - 1))}
              disabled={selectedPageIndex === 0}
              className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-stone-500">
              Page {selectedPageIndex + 1} of {pages.length}
            </span>
            <button
              onClick={() => setSelectedPageIndex((i) => Math.min(pages.length - 1, i + 1))}
              disabled={selectedPageIndex === pages.length - 1}
              className="p-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Page with placement overlay - properly sized container */}
          <div className="flex justify-center">
            <div
              ref={pageContainerRef}
              className="relative bg-white rounded-lg shadow-lg overflow-hidden select-none touch-none"
              style={{
                width: "100%",
                maxWidth: Math.min(600, currentPage.width),
                aspectRatio: `${currentPage.width} / ${currentPage.height}`,
              }}
              onMouseDown={handlePlacementStart}
              onMouseMove={handlePlacementMove}
              onMouseUp={handlePlacementEnd}
              onMouseLeave={handlePlacementEnd}
              onTouchStart={handlePlacementStart}
              onTouchMove={handlePlacementMove}
              onTouchEnd={handlePlacementEnd}
            >
              <img
                src={currentPage.preview}
                alt={`Page ${selectedPageIndex + 1}`}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

            {/* Existing signatures on this page */}
            {pageSignatures.map((sig) => (
              <div
                key={sig.id}
                className="absolute border-2 border-emerald-400 bg-emerald-50/50 pointer-events-none"
                style={{
                  left: `${sig.x}%`,
                  top: `${sig.y}%`,
                  width: `${sig.width}%`,
                  height: `${sig.height}%`,
                }}
              >
                <img
                  src={sig.imageDataUrl}
                  alt="Signature"
                  className="w-full h-full object-contain"
                />
              </div>
            ))}

            {/* Current placement box */}
            {placementBox && placementBox.width > 0 && placementBox.height > 0 && (
              <div
                className="absolute border-2 border-dashed border-stone-600 bg-stone-200/30"
                style={{
                  left: `${placementBox.x}%`,
                  top: `${placementBox.y}%`,
                  width: `${placementBox.width}%`,
                  height: `${placementBox.height}%`,
                }}
              />
            )}

            {/* Overlay hint */}
            {!isPlacing && !placementBox && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900/10 pointer-events-none">
                <div className="px-4 py-2 rounded-lg bg-white/90 text-stone-600 text-sm shadow-lg">
                  Click and drag to place signature
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Existing signatures list */}
          {pageSignatures.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-stone-500">Signatures on this page:</p>
              <div className="flex flex-wrap gap-2">
                {pageSignatures.map((sig, idx) => (
                  <div
                    key={sig.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg"
                  >
                    <PenTool className="w-3 h-3 text-emerald-600" />
                    <span className="text-sm text-emerald-700">Signature {idx + 1}</span>
                    <button
                      onClick={() => handleRemoveSignature(sig.id)}
                      className="ml-1 p-0.5 rounded hover:bg-emerald-200 text-emerald-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {placementBox && placementBox.width > 5 && placementBox.height > 3 ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => setPlacementBox(null)}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Box
                </Button>
                <Button
                  onClick={() => setStep("draw")}
                  className="flex-1"
                >
                  <PenTool className="w-4 h-4" />
                  Draw Signature
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setStep("review")}
                disabled={signatures.length === 0}
                className="w-full"
              >
                Done Adding Signatures
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Draw signature step (modal-like) */}
      {step === "draw" && placementBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-stone-800 text-center mb-4">
              Draw Your Signature
            </h3>
            <SignatureCanvas
              aspectRatio={placementBox.width / placementBox.height}
              onConfirm={handleSignatureConfirm}
              onCancel={() => {
                setPlacementBox(null);
                setStep("place-signature");
              }}
            />
          </div>
        </div>
      )}

      {/* Review step */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <PenTool className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-800">
                  {signatures.length} signature{signatures.length !== 1 ? "s" : ""} ready
                </p>
                <p className="text-sm text-emerald-600">
                  On {new Set(signatures.map((s) => s.pageIndex)).size} page{new Set(signatures.map((s) => s.pageIndex)).size !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* Summary of signed pages */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {pages.map((page, idx) => {
              const sigs = signatures.filter((s) => s.pageIndex === idx);
              if (sigs.length === 0) return null;
              return (
                <div
                  key={idx}
                  className="relative aspect-3/4 rounded-lg overflow-hidden border-2 border-emerald-300"
                >
                  <img
                    src={page.preview}
                    alt={`Page ${idx + 1}`}
                    className="w-full h-full object-contain bg-white"
                  />
                  <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-emerald-500 text-white text-xs">
                    {sigs.length} sig{sigs.length !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep("select-page")}
              className="flex-1"
            >
              <Plus className="w-4 h-4" />
              Add More
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isProcessing || signatures.length === 0}
              loading={isProcessing}
              className="flex-1"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && step === "upload" && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading PDF..." />
        </div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text={`Applying signatures... ${progress}%`} />
        </div>
      )}

      {/* Error display */}
      {(state === "error" || previewError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error || previewError}
        </div>
      )}

      {/* Success message */}
      {state === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
          PDF signed successfully! Download started.
        </div>
      )}
    </div>
  );
}

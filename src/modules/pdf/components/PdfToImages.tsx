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

// Type for pdfjs-dist (we'll import it dynamically)
type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => void;
};

type PDFPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> };
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
      >
        {file ? (
          <div className="text-center">
            <div className="mb-2 w-12 h-12 mx-auto rounded-lg bg-stone-200 flex items-center justify-center">
              <FileText className="w-6 h-6 text-stone-600" />
            </div>
            <p className="text-stone-700 font-medium truncate max-w-xs">{file.file.name}</p>
            {isLoading ? (
              <p className="text-stone-400 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading...
              </p>
            ) : numPages ? (
              <p className="text-stone-400 text-sm">{numPages} page{numPages !== 1 ? "s" : ""}</p>
            ) : null}
          </div>
        ) : undefined}
      </FileUploader>

      {/* Scale selector */}
      {file && numPages && (
        <div className="bg-stone-50 rounded-xl p-5">
          <label className="block text-sm font-medium text-stone-700 mb-2">
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
                    ? "bg-stone-800 text-stone-50"
                    : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Higher quality = larger file sizes
          </p>
        </div>
      )}

      {/* Preview info */}
      {numPages && numPages > 0 && (
        <div className="bg-stone-50 rounded-xl p-4">
          <p className="text-sm text-stone-500 mb-3">
            {numPages} page{numPages !== 1 ? "s" : ""} will be exported as PNG images
          </p>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: Math.min(numPages, 4) }, (_, i) => (
              <div
                key={i + 1}
                className="aspect-3/4 bg-white rounded border border-stone-200 flex items-center justify-center text-stone-400 text-sm"
              >
                {i + 1}
              </div>
            ))}
            {numPages > 4 && (
              <div className="aspect-3/4 bg-stone-100 rounded flex items-center justify-center text-stone-400 text-sm">
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
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {state === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
          Images exported! ZIP download started.
        </div>
      )}

      <Button onClick={handleConvert} disabled={!canProcess} loading={isProcessing} className="w-full">
        Export as Images
      </Button>
    </div>
  );
}

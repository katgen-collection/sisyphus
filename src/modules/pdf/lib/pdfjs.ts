/**
 * Shared PDF.js loader for the PDF preview tools.
 *
 * pdf.js is loaded once from a CDN script and memoized on the module, so all
 * four preview-based tools (merge, edit, sign, to-images) share a single
 * instance and worker rather than each shipping its own copy of this glue.
 */

const PDFJS_VERSION = "2.16.105";
const PDFJS_SCRIPT = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.min.js`;
const PDFJS_WORKER = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.worker.min.js`;

export type PDFPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

export type PDFDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  destroy: () => void;
};

export type PDFJSLib = {
  getDocument: (params: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> };
  GlobalWorkerOptions: { workerSrc: string };
};

let pdfjsLib: PDFJSLib | null = null;
let pdfjsLoading: Promise<PDFJSLib> | null = null;

export async function loadPdfjs(): Promise<PDFJSLib> {
  if (typeof window === "undefined") {
    throw new Error("PDF rendering is only available in the browser");
  }
  if (pdfjsLib) return pdfjsLib;
  if (pdfjsLoading) return pdfjsLoading;

  pdfjsLoading = new Promise<PDFJSLib>((resolve, reject) => {
    const existing = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
    if (existing) {
      existing.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      pdfjsLib = existing;
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PDFJSLib }).pdfjsLib;
      if (!lib) {
        reject(new Error("PDF.js failed to load"));
        return;
      }
      lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      pdfjsLib = lib;
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Failed to load PDF.js"));
    document.head.appendChild(script);
  });

  return pdfjsLoading;
}

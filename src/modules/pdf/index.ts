// PDF module barrel export

export { PdfTools } from "./components/PdfTools";
export { PdfCompress } from "./components/PdfCompress";
export { ImagesToPdf } from "./components/ImagesToPdf";
export { PdfEdit } from "./components/PdfEdit";
export { PdfSign } from "./components/PdfSign";
export { SignatureCanvas } from "./components/SignatureCanvas";
// Note: PdfToImages uses pdfjs-dist which requires client-side only
// Import it dynamically: dynamic(() => import("@/modules/pdf/components/PdfToImages"))

export { usePdfWorker } from "./hooks/usePdfWorker";
export { getPdfWorker, terminatePdfWorker } from "./workerClient";

export type { ImageFile, PdfOptimizeOptions, PdfResult, PdfWorkerAPI, SignaturePlacement } from "./types";

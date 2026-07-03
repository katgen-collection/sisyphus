/** Result from PDF operations */
export interface PdfResult {
  data: Uint8Array;
  filename: string;
}

/** Image-compression aggressiveness for the Compress tool */
export type PdfCompressionLevel = "light" | "balanced" | "maximum";

/** Why an image was left untouched during compression */
export type PdfSkipReason =
  | "unsupported-filter"
  | "transparency"
  | "predictor"
  | "colorspace"
  | "not-smaller";

/** Count + bytes of images skipped for a given reason */
export interface PdfSkipTally {
  reason: PdfSkipReason;
  count: number;
  bytes: number;
}

/** Per-run stats reported back from image compression */
export interface PdfCompressionStats {
  imagesTotal: number;
  duplicatesRemoved: number;
  imagesEligible: number;
  imagesRecompressed: number;
  originalSize: number;
  compressedSize: number;
  skipped: PdfSkipTally[];
}

/** Result from the image-compression operation */
export interface PdfCompressResult extends PdfResult {
  stats: PdfCompressionStats;
}

/** Signature placement information for PDF signing */
export interface SignaturePlacement {
  id: string;
  pageIndex: number; // 0-based page index
  x: number; // percentage of page width (0-100)
  y: number; // percentage of page height (0-100)
  width: number; // percentage of page width
  height: number; // percentage of page height
  imageDataUrl: string; // base64 PNG data URL
}

/** Text annotation for PDF */
export interface TextAnnotation {
  type: "text";
  id: string;
  text: string;
  pageIndex: number;
  x: number; // percentage
  y: number; // percentage
  size?: number;
  color?: string; // hex
  font?: string;
}

/** Image annotation for PDF */
export interface ImageAnnotation {
  type: "image";
  id: string;
  imageData: Uint8Array;
  pageIndex: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

export type PdfAnnotation = TextAnnotation | ImageAnnotation;

/** Source file info for merging */
export interface MergePageSource {
  fileId: string;
  fileIndex: number;
  pageIndex: number;
}

/** PDF worker API exposed via Comlink */
export interface PdfWorkerAPI {
  /**
   * Compresses a PDF by recompressing its embedded images in place.
   * Text and vectors are preserved; unsupported images are left untouched.
   */
  compressImages: (
    pdfData: Uint8Array,
    level: PdfCompressionLevel
  ) => Promise<PdfCompressResult>;

  /**
   * Converts multiple images into a single PDF.
   * Images should be sorted by desired page order.
   */
  imagesToPdf: (
    images: Array<{ data: Uint8Array; name: string; type: string }>,
    outputName?: string
  ) => Promise<PdfResult>;

  /**
  * Merges pages from multiple PDFs in a specific order.
  */
  mergeDocuments: (
    sources: Uint8Array[], // Array of source PDF files
    pages: MergePageSource[], // Ordered list of pages to include
    outputName?: string
  ) => Promise<PdfResult>;

  /**
   * Adds signature images to a PDF at specified locations.
   */
  addSignatures: (
    pdfData: Uint8Array,
    signatures: Array<{
      pageIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      imageData: Uint8Array;
    }>,
    outputName?: string
  ) => Promise<PdfResult>;

  /**
   * Adds text and image annotations to a PDF.
   */
  annotatePdf: (
    pdfData: Uint8Array,
    annotations: PdfAnnotation[],
    outputName?: string
  ) => Promise<PdfResult>;
}

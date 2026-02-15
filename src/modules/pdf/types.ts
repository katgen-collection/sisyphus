/** Image file with sorting order for images-to-PDF */
export interface ImageFile {
  file: File;
  id: string;
  order: number;
  preview?: string;
}

/** PDF optimization options */
export interface PdfOptimizeOptions {
  removeMetadata?: boolean;
  flattenForms?: boolean;
}

/** Result from PDF operations */
export interface PdfResult {
  data: Uint8Array;
  filename: string;
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
   * Optimizes a PDF by removing metadata and flattening forms.
   */
  optimize: (
    pdfData: Uint8Array,
    options?: PdfOptimizeOptions
  ) => Promise<PdfResult>;

  /**
   * Converts multiple images into a single PDF.
   * Images should be sorted by desired page order.
   */
  imagesToPdf: (
    images: Array<{ data: Uint8Array; name: string; type: string }>,
    outputName?: string
  ) => Promise<PdfResult>;

  /**
   * Reorders PDF pages by index.
   * Order is a 0-based array of page indices.
   */
  reorderPages: (
    pdfData: Uint8Array,
    order: number[],
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

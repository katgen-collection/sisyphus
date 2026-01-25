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
}

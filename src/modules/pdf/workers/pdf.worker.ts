import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as Comlink from "comlink";
import { compressPdfImages, type CompressionStats } from "./imageCompression";
import { encodeImage } from "./imageCodec";

/**
 * PDF processing worker.
 * Handles pdf-lib operations off the main thread.
 */

// Inline types to avoid module resolution issues in worker context
interface PdfOptimizeOptions {
  removeMetadata?: boolean;
  flattenForms?: boolean;
}

interface PdfResult {
  data: Uint8Array;
  filename: string;
}

/** Image-compression aggressiveness, mapped to size cap + JPEG quality. */
type PdfCompressionLevel = "light" | "balanced" | "maximum";

const COMPRESSION_LEVELS: Record<
  PdfCompressionLevel,
  { maxEdge: number; quality: number }
> = {
  light: { maxEdge: 1800, quality: 0.78 },
  balanced: { maxEdge: 1400, quality: 0.65 },
  maximum: { maxEdge: 1000, quality: 0.5 },
};

interface PdfCompressResult extends PdfResult {
  stats: CompressionStats;
}

interface ImageInput {
  data: Uint8Array;
  name: string;
  type: string;
}

interface SignatureInput {
  pageIndex: number;
  x: number;
  y: number;
  width: number; // percentage
  height: number; // percentage
  imageData: Uint8Array;
}

interface TextAnnotation {
  type: "text";
  id: string;
  text: string;
  pageIndex: number;
  x: number;
  y: number;
  size?: number;
  color?: string;
  font?: string;
}

interface ImageAnnotation {
  type: "image";
  id: string;
  imageData: Uint8Array;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

type PdfAnnotation = TextAnnotation | ImageAnnotation;

interface MergePageSource {
  fileId: string;
  fileIndex: number;
  pageIndex: number;
}

interface PdfWorkerAPI {
  optimize: (pdfData: Uint8Array, options?: PdfOptimizeOptions) => Promise<PdfResult>;
  compressImages: (pdfData: Uint8Array, level: PdfCompressionLevel) => Promise<PdfCompressResult>;
  imagesToPdf: (images: ImageInput[], outputName?: string) => Promise<PdfResult>;
  reorderPages: (pdfData: Uint8Array, order: number[], outputName?: string) => Promise<PdfResult>;
  mergeDocuments: (sources: Uint8Array[], pages: MergePageSource[], outputName?: string) => Promise<PdfResult>;
  addSignatures: (pdfData: Uint8Array, signatures: SignatureInput[], outputName?: string) => Promise<PdfResult>;
  annotatePdf: (pdfData: Uint8Array, annotations: PdfAnnotation[], outputName?: string) => Promise<PdfResult>;
}

const api: PdfWorkerAPI = {
  async optimize(
    pdfData: Uint8Array,
    options: PdfOptimizeOptions = {}
  ): Promise<PdfResult> {
    const { removeMetadata = true, flattenForms = true } = options;

    const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });

    if (removeMetadata) {
      doc.setTitle("");
      doc.setAuthor("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setProducer("");
      doc.setCreator("");
    }

    if (flattenForms) {
      const form = doc.getForm();
      try {
        form.flatten();
      } catch {
        // Form might not exist—ignore
      }
    }

    const optimized = await doc.save();

    return {
      data: optimized,
      filename: "optimized.pdf",
    };
  },

  async compressImages(
    pdfData: Uint8Array,
    level: PdfCompressionLevel = "balanced"
  ): Promise<PdfCompressResult> {
    const params = COMPRESSION_LEVELS[level] ?? COMPRESSION_LEVELS.balanced;
    const { data, stats } = await compressPdfImages(pdfData, params, encodeImage);

    return {
      data,
      filename: "compressed.pdf",
      stats,
    };
  },

  async imagesToPdf(
    images: ImageInput[],
    outputName: string = "images.pdf"
  ): Promise<PdfResult> {
    const doc = await PDFDocument.create();

    for (const img of images) {
      let embedded;

      if (img.type === "image/png") {
        embedded = await doc.embedPng(img.data);
      } else if (img.type === "image/jpeg" || img.type === "image/jpg") {
        embedded = await doc.embedJpg(img.data);
      } else {
        console.warn(`Skipping unsupported image format: ${img.type}`);
        continue;
      }

      const page = doc.addPage([embedded.width, embedded.height]);

      page.drawImage(embedded, {
        x: 0,
        y: 0,
        width: embedded.width,
        height: embedded.height,
      });
    }

    const pdfBytes = await doc.save();

    return {
      data: pdfBytes,
      filename: outputName,
    };
  },

  async reorderPages(
    pdfData: Uint8Array,
    order: number[],
    outputName: string = "reordered.pdf"
  ): Promise<PdfResult> {
    const sourceDoc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    const resultDoc = await PDFDocument.create();

    const copied = await resultDoc.copyPages(sourceDoc, order);
    copied.forEach((page) => resultDoc.addPage(page));

    const pdfBytes = await resultDoc.save();

    return {
      data: pdfBytes,
      filename: outputName,
    };
  },

  async addSignatures(
    pdfData: Uint8Array,
    signatures: SignatureInput[],
    outputName: string = "signed.pdf"
  ): Promise<PdfResult> {
    const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    const pages = doc.getPages();

    for (const sig of signatures) {
      const page = pages[sig.pageIndex];
      if (!page) continue;

      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Embed the signature image (PNG)
      const signatureImage = await doc.embedPng(sig.imageData);

      // Convert percentages to actual coordinates
      // Note: PDF coordinates start from bottom-left, so we need to flip Y
      const x = (sig.x / 100) * pageWidth;
      const width = (sig.width / 100) * pageWidth;
      const height = (sig.height / 100) * pageHeight;
      // Y is from top in our UI but from bottom in PDF
      const y = pageHeight - (sig.y / 100) * pageHeight - height;

      // Draw the signature on the page
      page.drawImage(signatureImage, {
        x,
        y,
        width,
        height,
      });
    }

    const pdfBytes = await doc.save();

    return {
      data: pdfBytes,
      filename: outputName,
    };
  },
  async mergeDocuments(
    sources: Uint8Array[],
    pages: MergePageSource[],
    outputName: string = "merged.pdf"
  ): Promise<PdfResult> {
    const resultDoc = await PDFDocument.create();

    // Load all source documents
    const sourceDocs = await Promise.all(
      sources.map(src => PDFDocument.load(src, { ignoreEncryption: true }))
    );

    // Copy pages based on the order
    // We can optimization by grouping pages by source document to reduce copyPages calls
    // But for simplicity and correctness with arbitrary order, we can just iterate.
    // Actually, copyPages is much more efficient if done in batches.

    // Naïve approach might be slow if many switches between docs.
    // Better:
    // 1. Group pages by source doc index: Map<docIndex, pageIndices[]>
    // 2. Copy all needed pages from each doc to the resultDoc (they become "embedded")
    // 3. Add them to the resultDoc in the correct order.
    // BUT pdf-lib copyPages returns IPDFPage[] which are not yet added. We can hold them.

    // Let's stick to a simpler approach first, pdf-lib copyPages allows copying multiple indices at once.
    // We can't really "hold" them easily without managing indices.

    // Let's try:
    // For each item in `pages`:
    //   sourceDoc = sourceDocs[item.fileIndex]
    //   [copiedPage] = await resultDoc.copyPages(sourceDoc, [item.pageIndex])
    //   resultDoc.addPage(copiedPage)

    for (const p of pages) {
      if (p.fileIndex < 0 || p.fileIndex >= sourceDocs.length) continue;
      const srcDoc = sourceDocs[p.fileIndex];
      const [copiedPage] = await resultDoc.copyPages(srcDoc, [p.pageIndex]);
      resultDoc.addPage(copiedPage);
    }

    const pdfBytes = await resultDoc.save();
    return {
      data: pdfBytes,
      filename: outputName,
    };
  },

  async annotatePdf(
    pdfData: Uint8Array,
    annotations: PdfAnnotation[],
    outputName: string = "annotated.pdf"
  ): Promise<PdfResult> {
    const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
    const pages = doc.getPages();
    const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);

    for (const ann of annotations) {
      const page = pages[ann.pageIndex];
      if (!page) continue;

      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (ann.type === "text") {
        const x = (ann.x / 100) * pageWidth;
        // PDF Y is from bottom
        // We need to estimate text height to position reasonably, but for now let's assume baseline.
        // If UI sends top-left coordinate, we need to adjust.
        // Assuming UI sends top-left.
        // pdf-lib drawText y is the baseline. 
        const fontSize = ann.size || 12;
        const y = pageHeight - (ann.y / 100) * pageHeight - fontSize; // approximate top alignment

        page.drawText(ann.text, {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: ann.color ? hexToRgb(ann.color) : undefined,
        });
      } else if (ann.type === "image") {
        // Embed the image
        let image;
        try {
          // Try PNG first (most common for signatures/transparent images)
          image = await doc.embedPng(ann.imageData);
        } catch {
          // Fallback to JPG
          try {
            image = await doc.embedJpg(ann.imageData);
          } catch (e) {
            console.warn("Failed to embed image annotation", e);
            continue;
          }
        }

        const x = (ann.x / 100) * pageWidth;
        const w = (ann.width / 100) * pageWidth;
        const h = (ann.height / 100) * pageHeight;
        // Y from top
        const y = pageHeight - (ann.y / 100) * pageHeight - h;

        page.drawImage(image, {
          x,
          y,
          width: w,
          height: h,
        });
      }
    }

    const pdfBytes = await doc.save();
    return {
      data: pdfBytes,
      filename: outputName,
    };
  },
};

// Helper to convert hex to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    )
    : undefined;
}


Comlink.expose(api);

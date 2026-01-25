import { PDFDocument } from "pdf-lib";
import * as Comlink from "comlink";

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

interface ImageInput {
  data: Uint8Array;
  name: string;
  type: string;
}

interface SignatureInput {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: Uint8Array;
}

interface PdfWorkerAPI {
  optimize: (pdfData: Uint8Array, options?: PdfOptimizeOptions) => Promise<PdfResult>;
  imagesToPdf: (images: ImageInput[], outputName?: string) => Promise<PdfResult>;
  reorderPages: (pdfData: Uint8Array, order: number[], outputName?: string) => Promise<PdfResult>;
  addSignatures: (pdfData: Uint8Array, signatures: SignatureInput[], outputName?: string) => Promise<PdfResult>;
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
};

Comlink.expose(api);

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

interface PdfWorkerAPI {
  optimize: (pdfData: Uint8Array, options?: PdfOptimizeOptions) => Promise<PdfResult>;
  imagesToPdf: (images: ImageInput[], outputName?: string) => Promise<PdfResult>;
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
};

Comlink.expose(api);

import JSZip from "jszip";
import { downloadArrayBuffer, downloadBlob } from "@/modules/_shared";
import { IMAGE_LIMITS } from "../types";
import type { ImageBatchResult } from "../types";

export function downloadResult(result: ImageBatchResult): void {
  downloadArrayBuffer(result.data, result.filename, result.mimeType);
}

export async function downloadResultZip(results: ImageBatchResult[]): Promise<void> {
  if (results.length === 0) throw new Error("There are no converted images to download.");
  let total = 0;
  for (const result of results) {
    total += result.outputBytes;
    if (!Number.isSafeInteger(total) || total > IMAGE_LIMITS.maxZipBytes) {
      throw new Error("Combined results exceed the 100 MiB ZIP limit. Download the images individually.");
    }
  }
  const zip = new JSZip();
  for (const result of results) zip.file(result.filename, result.data);
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
  downloadBlob(blob, "sisyphus-images.zip");
}

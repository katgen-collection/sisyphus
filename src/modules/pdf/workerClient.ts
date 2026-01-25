import * as Comlink from "comlink";
import type { PdfWorkerAPI } from "./types";

let worker: Worker | null = null;
let proxy: Comlink.Remote<PdfWorkerAPI> | null = null;

/**
 * Creates or returns existing PDF worker instance.
 */
export function getPdfWorker(): Comlink.Remote<PdfWorkerAPI> {
  if (proxy) return proxy;

  worker = new Worker(new URL("./workers/pdf.worker.ts", import.meta.url), {
    type: "module",
  });

  proxy = Comlink.wrap<PdfWorkerAPI>(worker);
  return proxy;
}

/**
 * Terminates the PDF worker and cleans up.
 */
export function terminatePdfWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  proxy = null;
}

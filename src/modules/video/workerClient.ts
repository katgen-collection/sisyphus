import * as Comlink from "comlink";
import type { FFmpegWorkerAPI } from "./types";

let worker: Worker | null = null;
let proxy: Comlink.Remote<FFmpegWorkerAPI> | null = null;

/**
 * Creates or returns existing FFmpeg worker instance.
 * Singleton
 */
export function getFFmpegWorker(): Comlink.Remote<FFmpegWorkerAPI> {
  if (proxy) return proxy;

  worker = new Worker(new URL("./workers/ffmpeg.worker.ts", import.meta.url), {
    type: "module",
  });

  proxy = Comlink.wrap<FFmpegWorkerAPI>(worker);
  return proxy;
}

/**
 * Terminates the worker and cleans up.
 */
export function terminateFFmpegWorker(): void {
  if (proxy) {
    proxy.terminate();
  }
  if (worker) {
    worker.terminate();
    worker = null;
  }
  proxy = null;
}

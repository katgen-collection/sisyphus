import * as Comlink from "comlink";
import type { ImageWorkerAPI } from "./types";

let worker: Worker | null = null;
let proxy: Comlink.Remote<ImageWorkerAPI> | null = null;

export function getImageWorker(): Comlink.Remote<ImageWorkerAPI> {
  if (proxy) return proxy;
  worker = new Worker(new URL("./workers/image.worker.ts", import.meta.url), { type: "module" });
  proxy = Comlink.wrap<ImageWorkerAPI>(worker);
  return proxy;
}

export function terminateImageWorker(): void {
  worker?.terminate();
  worker = null;
  proxy = null;
}

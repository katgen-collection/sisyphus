import type { AcceptedFile } from "@/modules/_shared";

export const IMAGE_INPUT_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif";

export const IMAGE_LIMITS = {
  maxSourceBytes: 100 * 1024 * 1024,
  maxPixels: 50_000_000,
  maxEdge: 16_384,
  maxAvifPixels: 24_000_000,
  maxZipBytes: 100 * 1024 * 1024,
} as const;

export type ImageInputFormat = "jpeg" | "png" | "webp" | "avif";
export type ImageOutputFormat = "jpeg" | "png" | "webp" | "avif";
export type ImageOutputMime = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
export type ImageOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ResizeMode = "none" | "percentage" | "dimensions";
export type ResizeFit = "contain" | "cover" | "stretch";

export interface ResizeOptions {
  mode: ResizeMode;
  percentage: number;
  width: number | null;
  height: number | null;
  maintainAspectRatio: boolean;
  fit: ResizeFit;
  preventUpscale: boolean;
}

export interface ImageOptions {
  outputFormat: ImageOutputFormat;
  quality: number;
  jpegMatte: string;
  resize: ResizeOptions;
  crop: PixelCrop | null;
}

export const IMAGE_DEFAULT_OPTIONS: Readonly<ImageOptions> = {
  outputFormat: "jpeg",
  quality: 85,
  jpegMatte: "#ffffff",
  resize: {
    mode: "none",
    percentage: 100,
    width: null,
    height: null,
    maintainAspectRatio: true,
    fit: "contain",
    preventUpscale: true,
  },
  crop: null,
};

export type ImageStage =
  | "queued"
  | "validating"
  | "decoding"
  | "orienting"
  | "cropping"
  | "resizing"
  | "encoding"
  | "finalizing"
  | "complete"
  | "failed"
  | "cancelled";

export type ImageErrorCode =
  | "empty-input"
  | "source-too-large"
  | "unsupported-input"
  | "unsupported-sequence"
  | "invalid-input"
  | "image-too-large"
  | "unsupported-browser"
  | "decode-failed"
  | "encode-failed"
  | "cancelled";

export interface SerializedImageError {
  code: ImageErrorCode;
  message: string;
}

export interface ImageWorkerInput {
  source: ArrayBuffer;
  sourceName: string;
  declaredMimeType: string;
  options: ImageOptions;
}

export interface ImageWorkerResult {
  data: ArrayBuffer;
  mimeType: ImageOutputMime;
  inputBytes: number;
  outputBytes: number;
  width: number;
  height: number;
  warning?: string;
}

export type ImageWorkerResponse =
  | { ok: true; result: ImageWorkerResult }
  | { ok: false; error: SerializedImageError };

export type ImageProgressCallback = (stage: ImageStage) => void;

export interface ImageWorkerAPI {
  processImage(
    input: ImageWorkerInput,
    onProgress?: ImageProgressCallback
  ): Promise<ImageWorkerResponse>;
}

export interface ImageBatchResult extends ImageWorkerResult {
  filename: string;
}

export interface ImageBatchItem {
  id: string;
  file: File;
  stage: ImageStage;
  progress: number;
  crop: PixelCrop | null;
  sourceDimensions: { width: number; height: number } | null;
  result: ImageBatchResult | null;
  error: SerializedImageError | null;
}

export type ImageBatchState = "idle" | "processing" | "creating-zip" | "done" | "done-with-errors";

export interface UseImageBatchReturn {
  items: ImageBatchItem[];
  state: ImageBatchState;
  progress: number;
  activeItemId: string | null;
  batchError: string | null;
  addFiles(files: AcceptedFile[]): void;
  removeItem(id: string): void;
  setItemCrop(id: string, crop: PixelCrop | null): void;
  setSourceDimensions(id: string, dimensions: { width: number; height: number }): void;
  process(options: Omit<ImageOptions, "crop">): Promise<void>;
  downloadItem(id: string): void;
  downloadAll(): Promise<void>;
  reset(): void;
}

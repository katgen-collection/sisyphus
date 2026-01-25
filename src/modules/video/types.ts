/** Supported input video formats */
export const VIDEO_INPUT_FORMATS = ["mp4", "mkv", "mov", "avi"] as const;
export type VideoInputFormat = (typeof VIDEO_INPUT_FORMATS)[number];

/** Supported output video formats */
export const VIDEO_OUTPUT_FORMATS = ["mp4", "gif"] as const;
export type VideoOutputFormat = (typeof VIDEO_OUTPUT_FORMATS)[number];

/** Preset resolution options */
export const RESOLUTION_PRESETS = {
  "720p": { width: -1, height: 720, label: "720p HD" },
  "1080p": { width: -1, height: 1080, label: "1080p Full HD" },
  "4k": { width: -1, height: 2160, label: "4K Ultra HD" },
  custom: { width: 0, height: 0, label: "Custom" },
} as const;
export type ResolutionPreset = keyof typeof RESOLUTION_PRESETS;

/** Compression quality levels (CRF values—lower = better quality) */
export const COMPRESSION_LEVELS = {
  low: { crf: 18, label: "Low (Best Quality)", description: "Minimal compression" },
  medium: { crf: 23, label: "Medium (Balanced)", description: "Good balance" },
  high: { crf: 28, label: "High (Smaller File)", description: "Maximum compression" },
} as const;
export type CompressionLevel = keyof typeof COMPRESSION_LEVELS;

/** Video conversion job configuration */
export interface VideoConversionJob {
  inputFile: File;
  outputFormat: VideoOutputFormat;
  resolution?: { width: number; height: number };
  compression?: CompressionLevel;
}

/** Progress event from worker */
export interface FFmpegProgress {
  ratio: number; // 0-1
  time?: number; // seconds processed
}

/** Result from video conversion */
export interface ConversionResult {
  data: Uint8Array;
  outputName: string;
  mimeType: string;
}

/** FFmpeg worker API exposed via Comlink */
export interface FFmpegWorkerAPI {
  load: () => Promise<void>;
  isLoaded: () => boolean;
  convert: (
    inputData: Uint8Array,
    inputName: string,
    outputFormat: VideoOutputFormat,
    options?: {
      resolution?: { width: number; height: number };
      compression?: CompressionLevel;
      fps?: number;
    },
    onProgress?: (progress: FFmpegProgress) => void,
    onLog?: (message: string) => void
  ) => Promise<ConversionResult>;
  terminate: () => void;
}

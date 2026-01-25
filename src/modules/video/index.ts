// Video module barrel export

export { VideoConverter } from "./components/VideoConverter";
export { VideoToolShell } from "./components/VideoToolShell";
export { useFFmpegWorker } from "./hooks/useFFmpegWorker";
export { getFFmpegWorker, terminateFFmpegWorker } from "./workerClient";

export {
  VIDEO_INPUT_FORMATS,
  VIDEO_OUTPUT_FORMATS,
  RESOLUTION_PRESETS,
  COMPRESSION_LEVELS,
} from "./types";

export type {
  VideoInputFormat,
  VideoOutputFormat,
  ResolutionPreset,
  CompressionLevel,
  VideoConversionJob,
  FFmpegProgress,
  ConversionResult,
  FFmpegWorkerAPI,
} from "./types";

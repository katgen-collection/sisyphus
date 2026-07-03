// Video module barrel export

export { VideoConverter } from "./components/VideoConverter";
export { useFFmpegWorker } from "./hooks/useFFmpegWorker";
export { getFFmpegWorker, terminateFFmpegWorker } from "./workerClient";

export {
  VIDEO_INPUT_FORMATS,
  VIDEO_OUTPUT_FORMATS,
  AUDIO_OUTPUT_FORMATS,
  RESOLUTION_PRESETS,
  COMPRESSION_LEVELS,
} from "./types";

export type {
  VideoInputFormat,
  VideoOutputFormat,
  AudioOutputFormat,
  ResolutionPreset,
  CompressionLevel,
  VideoConversionJob,
  FFmpegProgress,
  ConversionResult,
  FFmpegWorkerAPI,
} from "./types";

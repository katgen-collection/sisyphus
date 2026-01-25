import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import * as Comlink from "comlink";

/**
 * FFmpeg WASM worker.
 */

// Inline types to avoid module resolution issues in worker context
type VideoOutputFormat = "mp4" | "gif";
type CompressionLevel = "low" | "medium" | "high";

interface FFmpegProgress {
  ratio: number;
  time?: number;
}

interface ConversionResult {
  data: Uint8Array;
  outputName: string;
  mimeType: string;
}

interface FFmpegWorkerAPI {
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

// CRF values—lower = better quality, higher = more compression
const COMPRESSION_CRF: Record<CompressionLevel, number> = {
  low: 18,    // Best quality, larger file
  medium: 26, // Balanced
  high: 32,   // Smaller file, lower quality
};

let ffmpeg: FFmpeg | null = null;
let loaded = false;

const OUTPUT_MIME: Record<VideoOutputFormat, string> = {
  mp4: "video/mp4",
  gif: "image/gif",
};

const api: FFmpegWorkerAPI = {
  async load() {
    if (loaded) return;

    try {
      ffmpeg = new FFmpeg();

      // Enable logging
      ffmpeg.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
      });

      // Use single-threaded core for broader compatibility
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");

      await ffmpeg.load({ coreURL, wasmURL });

      loaded = true;
      console.log("[FFmpeg] Loaded successfully");
    } catch (err) {
      loaded = false;
      ffmpeg = null;
      throw new Error(`FFmpeg failed to load: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  isLoaded() {
    return loaded;
  },

  async convert(
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
  ): Promise<ConversionResult> {
    if (!ffmpeg || !loaded) {
      throw new Error("FFmpeg not loaded. Call load() first.");
    }

    // IMPORTANT: Use different input/output names to avoid "cannot edit in-place" error
    // FFmpeg cannot write to the same file it's reading from
    const inputExt = inputName.includes(".") ? inputName.split(".").pop() : outputFormat;
    const safeInputName = `input_${Date.now()}.${inputExt ?? outputFormat}`;
    const outputName = `output_${Date.now()}.${outputFormat}`;

    // The download name will preserve the original filename
    const hasExt = inputName.includes(".");
    const baseName = hasExt ? inputName.replace(/\.[^.]+$/, "") : inputName;
    const downloadName = `${baseName}_converted.${outputFormat}`;

    // Set up progress callback
    if (onProgress) {
      ffmpeg.on("progress", ({ progress, time }) => {
        onProgress({ ratio: progress, time });
      });
    }

    // Set up log callback
    const logHandler = ({ message }: { message: string }) => {
      console.log("[FFmpeg]", message);
      if (onLog) onLog(message);
    };
    ffmpeg.on("log", logHandler);

    try {
      await ffmpeg.writeFile(safeInputName, inputData);

      const args: string[] = ["-i", safeInputName];

      // Build filter chain
      const filters: string[] = [];

      // Resolution scaling (use -1 to maintain aspect ratio)
      if (options?.resolution) {
        const { width, height } = options.resolution;
        // Use -2 instead of -1 to ensure even dimensions (required by many codecs)
        const w = width > 0 ? width : -2;
        const h = height > 0 ? height : -2;
        filters.push(`scale=${w}:${h}`);
      }

      // Handle different output formats
      if (outputFormat === "gif") {
        // GIF requires special handling for reasonable file sizes
        const fps = options?.fps || 10; // Default 10 fps for GIF
        
        // Add FPS filter first
        filters.push(`fps=${fps}`);
        
        // Add scale if present, then split for palette generation
        const filterChain = filters.length > 0 
          ? `${filters.join(",")},split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`
          : `fps=${fps},split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
        
        args.push("-vf", filterChain);
        args.push("-loop", "0"); // Loop forever
      } else if (outputFormat === "mp4") {
        // MP4 with H.264
        if (filters.length > 0) {
          args.push("-vf", filters.join(","));
        }
        
        args.push("-c:v", "libx264");
        // Speed/quality tradeoff: faster presets for wasm
        const preset = options?.compression === "high"
          ? "ultrafast"
          : options?.compression === "medium"
            ? "veryfast"
            : "fast";
        args.push("-preset", preset);
        
        if (options?.compression) {
          const crf = COMPRESSION_CRF[options.compression];
          args.push("-crf", crf.toString());
        } else {
          args.push("-crf", "23"); // Default balanced quality
        }
        
        // Copy audio if no compression, otherwise re-encode
        args.push("-c:a", "aac");
        args.push("-b:a", "128k");
        
        // Ensure compatibility
        args.push("-pix_fmt", "yuv420p");
        args.push("-movflags", "+faststart");
      }

      args.push("-y"); // Overwrite output
      args.push(outputName);

      console.log("[FFmpeg] Running command:", args.join(" "));

      await ffmpeg.exec(args);

      const data = await ffmpeg.readFile(outputName) as Uint8Array;

      // Cleanup temporary files
      await ffmpeg.deleteFile(safeInputName);
      await ffmpeg.deleteFile(outputName);

      console.log(`[FFmpeg] Output size: ${(data.length / (1024 * 1024)).toFixed(2)} MB`);

      return {
        data,
        outputName: downloadName, // Use the friendly download name
        mimeType: OUTPUT_MIME[outputFormat],
      };
    } finally {
      // Remove listeners
      if (onProgress) {
        ffmpeg.off("progress", () => {});
      }
      ffmpeg.off("log", logHandler);
    }
  },

  terminate() {
    if (ffmpeg) {
      ffmpeg.terminate();
      ffmpeg = null;
      loaded = false;
    }
  },
};

Comlink.expose(api);

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import * as Comlink from "comlink";

/**
 * FFmpeg WASM worker — multi-threaded with single-thread fallback.
 *
 * Performance optimizations:
 *   1. Multi-threaded WASM core (tries first, falls back to single-threaded)
 *   2. Cache API for WASM binaries (~32 MB cached instead of re-downloaded)
 *   3. Always uses "-preset ultrafast" — slower presets waste time in WASM
 *   4. "-threads 0" lets FFmpeg use all available threads
 *   5. Simplified GIF pipeline (single-pass)
 *   6. Stream-copy audio when possible (no re-encode)
 */

// ── Inline types (avoids module resolution issues in worker context) ──────────

type VideoOutputFormat = "mp4" | "gif";
type AudioOutputFormat = "mp3" | "aac";
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
  isMultiThreaded: () => boolean;
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
  extractAudio: (
    inputData: Uint8Array,
    inputName: string,
    outputFormat: AudioOutputFormat,
    onProgress?: (progress: FFmpegProgress) => void,
    onLog?: (message: string) => void
  ) => Promise<ConversionResult>;
  terminate: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COMPRESSION_CRF: Record<CompressionLevel, number> = {
  low: 18,
  medium: 26,
  high: 32,
};

const OUTPUT_MIME: Record<VideoOutputFormat, string> = {
  mp4: "video/mp4",
  gif: "image/gif",
};

const AUDIO_MIME: Record<AudioOutputFormat, string> = {
  mp3: "audio/mpeg",
  aac: "audio/aac",
};

const CACHE_NAME = "ffmpeg-core-v0.12.10";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return a blob URL — uses Cache API to avoid
 * re-downloading ~32 MB of WASM on every page visit.
 *
 * Falls back to the stock `toBlobURL` from @ffmpeg/util if caching
 * is unavailable or fails for any reason.
 */
async function cachedToBlobURL(
  url: string,
  mimeType: string
): Promise<string> {
  // Cache API not available → fall back to normal fetch
  if (typeof caches === "undefined") {
    return toBlobURL(url, mimeType);
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);

    if (cached) {
      console.log(`[FFmpeg] Cache hit: ${url.split("/").pop()}`);
      const buf = await cached.arrayBuffer();
      const blob = new Blob([buf], { type: mimeType });
      return URL.createObjectURL(blob);
    }

    // Not cached — fetch with explicit CORS, cache the response, build blob URL
    console.log(`[FFmpeg] Fetching & caching: ${url.split("/").pop()}`);
    const response = await fetch(url);

    // Clone before consuming — a Response body can only be read once
    await cache.put(url, response.clone());

    const buf = await response.arrayBuffer();
    const blob = new Blob([buf], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    // Caching failed — fall back to the stock helper which is known to work
    console.warn("[FFmpeg] Cache failed, using direct fetch:", err);
    return toBlobURL(url, mimeType);
  }
}

// ── State ─────────────────────────────────────────────────────────────────────

let ffmpeg: FFmpeg | null = null;
let loaded = false;
let multiThreaded = false;

// ── API ───────────────────────────────────────────────────────────────────────

const api: FFmpegWorkerAPI = {
  async load() {
    if (loaded) return;

    ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
    });

    // ── Try multi-threaded first, fall back to single-threaded ────────────
    // Multi-threaded core files are served from public/ffmpeg/ (same-origin).
    // This avoids blob URL issues where core-mt can't spawn nested workers.
    try {
      const mtBase = "/ffmpeg";

      await ffmpeg.load({
        coreURL: `${mtBase}/ffmpeg-core.js`,
        wasmURL: `${mtBase}/ffmpeg-core.wasm`,
        workerURL: `${mtBase}/ffmpeg-core.worker.js`,
      });
      multiThreaded = true;
      loaded = true;
      console.log("[FFmpeg] Loaded multi-threaded core ✓");
      return;
    } catch (mtErr) {
      console.warn("[FFmpeg] Multi-threaded load failed, trying single-threaded:", mtErr);
      // Reset FFmpeg instance for the retry
      ffmpeg.terminate();
      ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        console.log("[FFmpeg]", message);
      });
    }

    // ── Single-threaded fallback ──────────────────────────────────────────
    try {
      const stBase = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";

      const [coreURL, wasmURL] = await Promise.all([
        cachedToBlobURL(`${stBase}/ffmpeg-core.js`, "text/javascript"),
        cachedToBlobURL(`${stBase}/ffmpeg-core.wasm`, "application/wasm"),
      ]);

      await ffmpeg.load({ coreURL, wasmURL });
      multiThreaded = false;
      loaded = true;
      console.log("[FFmpeg] Loaded single-threaded core (fallback)");
    } catch (err) {
      loaded = false;
      multiThreaded = false;
      ffmpeg = null;
      throw new Error(
        `FFmpeg failed to load: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  },

  isLoaded() {
    return loaded;
  },

  isMultiThreaded() {
    return multiThreaded;
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

    const inputExt = inputName.includes(".")
      ? inputName.split(".").pop()
      : outputFormat;
    const safeInputName = `input_${Date.now()}.${inputExt ?? outputFormat}`;
    const outputName = `output_${Date.now()}.${outputFormat}`;

    const hasExt = inputName.includes(".");
    const baseName = hasExt ? inputName.replace(/\.[^.]+$/, "") : inputName;
    const downloadName = `${baseName}_converted.${outputFormat}`;

    if (onProgress) {
      ffmpeg.on("progress", ({ progress, time }) => {
        onProgress({ ratio: progress, time });
      });
    }

    const logHandler = ({ message }: { message: string }) => {
      console.log("[FFmpeg]", message);
      if (onLog) onLog(message);
    };
    ffmpeg.on("log", logHandler);

    try {
      await ffmpeg.writeFile(safeInputName, inputData);

      const args: string[] = ["-i", safeInputName];

      const filters: string[] = [];

      if (options?.resolution) {
        const { width, height } = options.resolution;
        const w = width > 0 ? width : -2;
        const h = height > 0 ? height : -2;
        filters.push(`scale=${w}:${h}`);
      }

      if (outputFormat === "gif") {
        // ── GIF: single-pass for speed ────────────────────────────────────
        const fps = options?.fps || 10;
        filters.push(`fps=${fps}`);

        if (filters.length > 0) {
          args.push("-vf", filters.join(","));
        }
        args.push("-loop", "0");
        // Thread limit required — h264 decoder also deadlocks without it
        args.push("-threads", "4");
      } else if (outputFormat === "mp4") {
        // ── MP4: ultrafast + threads ──────────────────────────────────────
        if (filters.length > 0) {
          args.push("-vf", filters.join(","));
        }

        args.push("-c:v", "libx264");
        args.push("-preset", "ultrafast");
        // Explicit thread limit — "-threads 0" (auto) causes libx264 pthreads
        // to deadlock in WASM. A fixed count of 4 is the safe maximum.
        args.push("-threads", "4");
        args.push("-x264-params", "threads=4");

        const crf = options?.compression
          ? COMPRESSION_CRF[options.compression]
          : 23;
        args.push("-crf", crf.toString());

        args.push("-c:a", "aac", "-b:a", "128k");
        args.push("-pix_fmt", "yuv420p");
        args.push("-movflags", "+faststart");
      }

      args.push("-y", outputName);

      console.log("[FFmpeg] Running command:", args.join(" "));
      await ffmpeg.exec(args);

      const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

      await ffmpeg.deleteFile(safeInputName);
      await ffmpeg.deleteFile(outputName);

      console.log(
        `[FFmpeg] Output size: ${(data.length / (1024 * 1024)).toFixed(2)} MB`
      );

      return {
        data,
        outputName: downloadName,
        mimeType: OUTPUT_MIME[outputFormat],
      };
    } finally {
      if (onProgress) {
        ffmpeg.off("progress", () => { });
      }
      ffmpeg.off("log", logHandler);
    }
  },

  async extractAudio(
    inputData: Uint8Array,
    inputName: string,
    outputFormat: AudioOutputFormat,
    onProgress?: (progress: FFmpegProgress) => void,
    onLog?: (message: string) => void
  ): Promise<ConversionResult> {
    if (!ffmpeg || !loaded) {
      throw new Error("FFmpeg not loaded. Call load() first.");
    }

    const inputExt = inputName.includes(".")
      ? inputName.split(".").pop()
      : "mp4";
    const safeInputName = `input_${Date.now()}.${inputExt ?? "mp4"}`;
    const outputName = `audio_${Date.now()}.${outputFormat}`;

    const hasExt = inputName.includes(".");
    const baseName = hasExt ? inputName.replace(/\.[^.]+$/, "") : inputName;
    const downloadName = `${baseName}_audio.${outputFormat}`;

    const progressHandler = ({
      progress,
      time,
    }: {
      progress: number;
      time?: number;
    }) => {
      if (onProgress) onProgress({ ratio: progress, time });
    };

    const logHandler = ({ message }: { message: string }) => {
      console.log("[FFmpeg]", message);
      if (onLog) onLog(message);
    };

    if (onProgress) {
      ffmpeg.on("progress", progressHandler);
    }
    ffmpeg.on("log", logHandler);

    try {
      await ffmpeg.writeFile(safeInputName, inputData);

      const args: string[] = ["-i", safeInputName, "-vn"];

      // Stream-copy AAC from MP4/MOV sources (no re-encode = near-instant)
      const isAACCompatibleSource = ["mp4", "mov", "m4a"].includes(
        (inputExt ?? "").toLowerCase()
      );

      if (outputFormat === "aac" && isAACCompatibleSource) {
        args.push("-c:a", "copy");
        console.log(
          "[FFmpeg] Using stream copy for AAC extraction (fast path)"
        );
      } else if (outputFormat === "mp3") {
        args.push("-c:a", "libmp3lame", "-q:a", "2");
      } else {
        args.push("-c:a", "aac", "-b:a", "192k");
      }

      args.push("-y", outputName);

      console.log("[FFmpeg] Running command:", args.join(" "));
      await ffmpeg.exec(args);

      const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

      await ffmpeg.deleteFile(safeInputName);
      await ffmpeg.deleteFile(outputName);

      return {
        data,
        outputName: downloadName,
        mimeType: AUDIO_MIME[outputFormat],
      };
    } finally {
      if (onProgress) {
        ffmpeg.off("progress", progressHandler);
      }
      ffmpeg.off("log", logHandler);
    }
  },

  terminate() {
    if (ffmpeg) {
      ffmpeg.terminate();
      ffmpeg = null;
      loaded = false;
      multiThreaded = false;
    }
  },
};

Comlink.expose(api);

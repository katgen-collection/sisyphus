"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Video, RefreshCw, Minimize2, Maximize2, AlertCircle, AlertTriangle, Terminal, Music, Cpu } from "lucide-react";
import {
  FileUploader,
  Button,
  downloadUint8Array,
  type AcceptedFile,
} from "@/modules/_shared";
import { LoadingSpinner, ToolCarousel, type ToolTab } from "@/components";
import { useFFmpegWorker } from "..";
import { LARGE_FILE_THRESHOLD } from "../hooks/useFFmpegWorker";
import {
  VIDEO_INPUT_FORMATS,
  VIDEO_OUTPUT_FORMATS,
  AUDIO_OUTPUT_FORMATS,
  RESOLUTION_PRESETS,
  COMPRESSION_LEVELS,
  type VideoOutputFormat,
  type AudioOutputFormat,
  type CompressionLevel,
  type ResolutionPreset,
} from "../types";

type VideoTab = "convert" | "compress" | "resize" | "audio";

const TABS: ToolTab<VideoTab>[] = [
  {
    id: "convert",
    label: "Convert",
    description: "Change format",
    icon: <RefreshCw className="w-4 h-4" />,
  },
  {
    id: "compress",
    label: "Compress",
    description: "Shrink size",
    icon: <Minimize2 className="w-4 h-4" />,
  },
  {
    id: "resize",
    label: "Resize",
    description: "Change resolution",
    icon: <Maximize2 className="w-4 h-4" />,
  },
  {
    id: "audio",
    label: "Extract Audio",
    description: "MP3 or AAC",
    icon: <Music className="w-4 h-4" />,
  },
];

/**
 * Video tools component with tabs for conversion, compression, and resizing.
 */
export function VideoConverter() {
  const { state, progress, error, loadFFmpeg, convert, extractAudio, reset, logs, isMultiThreaded } = useFFmpegWorker();

  const [activeTab, setActiveTab] = useState<VideoTab>("convert");
  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Conversion options
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>("mp4");
  const [audioFormat, setAudioFormat] = useState<AudioOutputFormat>("mp3");

  // Compression options
  const [compression, setCompression] = useState<CompressionLevel>("medium");

  // Resize options
  const [resolutionPreset, setResolutionPreset] = useState<ResolutionPreset | "original">("720p");
  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);

  // GIF options
  const [gifFps, setGifFps] = useState(10);

  // Load FFmpeg on mount
  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  // Cleanup video URL on unmount or file change
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleFilesAccepted = useCallback((files: AcceptedFile[]) => {
    // Cleanup old URL
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    const newFile = files[0] ?? null;
    setFile(newFile);

    // Create preview URL
    if (newFile) {
      setVideoUrl(URL.createObjectURL(newFile.file));
    } else {
      setVideoUrl(null);
    }

    reset();
  }, [videoUrl, reset]);

  const handleProcess = useCallback(async () => {
    if (!file) return;

    let resolution: { width: number; height: number } | undefined;
    let compressionLevel: CompressionLevel | undefined;
    let format = outputFormat;
    let fps: number | undefined;

    switch (activeTab) {
      case "convert":
        // Just format conversion
        if (outputFormat === "gif") {
          fps = gifFps;
        }
        break;

      case "compress":
        compressionLevel = compression;
        format = "mp4"; // Compression only for MP4
        break;

      case "resize":
        if (resolutionPreset !== "original" && resolutionPreset !== "custom") {
          const preset = RESOLUTION_PRESETS[resolutionPreset];
          resolution = { width: preset.width, height: preset.height };
        } else if (resolutionPreset === "custom") {
          resolution = { width: customWidth, height: customHeight };
        }
        format = "mp4"; // Keep as MP4 for resize
        break;

      case "audio":
        // Audio extraction handled separately
        break;
    }

    const result = activeTab === "audio"
      ? await extractAudio(file.file, audioFormat)
      : await convert(file.file, format, {
        resolution,
        compression: compressionLevel,
        fps,
      });

    if (result) {
      downloadUint8Array(result.data, result.outputName, result.mimeType);
    }
  }, [file, activeTab, outputFormat, compression, resolutionPreset, customWidth, customHeight, gifFps, audioFormat, convert, extractAudio]);

  const acceptedFormats = VIDEO_INPUT_FORMATS.map((f) => `.${f}`).join(",");
  const isProcessing = state === "processing" || state === "loading";
  const canProcess = file && state !== "loading" && state !== "processing";
  const isLargeFile = file && file.file.size > LARGE_FILE_THRESHOLD;

  // Get action label based on tab
  const actionLabel = useMemo(() => {
    if (state === "loading") return "Loading FFmpeg...";
    switch (activeTab) {
      case "convert":
        return `Convert to ${outputFormat.toUpperCase()}`;
      case "compress":
        return "Compress Video";
      case "resize":
        return "Resize Video";
      case "audio":
        return `Extract ${audioFormat.toUpperCase()} Audio`;
    }
  }, [activeTab, outputFormat, audioFormat, state]);

  return (
    <div className="space-y-6">
      {/* Capability badge */}
      {state !== "loading" && (
        <div className="flex items-center gap-2 text-xs">
          <Cpu className="w-3.5 h-3.5 text-muted" />
          {isMultiThreaded ? (
            <span className="text-success-text font-medium">Multi-threaded ✓</span>
          ) : (
            <span className="text-warning-text font-medium">Single-threaded (limited browser)</span>
          )}
        </div>
      )}

      {/* Tabs carousel */}
      <ToolCarousel tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* File upload zone */}
      <FileUploader
        accept={acceptedFormats}
        onFilesAccepted={handleFilesAccepted}
        disabled={isProcessing}
        compact={!!file}
      >
        {file ? (
          <div className="text-center">
            <div className="mb-2 w-12 h-12 mx-auto rounded-full bg-surface-muted flex items-center justify-center">
              <Video className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-primary font-medium truncate max-w-xs">{file.file.name}</p>
            <p className="text-muted text-sm">
              {(file.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        ) : undefined}
      </FileUploader>

      {/* Video Preview — dark background preserved for media pixels */}
      {videoUrl && (
        <div className="bg-stone-900 rounded-xl overflow-hidden">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-64 object-contain"
            preload="metadata"
          />
        </div>
      )}

      {/* Large file warning */}
      {isLargeFile && (
        <div className="bg-warning-bg border border-warning-border rounded-lg px-4 py-3 text-warning-text flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm">
            Large file ({(file.file.size / (1024 * 1024)).toFixed(0)} MB) — processing may take a while{!isMultiThreaded ? " on this device" : ""}.
          </span>
        </div>
      )}

      {/* Tab-specific options */}
      {file && (
        <div className="bg-surface-subtle rounded-xl p-5 space-y-5">
          {/* Convert Tab */}
          {activeTab === "convert" && (
            <>
              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Output Format
                </label>
                <div className="flex gap-2">
                  {VIDEO_OUTPUT_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      disabled={isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-medium uppercase tracking-wide transition-colors duration-150 ${outputFormat === fmt
                          ? "bg-primary text-canvas"
                          : "bg-surface-muted text-secondary hover:bg-border-strong"
                        } disabled:opacity-50`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* GIF-specific options */}
              {outputFormat === "gif" && (
                <div>
                  <label className="block text-sm font-medium text-primary mb-2">
                    Frame Rate (FPS)
                  </label>
                  <div className="flex gap-2">
                    {[5, 10, 15, 20].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setGifFps(fps)}
                        disabled={isProcessing}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${gifFps === fps
                            ? "bg-primary text-canvas"
                            : "bg-surface-muted text-secondary hover:bg-border-strong"
                          } disabled:opacity-50`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Lower FPS = smaller file size
                  </p>
                </div>
              )}
            </>
          )}

          {/* Compress Tab */}
          {activeTab === "compress" && (
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Compression Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(COMPRESSION_LEVELS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setCompression(key as CompressionLevel)}
                    disabled={isProcessing}
                    className={`px-3 py-3 rounded-lg text-sm transition-colors duration-150 ${compression === key
                        ? "bg-primary text-canvas"
                        : "bg-surface-muted text-secondary hover:bg-border-strong"
                      } disabled:opacity-50`}
                  >
                    <div className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                    <div className="text-xs opacity-75 mt-1">{val.description}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-3">
                Higher compression = smaller file, lower quality
              </p>
            </div>
          )}

          {/* Resize Tab */}
          {activeTab === "resize" && (
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Resolution
              </label>
              <select
                value={resolutionPreset}
                onChange={(e) => setResolutionPreset(e.target.value as ResolutionPreset | "original")}
                disabled={isProcessing}
                className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-border-strong"
              >
                <option value="original">Original (no resize)</option>
                {Object.entries(RESOLUTION_PRESETS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>

              {resolutionPreset === "custom" && (
                <div className="flex gap-3 mt-3">
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    placeholder="Width"
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-border-strong"
                  />
                  <span className="text-muted self-center">×</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    placeholder="Height"
                    disabled={isProcessing}
                    className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-border-strong"
                  />
                </div>
              )}

              <p className="text-xs text-muted mt-3">
                Use -1 for width/height to maintain aspect ratio
              </p>
            </div>
          )}

          {/* Audio Tab */}
          {activeTab === "audio" && (
            <div>
              <label className="block text-sm font-medium text-primary mb-2">
                Output Audio Format
              </label>
              <div className="flex gap-2">
                {AUDIO_OUTPUT_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setAudioFormat(fmt)}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded-lg text-sm font-medium uppercase tracking-wide transition-colors duration-150 ${audioFormat === fmt
                        ? "bg-primary text-canvas"
                        : "bg-surface-muted text-secondary hover:bg-border-strong"
                      } disabled:opacity-50`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">
                Extracts audio without re-encoding video
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progress / Status display */}
      {state === "loading" && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Loading FFmpeg..." />
        </div>
      )}

      {state === "processing" && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text={`Processing... ${progress}%`} />
        </div>
      )}

      {state === "error" && (
        <div className="bg-error-bg border border-error-border rounded-lg px-4 py-3 text-error-text flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {state === "done" && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text">
          Complete! Download started.
        </div>
      )}

      {/* FFmpeg Logs (collapsible) — dark terminal-style preserved */}
      {logs.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-4 py-2 bg-surface-subtle hover:bg-surface-muted transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-secondary">
              <Terminal className="w-4 h-4" />
              FFmpeg Logs ({logs.length})
            </span>
            <span className="text-muted">{showLogs ? "▲" : "▼"}</span>
          </button>
          {showLogs && (
            <div className="max-h-48 overflow-y-auto bg-stone-900 p-3">
              <pre className="text-xs text-stone-300 font-mono whitespace-pre-wrap">
                {logs.join("\n")}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Action button */}
      <Button
        onClick={handleProcess}
        disabled={!canProcess}
        loading={isProcessing}
        className="w-full"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

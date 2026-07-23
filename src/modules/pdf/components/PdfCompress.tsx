"use client";

import { useState, useCallback } from "react";
import { FileText } from "lucide-react";
import {
  FileUploader,
  Button,
  downloadUint8Array,
  type AcceptedFile,
} from "@/modules/_shared";
import { LoadingSpinner } from "@/components";
import { usePdfWorker } from "../hooks/usePdfWorker";
import type { PdfCompressionLevel, PdfCompressionStats, PdfSkipReason } from "../types";

const SKIP_LABELS: Record<PdfSkipReason, string> = {
  "unsupported-filter": "unsupported format",
  transparency: "complex transparency",
  predictor: "compressed data",
  colorspace: "unsupported color",
  "not-smaller": "already optimal",
};

const LEVELS: Array<{
  id: PdfCompressionLevel;
  label: string;
  description: string;
}> = [
  { id: "light", label: "Light", description: "Best quality, modest shrink" },
  { id: "balanced", label: "Balanced", description: "Great for slides — recommended" },
  { id: "maximum", label: "Maximum", description: "Smallest file size" },
];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * PDF compression tool.
 * Recompresses embedded images in place; text and vectors are preserved.
 */
export function PdfCompress() {
  const { state, error, compressPdf, reset } = usePdfWorker();
  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [level, setLevel] = useState<PdfCompressionLevel>("balanced");
  const [stats, setStats] = useState<PdfCompressionStats | null>(null);

  const handleFilesAccepted = useCallback((files: AcceptedFile[]) => {
    setFile(files[0] ?? null);
    setStats(null);
    reset();
  }, [reset]);

  const handleCompress = useCallback(async () => {
    if (!file) return;

    const result = await compressPdf(file.file, level);

    if (result) {
      setStats(result.stats);
      downloadUint8Array(result.data, result.filename, "application/pdf");
    }
  }, [file, level, compressPdf]);

  const isProcessing = state === "processing";
  const canProcess = file && !isProcessing;
  const shrank = stats ? stats.compressedSize < stats.originalSize : false;
  const savedPct = stats && stats.originalSize > 0
    ? Math.round(((stats.originalSize - stats.compressedSize) / stats.originalSize) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <FileUploader
        accept=".pdf"
        onFilesAccepted={handleFilesAccepted}
        disabled={isProcessing}
        compact={!!file}
      >
        {file ? (
          <div className="text-center">
            <div className="mb-2 w-12 h-12 mx-auto rounded-lg bg-surface-muted flex items-center justify-center">
              <FileText className="w-6 h-6 text-secondary" />
            </div>
            <p className="text-primary font-medium truncate max-w-xs">{file.file.name}</p>
            <p className="text-muted text-sm">
              {(file.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        ) : undefined}
      </FileUploader>

      {file && (
        <div className="bg-surface-subtle rounded-xl p-5 space-y-3">
          <p className="text-sm font-medium text-primary">Compression level</p>
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((option) => {
              const active = level === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLevel(option.id)}
                  disabled={isProcessing}
                  className={`
                    rounded-lg border p-3 text-left transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${active
                      ? "border-primary bg-surface-subtle text-primary"
                      : "border-border bg-surface text-secondary hover:border-border-strong"
                    }
                  `}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted mt-0.5">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Recompresses images to shrink the file. Text stays selectable.
          </p>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Compressing..." />
        </div>
      )}

      {state === "error" && (
        <div className="bg-error-bg border border-error-border rounded-lg px-4 py-3 text-error-text">
          {error}
        </div>
      )}

      {state === "done" && stats && (
        <div className="bg-success-bg border border-success-border rounded-lg px-4 py-3 text-success-text space-y-1">
          {shrank ? (
            <p className="font-medium">
              {formatMB(stats.originalSize)} → {formatMB(stats.compressedSize)} ({savedPct}% smaller)
            </p>
          ) : (
            <p className="font-medium">Already optimized — couldn&apos;t shrink this file further.</p>
          )}
          <p className="text-sm text-success-text/80">
            Recompressed {stats.imagesRecompressed} of {stats.imagesTotal} images
            {stats.duplicatesRemoved > 0 &&
              `, merged ${stats.duplicatesRemoved} duplicates`}
          </p>
          {stats.skipped.length > 0 && (
            <p className="text-xs text-success-text/60">
              Skipped:{" "}
              {stats.skipped
                .map((s) => `${s.count} ${SKIP_LABELS[s.reason]}`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      <Button onClick={handleCompress} disabled={!canProcess} loading={isProcessing} className="w-full">
        Compress PDF
      </Button>
    </div>
  );
}

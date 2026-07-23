"use client";

import { useCallback, useState, useRef } from "react";
import { Download } from "lucide-react";
import type { AcceptedFile } from "../types";

interface FileUploaderProps {
  accept: string;
  multiple?: boolean;
  maxSizeMB?: number;
  onFilesAccepted: (files: AcceptedFile[]) => void;
  disabled?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}

/**
 * Whether a file satisfies an `accept` string (".pdf", ".png,.jpg", "image/*",
 * "application/pdf"). Browsers enforce `accept` in the file picker but NOT on
 * drag-and-drop, so we re-check dropped files ourselves.
 */
function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/**
 * Drag-and-drop file uploader.
 */
export function FileUploader({
  accept,
  multiple = false,
  maxSizeMB = 2048,
  onFilesAccepted,
  disabled = false,
  compact = false,
  children,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const maxBytes = maxSizeMB * 1024 * 1024;
      const accepted: AcceptedFile[] = [];
      const rejected: string[] = [];

      for (const file of Array.from(fileList)) {
        if (!matchesAccept(file, accept)) {
          rejected.push(`"${file.name}" is not a supported file type`);
          continue;
        }
        if (file.size > maxBytes) {
          rejected.push(`"${file.name}" exceeds the ${maxSizeMB}MB limit`);
          continue;
        }
        accepted.push({
          file,
          id: `${file.name}-${file.size}-${Date.now()}`,
        });
      }

      setRejection(rejected.length > 0 ? rejected.join(" · ") : null);

      if (accepted.length > 0) {
        onFilesAccepted(multiple ? accepted : [accepted[0]]);
      }
    },
    [accept, maxSizeMB, multiple, onFilesAccepted]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      processFiles(e.dataTransfer.files);
    },
    [disabled, processFiles]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFiles]
  );

  return (
    <div className="flex flex-col gap-2">
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative flex flex-col items-center justify-center
        ${compact ? "min-h-28 p-4 rounded-xl" : "min-h-48 p-8 rounded-2xl"}
        border-2 border-dashed
        transition-all duration-200 cursor-pointer
        ${isDragging
          ? "border-border-strong bg-surface-subtle"
          : "border-border bg-surface-subtle hover:border-border-strong hover:bg-surface-muted"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      {children ?? (
        <>
          {/* Boulder icon */}
          <div className="mb-4 w-16 h-16 rounded-full bg-linear-to-br from-surface-muted to-border flex items-center justify-center">
            <Download className="w-8 h-8 text-secondary" />
          </div>
          <p className="text-secondary font-medium">
            Drop files here or click to browse
          </p>
          <p className="text-muted text-sm mt-1">
            Max {maxSizeMB >= 1024 ? `${maxSizeMB / 1024}GB` : `${maxSizeMB}MB`} per file
          </p>
        </>
      )}
    </div>

    {rejection && (
      <p role="alert" className="text-sm text-error-text px-1">
        {rejection}
      </p>
    )}
    </div>
  );
}

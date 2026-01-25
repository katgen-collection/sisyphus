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

/**
 * PDF compression/optimization tool.
 * Strips metadata, flattens forms, re-saves.
 */
export function PdfCompress() {
  const { state, progress, error, optimizePdf, reset } = usePdfWorker();
  const [file, setFile] = useState<AcceptedFile | null>(null);
  const [removeMetadata, setRemoveMetadata] = useState(true);
  const [flattenForms, setFlattenForms] = useState(true);

  const handleFilesAccepted = useCallback((files: AcceptedFile[]) => {
    setFile(files[0] ?? null);
    reset();
  }, [reset]);

  const handleOptimize = useCallback(async () => {
    if (!file) return;

    const result = await optimizePdf(file.file, { removeMetadata, flattenForms });

    if (result) {
      downloadUint8Array(result.data, result.filename, "application/pdf");
    }
  }, [file, removeMetadata, flattenForms, optimizePdf]);

  const isProcessing = state === "processing";
  const canProcess = file && !isProcessing;

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
            <div className="mb-2 w-12 h-12 mx-auto rounded-lg bg-stone-200 flex items-center justify-center">
              <FileText className="w-6 h-6 text-stone-600" />
            </div>
            <p className="text-stone-700 font-medium truncate max-w-xs">{file.file.name}</p>
            <p className="text-stone-400 text-sm">
              {(file.file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        ) : undefined}
      </FileUploader>

      {file && (
        <div className="bg-stone-50 rounded-xl p-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={removeMetadata}
              onChange={(e) => setRemoveMetadata(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-400"
            />
            <div>
              <span className="text-sm font-medium text-stone-700">Remove Metadata</span>
              <p className="text-xs text-stone-400">Strips author, title, keywords</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={flattenForms}
              onChange={(e) => setFlattenForms(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-stone-400"
            />
            <div>
              <span className="text-sm font-medium text-stone-700">Flatten Forms</span>
              <p className="text-xs text-stone-400">Converts form fields to static content</p>
            </div>
          </label>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" text="Optimizing..." />
        </div>
      )}

      {state === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {state === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700">
          Optimization complete!
        </div>
      )}

      <Button onClick={handleOptimize} disabled={!canProcess} loading={isProcessing} className="w-full">
        Optimize PDF
      </Button>
    </div>
  );
}

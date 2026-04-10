"use client";

import { Columns2, FileText, PenLine, ZoomIn, ZoomOut, Download, Loader2 } from "lucide-react";
import { Button } from "@/modules/_shared";

type ViewMode = "split" | "editor" | "preview";

interface EditorToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  isExporting: boolean;
  onDownloadPdf: () => void;
}

/**
 * Toolbar for the Markdown editor
 */
export function EditorToolbar({
  viewMode,
  onViewModeChange,
  zoom,
  onZoomChange,
  isExporting,
  onDownloadPdf,
}: EditorToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-white border border-stone-200 rounded-xl shadow-sm">
      {/* View mode toggles */}
      <div className="flex items-center bg-stone-100 rounded-lg p-0.5 gap-0.5">
        <ViewToggle
          id="view-split"
          label="Split"
          icon={<Columns2 className="w-3.5 h-3.5" />}
          active={viewMode === "split"}
          onClick={() => onViewModeChange("split")}
        />
        <ViewToggle
          id="view-editor"
          label="Editor"
          icon={<PenLine className="w-3.5 h-3.5" />}
          active={viewMode === "editor"}
          onClick={() => onViewModeChange("editor")}
        />
        <ViewToggle
          id="view-preview"
          label="Preview"
          icon={<FileText className="w-3.5 h-3.5" />}
          active={viewMode === "preview"}
          onClick={() => onViewModeChange("preview")}
        />
      </div>

      {/* Zoom controls */}
      {viewMode !== "editor" && (
        <div className="flex items-center gap-1.5 bg-stone-100 rounded-lg px-2 py-1">
          <button
            id="zoom-out"
            onClick={() => onZoomChange(Math.max(0.5, parseFloat((zoom - 0.05).toFixed(2))))}
            disabled={zoom <= 0.5}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 disabled:opacity-30 transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-stone-600 w-10 text-center select-none">
            {zoomPercent}%
          </span>
          <button
            id="zoom-in"
            onClick={() => onZoomChange(Math.min(2, parseFloat((zoom + 0.05).toFixed(2))))}
            disabled={zoom >= 2}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-500 hover:text-stone-800 hover:bg-stone-200 disabled:opacity-30 transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <input
            id="zoom-slider"
            type="range"
            min={50}
            max={200}
            step={5}
            value={zoomPercent}
            onChange={(e) => onZoomChange(Number(e.target.value) / 100)}
            className="w-20 h-1.5 accent-stone-700 cursor-pointer"
            aria-label="Zoom level"
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download PDF */}
      <Button
        id="download-pdf"
        onClick={onDownloadPdf}
        disabled={isExporting}
        loading={isExporting}
        className="text-sm py-2 px-4"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Exporting…
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </>
        )}
      </Button>
    </div>
  );
}

interface ViewToggleProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

function ViewToggle({ id, label, icon, active, onClick }: ViewToggleProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium
        transition-all duration-150
        ${active
          ? "bg-white text-stone-800 shadow-sm border border-stone-200"
          : "text-stone-500 hover:text-stone-700"
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

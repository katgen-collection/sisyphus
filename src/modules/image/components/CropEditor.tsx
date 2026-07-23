"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/modules/_shared";
import {
  centeredCropForRatio,
  detectCropRatio,
  moveCrop,
  normalizeCrop,
  ratioValue,
  resizeCrop,
} from "../lib/cropGeometry";
import type {
  CropHandle,
  CropRatio,
  ImageDimensions,
} from "../lib/cropGeometry";
import type { PixelCrop } from "../types";

interface CropEditorProps {
  file: File;
  crop: PixelCrop | null;
  onChange: (crop: PixelCrop | null) => void;
  onDimensions: (dimensions: ImageDimensions) => void;
  onClose: () => void;
}

interface PointerInteraction {
  pointerId: number;
  clientX: number;
  clientY: number;
  crop: PixelCrop;
  action: "move" | CropHandle;
}

const RATIO_PRESETS: Array<{ value: CropRatio; label: string }> = [
  { value: "free", label: "Free" },
  { value: "original", label: "Original" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

const HANDLE_STYLES: Record<CropHandle, { button: string; marker: string; label: string }> = {
  north: {
    button: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
    marker: "left-1/2 top-1/2 h-1.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-sm",
    label: "north",
  },
  "north-east": {
    button: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    marker: "left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-bl-sm border-b-2 border-l-2",
    label: "north east",
  },
  east: {
    button: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    marker: "left-1/2 top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm",
    label: "east",
  },
  "south-east": {
    button: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    marker: "left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-tl-sm border-l-2 border-t-2",
    label: "south east",
  },
  south: {
    button: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
    marker: "left-1/2 top-1/2 h-1.5 w-6 -translate-x-1/2 -translate-y-1/2 rounded-sm",
    label: "south",
  },
  "south-west": {
    button: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    marker: "left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-tr-sm border-r-2 border-t-2",
    label: "south west",
  },
  west: {
    button: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
    marker: "left-1/2 top-1/2 h-6 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm",
    label: "west",
  },
  "north-west": {
    button: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    marker: "left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-br-sm border-b-2 border-r-2",
    label: "north west",
  },
};

const HANDLES = Object.keys(HANDLE_STYLES) as CropHandle[];
const HANDLE_INNER_THRESHOLD = 12;

function pointUsesHandle(
  handle: CropHandle,
  clientX: number,
  clientY: number,
  selection: DOMRect,
): boolean {
  const inside = clientX >= selection.left && clientX <= selection.right &&
    clientY >= selection.top && clientY <= selection.bottom;
  if (!inside) return true;

  const nearHorizontalEdge = handle.includes("west")
    ? clientX - selection.left <= HANDLE_INNER_THRESHOLD
    : handle.includes("east")
      ? selection.right - clientX <= HANDLE_INNER_THRESHOLD
      : true;
  const nearVerticalEdge = handle.includes("north")
    ? clientY - selection.top <= HANDLE_INNER_THRESHOLD
    : handle.includes("south")
      ? selection.bottom - clientY <= HANDLE_INNER_THRESHOLD
      : true;

  return nearHorizontalEdge && nearVerticalEdge;
}

function fullCrop(dimensions: ImageDimensions): PixelCrop {
  return { x: 0, y: 0, width: dimensions.width, height: dimensions.height };
}

function displayRatioLabel(ratio: CropRatio, crop: PixelCrop, dimensions: ImageDimensions): string {
  if (ratio === "original") return "Original";
  if (ratio !== "free") return ratio;
  const detected = detectCropRatio(crop, dimensions);
  if (detected === "original") return "Original";
  if (detected === "custom") return "Custom";
  return detected;
}

export function CropEditor({ file, crop, onChange, onDimensions, onClose }: CropEditorProps) {
  const previewRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<PointerInteraction | null>(null);
  const [dimensions, setDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [ratio, setRatio] = useState<CropRatio>("free");

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setViewport({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const selected = dimensions.width > 0
    ? normalizeCrop(crop ?? fullCrop(dimensions), dimensions)
    : { x: 0, y: 0, width: 1, height: 1 };
  const containScale = dimensions.width > 0 && viewport.width > 0 && viewport.height > 0
    ? Math.min(viewport.width / dimensions.width, viewport.height / dimensions.height)
    : 0;
  const frameWidth = Math.round(dimensions.width * containScale * 1000) / 1000;
  const frameHeight = Math.round(dimensions.height * containScale * 1000) / 1000;
  const lockedRatio = ratioValue(ratio, dimensions);
  const ratioLabel = dimensions.width > 0
    ? displayRatioLabel(ratio, selected, dimensions)
    : "Original";

  const setCrop = (next: PixelCrop, unlockRatio = false) => {
    if (!dimensions.width || !dimensions.height) return;
    const normalized = normalizeCrop(next, dimensions);
    const isFull = normalized.x === 0 && normalized.y === 0 &&
      normalized.width === dimensions.width && normalized.height === dimensions.height;
    if (unlockRatio) setRatio("free");
    onChange(isFull ? null : normalized);
  };

  const applyRatio = (value: CropRatio) => {
    setRatio(value);
    if (!dimensions.width || !dimensions.height || value === "free") return;
    if (value === "original") {
      onChange(null);
      return;
    }
    setCrop(centeredCropForRatio(dimensions, ratioValue(value, dimensions)));
  };

  const startInteraction = (
    event: React.PointerEvent<HTMLElement>,
    requestedAction: PointerInteraction["action"],
  ) => {
    if (!dimensions.width || !frameRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const action = requestedAction !== "move" && event.pointerType === "touch" &&
      !pointUsesHandle(
        requestedAction,
        event.clientX,
        event.clientY,
        event.currentTarget.parentElement?.getBoundingClientRect() ?? new DOMRect(),
      )
      ? "move"
      : requestedAction;
    interactionRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      crop: selected,
      action,
    };
  };

  const moveInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const frame = frameRef.current;
    if (!interaction || !frame || interaction.pointerId !== event.pointerId) return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    event.preventDefault();

    const deltaX = (event.clientX - interaction.clientX) * dimensions.width / rect.width;
    const deltaY = (event.clientY - interaction.clientY) * dimensions.height / rect.height;
    const next = interaction.action === "move"
      ? moveCrop(interaction.crop, deltaX, deltaY, dimensions)
      : resizeCrop(interaction.crop, interaction.action, deltaX, deltaY, dimensions, lockedRatio);
    setCrop(next);
  };

  const endInteraction = (event: React.PointerEvent<HTMLDivElement>) => {
    if (interactionRef.current?.pointerId === event.pointerId) {
      interactionRef.current = null;
    }
  };

  const updateExact = (field: keyof PixelCrop, value: number) => {
    if (!Number.isFinite(value)) return;
    if (field === "x") {
      setCrop(moveCrop(selected, value - selected.x, 0, dimensions));
      return;
    }
    if (field === "y") {
      setCrop(moveCrop(selected, 0, value - selected.y, dimensions));
      return;
    }
    setCrop(normalizeCrop({ ...selected, [field]: value }, dimensions), true);
  };

  return (
    <div className="min-w-0 w-full max-w-full rounded-2xl border border-border bg-surface p-4 shadow-lg" role="dialog" aria-label={`Crop ${file.name}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-primary">Crop {file.name}</h3>
          <p className="text-sm text-secondary">Drag the frame to move it, or pull any handle to resize.</p>
        </div>
        <Button type="button" variant="ghost" onClick={onClose} className="shrink-0 px-3">Done</Button>
      </div>

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-medium text-primary" aria-live="polite">
          {ratioLabel} · {selected.width} × {selected.height} px
        </p>
        <p className="hidden text-xs text-secondary sm:block">Only the area inside the frame is kept</p>
      </div>

      {/* Dark viewport preserved for crop editor canvas */}
      <div
        ref={viewportRef}
        className="flex h-[min(62dvh,32rem)] min-h-72 w-full items-center justify-center overflow-hidden rounded-xl bg-stone-950 p-0"
        data-testid="crop-viewport"
      >
        <div
          ref={frameRef}
          data-testid="crop-image-frame"
          className="relative shrink-0 overflow-hidden"
          style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          {/* The browser applies image orientation to this preview. The worker crops the same oriented coordinate space. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={previewRef}
            alt="Crop preview"
            draggable={false}
            className="absolute inset-0 block h-full w-full select-none"
            onLoad={(event) => {
              const next = {
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              };
              setDimensions(next);
              onDimensions(next);
              const detected = crop ? detectCropRatio(crop, next) : "original";
              setRatio(detected === "custom" ? "free" : detected);
            }}
          />

          {dimensions.width > 0 && frameWidth > 0 && (
            <div
              data-testid="crop-selection"
              className="absolute cursor-move touch-none border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.6)]"
              style={{
                left: `${selected.x / dimensions.width * 100}%`,
                top: `${selected.y / dimensions.height * 100}%`,
                width: `${selected.width / dimensions.width * 100}%`,
                height: `${selected.height / dimensions.height * 100}%`,
              }}
              onPointerDown={(event) => startInteraction(event, "move")}
            >
              <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/55" />
              <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/55" />
              <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/55" />
              <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/55" />

              {HANDLES.map((handle) => {
                const style = HANDLE_STYLES[handle];
                return (
                  <button
                    key={handle}
                    type="button"
                    aria-label={`Resize crop from ${style.label}`}
                    className={`absolute h-11 w-11 touch-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white ${style.button}`}
                    onPointerDown={(event) => startInteraction(event, handle)}
                  >
                    <span className={`pointer-events-none absolute border-white bg-white ${style.marker}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-sm font-medium text-primary">Aspect ratio</p>
          <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-2 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Aspect ratio presets">
            {RATIO_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-label={`Use ${preset.label} aspect ratio`}
                aria-pressed={ratio === preset.value}
                onClick={() => applyRatio(preset.value)}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                  ratio === preset.value
                    ? "border-primary bg-primary text-canvas"
                    : "border-border bg-surface text-primary hover:bg-surface-subtle"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <details className="rounded-xl border border-border bg-surface-subtle">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-primary">Exact crop</summary>
          <div className="grid grid-cols-2 gap-3 border-t border-border p-4 sm:grid-cols-4">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field} className="grid gap-1 text-sm capitalize text-secondary">
                {field}
                <input
                  type="number"
                  inputMode="numeric"
                  min={field === "width" || field === "height" ? 1 : 0}
                  max={field === "x" || field === "width" ? dimensions.width : dimensions.height}
                  value={selected[field]}
                  onChange={(event) => updateExact(field, Number(event.target.value))}
                  className="min-h-11 rounded-lg border border-border bg-surface px-3 py-2 text-primary"
                />
              </label>
            ))}
          </div>
        </details>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            aria-label="Reset crop"
            onClick={() => {
              setRatio("original");
              onChange(null);
            }}
          >
            Reset crop
          </Button>
        </div>
      </div>
    </div>
  );
}

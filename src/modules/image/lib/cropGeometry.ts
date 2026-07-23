import type { PixelCrop } from "../types";

export interface ImageDimensions {
  width: number;
  height: number;
}

export type CropRatio =
  | "free"
  | "original"
  | "1:1"
  | "4:5"
  | "5:4"
  | "3:4"
  | "4:3"
  | "2:3"
  | "3:2"
  | "9:16"
  | "16:9";

export type DetectedCropRatio = Exclude<CropRatio, "free"> | "custom";

export type CropHandle =
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

const RATIOS: Record<Exclude<CropRatio, "free" | "original">, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "5:4": 5 / 4,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "2:3": 2 / 3,
  "3:2": 3 / 2,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
};

const RATIO_ORDER = Object.keys(RATIOS) as Array<keyof typeof RATIOS>;

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeCrop(crop: PixelCrop, bounds: ImageDimensions): PixelCrop {
  const boundsWidth = positiveInteger(bounds.width, 1);
  const boundsHeight = positiveInteger(bounds.height, 1);
  const x = clamp(Number.isFinite(crop.x) ? Math.round(crop.x) : 0, 0, boundsWidth - 1);
  const y = clamp(Number.isFinite(crop.y) ? Math.round(crop.y) : 0, 0, boundsHeight - 1);

  return {
    x,
    y,
    width: clamp(positiveInteger(crop.width, boundsWidth - x), 1, boundsWidth - x),
    height: clamp(positiveInteger(crop.height, boundsHeight - y), 1, boundsHeight - y),
  };
}

export function ratioValue(ratio: CropRatio, bounds: ImageDimensions): number | null {
  if (ratio === "free") return null;
  if (ratio === "original") return bounds.width / bounds.height;
  return RATIOS[ratio];
}

export function centeredCropForRatio(bounds: ImageDimensions, ratio: number | null): PixelCrop {
  const width = positiveInteger(bounds.width, 1);
  const height = positiveInteger(bounds.height, 1);

  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) {
    return { x: 0, y: 0, width, height };
  }

  let cropWidth = width;
  let cropHeight = Math.round(cropWidth / ratio);
  if (cropHeight > height) {
    cropHeight = height;
    cropWidth = Math.round(cropHeight * ratio);
  }

  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  };
}

export function moveCrop(
  crop: PixelCrop,
  deltaX: number,
  deltaY: number,
  bounds: ImageDimensions,
): PixelCrop {
  const normalized = normalizeCrop(crop, bounds);
  return {
    ...normalized,
    x: clamp(Math.round(normalized.x + deltaX), 0, bounds.width - normalized.width),
    y: clamp(Math.round(normalized.y + deltaY), 0, bounds.height - normalized.height),
  };
}

function freeResize(
  crop: PixelCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  bounds: ImageDimensions,
): PixelCrop {
  let left = crop.x;
  let top = crop.y;
  let right = crop.x + crop.width;
  let bottom = crop.y + crop.height;

  if (handle.includes("west")) left = clamp(Math.round(left + deltaX), 0, right - 1);
  if (handle.includes("east")) right = clamp(Math.round(right + deltaX), left + 1, bounds.width);
  if (handle.includes("north")) top = clamp(Math.round(top + deltaY), 0, bottom - 1);
  if (handle.includes("south")) bottom = clamp(Math.round(bottom + deltaY), top + 1, bounds.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function aspectCornerResize(
  crop: PixelCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  bounds: ImageDimensions,
  ratio: number,
): PixelCrop {
  const west = handle.includes("west");
  const north = handle.includes("north");
  const anchorX = west ? crop.x + crop.width : crop.x;
  const anchorY = north ? crop.y + crop.height : crop.y;
  const proposedWidth = Math.max(1, crop.width + (west ? -deltaX : deltaX));
  const proposedHeight = Math.max(1, crop.height + (north ? -deltaY : deltaY));
  const widthChange = Math.abs(proposedWidth - crop.width);
  const heightChangeAsWidth = Math.abs(proposedHeight - crop.height) * ratio;
  let width = widthChange >= heightChangeAsWidth ? proposedWidth : proposedHeight * ratio;
  const maxWidth = west ? anchorX : bounds.width - anchorX;
  const maxHeight = north ? anchorY : bounds.height - anchorY;
  width = clamp(width, 1, Math.min(maxWidth, maxHeight * ratio));
  const height = width / ratio;
  const roundedWidth = Math.max(1, Math.round(width));
  const roundedHeight = Math.max(1, Math.round(height));

  return normalizeCrop({
    x: west ? anchorX - roundedWidth : anchorX,
    y: north ? anchorY - roundedHeight : anchorY,
    width: roundedWidth,
    height: roundedHeight,
  }, bounds);
}

function aspectHorizontalResize(
  crop: PixelCrop,
  handle: "east" | "west",
  deltaX: number,
  bounds: ImageDimensions,
  ratio: number,
): PixelCrop {
  const west = handle === "west";
  const anchorX = west ? crop.x + crop.width : crop.x;
  const centerY = crop.y + crop.height / 2;
  const maxWidthFromX = west ? anchorX : bounds.width - anchorX;
  const maxHeight = 2 * Math.min(centerY, bounds.height - centerY);
  const width = clamp(crop.width + (west ? -deltaX : deltaX), 1, Math.min(maxWidthFromX, maxHeight * ratio));
  const roundedWidth = Math.max(1, Math.round(width));
  const roundedHeight = Math.max(1, Math.round(roundedWidth / ratio));

  return normalizeCrop({
    x: west ? anchorX - roundedWidth : anchorX,
    y: Math.round(centerY - roundedHeight / 2),
    width: roundedWidth,
    height: roundedHeight,
  }, bounds);
}

function aspectVerticalResize(
  crop: PixelCrop,
  handle: "north" | "south",
  deltaY: number,
  bounds: ImageDimensions,
  ratio: number,
): PixelCrop {
  const north = handle === "north";
  const anchorY = north ? crop.y + crop.height : crop.y;
  const centerX = crop.x + crop.width / 2;
  const maxHeightFromY = north ? anchorY : bounds.height - anchorY;
  const maxWidth = 2 * Math.min(centerX, bounds.width - centerX);
  const height = clamp(crop.height + (north ? -deltaY : deltaY), 1, Math.min(maxHeightFromY, maxWidth / ratio));
  const roundedHeight = Math.max(1, Math.round(height));
  const roundedWidth = Math.max(1, Math.round(roundedHeight * ratio));

  return normalizeCrop({
    x: Math.round(centerX - roundedWidth / 2),
    y: north ? anchorY - roundedHeight : anchorY,
    width: roundedWidth,
    height: roundedHeight,
  }, bounds);
}

export function resizeCrop(
  crop: PixelCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  bounds: ImageDimensions,
  aspectRatio: number | null,
): PixelCrop {
  const normalized = normalizeCrop(crop, bounds);
  if (!aspectRatio || !Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return freeResize(normalized, handle, deltaX, deltaY, bounds);
  }
  if (handle === "east" || handle === "west") {
    return aspectHorizontalResize(normalized, handle, deltaX, bounds, aspectRatio);
  }
  if (handle === "north" || handle === "south") {
    return aspectVerticalResize(normalized, handle, deltaY, bounds, aspectRatio);
  }
  return aspectCornerResize(normalized, handle, deltaX, deltaY, bounds, aspectRatio);
}

export function detectCropRatio(crop: PixelCrop, bounds: ImageDimensions): DetectedCropRatio {
  const normalized = normalizeCrop(crop, bounds);
  if (
    normalized.x === 0 &&
    normalized.y === 0 &&
    normalized.width === Math.round(bounds.width) &&
    normalized.height === Math.round(bounds.height)
  ) {
    return "original";
  }

  const value = normalized.width / normalized.height;
  return RATIO_ORDER.find((ratio) => Math.abs(value - RATIOS[ratio]) <= 0.002) ?? "custom";
}

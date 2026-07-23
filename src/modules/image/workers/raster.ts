import { IMAGE_LIMITS } from "../types";
import type { ImageOrientation, PixelCrop, ResizeOptions } from "../types";

export interface RasterImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function assertDimensionsWithinLimits(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Image dimensions are invalid");
  }
  if (width > IMAGE_LIMITS.maxEdge || height > IMAGE_LIMITS.maxEdge || width * height > IMAGE_LIMITS.maxPixels) {
    throw new Error("Image dimensions exceed the safe processing limit");
  }
}

export function assertRasterWithinLimits(raster: RasterImage): void {
  assertDimensionsWithinLimits(raster.width, raster.height);
  if (raster.data.byteLength !== raster.width * raster.height * 4) {
    throw new Error("Decoded image data is invalid");
  }
}

export function applyOrientation(raster: RasterImage, orientation: ImageOrientation): RasterImage {
  if (orientation === 1) return raster;
  const swaps = orientation >= 5;
  const width = swaps ? raster.height : raster.width;
  const height = swaps ? raster.width : raster.height;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sourceX = x;
      let sourceY = y;
      switch (orientation) {
        case 2: sourceX = raster.width - 1 - x; break;
        case 3: sourceX = raster.width - 1 - x; sourceY = raster.height - 1 - y; break;
        case 4: sourceY = raster.height - 1 - y; break;
        case 5: sourceX = y; sourceY = x; break;
        case 6: sourceX = y; sourceY = raster.height - 1 - x; break;
        case 7: sourceX = raster.width - 1 - y; sourceY = raster.height - 1 - x; break;
        case 8: sourceX = raster.width - 1 - y; sourceY = x; break;
      }
      const sourceIndex = (sourceY * raster.width + sourceX) * 4;
      const targetIndex = (y * width + x) * 4;
      data.set(raster.data.subarray(sourceIndex, sourceIndex + 4), targetIndex);
    }
  }
  return { data, width, height };
}

export function cropRaster(raster: RasterImage, crop: PixelCrop | null): RasterImage {
  if (!crop) return raster;
  const x = Math.max(0, Math.min(raster.width - 1, Math.round(crop.x)));
  const y = Math.max(0, Math.min(raster.height - 1, Math.round(crop.y)));
  const width = Math.max(1, Math.min(raster.width - x, Math.round(crop.width)));
  const height = Math.max(1, Math.min(raster.height - y, Math.round(crop.height)));
  if (x === 0 && y === 0 && width === raster.width && height === raster.height) return raster;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * raster.width + x) * 4;
    data.set(raster.data.subarray(start, start + width * 4), row * width * 4);
  }
  return { data, width, height };
}

function sampleBilinear(raster: RasterImage, x: number, y: number, channel: number): number {
  const x0 = Math.max(0, Math.min(raster.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(raster.height - 1, Math.floor(y)));
  const x1 = Math.min(raster.width - 1, x0 + 1);
  const y1 = Math.min(raster.height - 1, y0 + 1);
  const dx = x - x0;
  const dy = y - y0;
  const a = raster.data[(y0 * raster.width + x0) * 4 + channel];
  const b = raster.data[(y0 * raster.width + x1) * 4 + channel];
  const c = raster.data[(y1 * raster.width + x0) * 4 + channel];
  const d = raster.data[(y1 * raster.width + x1) * 4 + channel];
  return Math.round(a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy);
}

function scaleRaster(raster: RasterImage, width: number, height: number): RasterImage {
  if (width === raster.width && height === raster.height) return raster;
  assertDimensionsWithinLimits(width, height);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = (y + 0.5) * raster.height / height - 0.5;
    for (let x = 0; x < width; x += 1) {
      const sourceX = (x + 0.5) * raster.width / width - 0.5;
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        data[index + channel] = sampleBilinear(raster, sourceX, sourceY, channel);
      }
    }
  }
  return { data, width, height };
}

export function resizeRaster(raster: RasterImage, options: ResizeOptions): RasterImage {
  if (options.mode === "none") return raster;

  if (options.mode === "percentage") {
    const percentage = Math.max(1, Math.min(options.preventUpscale ? 100 : 400, options.percentage));
    return scaleRaster(
      raster,
      Math.max(1, Math.round(raster.width * percentage / 100)),
      Math.max(1, Math.round(raster.height * percentage / 100))
    );
  }

  const requestedWidth = options.width && options.width > 0 ? Math.round(options.width) : null;
  const requestedHeight = options.height && options.height > 0 ? Math.round(options.height) : null;
  if (!requestedWidth && !requestedHeight) return raster;

  if (!requestedWidth || !requestedHeight) {
    const scale = requestedWidth
      ? requestedWidth / raster.width
      : requestedHeight! / raster.height;
    const safeScale = options.preventUpscale ? Math.min(1, scale) : scale;
    return scaleRaster(
      raster,
      Math.max(1, Math.round(raster.width * safeScale)),
      Math.max(1, Math.round(raster.height * safeScale))
    );
  }

  if (!options.maintainAspectRatio || options.fit === "stretch") {
    return scaleRaster(
      raster,
      options.preventUpscale ? Math.min(requestedWidth, raster.width) : requestedWidth,
      options.preventUpscale ? Math.min(requestedHeight, raster.height) : requestedHeight
    );
  }

  if (options.fit === "cover") {
    const requestedScale = Math.max(requestedWidth / raster.width, requestedHeight / raster.height);
    const targetScale = options.preventUpscale && requestedScale > 1 ? 1 / requestedScale : 1;
    const targetWidth = Math.max(1, Math.round(requestedWidth * targetScale));
    const targetHeight = Math.max(1, Math.round(requestedHeight * targetScale));
    const scale = Math.max(targetWidth / raster.width, targetHeight / raster.height);
    const scaled = scaleRaster(
      raster,
      Math.max(targetWidth, Math.round(raster.width * scale)),
      Math.max(targetHeight, Math.round(raster.height * scale))
    );
    return cropRaster(scaled, {
      x: Math.floor((scaled.width - targetWidth) / 2),
      y: Math.floor((scaled.height - targetHeight) / 2),
      width: targetWidth,
      height: targetHeight,
    });
  }

  const scale = Math.min(requestedWidth / raster.width, requestedHeight / raster.height);
  const safeScale = options.preventUpscale ? Math.min(1, scale) : scale;
  return scaleRaster(
    raster,
    Math.max(1, Math.round(raster.width * safeScale)),
    Math.max(1, Math.round(raster.height * safeScale))
  );
}

export function compositeForJpeg(raster: RasterImage, matte: string): RasterImage {
  if (!/^#[0-9a-f]{6}$/i.test(matte)) throw new Error("JPEG background color is invalid");
  const matteChannels = [1, 3, 5].map((offset) => Number.parseInt(matte.slice(offset, offset + 2), 16));
  const data = new Uint8ClampedArray(raster.data);
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    for (let channel = 0; channel < 3; channel += 1) {
      data[index + channel] = Math.round((data[index + channel] * alpha + matteChannels[channel] * (255 - alpha)) / 255);
    }
    data[index + 3] = 255;
  }
  return { data, width: raster.width, height: raster.height };
}

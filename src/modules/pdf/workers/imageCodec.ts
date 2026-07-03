import type {
  CompressParams,
  EncodedImage,
  RawImage,
} from "./imageCompression";

/**
 * Browser-side image codec for in-place PDF compression.
 *
 * Runs inside the PDF Web Worker and uses only native worker APIs
 * (createImageBitmap, OffscreenCanvas, DecompressionStream) — no dependencies,
 * no bundle cost. Given one image XObject's raw bytes, it decodes, optionally
 * downscales, and re-encodes as JPEG. Returns null if anything can't be handled,
 * in which case the caller leaves the original image untouched.
 */
export async function encodeImage(
  image: RawImage,
  params: CompressParams
): Promise<EncodedImage | null> {
  try {
    const bitmap = await decode(image);
    if (!bitmap) return null;

    const { width, height } = fitWithin(bitmap.width, bitmap.height, params.maxEdge);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Grayscale images (notably soft masks) must stay 1-component, so we can't
    // emit a 3-channel JPEG. Re-encode them as deflated DeviceGray samples.
    if (image.colorSpace === "DeviceGray") {
      const { data } = ctx.getImageData(0, 0, width, height);
      const gray = new Uint8Array(width * height);
      for (let i = 0; i < gray.length; i++) gray[i] = data[i * 4]; // R == G == B
      const bytes = await deflate(gray);
      return { bytes, width, height, filter: "FlateDecode", colorSpace: "DeviceGray" };
    }

    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: params.quality,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, width, height, filter: "DCTDecode", colorSpace: "DeviceRGB" };
  } catch {
    // Any decode/encode failure → skip this image, keep the original.
    return null;
  }
}

/** Deflate raw bytes to a zlib (PDF FlateDecode) stream via native APIs. */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode a raw image XObject into an ImageBitmap. */
async function decode(image: RawImage): Promise<ImageBitmap | null> {
  if (image.filter === "DCTDecode") {
    // The stream bytes are already a complete JPEG file.
    const blob = new Blob([toArrayBuffer(image.bytes)], { type: "image/jpeg" });
    return createImageBitmap(blob);
  }

  // FlateDecode: inflate to raw samples, then build pixel data.
  const samples = await inflate(image.bytes);
  const pixels = samplesToRgba(samples, image.width, image.height, image.colorSpace);
  if (!pixels) return null;
  return createImageBitmap(pixels);
}

/** Scale dimensions down so the longest edge is at most maxEdge (never up). */
function fitWithin(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Inflate a zlib (PDF FlateDecode) stream using the native DecompressionStream. */
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Expand decoded RGB/Gray samples into an RGBA ImageData buffer. */
function samplesToRgba(
  samples: Uint8Array,
  width: number,
  height: number,
  colorSpace: RawImage["colorSpace"]
): ImageData | null {
  const pixelCount = width * height;
  const rgba = new Uint8ClampedArray(pixelCount * 4);

  if (colorSpace === "DeviceGray") {
    if (samples.length < pixelCount) return null;
    for (let i = 0; i < pixelCount; i++) {
      const v = samples[i];
      rgba[i * 4] = v;
      rgba[i * 4 + 1] = v;
      rgba[i * 4 + 2] = v;
      rgba[i * 4 + 3] = 255;
    }
  } else {
    if (samples.length < pixelCount * 3) return null;
    for (let i = 0; i < pixelCount; i++) {
      rgba[i * 4] = samples[i * 3];
      rgba[i * 4 + 1] = samples[i * 3 + 1];
      rgba[i * 4 + 2] = samples[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
  }

  return new ImageData(rgba, width, height);
}

/** Copy into a fresh ArrayBuffer so Blob never chokes on a SharedArrayBuffer view. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

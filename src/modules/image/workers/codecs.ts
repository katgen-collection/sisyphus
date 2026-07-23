import type { ImageOutputFormat } from "../types";
import type { RasterImage } from "./raster";

export async function decodeStandard(
  format: "jpeg" | "png" | "webp" | "avif",
  source: ArrayBuffer
): Promise<RasterImage> {
  let decoded: ImageData;
  switch (format) {
    case "jpeg":
      decoded = await (await import("@jsquash/jpeg/decode.js")).default(source, {
        preserveOrientation: false,
      });
      break;
    case "png":
      decoded = await (await import("@jsquash/png/decode.js")).default(source);
      break;
    case "webp":
      decoded = await (await import("@jsquash/webp/decode.js")).default(source);
      if (!decoded) throw new Error("WebP decoding failed");
      break;
    case "avif": {
      const avif = await (await import("@jsquash/avif/decode.js")).default(source);
      if (!avif) throw new Error("AVIF decoding failed");
      decoded = avif;
      break;
    }
  }
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

let avifModule: Promise<Awaited<ReturnType<typeof createAvifModule>>> | null = null;

async function createAvifModule() {
  const [{ default: factory }, { initEmscriptenModule }] = await Promise.all([
    import("@jsquash/avif/codec/enc/avif_enc.js"),
    import("@jsquash/avif/utils.js"),
  ]);
  return initEmscriptenModule(factory);
}

async function encodeAvifSingleThread(imageData: ImageData, quality: number): Promise<ArrayBuffer> {
  avifModule ??= createAvifModule();
  const codecModule = await avifModule;
  const output = codecModule.encode(
    new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    imageData.width,
    imageData.height,
    {
      quality,
      qualityAlpha: quality,
      denoiseLevel: 0,
      tileRowsLog2: 0,
      tileColsLog2: 0,
      speed: 6,
      subsample: 1,
      chromaDeltaQ: false,
      sharpness: 0,
      enableSharpYUV: false,
      tune: 0,
      bitDepth: 8,
      lossless: false,
    }
  );
  if (!output) throw new Error("Encoding error");
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

export async function encodeStandard(
  format: ImageOutputFormat,
  raster: RasterImage,
  quality: number
): Promise<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(raster.data.byteLength);
  pixels.set(raster.data);
  const imageData = new ImageData(pixels, raster.width, raster.height);
  const safeQuality = Math.max(1, Math.min(100, Math.round(quality)));
  switch (format) {
    case "jpeg":
      return (await import("@jsquash/jpeg/encode.js")).default(imageData, { quality: safeQuality });
    case "png":
      return (await import("@jsquash/png/encode.js")).default(imageData, { bitDepth: 8 });
    case "webp":
      return (await import("@jsquash/webp/encode.js")).default(imageData, { quality: safeQuality });
    case "avif":
      return encodeAvifSingleThread(imageData, safeQuality);
  }
}

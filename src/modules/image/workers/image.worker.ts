import * as Comlink from "comlink";
import { inspectImage } from "../lib/inspectImage";
import { OUTPUT_MIME } from "../lib/naming";
import { IMAGE_LIMITS } from "../types";
import type {
  ImageErrorCode,
  ImageProgressCallback,
  ImageWorkerAPI,
  ImageWorkerInput,
  ImageWorkerResponse,
} from "../types";
import { decodeStandard, encodeStandard } from "./codecs";
import {
  applyOrientation,
  assertDimensionsWithinLimits,
  assertRasterWithinLimits,
  compositeForJpeg,
  cropRaster,
  resizeRaster,
} from "./raster";

class ImageProcessingError extends Error {
  constructor(readonly code: ImageErrorCode, message: string) {
    super(message);
  }
}

function fail(code: ImageErrorCode, message: string): never {
  throw new ImageProcessingError(code, message);
}

function normalizeError(error: unknown): ImageWorkerResponse {
  if (error instanceof ImageProcessingError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  const message = error instanceof Error ? error.message : "Image processing failed";
  const code: ImageErrorCode = /encod/i.test(message) ? "encode-failed" : "decode-failed";
  console.error("Image worker failure", error);
  return { ok: false, error: { code, message: code === "encode-failed" ? "The image could not be encoded." : "The image could not be decoded." } };
}

const api: ImageWorkerAPI = {
  async processImage(input: ImageWorkerInput, onProgress?: ImageProgressCallback): Promise<ImageWorkerResponse> {
    try {
      if (typeof WebAssembly !== "object" || typeof ImageData !== "function") {
        fail("unsupported-browser", "This browser cannot run the local image codecs.");
      }
      if (input.source.byteLength === 0) fail("empty-input", "The selected file is empty.");
      if (input.source.byteLength > IMAGE_LIMITS.maxSourceBytes) {
        fail("source-too-large", "The selected file exceeds the 100 MiB limit.");
      }

      onProgress?.("validating");
      let inspected;
      try {
        inspected = inspectImage(new Uint8Array(input.source));
      } catch {
        fail("unsupported-input", "The file is not a supported JPEG, PNG, WebP, or AVIF image.");
      }
      if (inspected.sequence) fail("unsupported-sequence", "Animated images and image sequences are not supported yet.");
      if (inspected.width && inspected.height) {
        try {
          assertDimensionsWithinLimits(inspected.width, inspected.height);
        } catch (error) {
          fail("image-too-large", error instanceof Error ? error.message : "The image is too large.");
        }
      }

      onProgress?.("decoding");
      let raster = await decodeStandard(inspected.format, input.source);
      try {
        assertRasterWithinLimits(raster);
      } catch (error) {
        fail("image-too-large", error instanceof Error ? error.message : "The image is too large.");
      }

      onProgress?.("orienting");
      raster = applyOrientation(raster, inspected.format === "jpeg" ? inspected.orientation : 1);
      onProgress?.("cropping");
      raster = cropRaster(raster, input.options.crop);
      onProgress?.("resizing");
      raster = resizeRaster(raster, input.options.resize);
      assertRasterWithinLimits(raster);
      if (input.options.outputFormat === "avif" && raster.width * raster.height > IMAGE_LIMITS.maxAvifPixels) {
        fail("image-too-large", "AVIF output is limited to 24 megapixels.");
      }
      if (input.options.outputFormat === "jpeg") {
        try {
          raster = compositeForJpeg(raster, input.options.jpegMatte);
        } catch {
          fail("invalid-input", "JPEG background color must be a six-digit hex color.");
        }
      }

      onProgress?.("encoding");
      let data: ArrayBuffer;
      try {
        data = await encodeStandard(input.options.outputFormat, raster, input.options.quality);
      } catch (error) {
        console.error("Image encode failure", error);
        fail("encode-failed", "The image could not be encoded.");
      }
      onProgress?.("finalizing");
      const result = {
        data,
        mimeType: OUTPUT_MIME[input.options.outputFormat],
        inputBytes: input.source.byteLength,
        outputBytes: data.byteLength,
        width: raster.width,
        height: raster.height,
      };
      const response: ImageWorkerResponse = { ok: true, result };
      return Comlink.transfer(response, [data]);
    } catch (error) {
      return normalizeError(error);
    }
  },
};

Comlink.expose(api);

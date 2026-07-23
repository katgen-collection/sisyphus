import { describe, expect, test } from "bun:test";
import fixture from "../test-fixtures/Landscape_6.jpg" with { type: "file" };
import { inspectImage } from "./inspectImage";

const fixturePath = fixture as unknown as string;

function png(width: number, height: number, animated = false): Uint8Array {
  const bytes = new Uint8Array(animated ? 57 : 45);
  const view = new DataView(bytes.buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  let offset = 33;
  if (animated) {
    view.setUint32(offset, 0);
    bytes.set([0x61, 0x63, 0x54, 0x4c], offset + 4);
    offset += 12;
  }
  view.setUint32(offset, 0);
  bytes.set([0x49, 0x45, 0x4e, 0x44], offset + 4);
  return bytes;
}

function webp(width: number, height: number, animated = false): Uint8Array {
  const bytes = new Uint8Array(30);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBPVP8X"), 8);
  bytes[20] = animated ? 2 : 0;
  const w = width - 1;
  const h = height - 1;
  bytes.set([w & 255, (w >> 8) & 255, (w >> 16) & 255], 24);
  bytes.set([h & 255, (h >> 8) & 255, (h >> 16) & 255], 27);
  return bytes;
}

function isoBmff(majorBrand: string, compatibleBrand: string): Uint8Array {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength);
  bytes.set(new TextEncoder().encode("ftyp"), 4);
  bytes.set(new TextEncoder().encode(majorBrand), 8);
  bytes.set(new TextEncoder().encode(compatibleBrand), 16);
  return bytes;
}

describe("inspectImage", () => {
  test("reads PNG dimensions and animation", () => {
    expect(inspectImage(png(20, 10))).toMatchObject({ format: "png", width: 20, height: 10, sequence: false });
    expect(inspectImage(png(20, 10, true)).sequence).toBe(true);
  });

  test("reads WebP dimensions and animation", () => {
    expect(inspectImage(webp(17, 9))).toMatchObject({ format: "webp", width: 17, height: 9, sequence: false });
    expect(inspectImage(webp(17, 9, true)).sequence).toBe(true);
  });

  test("reads a real JPEG EXIF orientation fixture", async () => {
    const bytes = new Uint8Array(await Bun.file(fixturePath).arrayBuffer());

    expect(inspectImage(bytes)).toMatchObject({
      format: "jpeg",
      width: 1200,
      height: 1800,
      orientation: 6,
      sequence: false,
    });
  });

  test("accepts AVIF but keeps unverified HEIC and HEIF disabled", () => {
    expect(inspectImage(isoBmff("avif", "mif1"))).toMatchObject({ format: "avif", sequence: false });
    expect(() => inspectImage(isoBmff("heic", "mif1"))).toThrow("Invalid");
    expect(() => inspectImage(isoBmff("mif1", "heic"))).toThrow("Invalid");
  });

  test("rejects unknown data", () => {
    expect(() => inspectImage(new Uint8Array([1, 2, 3]))).toThrow("Invalid");
  });
});

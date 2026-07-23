import type { ImageInputFormat, ImageOrientation } from "../types";

export interface InspectedImage {
  format: ImageInputFormat;
  width: number | null;
  height: number | null;
  orientation: ImageOrientation;
  sequence: boolean;
}

const decoder = new TextDecoder("ascii");

function text(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || length < 0 || start + length > bytes.byteLength) return "";
  return decoder.decode(bytes.subarray(start, start + length));
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function invalid(): never {
  throw new Error("Invalid or unsupported image file");
}

function jpegOrientation(bytes: Uint8Array, start: number, length: number): ImageOrientation {
  if (length < 14 || text(bytes, start, 6) !== "Exif\0\0") return 1;
  const tiff = start + 6;
  const endian = text(bytes, tiff, 2);
  const little = endian === "II";
  if (!little && endian !== "MM") return 1;
  const view = viewOf(bytes);
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  if (tiff + 8 > bytes.byteLength || u16(tiff + 2) !== 42) return 1;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > start + length) return 1;
  const count = u16(ifd);
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > start + length) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? (value as ImageOrientation) : 1;
    }
  }
  return 1;
}

function inspectJpeg(bytes: Uint8Array): InspectedImage {
  let offset = 2;
  let orientation: ImageOrientation = 1;
  while (offset + 4 <= bytes.byteLength) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.byteLength) invalid();
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.byteLength) invalid();
    const payload = offset + 2;
    if (marker === 0xe1) orientation = jpegOrientation(bytes, payload, length - 2);
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof) {
      if (length < 7) invalid();
      return {
        format: "jpeg",
        width: (bytes[payload + 3] << 8) | bytes[payload + 4],
        height: (bytes[payload + 1] << 8) | bytes[payload + 2],
        orientation,
        sequence: false,
      };
    }
    offset += length;
  }
  invalid();
}

function inspectPng(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength < 24 || text(bytes, 12, 4) !== "IHDR") invalid();
  const view = viewOf(bytes);
  let offset = 8;
  let sequence = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset);
    const type = text(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (!Number.isSafeInteger(end) || end > bytes.byteLength) invalid();
    if (type === "acTL") sequence = true;
    offset = end;
    if (type === "IEND") break;
  }
  return {
    format: "png",
    width: view.getUint32(16),
    height: view.getUint32(20),
    orientation: 1,
    sequence,
  };
}

function inspectWebp(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength < 30 || text(bytes, 8, 4) !== "WEBP") invalid();
  const view = viewOf(bytes);
  const chunk = text(bytes, 12, 4);
  if (chunk === "VP8X") {
    const flags = bytes[20];
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return { format: "webp", width, height, orientation: 1, sequence: (flags & 0x02) !== 0 };
  }
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) invalid();
    return {
      format: "webp",
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
      orientation: 1,
      sequence: false,
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) invalid();
    const bits = view.getUint32(21, true);
    return {
      format: "webp",
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
      orientation: 1,
      sequence: false,
    };
  }
  invalid();
}

const AVIF_BRANDS = new Set(["avif", "avis"]);

function inspectIsoBmff(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength < 16 || text(bytes, 4, 4) !== "ftyp") invalid();
  const view = viewOf(bytes);
  const boxSize = view.getUint32(0);
  if (boxSize < 16 || boxSize > bytes.byteLength) invalid();
  const brands: string[] = [text(bytes, 8, 4)];
  for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(text(bytes, offset, 4));
  const format: ImageInputFormat | null = brands.some((brand) => AVIF_BRANDS.has(brand))
    ? "avif"
    : null;
  if (!format) invalid();

  let width: number | null = null;
  let height: number | null = null;
  for (let offset = boxSize; offset + 8 <= bytes.byteLength;) {
    const size = view.getUint32(offset);
    if (size === 0) break;
    if (size < 8 || offset + size > bytes.byteLength) invalid();
    if (text(bytes, offset + 4, 4) === "ispe" && size >= 20) {
      width = view.getUint32(offset + 12);
      height = view.getUint32(offset + 16);
      break;
    }
    offset += size;
  }
  return { format, width, height, orientation: 1, sequence: brands.includes("avis") || brands.includes("msf1") };
}

export function inspectImage(bytes: Uint8Array): InspectedImage {
  if (bytes.byteLength === 0) invalid();
  if (bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return inspectJpeg(bytes);
  if (bytes.byteLength >= 8 && text(bytes, 1, 3) === "PNG" && bytes[0] === 0x89) return inspectPng(bytes);
  if (bytes.byteLength >= 12 && text(bytes, 0, 4) === "RIFF") return inspectWebp(bytes);
  if (bytes.byteLength >= 12 && text(bytes, 4, 4) === "ftyp") return inspectIsoBmff(bytes);
  invalid();
}

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
} from "pdf-lib";

/**
 * In-place PDF image compression (Option B).
 *
 * This module is intentionally free of browser APIs so it can be unit-tested in
 * Node. It walks a PDF's image XObjects, classifies which ones we can safely
 * recompress, and swaps in smaller image bytes produced by an injected codec.
 * Text, fonts, and vector content are never touched, so selectability is fully
 * preserved. Anything we can't safely decode is left byte-for-byte untouched.
 */

/** Target quality knobs for a single compression run. */
export interface CompressParams {
  /** Longest edge (px) an image is downscaled to; larger images shrink. */
  maxEdge: number;
  /** JPEG quality, 0..1. */
  quality: number;
}

/** A single image XObject handed to the codec for recompression. */
export interface RawImage {
  /** The raw (still-encoded) stream bytes exactly as stored in the PDF. */
  bytes: Uint8Array;
  /** Single stream filter: "DCTDecode" (JPEG) or "FlateDecode" (raw samples). */
  filter: "DCTDecode" | "FlateDecode";
  width: number;
  height: number;
  /** Normalised to "DeviceRGB" or "DeviceGray" by the classifier. */
  colorSpace: "DeviceRGB" | "DeviceGray";
  bitsPerComponent: number;
}

/**
 * Result the codec returns for a recompressed image. Colour images come back as
 * JPEG (DCTDecode/DeviceRGB); grayscale images (incl. soft masks) come back as
 * deflated raw samples (FlateDecode/DeviceGray) so they stay valid 1-component
 * masks.
 */
export interface EncodedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  filter: "DCTDecode" | "FlateDecode";
  colorSpace: "DeviceRGB" | "DeviceGray";
}

/** Injected codec: browser impl in imageCodec.ts, fake in tests. */
export type EncodeImageFn = (
  image: RawImage,
  params: CompressParams
) => Promise<EncodedImage | null>;

/** Why an image was not recompressed. */
export type SkipReason =
  | "unsupported-filter"
  | "transparency"
  | "predictor"
  | "colorspace"
  | "not-smaller";

export interface SkipTally {
  reason: SkipReason;
  count: number;
  bytes: number;
}

export interface CompressionStats {
  /** Total image XObjects found in the document. */
  imagesTotal: number;
  /** Duplicate image objects collapsed into a shared copy. */
  duplicatesRemoved: number;
  /** How many unique images were eligible for recompression. */
  imagesEligible: number;
  /** How many were actually replaced with smaller bytes. */
  imagesRecompressed: number;
  originalSize: number;
  compressedSize: number;
  /** Breakdown of images we left untouched, by reason, biggest first. */
  skipped: SkipTally[];
}

export interface CompressionResult {
  data: Uint8Array;
  stats: CompressionStats;
}

const ALLOWED_COLOR_SPACES = new Set(["DeviceRGB", "DeviceGray"]);

/** Returns a PDFName's string form (e.g. "/Image") or null. */
function nameString(obj: unknown): string | null {
  return obj instanceof PDFName ? obj.toString() : null;
}

/** Resolve the number of colour components declared by an ICCBased stream. */
function iccComponentCount(doc: PDFDocument, iccArray: PDFArray): number | null {
  const streamRef = iccArray.get(1);
  const stream = streamRef instanceof PDFRef ? doc.context.lookup(streamRef) : streamRef;
  if (!(stream instanceof PDFRawStream)) return null;
  const n = stream.dict.lookup(PDFName.of("N"));
  return n instanceof PDFNumber ? n.asNumber() : null;
}

/**
 * Normalise a /ColorSpace entry to "DeviceRGB" | "DeviceGray", or null if it's
 * something we won't touch (CMYK, Indexed, unknown ICC channel counts, ...).
 */
function normaliseColorSpace(doc: PDFDocument, csObj: unknown): RawImage["colorSpace"] | null {
  const name = nameString(csObj);
  if (name === "/DeviceRGB" || name === "/CalRGB") return "DeviceRGB";
  if (name === "/DeviceGray" || name === "/CalGray") return "DeviceGray";

  if (csObj instanceof PDFArray && nameString(csObj.get(0)) === "/ICCBased") {
    const n = iccComponentCount(doc, csObj);
    if (n === 3) return "DeviceRGB";
    if (n === 1) return "DeviceGray";
  }
  return null;
}

/** Extract a single supported filter name, or null for chains / unsupported. */
function singleFilter(filterObj: unknown): RawImage["filter"] | null {
  let name = nameString(filterObj);
  // A one-element array like [/DCTDecode] is equivalent to a bare name.
  if (!name && filterObj instanceof PDFArray && filterObj.size() === 1) {
    name = nameString(filterObj.get(0));
  }
  if (name === "/DCTDecode") return "DCTDecode";
  if (name === "/FlateDecode") return "FlateDecode";
  return null;
}

/** True if a FlateDecode image uses a predictor we don't reverse (so we skip). */
function hasPredictor(dict: PDFDict): boolean {
  const parms =
    dict.lookup(PDFName.of("DecodeParms")) ?? dict.lookup(PDFName.of("DP"));
  const parmDict = parms instanceof PDFArray ? parms.lookup(0) : parms;
  if (parmDict instanceof PDFDict) {
    const predictor = parmDict.lookup(PDFName.of("Predictor"));
    if (predictor instanceof PDFNumber) return predictor.asNumber() > 1;
  }
  return false;
}

interface ImageEntry {
  ref: PDFRef;
  stream: PDFRawStream;
  size: number;
  raw: RawImage | null; // non-null iff eligible
  reason: SkipReason | null; // why it was skipped (when raw is null)
}

/** Walk every indirect object and pick out the image XObjects. */
function collectImages(doc: PDFDocument): ImageEntry[] {
  const entries: ImageEntry[] = [];

  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (nameString(dict.lookup(PDFName.of("Subtype"))) !== "/Image") continue;

    const { raw, reason } = classify(doc, obj);
    entries.push({ ref, stream: obj, size: obj.getContents().length, raw, reason });
  }

  return entries;
}

/**
 * Decide whether an image is safe to recompress.
 *
 * Soft masks (`/SMask`) are ALLOWED: we recompress the base colour image and
 * keep the mask reference — the mask is itself a separate grayscale image object
 * that gets recompressed on its own pass. Only stencil masks (`/ImageMask`) and
 * explicit `/Mask` (colour-key / 1-bit) are skipped, since we can't safely
 * reconstruct those.
 */
function classify(
  doc: PDFDocument,
  stream: PDFRawStream
): { raw: RawImage | null; reason: SkipReason | null } {
  const dict = stream.dict;

  const filter = singleFilter(dict.lookup(PDFName.of("Filter")));
  if (!filter) return { raw: null, reason: "unsupported-filter" };

  if (dict.has(PDFName.of("ImageMask")) || dict.has(PDFName.of("Mask"))) {
    return { raw: null, reason: "transparency" };
  }
  if (filter === "FlateDecode" && hasPredictor(dict)) {
    return { raw: null, reason: "predictor" };
  }

  const width = dict.lookup(PDFName.of("Width"));
  const height = dict.lookup(PDFName.of("Height"));
  if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber)) {
    return { raw: null, reason: "colorspace" };
  }

  const bpcObj = dict.lookup(PDFName.of("BitsPerComponent"));
  const bitsPerComponent = bpcObj instanceof PDFNumber ? bpcObj.asNumber() : 8;
  // FlateDecode raw samples must be 8-bit; JPEG defines its own depth internally.
  if (filter === "FlateDecode" && bitsPerComponent !== 8) {
    return { raw: null, reason: "colorspace" };
  }

  const colorSpace = normaliseColorSpace(doc, dict.lookup(PDFName.of("ColorSpace")));
  if (!colorSpace || !ALLOWED_COLOR_SPACES.has(colorSpace)) {
    return { raw: null, reason: "colorspace" };
  }

  return {
    raw: {
      bytes: stream.getContents(),
      filter,
      width: width.asNumber(),
      height: height.asNumber(),
      colorSpace,
      bitsPerComponent,
    },
    reason: null,
  };
}

/**
 * Replace an image XObject's stream with recompressed bytes. Uses the codec's
 * reported filter/colour space (JPEG-RGB for colour, deflated-gray for masks)
 * and preserves any `/SMask` reference so transparency survives.
 */
function replaceImage(doc: PDFDocument, entry: ImageEntry, encoded: EncodedImage): void {
  const dict = entry.stream.dict;

  dict.set(PDFName.of("Filter"), PDFName.of(encoded.filter));
  dict.set(PDFName.of("Width"), PDFNumber.of(encoded.width));
  dict.set(PDFName.of("Height"), PDFNumber.of(encoded.height));
  dict.set(PDFName.of("BitsPerComponent"), PDFNumber.of(8));
  dict.set(PDFName.of("ColorSpace"), PDFName.of(encoded.colorSpace));
  dict.set(PDFName.of("Length"), PDFNumber.of(encoded.bytes.length));
  dict.delete(PDFName.of("DecodeParms"));
  dict.delete(PDFName.of("DP"));

  doc.context.assign(entry.ref, PDFRawStream.of(dict, encoded.bytes));
}

/** Fast non-cryptographic content hash (FNV-1a) for bucketing image bytes. */
function fnv1a(bytes: Uint8Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function refKey(ref: PDFRef): string {
  return `${ref.objectNumber} ${ref.generationNumber}`;
}

/** Rewrite every indirect reference that points at a deduped duplicate. */
function remapReferences(doc: PDFDocument, canonicalOf: Map<string, PDFRef>): void {
  const visit = (obj: unknown) => {
    if (obj instanceof PDFDict) {
      for (const [key, value] of obj.entries()) {
        const canonical = value instanceof PDFRef ? canonicalOf.get(refKey(value)) : undefined;
        if (canonical) obj.set(key, canonical);
        else if (value instanceof PDFDict || value instanceof PDFArray) visit(value);
      }
    } else if (obj instanceof PDFArray) {
      for (let i = 0; i < obj.size(); i++) {
        const value = obj.get(i);
        const canonical = value instanceof PDFRef ? canonicalOf.get(refKey(value)) : undefined;
        if (canonical) obj.set(i, canonical);
        else if (value instanceof PDFDict || value instanceof PDFArray) visit(value);
      }
    }
  };

  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    visit(obj instanceof PDFRawStream ? obj.dict : obj);
  }
}

/**
 * Collapse byte-identical image XObjects into a single shared object. Slide
 * decks repeat the same logo/background on every page; deduping stores it once
 * and repoints every reference. Returns the surviving (unique) images and how
 * many duplicates were removed.
 */
function dedupeImages(
  doc: PDFDocument,
  images: ImageEntry[]
): { survivors: ImageEntry[]; duplicatesRemoved: number } {
  const buckets = new Map<string, ImageEntry[]>();
  const canonicalOf = new Map<string, PDFRef>();
  const survivors: ImageEntry[] = [];
  let duplicatesRemoved = 0;

  for (const entry of images) {
    const bytes = entry.stream.getContents();
    const key = `${bytes.length}:${fnv1a(bytes)}`;
    const bucket = buckets.get(key);
    const twin = bucket?.find((e) => bytesEqual(e.stream.getContents(), bytes));

    if (twin) {
      canonicalOf.set(refKey(entry.ref), twin.ref);
      doc.context.delete(entry.ref);
      duplicatesRemoved++;
    } else if (bucket) {
      bucket.push(entry);
      survivors.push(entry);
    } else {
      buckets.set(key, [entry]);
      survivors.push(entry);
    }
  }

  if (duplicatesRemoved > 0) remapReferences(doc, canonicalOf);
  return { survivors, duplicatesRemoved };
}

/**
 * Recompress a PDF's images in place. Returns the smaller of {rewritten,
 * original} so we never hand back a larger file, along with stats.
 */
export async function compressPdfImages(
  pdfData: Uint8Array,
  params: CompressParams,
  encodeImage: EncodeImageFn
): Promise<CompressionResult> {
  const doc = await PDFDocument.load(pdfData, { ignoreEncryption: true });
  const allImages = collectImages(doc);

  // Collapse duplicate images first, then only recompress the unique survivors.
  const { survivors: images, duplicatesRemoved } = dedupeImages(doc, allImages);

  const skipBytes = new Map<SkipReason, { count: number; bytes: number }>();
  const tallySkip = (reason: SkipReason, bytes: number) => {
    const entry = skipBytes.get(reason) ?? { count: 0, bytes: 0 };
    entry.count++;
    entry.bytes += bytes;
    skipBytes.set(reason, entry);
  };

  let imagesRecompressed = 0;
  for (const entry of images) {
    if (!entry.raw) {
      tallySkip(entry.reason ?? "colorspace", entry.size);
      continue;
    }

    const encoded = await encodeImage(entry.raw, params);
    // Only swap if the codec succeeded AND the result is actually smaller.
    if (encoded && encoded.bytes.length < entry.raw.bytes.length) {
      replaceImage(doc, entry, encoded);
      imagesRecompressed++;
    } else {
      tallySkip("not-smaller", entry.size);
    }
  }

  const rewritten = await doc.save();
  const imagesEligible = images.filter((e) => e.raw !== null).length;

  const skipped: SkipTally[] = [...skipBytes.entries()]
    .map(([reason, v]) => ({ reason, count: v.count, bytes: v.bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  // If our rewrite didn't actually save bytes, keep the original untouched.
  const shrank = rewritten.length < pdfData.length;
  return {
    data: shrank ? rewritten : pdfData,
    stats: {
      imagesTotal: allImages.length,
      duplicatesRemoved,
      imagesEligible,
      imagesRecompressed,
      originalSize: pdfData.length,
      compressedSize: shrank ? rewritten.length : pdfData.length,
      skipped,
    },
  };
}

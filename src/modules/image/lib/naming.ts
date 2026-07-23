import type { ImageOutputFormat, ImageOutputMime } from "../types";

export const OUTPUT_EXTENSION: Record<ImageOutputFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
};

export const OUTPUT_MIME: Record<ImageOutputFormat, ImageOutputMime> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function makeOutputName(
  sourceName: string,
  format: ImageOutputFormat,
  usedNames: ReadonlySet<string>
): string {
  const leaf = sourceName.split(/[\\/]/).pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  let stem = (dot > 0 ? leaf.slice(0, dot) : leaf)
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/[\x00-\x1f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 120);
  if (!stem) stem = "image";
  if (RESERVED.test(stem)) stem = `image-${stem.toLowerCase()}`;

  const extension = OUTPUT_EXTENSION[format];
  let candidate = `${stem}.${extension}`;
  let suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase("en-US"))) {
    candidate = `${stem} (${suffix}).${extension}`;
    suffix += 1;
  }
  return candidate;
}

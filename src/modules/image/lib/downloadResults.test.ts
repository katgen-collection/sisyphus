import { describe, expect, mock, test } from "bun:test";
import { IMAGE_LIMITS } from "../types";
import type { ImageBatchResult } from "../types";

const downloads: Array<{ blob: Blob; filename: string }> = [];

mock.module("@/modules/_shared", () => ({
  downloadArrayBuffer: () => {},
  downloadBlob: (blob: Blob, filename: string) => {
    downloads.push({ blob, filename });
  },
}));

const { downloadResultZip } = await import("./downloadResults");

function result(
  filename: string,
  outputBytes: number,
  data = Uint8Array.of(1).buffer
): ImageBatchResult {
  return {
    filename,
    data,
    mimeType: "image/png",
    inputBytes: data.byteLength,
    outputBytes,
    width: 1,
    height: 1,
  };
}

describe("downloadResultZip", () => {
  test("rejects empty results and totals over the ZIP limit before creating a download", async () => {
    downloads.length = 0;

    await expect(downloadResultZip([])).rejects.toThrow(
      "There are no converted images to download."
    );
    await expect(
      downloadResultZip([
        result("first.png", IMAGE_LIMITS.maxZipBytes),
        result("second.png", 1),
      ])
    ).rejects.toThrow("Combined results exceed the 100 MiB ZIP limit.");

    expect(downloads).toEqual([]);
  });

  test("creates an uncompressed local ZIP for valid results", async () => {
    downloads.length = 0;

    await downloadResultZip([
      result("first.png", 1, Uint8Array.of(1).buffer),
      result("second.png", 1, Uint8Array.of(2).buffer),
    ]);

    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.filename).toBe("sisyphus-images.zip");
    expect(downloads[0]?.blob.type).toBe("application/zip");
    expect(downloads[0]?.blob.size).toBeGreaterThan(0);
  });
});

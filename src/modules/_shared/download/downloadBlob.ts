/**
 * Triggers a browser download from a Blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Triggers download from raw ArrayBuffer data.
 */
export function downloadArrayBuffer(
  data: ArrayBuffer,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([data], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Triggers download from Uint8Array data.
 * Handles SharedArrayBuffer compatibility issues.
 */
export function downloadUint8Array(
  data: Uint8Array,
  filename: string,
  mimeType: string
): void {
  // Copy to plain ArrayBuffer to avoid SharedArrayBuffer issues
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  const blob = new Blob([buffer], { type: mimeType });
  downloadBlob(blob, filename);
}

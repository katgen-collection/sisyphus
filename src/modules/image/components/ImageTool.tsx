"use client";

import { useState } from "react";
import { Crop, Download, ImageIcon, RotateCcw, Trash2 } from "lucide-react";
import { Button, FileUploader, ProgressRing } from "@/modules/_shared";
import { useImageBatch } from "../hooks/useImageBatch";
import { IMAGE_DEFAULT_OPTIONS, IMAGE_INPUT_ACCEPT } from "../types";
import type { ImageOptions, ImageOutputFormat, ResizeMode } from "../types";
import { CropEditor } from "./CropEditor";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}

export function ImageTool() {
  const batch = useImageBatch();
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>(IMAGE_DEFAULT_OPTIONS.outputFormat);
  const [quality, setQuality] = useState(IMAGE_DEFAULT_OPTIONS.quality);
  const [jpegMatte, setJpegMatte] = useState(IMAGE_DEFAULT_OPTIONS.jpegMatte);
  const [resize, setResize] = useState(IMAGE_DEFAULT_OPTIONS.resize);
  const [cropItemId, setCropItemId] = useState<string | null>(null);
  const busy = batch.state === "processing" || batch.state === "creating-zip";
  const cropItem = batch.items.find((item) => item.id === cropItemId) ?? null;
  const successful = batch.items.filter((item) => item.result).length;

  const process = () => {
    const options: Omit<ImageOptions, "crop"> = { outputFormat, quality, jpegMatte, resize };
    void batch.process(options);
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex gap-3">
          <div className="mt-0.5 rounded-xl bg-surface-subtle p-2"><ImageIcon className="h-5 w-5 text-secondary" /></div>
          <div>
            <h2 className="font-semibold text-primary">Private image processing</h2>
            <p className="text-sm leading-relaxed text-secondary">Processed entirely on your device. Files are never uploaded.</p>
          </div>
        </div>
      </section>

      <FileUploader accept={IMAGE_INPUT_ACCEPT} multiple maxSizeMB={100} disabled={busy} onFilesAccepted={batch.addFiles} />

      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium text-primary">
            Output format
            <select value={outputFormat} disabled={busy} onChange={(event) => setOutputFormat(event.target.value as ImageOutputFormat)} className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option><option value="avif">AVIF</option>
            </select>
          </label>
          {outputFormat !== "png" && (
            <label className="grid gap-1.5 text-sm font-medium text-primary">
              Quality: {quality}
              <input aria-label="Quality" type="range" min={1} max={100} value={quality} disabled={busy} onChange={(event) => setQuality(Number(event.target.value))} className="h-10" />
            </label>
          )}
          {outputFormat === "jpeg" && (
            <label className="grid gap-1.5 text-sm font-medium text-primary">
              JPEG background color
              <input type="color" value={jpegMatte} disabled={busy} onChange={(event) => setJpegMatte(event.target.value)} className="h-11 w-full rounded-lg border border-border bg-surface p-1" />
            </label>
          )}
        </div>
        <p className="text-sm text-secondary">Quality changes compression, not image dimensions. PNG is lossless and may be larger.</p>
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div>
          <h2 className="font-semibold text-primary">Resize</h2>
          <p className="text-sm text-secondary">One resize setting applies to every image after its individual crop.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium text-primary">
            Resize mode
            <select value={resize.mode} disabled={busy} onChange={(event) => setResize({ ...resize, mode: event.target.value as ResizeMode })} className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <option value="none">Original size</option><option value="percentage">Percentage</option><option value="dimensions">Exact dimensions</option>
            </select>
          </label>
          {resize.mode === "percentage" && (
            <label className="grid gap-1.5 text-sm font-medium text-primary">
              Scale percentage
              <select value={resize.percentage} disabled={busy} onChange={(event) => setResize({ ...resize, percentage: Number(event.target.value) })} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                {[25, 50, 75, 100, 125, 150, 200].map((value) => <option key={value} value={value}>{value}%</option>)}
              </select>
            </label>
          )}
          {resize.mode === "dimensions" && <>
            <label className="grid gap-1.5 text-sm font-medium text-primary">Width (px)<input type="number" min={1} max={16384} value={resize.width ?? ""} onChange={(event) => setResize({ ...resize, width: event.target.value ? Number(event.target.value) : null })} className="rounded-lg border border-border px-3 py-2.5" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-primary">Height (px)<input type="number" min={1} max={16384} value={resize.height ?? ""} onChange={(event) => setResize({ ...resize, height: event.target.value ? Number(event.target.value) : null })} className="rounded-lg border border-border px-3 py-2.5" /></label>
            <label className="grid gap-1.5 text-sm font-medium text-primary">Fit mode<select value={resize.fit} onChange={(event) => setResize({ ...resize, fit: event.target.value as typeof resize.fit })} className="rounded-lg border border-border bg-surface px-3 py-2.5"><option value="contain">Fit inside</option><option value="cover">Fill and crop</option><option value="stretch">Stretch</option></select></label>
          </>}
        </div>
        {resize.mode !== "none" && <div className="flex flex-wrap gap-5 text-sm text-secondary"><label className="flex items-center gap-2"><input type="checkbox" checked={resize.maintainAspectRatio} onChange={(event) => setResize({ ...resize, maintainAspectRatio: event.target.checked })} /> Preserve aspect ratio</label><label className="flex items-center gap-2"><input type="checkbox" checked={resize.preventUpscale} onChange={(event) => setResize({ ...resize, preventUpscale: event.target.checked })} /> Prevent upscaling</label></div>}
      </section>

      {cropItem && <CropEditor file={cropItem.file} crop={cropItem.crop} onChange={(crop) => batch.setItemCrop(cropItem.id, crop)} onDimensions={(dimensions) => batch.setSourceDimensions(cropItem.id, dimensions)} onClose={() => setCropItemId(null)} />}

      {batch.items.length > 0 && (
        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="font-semibold text-primary">Images ({batch.items.length})</h2>{busy && <ProgressRing progress={batch.progress} size={52} />}</div>
          <ul className="grid gap-3">
            {batch.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-surface-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-medium text-primary">{item.file.name}</p><p className="text-xs text-secondary">{formatBytes(item.file.size)} · {item.crop ? `${item.crop.width}×${item.crop.height} crop` : "Full image"}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {item.stage === "queued" && <Button type="button" variant="secondary" onClick={() => setCropItemId(item.id)}><Crop className="h-4 w-4" /> Crop</Button>}
                    {item.stage === "queued" && <Button type="button" variant="ghost" onClick={() => batch.removeItem(item.id)} aria-label={`Remove ${item.file.name}`}><Trash2 className="h-4 w-4" /></Button>}
                    {item.result && <Button type="button" variant="secondary" onClick={() => batch.downloadItem(item.id)}><Download className="h-4 w-4" /> Download</Button>}
                  </div>
                </div>
                <p role={item.error ? "alert" : "status"} className={`mt-2 text-sm ${item.error ? "text-error-text" : "text-secondary"}`}>{item.error?.message ?? (item.result ? `${item.result.width}×${item.result.height} · ${formatBytes(item.result.outputBytes)}${item.result.warning ? ` · ${item.result.warning}` : ""}` : item.stage)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {batch.batchError && <p role="alert" className="rounded-xl bg-error-bg p-3 text-sm text-error-text">{batch.batchError}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={process} disabled={busy || batch.items.length === 0 || !batch.items.some((item) => item.stage === "queued")} loading={batch.state === "processing"}>Convert images</Button>
        {successful > 0 && <Button type="button" variant="secondary" onClick={() => void batch.downloadAll()} disabled={busy} loading={batch.state === "creating-zip"}><Download className="h-4 w-4" /> Download all as ZIP</Button>}
        {batch.items.length > 0 && <Button type="button" variant="ghost" disabled={batch.state === "creating-zip"} onClick={() => { if (!successful || window.confirm("Reset and discard all converted images?")) { setCropItemId(null); batch.reset(); } }}><RotateCcw className="h-4 w-4" /> Reset</Button>}
      </div>
      <p className="text-sm text-secondary">AVIF output is limited to 24 megapixels. Combined results over 100 MiB must be downloaded individually.</p>
    </div>
  );
}

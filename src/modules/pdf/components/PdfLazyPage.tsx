"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "../lib/pdfjs";

interface PdfLazyPageProps {
  doc: PDFDocumentProxy | null;
  /** 1-based page number. */
  pageNumber: number;
  /** Render scale — higher = sharper but heavier. Thumbnails ~0.5, active page ~1.5. */
  scale?: number;
  className?: string;
  alt?: string;
  /** Render immediately instead of waiting to scroll into view (e.g. the active page). */
  eager?: boolean;
}

/**
 * Renders a single PDF page to an image, lazily.
 *
 * The page is rasterized only once its container scrolls near the viewport
 * (via IntersectionObserver) — so opening a 300-page PDF no longer rasterizes
 * all 300 pages up front. The blob URL is revoked on unmount / re-render.
 */
export function PdfLazyPage({
  doc,
  pageNumber,
  scale = 0.5,
  className,
  alt,
  eager = false,
}: PdfLazyPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(eager);
  const [src, setSrc] = useState<string | null>(null);

  // Reveal when scrolled near the viewport.
  useEffect(() => {
    if (eager || visible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible]);

  // Rasterize once visible. Guarded against races when doc/page/scale change.
  useEffect(() => {
    if (!visible || !doc) return;

    let cancelled = false;
    let url: string | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport, canvas }).promise;
        if (cancelled) return;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.8)
        );
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      } catch {
        // A failed page render just leaves the placeholder in place.
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [visible, doc, pageNumber, scale]);

  return (
    <div ref={containerRef} className={className}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? `Page ${pageNumber}`}
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-surface-subtle animate-pulse" />
      )}
    </div>
  );
}

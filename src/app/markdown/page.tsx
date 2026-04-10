"use client";

import { PageHeader } from "@/components";
import { MarkdownTools } from "@/modules/markdown";

/**
 * Markdown page — overrides --page-max-width to none so both the sticky
 * PageHeader inner content and the editor below use the full available width.
 * Side padding is reduced to px-3 to maximise editor real estate.
 */
export default function MarkdownPage() {
  return (
    <div
      className="min-h-screen"
      style={{ "--page-max-width": "none" } as React.CSSProperties}
    >
      <PageHeader
        title="Markdown Tools"
        description="Edit, preview, and export"
        backHref="/"
      />
      <div className="px-3 lg:px-4 py-4 lg:py-5">
        <MarkdownTools />
      </div>
    </div>
  );
}

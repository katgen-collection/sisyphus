"use client";

import { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileText } from "lucide-react";
import "highlight.js/styles/github.css";

interface MarkdownPreviewProps {
  /** Raw markdown string to render */
  markdown: string;
  /** Zoom level (0.5–2.0) — applied as fontSize percentage, not CSS transform */
  zoom: number;
}

/**
 * GitHub-style Markdown preview pane.
 *
 * Zoom is applied via fontSize on the wrapper rather than CSS transform.
 * Because all prose CSS uses relative `em` units, the entire layout scales
 * naturally and the browser calculates the correct height — no whitespace gap.
 *
 * The ref is attached to the inner content div so the parent can read
 * its innerHTML for PDF export.
 */
export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(
  function MarkdownPreview({ markdown, zoom }, ref) {
    const zoomPercent = Math.round(zoom * 100);

    return (
      <div className="flex flex-col rounded-xl border border-stone-200 overflow-hidden shadow-sm">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
          <FileText className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
            Preview
          </span>
          {zoom !== 1 && (
            <span className="ml-auto text-xs text-stone-400 font-mono">
              {zoomPercent}%
            </span>
          )}
        </div>

        {/* Scrollable preview — zoomed via fontSize, not transform */}
        <div className="flex-1 overflow-auto bg-white">
          <div
            ref={ref}
            className="md-preview p-6 bg-white"
            style={{ fontSize: `${zoom * 100}%` }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                input: ({ ...props }) => (
                  <input {...props} disabled className="mr-1.5 align-middle" />
                ),
              }}
            >
              {markdown}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }
);

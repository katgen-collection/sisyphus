"use client";

import { useState, useRef, useCallback } from "react";
import { PenLine } from "lucide-react";
import { EditorToolbar } from "./EditorToolbar";
import { MarkdownPreview } from "./MarkdownPreview";
import { usePdfExport } from "../hooks/usePdfExport";
import type { ViewMode } from "../types";

const DEFAULT_MARKDOWN = `# Welcome to Sisyphus Markdown Editor

A **privacy-first** markdown editor with GitHub-flavored preview.

## Features

- Live preview as you type
- GitHub Flavored Markdown (GFM)
- Syntax highlighting for code blocks
- Zoom level control for the preview
- Download as PDF — real text, searchable, properly paged

## Example Table

| Feature | Status |
|---|---|
| GFM Tables | ✅ |
| Code Blocks | ✅ |
| Task Lists | ✅ |
| Zoom Control | ✅ |
| PDF Export | ✅ |

## Code Example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

## Task List

- [x] Write your markdown
- [x] Adjust zoom to your liking
- [ ] Download as PDF

> "One must imagine Sisyphus happy." — Albert Camus
`;

export function MarkdownEditor() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [zoom, setZoom] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const { isExporting, exportPdf } = usePdfExport();

  const handleDownloadPdf = useCallback(() => {
    if (!previewRef.current) return;
    exportPdf(previewRef.current.innerHTML, zoom);
  }, [exportPdf, zoom]);

  return (
    <div className="flex flex-col gap-4">
      <EditorToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        zoom={zoom}
        onZoomChange={setZoom}
        isExporting={isExporting}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Editor / Preview panes */}
      <div
        className={`
          grid gap-4 min-h-[60vh]
          ${viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}
        `}
      >
        {/* Editor pane */}
        {(viewMode === "split" || viewMode === "editor") && (
          <div className="flex flex-col rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-50 border-b border-stone-200">
              <PenLine className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
                Editor
              </span>
            </div>
            <textarea
              id="markdown-input"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              spellCheck={false}
              className="flex-1 w-full p-4 font-mono text-sm text-stone-800 bg-white resize-none outline-none leading-relaxed placeholder:text-stone-300"
              placeholder="Type your markdown here…"
              style={{ minHeight: "60vh" }}
            />
          </div>
        )}

        {/* Preview pane — always mounted (even in Editor mode) so "Download PDF"
            can read its rendered HTML; hidden, not unmounted, when editing. */}
        <div className={viewMode === "editor" ? "hidden" : "contents"}>
          <MarkdownPreview ref={previewRef} markdown={markdown} zoom={zoom} />
        </div>
      </div>
    </div>
  );
}

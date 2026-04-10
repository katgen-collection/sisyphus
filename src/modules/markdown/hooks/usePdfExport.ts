"use client";

import { useCallback, useState } from "react";

export function usePdfExport() {
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = useCallback(async (html: string, zoom: number) => {
    if (isExporting || !html) return;
    setIsExporting(true);

    try {
      // Create a completely hidden iframe
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "-9999px";
      iframe.style.bottom = "-9999px";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("Could not access iframe document");

      // 1. Copy all stylesheets from the main page to the iframe
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
      const stylesHtml = styles.map((node) => node.outerHTML).join("\n");

      // 2. Build the iframe HTML document
      const iframeHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Markdown Export</title>
          ${stylesHtml}
          <style>
            /* 
             * Force print rules to ensure A4 size, background graphics (for code blocks),
             * and hide any scrollbars that might render. 
             */
            @page {
              size: A4 portrait;
              margin: 10mm 15mm;
            }
            
            @media print {
              html, body {
                background: white !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              
              /* Prevent code blocks and tables from breaking across pages awkwardly */
              pre, blockquote, table, img {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              
              h1, h2, h3, h4 {
                page-break-after: avoid;
                break-after: avoid;
              }
            }
          </style>
        </head>
        <body class="bg-white">
          <div class="md-preview" style="padding: 0; font-size: ${zoom * 100}%;">
            ${html}
          </div>
        </body>
        </html>
      `;

      // 3. Write to iframe
      doc.open();
      doc.write(iframeHtml);
      doc.close();

      // 4. Wait for styles to apply, then print
      await new Promise((resolve) => setTimeout(resolve, 500));

      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
      }

      // 5. Cleanup the iframe after the print dialog resolves
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);

    } catch (err) {
      console.error("Native print export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  return { isExporting, exportPdf };
}

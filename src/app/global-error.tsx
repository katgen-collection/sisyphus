"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary for failures in the root layout itself.
 * Replaces the entire document, so it ships its own <html>/<body> and uses
 * inline styles — the app's stylesheet may not have loaded if the root
 * layout is what threw.
 *
 * MUST remain self-contained: no stored theme preference access, no
 * component imports. Uses prefers-color-scheme to match the system
 * appearance at the moment of the crash.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style>{`
          :root {
            --bg: #fafaf9;
            --fg: #44403c;
            --fg-secondary: #78716c;
            --btn-bg: #292524;
            --btn-fg: #fff;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #0c0a09;
              --fg: #d6d3d1;
              --fg-secondary: #a8a29e;
              --btn-bg: #fafaf9;
              --btn-fg: #1c1917;
            }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
            The boulder slipped
          </h1>
          <p style={{ color: "var(--fg-secondary)", lineHeight: 1.6, marginBottom: "2rem" }}>
            Something went wrong loading the app. Nothing you were working on was
            uploaded anywhere. Try reloading.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              background: "var(--btn-bg)",
              color: "var(--btn-fg)",
              border: "none",
              borderRadius: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

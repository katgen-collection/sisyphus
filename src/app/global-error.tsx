"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary for failures in the root layout itself.
 * Replaces the entire document, so it ships its own <html>/<body> and uses
 * inline styles — the app's stylesheet may not have loaded if the root
 * layout is what threw.
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
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#fafaf9",
          color: "#44403c",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
            The boulder slipped
          </h1>
          <p style={{ color: "#78716c", lineHeight: 1.6, marginBottom: "2rem" }}>
            Something went wrong loading the app. Nothing you were working on was
            uploaded anywhere. Try reloading.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.75rem 1.5rem",
              background: "#292524",
              color: "#fff",
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

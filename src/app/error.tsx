"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import { SpinningLogo } from "@/components";

/**
 * Route-level error boundary.
 * Catches render/runtime throws from any tool (worker init under COEP,
 * pdf-lib / ffmpeg.wasm failures, a malformed file) so a single bad
 * operation degrades to a recoverable screen instead of a blank crash.
 */
export default function Error({
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
    <div className="fixed inset-0 flex items-center justify-center px-6 py-12 bg-[var(--background)]">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 flex justify-center">
          <SpinningLogo
            size={240}
            spinning={false}
            spinOnHover
            className="opacity-60"
          />
        </div>

        <h1 className="text-2xl font-semibold text-stone-700 mb-4">
          The boulder slipped
        </h1>

        <p className="text-stone-500 mb-8 leading-relaxed">
          Something went wrong while processing that. Your files never left your
          device — nothing was uploaded. You can try again, or head home and
          start fresh.
        </p>

        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-12 bg-stone-300" />
          <div className="w-2 h-2 rounded-full bg-stone-300" />
          <div className="h-px w-12 bg-stone-300" />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>
        </div>

        <p className="mt-12 text-sm text-stone-400 italic">
          &quot;One must imagine Sisyphus happy.&quot;
        </p>
      </div>
    </div>
  );
}

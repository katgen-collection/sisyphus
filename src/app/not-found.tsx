"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { SpinningLogo } from "@/components";

export default function NotFound() {
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6 py-12 bg-canvas">
      <div className="max-w-md w-full text-center">
        {/* Spinning logo */}
        <div className="mb-8 flex justify-center">
          <SpinningLogo
            size={240}
            spinning
            spinOnHover={false}
            className="opacity-60"
          />
        </div>

        {/* 404 Display */}
        <h1 className="text-8xl font-bold text-surface-muted tracking-tighter mb-2">
          404
        </h1>

        <h2 className="text-2xl font-semibold text-secondary mb-4">
          The boulder rolled away
        </h2>

        <p className="text-secondary mb-8 leading-relaxed">
          Like Sisyphus, we must push forward. The page you&apos;re looking for
          seems to have tumbled down the mountain.
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-12 bg-border-strong" />
          <div className="w-2 h-2 rounded-full bg-border-strong" />
          <div className="h-px w-12 bg-border-strong" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-canvas rounded-xl font-medium hover:opacity-90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-surface-subtle text-primary rounded-xl font-medium hover:bg-surface-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Quote */}
        <p className="mt-12 text-sm text-muted italic">
          &quot;One must imagine Sisyphus happy.&quot;
        </p>
      </div>
    </div>
  );
}

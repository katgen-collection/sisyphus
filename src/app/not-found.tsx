"use client";

import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { SpinningLogo } from "@/components";

export default function NotFound() {
  return (
    <div className="fixed inset-0 flex items-center justify-center px-6 py-12 bg-[var(--background)]">
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
        <h1 className="text-8xl font-bold text-stone-200 tracking-tighter mb-2">
          404
        </h1>

        <h2 className="text-2xl font-semibold text-stone-700 mb-4">
          The boulder rolled away
        </h2>

        <p className="text-stone-500 mb-8 leading-relaxed">
          Like Sisyphus, we must push forward. The page you&apos;re looking for
          seems to have tumbled down the mountain.
        </p>

        {/* Divider */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-px w-12 bg-stone-300" />
          <div className="w-2 h-2 rounded-full bg-stone-300" />
          <div className="h-px w-12 bg-stone-300" />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Link>

          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-stone-100 text-stone-700 rounded-xl font-medium hover:bg-stone-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>

        {/* Quote */}
        <p className="mt-12 text-sm text-stone-400 italic">
          &quot;One must imagine Sisyphus happy.&quot;
        </p>
      </div>
    </div>
  );
}
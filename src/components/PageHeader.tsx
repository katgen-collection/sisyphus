"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
}

/**
 * Page header with elegant styling.
 * Responsive design for mobile and desktop.
 */
export function PageHeader({ title, description, backHref }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-stone-50/40 backdrop-blur-sm border-b border-stone-200/60">
    <div className="page-content px-6 py-4 lg:py-5">
        <div className="flex items-center gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="p-2.5 -ml-2 rounded-xl bg-white/50 hover:bg-white border border-stone-200/50 hover:border-stone-300 hover:shadow-sm transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-stone-600" />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold text-stone-800 tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm lg:text-base text-stone-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

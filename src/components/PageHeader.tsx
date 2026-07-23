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
    <header className="sticky top-0 z-10 bg-canvas/40 backdrop-blur-sm border-b border-border">
    <div className="page-content px-6 pr-16 py-4 lg:pr-6 lg:py-5">
        <div className="flex items-center gap-4">
          {backHref && (
            <Link
              href={backHref}
              className="p-2.5 -ml-2 rounded-xl bg-surface/50 hover:bg-surface border border-border hover:border-border-strong hover:shadow-sm transition-all duration-200"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-secondary" />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold text-primary tracking-tight">
              {title}
            </h1>
            {description && (
              <p className="text-sm lg:text-base text-secondary mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

/**
 * Navigation card for tool sections.
 */
export function ToolCard({ href, icon: Icon, title, description }: ToolCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 p-5 lg:p-6 bg-surface rounded-2xl border border-border hover:border-border-strong hover:shadow-lg active:bg-surface-subtle transition-all duration-300"
    >
      {/* Subtle accent line */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-muted rounded-r-full group-hover:h-12 transition-all duration-300" />

      <div className="flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-xl bg-surface-subtle flex items-center justify-center group-hover:bg-surface-muted transition-colors duration-300">
        <Icon className="w-7 h-7 lg:w-8 lg:h-8 text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-primary text-lg group-hover:text-primary">{title}</h3>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted group-hover:text-secondary group-hover:translate-x-1 transition-all duration-300" />
    </Link>
  );
}

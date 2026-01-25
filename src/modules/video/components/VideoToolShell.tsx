"use client";

import { ReactNode } from "react";

interface VideoToolShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Shell container for video tools.
 * Provides consistent layout and header styling.
 */
export function VideoToolShell({ title, description, children }: VideoToolShellProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-stone-800 tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-2 text-stone-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

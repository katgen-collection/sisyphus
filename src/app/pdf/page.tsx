"use client";

import { PageHeader } from "@/components";
import { PdfTools } from "@/modules/pdf";

export default function PdfPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="PDF Tools"
        description="Compress, convert, extract"
        backHref="/"
      />
      <div className="px-6 py-6 lg:py-8 max-w-5xl mx-auto">
        <PdfTools />
      </div>
    </div>
  );
}

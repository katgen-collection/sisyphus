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
      <div className="page-content px-6 py-6 lg:py-8">
        <PdfTools />
      </div>
    </div>
  );
}

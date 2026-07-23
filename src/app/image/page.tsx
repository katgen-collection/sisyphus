"use client";

import { PageHeader } from "@/components";
import { ImageTool } from "@/modules/image";

export default function ImagePage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Image Tools" description="Convert, compress, resize, and crop images" backHref="/" />
      <div className="page-content px-6 py-6 lg:py-8">
        <ImageTool />
      </div>
    </div>
  );
}

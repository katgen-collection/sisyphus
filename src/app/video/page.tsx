"use client";

import { PageHeader } from "@/components";
import { VideoConverter } from "@/modules/video";

export default function VideoPage() {
  return (
    <div className="min-h-screen">
      <PageHeader
        title="Video Tools"
        description="Convert, compress, resize"
        backHref="/"
      />
      <div className="page-content px-6 py-6 lg:py-8">
        <VideoConverter />
      </div>
    </div>
  );
}

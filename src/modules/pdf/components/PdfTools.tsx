"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Minimize2, Image, FileImage, Loader2, GripVertical, PenTool } from "lucide-react";
import { ToolCarousel, type ToolTab } from "@/components";
import { PdfCompress } from "./PdfCompress";
import { ImagesToPdf } from "./ImagesToPdf";
import { PdfReorder } from "./PdfReorder";
import { PdfSign } from "./PdfSign";

// Dynamically import PdfToImages to avoid pdfjs-dist SSR issues
const PdfToImages = dynamic(
  () => import("./PdfToImages").then((mod) => mod.PdfToImages),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
      </div>
    ),
  }
);

type PdfTab = "compress" | "images-to-pdf" | "pdf-to-images" | "reorder" | "sign";

const tabs: ToolTab<PdfTab>[] = [
  {
    id: "compress",
    label: "Compress",
    description: "Reduce size & clean",
    icon: <Minimize2 className="w-4 h-4" />,
  },
  {
    id: "images-to-pdf",
    label: "Images → PDF",
    description: "Combine images",
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: "pdf-to-images",
    label: "PDF → Images",
    description: "Export as PNGs",
    icon: <FileImage className="w-4 h-4" />,
  },
  {
    id: "reorder",
    label: "Rearranger",
    description: "Reorder pages",
    icon: <GripVertical className="w-4 h-4" />,
  },
  {
    id: "sign",
    label: "Sign",
    description: "Add signatures",
    icon: <PenTool className="w-4 h-4" />,
  },
];

/**
 * Tabbed PDF tools interface.
 */
export function PdfTools() {
  const [activeTab, setActiveTab] = useState<PdfTab>("compress");

  return (
    <div className="space-y-6">
      {/* Tab navigation carousel */}
      <ToolCarousel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div>
        {activeTab === "compress" && <PdfCompress />}
        {activeTab === "images-to-pdf" && <ImagesToPdf />}
        {activeTab === "pdf-to-images" && <PdfToImages />}
        {activeTab === "reorder" && <PdfReorder />}
        {activeTab === "sign" && <PdfSign />}
      </div>
    </div>
  );
}

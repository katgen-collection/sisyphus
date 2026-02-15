"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Minimize2, Image, FileImage, Loader2, ListPlus, PenTool, Edit3 } from "lucide-react";
import { ToolCarousel, type ToolTab } from "@/components";
import { PdfCompress } from "./PdfCompress";
import { ImagesToPdf } from "./ImagesToPdf";
import { PdfMerge } from "./PdfMerge";
import { PdfSign } from "./PdfSign";
import { PdfEdit } from "./PdfEdit";

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

type PdfTab = "compress" | "images-to-pdf" | "pdf-to-images" | "merge" | "edit" | "sign";

const tabs: ToolTab<PdfTab>[] = [
  {
    id: "compress",
    label: "Compress",
    description: "Reduce size & clean",
    icon: <Minimize2 className="w-4 h-4" />,
  },
  {
    id: "merge",
    label: "Merge",
    description: "Combine & Organize",
    icon: <ListPlus className="w-4 h-4" />,
  },
  {
    id: "edit",
    label: "Edit",
    description: "Add Text & Images",
    icon: <Edit3 className="w-4 h-4" />,
  },
  {
    id: "sign",
    label: "Sign",
    description: "Add signatures",
    icon: <PenTool className="w-4 h-4" />,
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
];

/**
 * Tabbed PDF tools interface.
 */
export function PdfTools() {
  const [activeTab, setActiveTab] = useState<PdfTab>("merge"); // Default to merge as it's the requested feature

  return (
    <div className="space-y-6">
      {/* Tab navigation carousel */}
      <ToolCarousel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "compress" && <PdfCompress />}
        {activeTab === "images-to-pdf" && <ImagesToPdf />}
        {activeTab === "pdf-to-images" && <PdfToImages />}
        {activeTab === "merge" && <PdfMerge />}
        {activeTab === "edit" && <PdfEdit />}
        {activeTab === "sign" && <PdfSign />}
      </div>
    </div>
  );
}

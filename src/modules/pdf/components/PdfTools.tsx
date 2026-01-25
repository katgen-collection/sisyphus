"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Minimize2, Image, FileImage, Loader2, GripVertical } from "lucide-react";
import { PdfCompress } from "./PdfCompress";
import { ImagesToPdf } from "./ImagesToPdf";
import { PdfReorder } from "./PdfReorder";

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

type PdfTab = "compress" | "images-to-pdf" | "pdf-to-images" | "reorder";

const tabs: Array<{ id: PdfTab; label: string; description: string; icon: React.ReactNode }> = [
  {
    id: "compress",
    label: "Compress",
    description: "Reduce size & clean metadata",
    icon: <Minimize2 className="w-4 h-4" />,
  },
  {
    id: "images-to-pdf",
    label: "Images → PDF",
    description: "Combine images into a PDF",
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: "pdf-to-images",
    label: "PDF → Images",
    description: "Export pages as PNGs",
    icon: <FileImage className="w-4 h-4" />,
  },
  {
    id: "reorder",
    label: "Rearranger",
    description: "Reorder or remove pages",
    icon: <GripVertical className="w-4 h-4" />,
  },
];

/**
 * Tabbed PDF tools interface.
 */
export function PdfTools() {
  const [activeTab, setActiveTab] = useState<PdfTab>("compress");

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group rounded-xl border p-4 text-left transition-all duration-200
              ${activeTab === tab.id
                ? "border-stone-300 bg-white shadow-sm"
                : "border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white"
              }
            `}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-700">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === tab.id ? "bg-stone-800 text-stone-50" : "bg-stone-200 text-stone-600"}`}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </div>
            <p className="mt-2 text-xs text-stone-500 leading-relaxed">
              {tab.description}
            </p>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "compress" && <PdfCompress />}
        {activeTab === "images-to-pdf" && <ImagesToPdf />}
        {activeTab === "pdf-to-images" && <PdfToImages />}
        {activeTab === "reorder" && <PdfReorder />}
      </div>
    </div>
  );
}

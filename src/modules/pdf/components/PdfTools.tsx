"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Minimize2, Image, FileImage, Loader2 } from "lucide-react";
import { PdfCompress } from "./PdfCompress";
import { ImagesToPdf } from "./ImagesToPdf";

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

type PdfTab = "compress" | "images-to-pdf" | "pdf-to-images";

const tabs: Array<{ id: PdfTab; label: string; icon: React.ReactNode }> = [
  {
    id: "compress",
    label: "Compress",
    icon: <Minimize2 className="w-4 h-4" />,
  },
  {
    id: "images-to-pdf",
    label: "Images → PDF",
    icon: <Image className="w-4 h-4" />,
  },
  {
    id: "pdf-to-images",
    label: "PDF → Images",
    icon: <FileImage className="w-4 h-4" />,
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
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md
              text-sm font-medium transition-colors duration-150
              ${activeTab === tab.id
                ? "bg-white text-stone-800 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
              }
            `}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "compress" && <PdfCompress />}
        {activeTab === "images-to-pdf" && <ImagesToPdf />}
        {activeTab === "pdf-to-images" && <PdfToImages />}
      </div>
    </div>
  );
}

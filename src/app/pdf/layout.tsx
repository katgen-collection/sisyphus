import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PDF Tools — Sisyphus",
  description: "Compress, reorder, convert, and sign PDFs locally.",
  alternates: {
    canonical: "/pdf",
  },
  openGraph: {
    title: "PDF Tools — Sisyphus",
    description: "Compress, reorder, convert, and sign PDFs locally.",
    url: "/pdf",
  },
  twitter: {
    card: "summary",
    title: "PDF Tools — Sisyphus",
    description: "Compress, reorder, convert, and sign PDFs locally.",
  },
};

export default function PdfLayout({ children }: { children: React.ReactNode }) {
  return children;
}

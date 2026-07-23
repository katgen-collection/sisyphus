import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Image Tools — Sisyphus",
  description: "Convert, compress, resize, and crop JPEG, PNG, WebP, and AVIF images locally.",
  alternates: { canonical: "/image" },
  openGraph: {
    title: "Image Tools — Sisyphus",
    description: "Convert, compress, resize, and crop images locally.",
    url: "/image",
  },
  twitter: {
    card: "summary",
    title: "Image Tools — Sisyphus",
    description: "Convert, compress, resize, and crop images locally.",
  },
};

export default function ImageLayout({ children }: { children: React.ReactNode }) {
  return children;
}

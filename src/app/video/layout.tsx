import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Tools — Sisyphus",
  description: "Convert, compress, resize, and extract audio locally.",
  alternates: {
    canonical: "/video",
  },
  openGraph: {
    title: "Video Tools — Sisyphus",
    description: "Convert, compress, resize, and extract audio locally.",
    url: "/video",
  },
  twitter: {
    card: "summary",
    title: "Video Tools — Sisyphus",
    description: "Convert, compress, resize, and extract audio locally.",
  },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

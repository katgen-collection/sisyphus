import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Markdown Tools — Sisyphus",
  description: "Write and preview GitHub-flavored Markdown locally. Export as pixel-perfect PDF.",
  alternates: {
    canonical: "/markdown",
  },
  openGraph: {
    title: "Markdown Tools — Sisyphus",
    description: "Write and preview GitHub-flavored Markdown locally. Export as pixel-perfect PDF.",
    url: "/markdown",
  },
  twitter: {
    card: "summary",
    title: "Markdown Tools — Sisyphus",
    description: "Write and preview GitHub-flavored Markdown locally. Export as pixel-perfect PDF.",
  },
};

export default function MarkdownLayout({ children }: { children: React.ReactNode }) {
  return children;
}

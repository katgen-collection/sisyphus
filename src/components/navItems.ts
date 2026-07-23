import { Home, Video, Image, FileText, FileCode } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

/**
 * Single source of truth for primary navigation.
 * Consumed by both the desktop Sidebar and the mobile BottomNav — adding a
 * module means editing this list once (plus its route and sitemap.ts).
 */
export const navItems: NavItem[] = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/video", icon: Video, label: "Video" },
  { href: "/image", icon: Image, label: "Image" },
  { href: "/pdf", icon: FileText, label: "PDF" },
  { href: "/markdown", icon: FileCode, label: "Markdown" },
];

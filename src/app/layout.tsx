import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav, Sidebar, OfflineIndicator } from "@/components";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sisyphus",
  description: "Privacy-first, local-only file manipulation tools. Zero-knowledge processing.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Sisyphus",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#292524",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-50 min-h-screen`}
      >
        <OfflineIndicator />
        
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main content area - shifts right on desktop */}
        <main className="pb-24 lg:pb-8 lg:ml-64 min-h-screen">
          {children}
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav />
      </body>
    </html>
  );
}

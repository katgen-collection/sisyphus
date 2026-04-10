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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://sisyphus.mikhailjbs.my.id"),
  title: "Sisyphus",
  description: "Privacy-first, local-only file manipulation tools. Zero-knowledge processing.",
  applicationName: "Sisyphus",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Sisyphus",
    description: "Privacy-first, local-only file manipulation tools. Zero-knowledge processing.",
    type: "website",
    url: "/",
    images: [
      {
        url: "/assets/logo/icon-512.png",
        width: 512,
        height: 512,
        alt: "Sisyphus",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Sisyphus",
    description: "Privacy-first, local-only file manipulation tools. Zero-knowledge processing.",
    images: ["/assets/logo/icon-512.png"],
  },
  icons: {
    icon: "/assets/logo/logo_svg.svg",
    apple: "/assets/logo/icon-192.png",
  },
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
    <html lang="en" data-sidebar="expanded">
      <head>
        <link rel="apple-touch-icon" href="/assets/logo/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-stone-50 min-h-screen`}
      >
        <OfflineIndicator />
        
        {/* Desktop Sidebar */}
        <Sidebar />
        
        {/* Main content area - margin driven by data-sidebar CSS rules */}
        <main className="pb-24 lg:pb-8 min-h-screen">
          {children}
        </main>
        
        {/* Mobile Bottom Nav */}
        <BottomNav />
      </body>
    </html>
  );
}

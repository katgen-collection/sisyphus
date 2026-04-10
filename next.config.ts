import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Explicit runtime caching strategies for offline support
    runtimeCaching: [
      {
        // Cache page navigations (HTML) — network first, fallback to cache
        urlPattern: /^https?.*\/(_next\/static|_next\/image|favicon\.ico)/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
      {
        // Cache all other pages with StaleWhileRevalidate
        urlPattern: /^https?.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "offline-cache",
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
    ],
  },
  // Fallback to root page when navigating offline
  fallbacks: {
    document: "/",
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  
};

export default withPWA(nextConfig);

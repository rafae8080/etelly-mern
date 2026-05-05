import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.png"],
      manifest: {
        name: "E-Telly: Disaster Preparedness & Resource Sharing",
        short_name: "E-Telly",
        description:
          "Smart disaster preparedness, real-time hazard alerts, and community resource sharing for Antipolo City.",
        start_url: "/dashboard",
        display: "standalone",
        orientation: "any",
        theme_color: "#1e293b",
        background_color: "#1e293b",
        icons: [
          {
            src: "/icons/icon.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["utilities", "productivity"],
        lang: "en-PH",
      },
      workbox: {
        // Cache the app shell (JS, CSS, HTML) — Cache First
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],

        // Runtime caching rules
        runtimeCaching: [
          // API: alerts + reports — Network First (show live data, fall back to cache)
          {
            urlPattern: /\/api\/(alerts|reports)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
          // OpenStreetMap / CartoCDN tiles — Stale While Revalidate
          {
            urlPattern:
              /^https:\/\/(.*\.tile\.openstreetmap\.org|.*\.basemaps\.cartocdn\.com|server\.arcgisonline\.com)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "map-tiles",
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
          // Nominatim geocoding — Network First
          {
            urlPattern: /nominatim\.openstreetmap\.org/,
            handler: "NetworkFirst",
            options: {
              cacheName: "geocoding-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
              networkTimeoutSeconds: 8,
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ["leaflet"],
    exclude: ["leaflet.heat"],
  },
});

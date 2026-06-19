import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// During local dev we proxy /api/* to a running `wrangler pages dev` instance
// so the chat function works without deploying. Override the target with
// API_PROXY if your wrangler dev server runs elsewhere.
const apiProxy = process.env.API_PROXY || "http://localhost:8788";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "aldi-logo.svg"],
      // Cache-busting: the new service worker activates immediately and takes
      // over open clients, and autoUpdate reloads the page so users never get
      // stuck on a stale build.
      manifest: {
        name: "ALDI Recipe-to-Cart Assistant",
        short_name: "ALDI Cart",
        description:
          "Name a dish — get a recipe, the right ALDI products, and the smartest route to checkout.",
        theme_color: "#00005f",
        background_color: "#00005f",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          // Square basket mark stays the maskable home-screen icon (a wide
          // wordmark crops badly in a maskable safe-zone).
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          // ALDI wordmark as the "any" icon (install prompts, app listings).
          { src: "aldi-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // Cache the app shell; never cache the chat API or ALDI API responses.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api/chat": { target: apiProxy, changeOrigin: true },
    },
  },
});

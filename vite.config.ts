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
      includeAssets: ["icon.svg"],
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
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Cache the app shell; never cache the chat API or ALDI API responses.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
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

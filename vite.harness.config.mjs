import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const NM = "/home/andrii/projects/aldi-recipe-cart-bot/node_modules";

export default defineConfig({
  root: "/tmp",
  cacheDir: "/tmp/.vite-harness",
  plugins: [react()],
  resolve: {
    alias: {
      react: NM + "/react",
      "react-dom": NM + "/react-dom",
    },
  },
  optimizeDeps: { include: [] },
  server: {
    port: 5210,
    fs: { allow: ["/tmp", "/home/andrii/projects/aldi-recipe-cart-bot"] },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/hooks": "http://localhost:7777",
      "/health": "http://localhost:7777",
    },
  },
  build: {
    outDir: "dist",
  },
});

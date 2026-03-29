import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/proxy/origin": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/origin/, ""),
      },
      "/proxy/edge/us": {
        target: "http://localhost:5001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/edge\/us/, ""),
      },
      "/proxy/edge/eu": {
        target: "http://localhost:5002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/edge\/eu/, ""),
      },
      "/proxy/edge/ap": {
        target: "http://localhost:5003",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/proxy\/edge\/ap/, ""),
      },
    },
  },
});

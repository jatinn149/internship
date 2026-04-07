import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["localhost", "127.0.0.1", ".trycloudflare.com"],
    proxy: {
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/health": {
        target: "http://localhost:4000",
      },
    },
  },
});

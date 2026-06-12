import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // UI dev server proxies API calls to `wrangler dev` (npm run dev:api)
    proxy: { "/api": "http://localhost:8787" },
  },
});

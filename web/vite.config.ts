import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"]
  },
  build: {
    chunkSizeWarningLimit: 800
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true
  }
});

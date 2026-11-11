/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // En produccion, Nginx manda /api al backend y el resto al front, asi que
    // los dos viven en el mismo origen. Este proxy reproduce eso en desarrollo:
    // el front pide /api/v1/... a su propio puerto y Vite lo reenvia a Uvicorn.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/shared/test/setup.ts",
  },
});

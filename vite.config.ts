import { resolve } from "node:path";
import { defineConfig } from "vite";

// Tauri expects a fixed port and serves two pages: the main window and the alert.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        alert: resolve(import.meta.dirname, "alert.html"),
      },
    },
  },
});

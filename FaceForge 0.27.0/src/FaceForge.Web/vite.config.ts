import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json" with { type: "json" };

// package.json carries the version build.ps1 checks against VERSION.txt; the interface reads it
// from here instead of repeating the number in its own text.
const appVersion = packageJson.version;

export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "es2022"
  }
});

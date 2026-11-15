import { defineConfig } from "vitest/config";
import packageJson from "./package.json" with { type: "json" };

const appVersion = packageJson.version;

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  test: {
    environment: "node",
    coverage: {
      reporter: ["text", "json-summary"]
    }
  }
});

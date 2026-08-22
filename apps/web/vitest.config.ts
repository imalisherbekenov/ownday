import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The suite must behave the same with or without a local .env. A defined
    // DATABASE_URL switches the app to Prisma at import time, which would make
    // these tests talk to a real database depending on the developer's machine.
    env: { DATABASE_URL: "" },
  },
});

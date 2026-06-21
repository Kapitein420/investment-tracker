import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Minimal Vitest setup. Tests run in Node (server-side code: Prisma, auth
// helpers, the jsdom-backed HTML sanitiser). The `@/` alias mirrors the
// tsconfig path mapping so test imports match app imports. `.env` is loaded
// via the setup file so integration tests can reach the local Postgres.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});

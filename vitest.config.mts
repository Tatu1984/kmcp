import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Deliberately the same shape as kmcp-backend's `vitest.config.mts` — same
 * runner, same `globals`, same `@/` alias, same `*.spec.ts` naming — so that
 * moving between the two repositories does not mean relearning how to run a
 * test.
 *
 * Two things differ, and both are forced by this being a browser application:
 *
 * `jsdom`, because the code under test reads `window.localStorage` and renders
 * React. And a `NEXT_PUBLIC_API_URL`, because `src/config/env.ts` decides at
 * import time whether the portal is live or running on its bundled demo data —
 * and almost every behaviour worth testing is the live one. The few tests that
 * need demo mode mock `@/config/env` for themselves.
 *
 * There is no `@vitejs/plugin-react`: its only job here would be Fast Refresh,
 * which tests do not use, and it currently cannot be installed without forcing
 * a Babel 8 upgrade on the rest of the tree. Vite's own esbuild transform reads
 * `jsx: "react-jsx"` from tsconfig.json and compiles the components fine.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.spec.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    env: {
      NEXT_PUBLIC_API_URL: "https://api.kmcp.test/api/v1",
    },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
});

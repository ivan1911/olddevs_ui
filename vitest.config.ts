import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// A separate config, not a section in vite.config.ts: without an explicit include, Vitest
// also picks up `tests-visual/*.spec.ts`, which are written for Playwright, and fails
// on the foreign API. Two runners, two disjoint folders.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // The default environment is node: the checks for tokens, periods and the icon
    // vocabulary run without a DOM and should not pay for starting one. Behavior tests
    // enable jsdom themselves with the `@vitest-environment jsdom` line.
    environment: "node",
    // jsdom shims: see `tests/setup-jsdom.ts`. The file is harmless in the node
    // environment: it only fills in what is missing on `globalThis`.
    setupFiles: ["tests/setup-jsdom.ts"],
  },
});

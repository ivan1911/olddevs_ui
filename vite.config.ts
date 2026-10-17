import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// This config is needed only for Storybook. The package itself is built with plain tsc,
// without a bundler.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});

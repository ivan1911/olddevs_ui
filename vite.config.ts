import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Конфиг нужен только Storybook — сам пакет собирается голым tsc, без бандлера.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});

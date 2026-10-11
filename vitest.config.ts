import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Отдельный конфиг, а не секция в vite.config.ts: без явного include Vitest
// подхватывает и `tests-visual/*.spec.ts`, которые написаны под Playwright,
// и падает на чужом API. Два раннера — две непересекающиеся папки.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Окружение по умолчанию — node: проверки токенов, периодов и словаря
    // иконок обходятся без DOM и не должны платить за его поднятие. Тесты
    // поведения включают jsdom сами строкой `@vitest-environment jsdom`.
    environment: "node",
    // Заплатки для jsdom — см. `tests/setup-jsdom.ts`. Файл безвреден в
    // окружении node: он только дописывает недостающее в `globalThis`.
    setupFiles: ["tests/setup-jsdom.ts"],
  },
});

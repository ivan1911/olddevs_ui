import { defineConfig, devices } from "@playwright/test";

// PW_PORT — для параллельных worktree: при общем порте `reuseExistingServer`
// подхватил бы витрину соседнего дерева и проверял бы чужой код.
const PORT = Number(process.env.PW_PORT ?? 6007);

export default defineConfig({
  testDir: "./tests-visual",
  // Снапшоты — единственный артефакт, который коммитится; держим рядом с тестом.
  // {platform} обязателен: отрисовка шрифтов на macOS и в Linux-образе CI
  // различается, и без разделения локальный бейзлайн валил бы пайплайн.
  snapshotPathTemplate: "{testDir}/__snapshots__/{platform}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Анимации — главный источник флейка: 6 именованных `--animate-*` плюс
    // `transition-colors` почти в каждом примитиве. Гасим на уровне браузера,
    // а не только в момент снимка.
    contextOptions: { reducedMotion: "reduce" },
  },

  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Два порога, и оба откалиброваны по реальным правкам, а не взяты «на глаз».
      // До калибровки бейзлайн показывал «51 passed» на двух подряд идущих
      // намеренных изменениях цвета — то есть не работал ровно там, ради чего
      // заводился: на правке токенов.
      //
      // `threshold` — попиксельный допуск по цвету, и он важнее. Дефолтные 0.2
      // означают, что пиксель считается «тем же самым», пока цвет не уехал
      // заметно; правка `--text-muted` с `#a6a8b3` на `#acaeb8` давала при них
      // РОВНО НОЛЬ различающихся пикселей на всех 51 снимке. С нулём та же
      // правка видна как 747 пикселей на снимок.
      //
      // `maxDiffPixels` — сколько таких пикселей прощаем. Абсолютное число, не
      // доля: долевой `maxDiffPixelRatio: 0.002` на снимке 1280×900 — это 2304
      // пикселя допуска, а самая мелкая правка, которую мы обязаны увидеть
      // (цвет текста на двух кнопках матрицы), задевает 168. Запас в 32 нужен
      // только на разброс антиалиасинга между раннерами: локально два прогона
      // подряд дают снимки байт-в-байт, а бейзлайны и так разведены по платформам.
      threshold: 0,
      maxDiffPixels: 32,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    command: `npx http-server storybook-static -p ${PORT} -s --silent`,
    url: `http://127.0.0.1:${PORT}/index.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

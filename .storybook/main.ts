import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    // react-vite, а не nextjs-vite: во всех компонентах пакета нет ни одного
    // импорта next/*, поэтому Next-специфичный фреймворк только добавил бы
    // зависимостей и точек отказа.
    name: "@storybook/react-vite",
    options: {},
  },
  // Storybook по умолчанию отправляет анонимную телеметрию при каждой сборке,
  // в том числе из CI. Внутреннему инструменту это не нужно.
  core: { disableTelemetry: true },
  // Картинки историй Редактора: адрес картинки в Документе —
  // только абсолютный http(s), поэтому файл раздаётся витриной с того же
  // адреса, а не встраивается `data:`, и снимки не зависят от сети.
  staticDirs: ["./static"],
};

export default config;

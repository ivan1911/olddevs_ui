// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "storybook-static/**",
      "test-results/**",
      "playwright-report/**",
      // Фикстура-потребитель: чужой проект со своими правилами и своим tsconfig.
      // Её проверяет `npm run check:consumer` сборкой, а не линтером кита.
      "fixtures/**",
    ],
  },
  js.configs.recommended,
  {
    // Скрипты и конфиги исполняются Node напрямую: у них есть `process` и `console`,
    // которых нет у кода пакета — тот уезжает в браузер потребителя.
    files: ["scripts/**/*.mjs", "*.config.{ts,mjs}"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", fetch: "readonly" },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Согласовано с фронтом: verbatimModuleSyntax в tsconfig требует того же.
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": "warn",
    },
  },
  storybook.configs["flat/recommended"],
  {
    // Плагин пришёл с апгрейдом до 10.5.6 и полезен: он ловит забытый
    // `export default meta`, истории без имени, `play` без `expect`.
    //
    // Кроме одного правила. `prefer-pascal-case` проверяет первую букву
    // регулярным выражением на латиницу и потому считает `Мастер` и `Дашборд`
    // нарушением — а кит одноязычный, и это решение, а не недосмотр (см. docs/conventions.md).
    // 183 предупреждения на ровном месте прячут настоящие: правило выключено,
    // а не заглушено построчно.
    files: ["**/*.stories.tsx"],
    rules: { "storybook/prefer-pascal-case": "off" },
  }
);

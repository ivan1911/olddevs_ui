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
      // Consumer fixture: a foreign project with its own rules and its own tsconfig.
      // It is checked by `npm run check:consumer` through a build, not by the kit's linter.
      "fixtures/**",
    ],
  },
  js.configs.recommended,
  {
    // Scripts and configs run in Node directly: they have `process` and `console`,
    // which the package code does not have, because that code ships to the consumer's browser.
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
      // Aligned with the front end: verbatimModuleSyntax in tsconfig requires the same.
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "no-console": "warn",
    },
  },
  storybook.configs["flat/recommended"],
  {
    // The plugin came with the upgrade to 10.5.6 and is useful: it catches a forgotten
    // `export default meta`, stories without a name, and `play` without `expect`.
    //
    // One rule is the exception. `prefer-pascal-case` checks the first letter with a
    // Latin-only regular expression, so it flags `Éclair` and `Ångström` as violations.
    // The kit is single-language, so this is a deliberate choice, not an oversight
    // (see docs/conventions.md). 183 warnings from nothing would bury the real ones:
    // the rule is turned off, not silenced line by line.
    files: ["**/*.stories.tsx"],
    rules: { "storybook/prefer-pascal-case": "off" },
  }
);

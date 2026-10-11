import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import * as barrel from "../src/index.js";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * Ворота отдельного входа `@olddevs/ui/color`.
 *
 * ЗАЧЕМ. Цветовая подсистема react-aria стоит 61 кБ gzip, и ADR-0038 держит её
 * вне barrel именно поэтому. Но одна забытая строка `export` в `src/index.ts`
 * добавит эти килобайты каждому потребителю, и **не покраснеет ничего**:
 * `npm run size` объявляет react-aria внешним вместе с остальными
 * peer-зависимостями, а страница фикстуры цвет не импортирует. Сам ADR называет
 * это отслеживаемым риском — здесь он отслеживается.
 */

test("the barrel does not export the colour picker", () => {
  expect(Object.keys(barrel)).not.toContain("ColorPicker");
});

test("the colour component is imported only by its own entry", () => {
  const entry = readFileSync(join(ROOT, "src", "color.ts"), "utf8");
  expect(entry).toContain("./components/inputs/ColorPicker.js");

  const barrelSource = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  expect(barrelSource).not.toContain("ColorPicker");
});

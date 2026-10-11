import { expect, test } from "vitest";
import * as icons from "../src/icons.js";

/**
 * Проверяет, что КАЖДОЕ имя словаря разрешается в настоящий компонент и следует
 * соглашению об именах.
 *
 * ЧЕСТНО О ГРАНИЦАХ ЭТОГО ТЕСТА. Отсутствующее имя lucide ловит и `tsc` —
 * `export { PendingCw as … } from "lucide-react"` даёт `TS2305`, проверено.
 * Так что от опечатки в имени страхует прежде всего typecheck, а не этот файл.
 *
 * Уникального здесь два:
 *  1. Соглашение «каждое имя словаря заканчивается на `Icon`» — типами
 *     невыразимо, а без него словарь быстро расползётся.
 *  2. Проверка РАНТАЙМА, а не только типов: тест исполняет модуль и убеждается,
 *     что значения существуют. Это страхует случай, когда типы lucide и её
 *     собранные бандлы расходятся.
 *
 * Почему имена вообще сверяются по установленному пакету, а не по документации:
 * `pending-cw` числится в релиз-нотах lucide 1.27.0, но экспорта в опубликованном
 * пакете нет вовсе.
 */

const names = Object.keys(icons);

test("the dictionary is not empty", () => {
  expect(names.length).toBeGreaterThan(40);
});

test.each(names)("%s resolves to a component", (name) => {
  const icon = (icons as Record<string, unknown>)[name];
  expect(icon, `${name} is not exported`).toBeDefined();
  // lucide-иконки — результат forwardRef, то есть объекты, а не функции.
  expect(["function", "object"]).toContain(typeof icon);
});

test("every dictionary name ends with Icon", () => {
  const bad = names.filter((n) => !n.endsWith("Icon"));
  expect(bad, `without the Icon suffix: ${bad.join(", ")}`).toEqual([]);
});

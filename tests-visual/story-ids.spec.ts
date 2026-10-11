import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Ворота идентификаторов: каждый `id=` в браузерных тестах ведёт на живую
 * историю.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ПРОВЕРКА. Неверный id не роняет ни компилятор, ни линтер:
 * Storybook отдаёт страницу «Story not found» с кодом 200, и тест падает
 * позже — на `waitForSelector` или на клике по кнопке, которой нет. Сообщение
 * при этом говорит про селектор, а не про причину, и поиск начинается не с
 * того конца. Волна 23 переименовала 300 историй разом, и цена такой
 * диагностики стала очевидной.
 *
 * Файл лежит в `tests-visual/`, а не в `tests/`: он читает
 * `storybook-static/index.json` — артефакт сборки витрины. В `vitest` он
 * требовал бы либо собранной витрины на каждом прогоне, либо молчаливого
 * пропуска, а проверка, умеющая тихо не запуститься, в этом репозитории не
 * считается сделанной.
 */

const ROOT = resolve(import.meta.dirname, "..");

const entries: Record<string, unknown> = JSON.parse(
  readFileSync(resolve(ROOT, "storybook-static/index.json"), "utf8")
).entries;

/** Ссылка на историю: файл, строка и сам id — чтобы чинить, не ища. */
type Ref = { file: string; line: number; id: string };

/**
 * Собственный файл пропускается: регулярное выражение ниже само выглядит
 * ссылкой на историю. Имя берётся из `import.meta.url`, а не из литерала:
 * переименование файла иначе тихо вернуло бы самоловлю.
 */
const SELF = basename(fileURLToPath(import.meta.url));

function references(): Ref[] {
  const out: Ref[] = [];
  for (const name of readdirSync(resolve(ROOT, "tests-visual"))) {
    if (!name.endsWith(".ts") || name === SELF) continue;
    const lines = readFileSync(resolve(ROOT, "tests-visual", name), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/id=([^&"'`\s]+)/g)) {
        // Шаблонная подстановка — это перебор индекса, а не жёсткая ссылка.
        if (m[1]!.includes("$")) continue;
        out.push({ file: name, line: i + 1, id: m[1]! });
      }
    });
  }
  return out;
}

/** Ближайшие по написанию id — без подсказки поиск начинается с нуля. */
function nearest(id: string): string[] {
  const [, story = ""] = id.split("--");
  return Object.keys(entries)
    .filter((k) => k.startsWith(id.split("--")[0] + "--") || k.endsWith("--" + story))
    .slice(0, 3);
}

test("every id= in the browser tests leads to an existing story", () => {
  const refs = references();
  // Пустое множество ссылок означает сломанный поиск, а не порядок в тестах.
  expect(refs.length, "no story references found — the parsing is broken").toBeGreaterThan(0);

  const broken = refs
    .filter((r) => !(r.id in entries))
    .map((r) => `${r.file}:${r.line}: ${r.id}\n    similar: ${nearest(r.id).join(", ") || "none"}`);

  expect(
    broken,
    "A reference to a story missing from the showcase. Storybook will serve “Story not found”,\n" +
      "and the test will fail on a selector, not here.\n" +
      broken.join("\n")
  ).toEqual([]);
});

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";
import * as editor from "../src/editor/index.js";
import * as schemaEntry from "../src/editor/schema-entry.js";
import { RICH_TEXT_SCHEMA, richTextSanitizeConfig } from "../src/editor/core/schema.js";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/**
 * Ворота входа `@olddevs/ui/editor/schema` (OLDSUI-48, ADR-0050).
 *
 * ЗАЧЕМ. Очистка HTML — дело сервера потребителя, и Node-процессу, которому
 * нужен один конфиг для DOMPurify, незачем грузить React и Tiptap. Вход
 * `@olddevs/ui/editor` тянет редактор целиком, поэтому конфиг отдаётся ещё и
 * отдельным лёгким входом. Обещание держится на графе модулей: одна лишняя
 * строка импорта в `schema.ts` — и вход снова тяжёлый, а ни размер (Tiptap во
 * внешних), ни типы этого не заметят.
 */

test("the entry exports the schema as data, the sanitiser, the bare config and markRange", () => {
  expect(Object.keys(schemaEntry).sort()).toEqual([
    "RICH_TEXT_SCHEMA",
    "markRange",
    "richTextSanitizeConfig",
    "richTextSchema",
    "sanitizeRichText",
  ]);
  expect(schemaEntry.RICH_TEXT_SCHEMA).toBe(RICH_TEXT_SCHEMA);
  expect(schemaEntry.richTextSanitizeConfig().ALLOWED_TAGS).toEqual(
    richTextSanitizeConfig().ALLOWED_TAGS
  );
});

test("the editor entry keeps exporting the sanitise config and the sanitiser", () => {
  expect(editor.richTextSanitizeConfig).toBe(schemaEntry.richTextSanitizeConfig);
  expect(editor.sanitizeRichText).toBe(schemaEntry.sanitizeRichText);
  // Схема для набора `tools` своих Инструментов (OLDSUI-104) — из обоих входов.
  expect(editor.richTextSchema).toBe(schemaEntry.richTextSchema);
  // Помощник Карточки у текста: описание своего Инструмента собирается и на
  // сервере, а `rangeAt` — его поле (OLDSUI-113).
  expect(editor.markRange).toBe(schemaEntry.markRange);
});

/** Подключения модуля: `from "…"` и `import "…"`; типовые импорты не в счёт. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(
    /^\s*(?:import|export)\s+(type\s+)?[^"']*?from\s+["']([^"']+)["']/gm
  )) {
    if (!match[1]) found.push(match[2]!);
  }
  for (const match of source.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) found.push(match[1]!);
  return found;
}

function moduleGraph(entry: string): { files: string[]; packages: string[] } {
  const files: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.includes(file)) continue;
    files.push(file);
    for (const specifier of specifiers(readFileSync(file, "utf8"))) {
      if (!specifier.startsWith(".")) {
        packages.add(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier).replace(/\.js$/, "");
      const found = [".ts", ".tsx"].map((extension) => target + extension).find(existsSync);
      if (!found) throw new Error(`${file} imports ${specifier}, which has no source`);
      queue.push(found);
    }
  }
  return { files, packages: [...packages].sort() };
}

test("the module graph of the entry has no React, no engine and no client boundary", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "schema-entry.ts"));

  expect(files).toContain(join(SRC, "editor", "core", "schema.ts"));
  expect(files).toContain(join(SRC, "editor", "core", "customTool.ts"));
  // Ни одного пакета: React и Tiptap — пакеты, а компоненты кита до графа не доходят.
  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
});

/*
  Свой Инструмент на сервере (OLDSUI-104, ADR-0058, п. 2.3): очистка читает
  правила Схемы из описания, и модуль описания (`customTool.ts`) импортируется
  там же, где лёгкий вход, — без Tiptap и React. Extensions — дело
  описания потребителя: с загрузчиком они и у него не попадают в граф сервера.
*/
test("the custom tool description module is as light as the entry", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "core", "customTool.ts"));

  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
  // Проводка своего Инструмента в движок — отдельно и в граф входа не попадает.
  const entry = moduleGraph(join(SRC, "editor", "schema-entry.ts")).files;
  expect(entry).not.toContain(join(SRC, "editor", "core", "customToolEngine.ts"));
});

/*
  Настроенный Инструмент на сервере (OLDSUI-268): `tool()` вызывают в серверном
  модуле, где собирается `tools`, и модуль помощника не тянет ни Tiptap, ни React.
*/
test("the tool() module is as light as the entry, and the schema skips a Configured Tool", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "core", "toolOptions.ts"));

  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
  // Он же — часть графа лёгкого входа: `schema.ts` отличает им запись `tools` от своего Инструмента.
  expect(moduleGraph(join(SRC, "editor", "schema-entry.ts")).files).toContain(files[0]);

  const schema = schemaEntry.richTextSchema([editor.tool("toc", { levels: [2] })]);
  expect(schema.customBlocks).toEqual({});
  expect(schema.customMarks).toEqual({});
});

test("the server reads only the schema rules of a description, never its Extensions", () => {
  const description = {
    name: "acme_card",
    get engine(): never {
      throw new Error("the server touched the Extensions");
    },
    blocks: { acme_card: { kind: "block" } },
  } as const;

  expect(schemaEntry.richTextSchema([description]).customBlocks).toEqual({
    acme_card: { kind: "block", place: "anywhere", attributes: {} },
  });
});

test("the entry is published as a subpath of the package", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  expect(manifest.exports["./editor/schema"]).toEqual({
    types: "./dist/editor/schema-entry.d.ts",
    default: "./dist/editor/schema-entry.js",
  });
});

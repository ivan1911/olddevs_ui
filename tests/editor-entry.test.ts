import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";
import * as barrel from "../src/index.js";
import type { CustomTool, Tool, ToolName } from "../src/editor/index.js";
import { EDITOR_ENGINE } from "../scripts/editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/**
 * Ворота отдельного входа `@olddevs/ui/editor`.
 *
 * ЗАЧЕМ. Движок редактора ставит только тот, кто импортирует подпуть
 * (ADR-0050, список — `scripts/editor-engine.mjs`): остальные Tiptap не ставят.
 * Обещание держится на одном: ни один модуль вне `src/editor/` не тянется к
 * Tiptap и к самому редактору. Одна забытая строка в barrel — и у каждого
 * потребителя без Tiptap сборка падает на неразрешимом импорте. Ни `npm run
 * size` (Tiptap там внешний), ни фикстура потребителя (Tiptap у неё стоит: она
 * импортирует редактор) этого не увидели бы до установки у живого потребителя.
 */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const OUTSIDE_EDITOR = sourceFiles(SRC)
  .map((full) => relative(SRC, full).split("\\").join("/"))
  .filter((path) => !path.startsWith("editor/"));

test("the barrel does not export the editor", () => {
  expect(Object.keys(barrel)).not.toContain("RichTextEditor");
});

test("nothing outside src/editor imports Tiptap or the editor", () => {
  const offenders = OUTSIDE_EDITOR.filter((path) => {
    const source = readFileSync(join(SRC, path), "utf8");
    return /from\s+["']@tiptap\//.test(source) || /from\s+["'][./]*editor\//.test(source);
  });

  expect(
    offenders,
    `These modules pull Tiptap into the main entry — a consumer without the optional ` +
      `peer dependencies would fail to build:\n${offenders.join("\n")}`
  ).toEqual([]);
});

test("the editor entry is published and its engine is not in the manifest", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  expect(manifest.exports["./editor"]).toEqual({
    types: "./dist/editor/index.d.ts",
    default: "./dist/editor/index.js",
  });

  // The GitLab registry drops peerDependenciesMeta, so an optional peer is a
  // required one for every consumer (OLDSUI-195): the engine stays out of
  // peerDependencies and dependencies altogether.
  const declared = { ...manifest.peerDependencies, ...manifest.dependencies };
  expect(EDITOR_ENGINE.filter((name) => name in declared)).toEqual([]);
  expect(manifest.peerDependenciesMeta).toBeUndefined();
});

test("the Handle hook is part of the editor entry, not of the barrel", async () => {
  const editor = await import("../src/editor/index.js");

  expect(Object.keys(editor)).toContain("useRichTextEditorState");
  expect(Object.keys(barrel)).not.toContain("useRichTextEditorState");
});

test("the custom tool API is part of the editor entry, not of the barrel", async () => {
  const editor = await import("../src/editor/index.js");

  expect(Object.keys(editor)).toContain("RICH_TEXT_PRESETS");
  expect(Object.keys(barrel)).not.toContain("RICH_TEXT_PRESETS");
  // Помощник диапазона Карточки у текста для Метки (OLDSUI-113).
  expect(Object.keys(editor)).toContain("markRange");
  expect(Object.keys(barrel)).not.toContain("markRange");

  // Типы входа: `Tool` принимает и имя кита, и описание своего Инструмента.
  const mergeTag: CustomTool = {
    name: "acme_mergeTag",
    engine: [],
    blocks: { acme_mergeTag: { kind: "inline", attributes: { acme_key: { kind: "url" } } } },
  };
  const tools: readonly Tool[] = [...editor.RICH_TEXT_PRESETS.full, mergeTag];
  const names: readonly ToolName[] = editor.RICH_TEXT_PRESETS.basic;
  expect(tools).toHaveLength(editor.RICH_TEXT_PRESETS.full.length + 1);
  expect(names).toContain("bold");
});

test("tool() is part of the editor entry, not of the barrel", async () => {
  const editor = await import("../src/editor/index.js");

  expect(Object.keys(editor)).toContain("tool");
  expect(Object.keys(barrel)).not.toContain("tool");
  // Запись `tools` — Настроенный Инструмент: данные, без функций.
  expect(editor.tool("toc", { levels: [2, 3] })).toEqual({
    configured: true,
    name: "toc",
    options: { levels: [2, 3] },
  });
});

test("the schema for custom tools is part of the editor entry, not of the barrel", async () => {
  const editor = await import("../src/editor/index.js");

  expect(Object.keys(editor)).toContain("richTextSchema");
  expect(Object.keys(barrel)).not.toContain("richTextSchema");
});

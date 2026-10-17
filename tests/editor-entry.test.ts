import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";
import * as barrel from "../src/index.js";
import type { CustomTool, Tool, ToolName } from "../src/editor/index.js";
import { EDITOR_ENGINE } from "../scripts/editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/**
 * The guard of the separate `@olddevs/ui/editor` entry point.
 *
 * WHY. Only a consumer who imports the subpath installs the editor engine
 * (ADR-0050, list in `scripts/editor-engine.mjs`): everyone else does not install Tiptap.
 * The promise rests on one thing: no module outside `src/editor/` reaches for
 * Tiptap or the editor itself. One forgotten line in the barrel, and every
 * consumer without Tiptap fails to build on an unresolvable import. Neither `npm run
 * size` (Tiptap is external there) nor the consumer fixture (it has Tiptap installed, since it
 * imports the editor) would notice this until a live consumer installs the package.
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
  // The Text card range helper for a Mark (OLDSUI-113).
  expect(Object.keys(editor)).toContain("markRange");
  expect(Object.keys(barrel)).not.toContain("markRange");

  // Entry types: `Tool` accepts both the kit's name and the description of a custom Tool.
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
  // A `tools` entry is a Configured Tool: data, without functions.
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

test("the tool State hook is part of the editor entry, not of the barrel", async () => {
  const editor = await import("../src/editor/index.js");

  expect(Object.keys(editor)).toContain("useRichTextToolState");
  expect(Object.keys(barrel)).not.toContain("useRichTextToolState");
});

/**
 * The static graph of `RichTextEditor` (no `import()`): the modules it pulls in
 * right away. The editor's startup budget is nearly used up, so the state hook and
 * snapshot computation must not live there (OLDSUI-268): the screen pays for them,
 * the one that imported them.
 */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const [, specifier] of source.matchAll(
      /^(?:import|export)\b[^;]*?from\s+"(\.[^"]+)"/gms
    )) {
      const base = resolve(file, "..", specifier!.replace(/\.js$/, ""));
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        try {
          visit(candidate);
          break;
        } catch {
          // Wrong suffix: the module has only one extension.
        }
      }
    }
  };
  visit(entry);
  return seen;
}

test("the static graph of RichTextEditor does not carry the State hook or the snapshots", () => {
  const graph = [...staticGraph(join(SRC, "editor/RichTextEditor.tsx"))].map((file) =>
    relative(SRC, file).split("\\").join("/")
  );

  // The graph was found: otherwise the check below would silently become empty.
  expect(graph).toContain("editor/features/search/searchPlugin.ts");
  expect(graph).toContain("editor/core/handleWatchers.ts");
  expect(graph.filter((path) => /useRichTextToolState|Snapshot\.ts$/.test(path))).toEqual([]);
});

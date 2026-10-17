import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, test } from "vitest";
import * as editor from "../src/editor/index.js";
import * as schemaEntry from "../src/editor/schema-entry.js";
import { RICH_TEXT_SCHEMA, richTextSanitizeConfig } from "../src/editor/core/schema.js";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

/**
 * The guard of the `@olddevs/ui/editor/schema` entry point (OLDSUI-48, ADR-0050).
 *
 * WHY. Sanitizing HTML is the consumer's server job, and a Node process that needs
 * one config for DOMPurify has no reason to load React and Tiptap. The
 * `@olddevs/ui/editor` entry point pulls in the whole editor, so the config is also exposed
 * as a separate light entry point. The promise rests on the module graph: one extra
 * import line in `schema.ts` and the entry is heavy again, and neither the size check (Tiptap is among the
 * externals) nor the types would notice this.
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
  // The Schema for the `tools` set of custom Tools (OLDSUI-104), from both entry points.
  expect(editor.richTextSchema).toBe(schemaEntry.richTextSchema);
  // Text card helper: the description of a custom Tool is also assembled on the
  // server, and `rangeAt` is its field (OLDSUI-113).
  expect(editor.markRange).toBe(schemaEntry.markRange);
});

/** Module dependencies: `from "…"` and side-effect `import "…"`; regular imports do not count. */
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
  // Not a single package: React and Tiptap are packages, and the kit's components never reach the graph.
  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
});

/*
 * A custom Tool on the server (OLDSUI-104, ADR-0058, section 2.3): sanitizing reads
 * the Schema rules from the description, and the description module (`customTool.ts`) is imported
 * where the light entry is, without Tiptap and React. Extensions are the job of the
 * consumer's description: with a loader, they also stay out of the server graph.
 */
test("the custom tool description module is as light as the entry", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "core", "customTool.ts"));

  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
  // Wiring a custom Tool into the engine is separate and is not part of the entry's graph.
  const entry = moduleGraph(join(SRC, "editor", "schema-entry.ts")).files;
  expect(entry).not.toContain(join(SRC, "editor", "core", "customToolEngine.ts"));
});

/*
 * A Configured Tool on the server (OLDSUI-268): `tool()` is called in the server
 * module where `tools` is assembled, and the helper module pulls in neither Tiptap nor React.
 */
test("the tool() module is as light as the entry, and the schema skips a Configured Tool", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "core", "toolOptions.ts"));

  expect(packages).toEqual([]);
  expect(
    files.filter((file) => readFileSync(file, "utf8").trimStart().startsWith('"use client"'))
  ).toEqual([]);
  // It is also part of the light entry's graph: `schema.ts` uses it to tell a `tools` entry from a custom Tool.
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

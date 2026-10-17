import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { EDITOR_ENGINE } from "../scripts/editor-engine.mjs";
import { installCommand } from "./docs-install-command.js";

/**
 * The Editor engine is a hand-kept list (`scripts/editor-engine.mjs`) since it
 * left the manifest (OLDSUI-195): the GitLab registry drops
 * peerDependenciesMeta, so optional peers were installed for every consumer.
 * Without the manifest nothing ties the list to the code or to the install
 * command on the Editor page — these checks do. A Tiptap extension imported by
 * src/editor but missing from the list would break the build of a consumer who
 * followed the Editor page.
 */

const ROOT = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.stories\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Package names of bare imports — static, re-exports, side-effect and dynamic
 * `import()` (a lazy Tool may load its package that way): `@tiptap/pm/state` →
 * `@tiptap/pm`.
 */
function importedPackages(files: string[]) {
  const names = new Set<string>();
  for (const file of files) {
    for (const [, spec] of readFileSync(file, "utf8").matchAll(
      /(?:\bfrom|\bimport)\s*\(?\s*["']([^"'.][^"']*)["']/g
    )) {
      const parts = spec!.split("/");
      names.add(spec!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!);
    }
  }
  return [...names].sort();
}

describe("the Editor engine", () => {
  test("every engine package has its version in devDependencies", () => {
    expect(EDITOR_ENGINE.filter((name) => !manifest.devDependencies[name])).toEqual([]);
  });

  test("src/editor imports nothing beyond the engine and the kit's declared packages", () => {
    const known = new Set([
      ...EDITOR_ENGINE,
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
    ]);
    // react-dom comes with react in every React app; the kit never declared it.
    known.add("react-dom");
    const imported = importedPackages(sourceFiles(join(ROOT, "src", "editor")));
    expect(imported.filter((name) => !known.has(name))).toEqual([]);
    expect(EDITOR_ENGINE.filter((name) => !imported.includes(name))).toEqual([]);
  });

  test("the install command of the Editor page names exactly the engine", () => {
    const page = "components/inputs/rich-text-editor.md";
    // `katex@0.18.10`: a pinned spec is a name plus the exact devDependencies version.
    const specs = installCommand(page).map((spec) => {
      const at = spec.indexOf("@", 1);
      return at === -1 ? { name: spec } : { name: spec.slice(0, at), version: spec.slice(at + 1) };
    });
    expect(specs.map((spec) => spec.name).sort()).toEqual([...EDITOR_ENGINE].sort());
    for (const spec of specs.filter((entry) => entry.version !== undefined)) {
      expect(spec.version, spec.name).toBe(manifest.devDependencies[spec.name]);
    }
  });
});

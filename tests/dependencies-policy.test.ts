import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { EDITOR_ENGINE } from "../scripts/editor-engine.mjs";

/**
 * ADR-0072: the kit's only peer dependency is React, and the package brings
 * every other third-party library itself. A library that sneaks back into
 * peerDependencies lengthens the install command again; a library that src
 * imports but the manifest does not declare builds here (devDependencies) and
 * breaks for the consumer. The Editor engine is the exception: it stays out of
 * the manifest altogether (ADR-0050, OLDSUI-195), `editor-engine.test.ts`
 * guards it.
 */

const ROOT = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  name: string;
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

/** Package names of bare imports, static and dynamic: `lucide-react/icons` → `lucide-react`. */
function importedPackages(files: string[]) {
  const names = new Set<string>();
  for (const file of files) {
    // Comments are prose and may say `from "x"` or `import "x"` in English: look at code only.
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    for (const [, spec] of code.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'.][^"']*)["']/g)) {
      const parts = spec!.split("/");
      names.add(spec!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!);
    }
  }
  return [...names].sort();
}

describe("dependency policy (ADR-0072)", () => {
  test("React is the only peer dependency", () => {
    expect(Object.keys(manifest.peerDependencies)).toEqual(["react"]);
  });

  test("every package src imports is declared for the consumer", () => {
    const declared = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.peerDependencies),
      ...EDITOR_ENGINE,
      // react-dom comes with react in every React app; the kit never declared it.
      "react-dom",
      // Usage examples in JSDoc import the kit by its own name.
      manifest.name,
    ]);
    const imported = importedPackages(sourceFiles(join(ROOT, "src")));
    expect(imported.filter((name) => !declared.has(name))).toEqual([]);
  });

  test("a dependency is not repeated in devDependencies", () => {
    const repeated = Object.keys(manifest.dependencies).filter(
      (name) => name in manifest.devDependencies
    );
    expect(repeated).toEqual([]);
  });
});

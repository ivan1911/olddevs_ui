import { readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

/**
 * Identifier gate: every `id=` in the browser tests leads to a live story.
 *
 * WHY A SEPARATE CHECK. A wrong id breaks neither the compiler nor the linter:
 * Storybook serves a "Story not found" page with status 200, and the test fails later —
 * on `waitForSelector` or on a click on a button that does not exist. The message then
 * talks about the selector, not the cause, so the search starts from the wrong end.
 * Wave 23 renamed 300 stories at once, and the cost of such diagnosis became obvious.
 *
 * The file lives in `tests-visual/`, not `tests/`: it reads `storybook-static/index.json`,
 * the artifact of the showcase build. In `vitest` it would need either a built showcase on
 * every run or a silent skip, and a check that can quietly fail to run is not considered
 * done in this repository.
 */

const ROOT = resolve(import.meta.dirname, "..");

const entries: Record<string, unknown> = JSON.parse(
  readFileSync(resolve(ROOT, "storybook-static/index.json"), "utf8")
).entries;

/** A reference to a story: the file, the line and the id itself, so it can be fixed without searching. */
type Ref = { file: string; line: number; id: string };

/**
 * The file itself is skipped: the regular expression below looks like a story reference
 * itself. The name comes from `import.meta.url`, not from a literal: renaming the file
 * would otherwise quietly bring back the self-match.
 */
const SELF = basename(fileURLToPath(import.meta.url));

function references(): Ref[] {
  const out: Ref[] = [];
  for (const name of readdirSync(resolve(ROOT, "tests-visual"))) {
    if (!name.endsWith(".ts") || name === SELF) continue;
    const lines = readFileSync(resolve(ROOT, "tests-visual", name), "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(/id=([^&"'`\s]+)/g)) {
        // A template substitution is a loop over an index, not a hard-coded reference.
        if (m[1]!.includes("$")) continue;
        out.push({ file: name, line: i + 1, id: m[1]! });
      }
    });
  }
  return out;
}

/** IDs closest in spelling: without a hint, the search starts from zero. */
function nearest(id: string): string[] {
  const [, story = ""] = id.split("--");
  return Object.keys(entries)
    .filter((k) => k.startsWith(id.split("--")[0] + "--") || k.endsWith("--" + story))
    .slice(0, 3);
}

test("every id= in the browser tests leads to an existing story", () => {
  const refs = references();
  // An empty set of references means the search is broken, not the tests.
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

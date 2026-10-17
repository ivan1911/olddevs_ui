/**
 * Checks the built package: the `"use client"` directives survived the build.
 *
 * Why this is separate from `tests/rsc-gate.test.ts` and not in it. That test reads the
 * sources and covers the layout the author writes. This check covers something else, and
 * with a different tool: **whether the directive survived into `dist`**. The bundler can
 * drop it, not the author. Next.js warns library authors directly that the build config
 * must not strip the directive. Today `tsc` keeps it; this check exists for the day the
 * bundler changes.
 *
 * Why a script and not a test. `dist/` is in `.gitignore`, so a fresh checkout has none of
 * it. A test that "passes" in that case would be green exactly when there is nothing to
 * check, which makes it useless. The script fails with a clear message instead, and runs
 * right after `npm run build`: in the CI job and in `release:check`.
 *
 * Each `.js` in `dist` is matched to its `.ts`/`.tsx` counterpart in `src`, and the
 * directives must agree. The list of files is not kept here on purpose: two lists would
 * drift apart silently.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const SRC = join(ROOT, "src");

const DIRECTIVE = '"use client"';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!existsSync(DIST)) {
  fail("The dist directory is missing. Run `npm run build` — there is nothing to check.");
}

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });
}

/** The first meaningful line of the file: the directive must come before any imports. */
function hasDirective(file) {
  return readFileSync(file, "utf8").trimStart().startsWith(DIRECTIVE);
}

const built = jsFiles(DIST);

if (built.length === 0) {
  fail("dist has no .js at all. The build did not happen — there is nothing to check.");
}

const lost = [];
const orphans = [];

for (const file of built) {
  const stem = relative(DIST, file).replace(/\.js$/, "");
  const source = [".tsx", ".ts"].map((ext) => join(SRC, `${stem}${ext}`)).find(existsSync);

  if (!source) {
    orphans.push(`${stem}.js`);
    continue;
  }

  if (hasDirective(source) && !hasDirective(file)) {
    lost.push(`${stem}.js`);
  }
}

if (orphans.length > 0) {
  fail(
    `dist has a file with no counterpart in src — the build produced something unexpected:\n` +
      orphans.map((name) => `  ${name}`).join("\n")
  );
}

if (lost.length > 0) {
  fail(
    `The build lost "use client" — these files will fail for the consumer in a server ` +
      `component:\n${lost.map((name) => `  ${name}`).join("\n")}`
  );
}

const withDirective = built.filter(hasDirective).length;
console.log(`✓ dist: ${built.length} files, "use client" present in ${withDirective} of them`);

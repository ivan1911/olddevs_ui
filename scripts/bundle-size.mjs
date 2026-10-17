/**
 * The size budget: what the package costs the consumer.
 *
 * THE METHOD IS PART OF THE CHECK, so it is written down here rather than implied.
 *
 * - The built `dist` is measured, not `src`: that is what the consumer installs.
 * - The build is Rollup inside Vite, the same bundler most consumers use.
 * - React and all of the package's dependencies, peer and `dependencies`, are declared
 *   external. Otherwise the number would include react-aria and Radix rather than the kit,
 *   and the budget would react to other projects' releases.
 * - Minification is on, and the metric is **gzip**, since that is what goes over the wire.
 *
 * The numbers from this script cover tree shaking inside the package. They do NOT cover
 * what a Next.js user receives: there the boundary of the client graph adds its own cost,
 * and importing one button can cost 306 kB against 6 kB in this measurement (ADR-0029).
 * The second figure is measured by `npm run check:consumer`, against the budgets in the
 * same file as here.
 */

import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { build } from "vite";
import { BUDGETS, PACKAGE_SCENARIOS } from "./bundle-size.budgets.mjs";
import { EDITOR_ENGINE } from "./editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

if (!existsSync(join(DIST, "index.js"))) {
  console.error(
    "✗ The dist directory is missing or empty. Run `npm run build` — there is nothing to measure."
  );
  process.exit(1);
}

/**
 * External: everything that is not the kit's code, meaning peer dependencies,
 * `dependencies` and the Editor engine. The list is derived from `package.json`, not
 * written by hand, so that a new dependency cannot slip into the measurement unnoticed.
 * The Editor engine is not declared in the manifest (OLDSUI-195); its list is in
 * `editor-engine.mjs`.
 */
const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const EXTERNAL = [
  ...Object.keys(manifest.peerDependencies ?? {}),
  ...Object.keys(manifest.dependencies ?? {}),
  ...EDITOR_ENGINE,
  "react/jsx-runtime",
  "react-dom",
];

// A temporary folder inside the package: peer dependencies are resolved from the entry
// file, and the system tmp directory has no node_modules.
const tmp = mkdtempSync(join(ROOT, ".tmp-size-"));

/**
 * Package entries are matched by their exact names, not by a prefix. A string alias in
 * Vite also fires on a subpath: `@olddevs/ui/editor` would turn into
 * `dist/index.js/editor`. So each name is a regular expression that matches the whole
 * specifier.
 */
const ENTRIES = [
  {
    find: /^@olddevs\/ui\/editor\/highlight$/,
    replacement: join(DIST, "editor", "highlight-entry.js"),
  },
  {
    find: /^@olddevs\/ui\/editor\/schema$/,
    replacement: join(DIST, "editor", "schema-entry.js"),
  },
  { find: /^@olddevs\/ui\/editor$/, replacement: join(DIST, "editor", "index.js") },
  { find: /^@olddevs\/ui$/, replacement: join(DIST, "index.js") },
];

async function measure(scenario) {
  const entry = join(tmp, `${scenario.key}.js`);
  writeFileSync(entry, scenario.source, "utf8");

  /*
    A scenario may BRING some external packages into the measurement: `bundled`, a list
    of name prefixes. This is how the cost of the Editor engine is measured. The consumer
    installs Tiptap, but the choice of extensions belongs to the kit, and an extra
    extension costs the consumer exactly as much as extra code in the kit itself. Subpaths
    (`@tiptap/pm/state`) stay external: the comparison matches the start of the name.
  */
  const bundled = scenario.bundled ?? [];
  const external = (id) =>
    !bundled.some((prefix) => id.startsWith(prefix)) &&
    EXTERNAL.some((name) => id === name || id.startsWith(`${name}/`));

  const result = await build({
    root: tmp,
    logLevel: "error",
    resolve: { alias: ENTRIES },
    build: {
      outDir: join(tmp, `out-${scenario.key}`),
      emptyOutDir: true,
      minify: "esbuild",
      target: "es2022",
      lib: { entry, formats: ["es"], fileName: "bundle" },
      rollupOptions: { external },
      // In memory: the chunks are classified below by their role, not by file name.
      write: false,
    },
  });

  /*
    Two numbers per scenario (ADR-0058, item 11.7). "Start" is what the consumer downloads
    right away: the entry chunk and everything it imports statically. "Full" is the whole
    graph, including the chunks loaded by `import()`: the popover of a custom color
    (OLDSUI-46, `ColorPicker`), the lazy `codeBlock` and `table` (OLDSUI-111), and the
    loaders of custom Tools. Lazy chunks used to be dropped silently, which made moving
    code behind `import()` look like pure savings. Now their weight is printed for every
    scenario, and a scenario with `chunks: "all"` is measured by it. Without splitting into
    chunks, the bundler would leave a stub in `bundle.js` and put the code into a neighbouring
    file, so the measurement would show zero for any entry with a dynamic import. The
    chunks are concatenated into one string, so that gzip sees one file, as it did before
    the split.
  */
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
  const chunks = outputs.filter((file) => file.type === "chunk");
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  // Static imports from the entry: `isDynamicEntry` does not work here, because a chunk
  // shared by the lazy and the static graph can also be the target of an `import()`.
  const initial = new Set();
  const visit = (chunk) => {
    if (!chunk || initial.has(chunk)) return;
    initial.add(chunk);
    for (const name of chunk.imports) visit(byName.get(name));
  };
  for (const chunk of chunks) if (chunk.isEntry) visit(chunk);
  const size = (list) => {
    const bytes = Buffer.from(list.map((chunk) => chunk.code).join("\n"), "utf8");
    return { raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length };
  };
  const start = size([...initial]);
  const full = size(chunks);
  const modules = (list) => list.flatMap((chunk) => Object.keys(chunk.modules));
  return {
    ...(scenario.chunks === "all" ? full : start),
    lazy: full.gzip - start.gzip,
    startModules: modules([...initial]),
    allModules: modules(chunks),
  };
}

/**
 * The "start" seam (ADR-0058, items 11.1 and 11.7): the lazy built-in modules are absent
 * from the static graph, but present in the full one. The second half of the check guards
 * against an always-green gate: a pattern that matches nothing (a module was renamed, a path
 * changed) must fail the check, not pass it.
 */
function startLeaks(scenario, { startModules, allModules }) {
  return (scenario.notInStart ?? []).flatMap((pattern) => {
    if (!allModules.some((id) => id.includes(pattern))) {
      return [`${scenario.key}: no module matches “${pattern}” at all — update the pattern`];
    }
    const leaked = startModules.filter((id) => id.includes(pattern));
    return leaked.length > 0
      ? [
          `${scenario.key}: the start graph contains ${leaked.map((id) => id.slice(ROOT.length)).join(", ")}`,
        ]
      : [];
  });
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

let exitCode = 0;

try {
  const rows = [];
  const measured = {};
  const leaks = [];
  let failed = false;

  for (const scenario of PACKAGE_SCENARIOS) {
    const budget = BUDGETS.package[scenario.key];
    if (budget === undefined) {
      console.error(`✗ Scenario “${scenario.key}” has no budget in bundle-size.budgets.mjs`);
      exitCode = 1;
      break;
    }

    const measurement = await measure(scenario);
    const { raw, gzip, lazy } = measurement;
    measured[scenario.key] = gzip;
    leaks.push(...startLeaks(scenario, measurement));
    const slack = budget - gzip;
    if (slack < 0) failed = true;

    rows.push(
      [
        scenario.title.padEnd(40),
        format(raw).padStart(10),
        format(gzip).padStart(10),
        (scenario.chunks === "all" ? "counted" : format(lazy)).padStart(10),
        format(budget).padStart(10),
        (slack < 0 ? `over by ${format(-slack)}` : `slack ${format(slack)}`).padStart(22),
      ].join(" ")
    );
  }

  console.log(
    [
      "Scenario".padEnd(40),
      "raw".padStart(10),
      "gzip".padStart(10),
      "lazy".padStart(10),
      "budget".padStart(10),
    ].join(" ")
  );
  console.log(rows.join("\n"));
  console.log(
    "\nlazy — gzip of the import() chunks on top of the start; a scenario marked “counted” " +
      "measures the whole graph (ADR-0058, 11.7)."
  );

  if (leaks.length > 0) {
    console.error(
      `\n✗ The start graph of the editor must not carry the lazy built-ins (ADR-0058, 11.1):\n` +
        leaks.map((line) => `  ${line}`).join("\n")
    );
    exitCode = 1;
  }

  if (failed) {
    console.error(
      "\n✗ The size budget is exceeded. Either an import pulled in too much, or the component " +
        "grew for a reason. In the latter case raise the budget in " +
        "scripts/bundle-size.budgets.mjs as a SEPARATE line in the MR — with an explanation of " +
        "what exactly grew."
    );
    exitCode = 1;
  }

  // The numbers in the docs are part of the contract with the reader, and they go stale
  // silently. So the "Import size" table is checked against the measurement: a discrepancy
  // of more than a tenth of a kilobyte fails the check, rather than being left to chance.
  const doc = readFileSync(join(ROOT, "docs", "getting-started.md"), "utf8");
  // Only the section, not the whole file: the page has a second table, about the cost of
  // the client graph boundary, and its rows are named almost the same way.
  // The section heading and the unit "kB" are parsed as they are: the Reference is in
  // English (ADR-0073). Renaming them would break the check and leave an always-green gate.
  const section = doc.split("## Import size")[1]?.split("\n## ")[0];

  if (!section) {
    console.error(
      "\n✗ docs/getting-started.md has no import-cost section — " +
        "there is nothing to compare the numbers with."
    );
    exitCode = 1;
  } else {
    const stale = [];

    for (const { key, documented } of PACKAGE_SCENARIOS) {
      const row = section.split("\n").find((line) => line.includes(`| ${documented}`));
      if (!row) {
        stale.push(
          `${key}: the row “${documented}” is missing from the table in docs/getting-started.md`
        );
        continue;
      }

      const written = Number(row.match(/([\d]+(?:[.,]\d+)?)\s*kB/)?.[1]?.replace(",", "."));
      const actual = Number((measured[key] / 1024).toFixed(1));
      if (!Number.isFinite(written) || Math.abs(written - actual) > 0.1) {
        stale.push(`${key}: the docs say ${written} kB, the measurement says ${actual} kB`);
      }
    }

    if (stale.length > 0) {
      console.error(
        `\n✗ The import-cost table in docs/getting-started.md has diverged from the ` +
          `measurement:\n${stale.map((line) => `  ${line}`).join("\n")}`
      );
      exitCode = 1;
    }
  }

  if (exitCode === 0) {
    console.log(
      "\n✓ the package contribution is within budget; the documented numbers match the measurement"
    );
  }
} finally {
  // Cleanup must happen whatever the outcome. That is why there is no `process.exit` earlier
  // in the flow: it skips `finally`, the temporary folder stays in the repository, and the
  // linter of the next run fails on it.
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(exitCode);

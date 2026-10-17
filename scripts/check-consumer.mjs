/**
 * Builds a consumer application: proof that the package works from the outside.
 *
 * WHAT IS CHECKED HERE, AND WHAT THE OTHER GATES CANNOT SEE.
 *
 * `npm test` and `npm run build` look at the package from the inside. There all the code is
 * client code, resolution goes through the repository's paths, and Tailwind scans the
 * sources. None of those checks can see that a component is imported into a server file in
 * the consumer's app, that `exports` closed the path it needs, or that the classes never
 * reached the CSS.
 *
 * WHY A TARBALL AND NOT AN ALIAS TO `src`. An alias would check the sources, which is not
 * what goes to the registry. It would not notice a file missing from `files`, a closed
 * `exports`, or a directive lost in the build. A gate that is green regardless of what is in
 * the package always passes. So: `npm pack`, install the `.tgz`, build.
 *
 * The package is installed with `--no-save`. The fixture's `package.json` does not know about
 * the kit at all, so its lock file is not rewritten on every release and the CI cache stays
 * usable. Of the kit's dependencies, the fixture declares only React, just as a real consumer
 * does (ADR-0072). npm installs the rest by the ranges in the tarball's manifest, so each run
 * gets fresh versions, as a new consumer would. A Radix or react-aria release that breaks the
 * build or the budget shows up here before it reaches users.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BUDGETS } from "./bundle-size.budgets.mjs";
import { EDITOR_ENGINE } from "./editor-engine.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const FIXTURE = join(ROOT, "fixtures", "consumer");
const TARBALL = join(FIXTURE, "olddevs-ui.tgz");

/**
 * Probe classes for the final CSS.
 *
 * Taken from `lib/button.ts`. They are not in the fixture's own markup, so they can reach
 * the CSS only through `@source` pointing at the package's `dist`. `rounded-control` is also
 * defined in the kit's `styles.css`, so the probe additionally proves that
 * `@import "@olddevs/ui/styles.css"` worked.
 */
const CSS_PROBES = ["rounded-control", "outline-accent-strong"];

function step(name) {
  console.log(`\n→ ${name}`);
}

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** The same as `run`, but captures the output: the route table is read from it. */
function runCaptured(command, args, cwd) {
  const output = execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
  process.stdout.write(output);
  return output;
}

/**
 * The `First Load JS` of a route, from the `next build` table.
 *
 * Parsing the output is a fragile method, so it MUST fail when the format changes. Silently
 * returning "zero kilobytes" would report success exactly when the check has stopped
 * checking.
 */
function firstLoadKb(output, route) {
  const line = output
    .split("\n")
    .find((row) => new RegExp(`[○●λƒ]\\s+${route.replace("/", "\\/")}\\s`).test(row));

  if (!line) {
    fail(
      `The next build output has no line for route ${route}. The table format ` +
        `has changed — fix the parsing instead of switching the check off.`
    );
  }

  const sizes = [...line.matchAll(/([\d.]+)\s*(kB|MB|B)\b/g)];
  const last = sizes.at(-1);
  if (!last) fail(`The line for route ${route} carries no size at all: ${line.trim()}`);

  const value = Number(last[1]);
  const unit = last[2];
  return unit === "MB" ? value * 1024 : unit === "B" ? value / 1024 : value;
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

step("building the package");
run("npm", ["run", "build"], ROOT);
run("node", [join(ROOT, "scripts", "check-dist.mjs")], ROOT);

step("packing the tarball");
rmSync(TARBALL, { force: true });
const packed = execFileSync("npm", ["pack", "--json", "--pack-destination", FIXTURE], {
  cwd: ROOT,
  encoding: "utf8",
});
const packedName = JSON.parse(packed)[0].filename;
// The tarball's name carries the version. The fixture installs it under a fixed name,
// otherwise the install command would change with every release.
const versioned = join(FIXTURE, packedName);
if (!existsSync(versioned)) fail(`npm pack did not create ${packedName}`);
writeFileSync(TARBALL, readFileSync(versioned));
rmSync(versioned, { force: true });

/**
 * The tarball's manifest as the GitLab registry serves it (OLDSUI-195). The registry passes
 * the npm dependencies through but not `peerDependenciesMeta`, so an optional peer becomes
 * required for the consumer. The check reads the manifest the same way, without that field,
 * and requires that the Editor engine is not in it. Otherwise a consumer without the Editor
 * would get all of Tiptap in its lock file again. Installing the tarball itself would not
 * show this: from a `.tgz`, npm reads the full manifest.
 */
step("the published manifest does not make the Editor engine a dependency");
const packedManifest = JSON.parse(
  execFileSync("tar", ["-xzOf", TARBALL, "package/package.json"], { encoding: "utf8" })
);
const asGitlabServes = {
  ...packedManifest.dependencies,
  ...packedManifest.peerDependencies,
  ...packedManifest.optionalDependencies,
};
const engineDeclared = EDITOR_ENGINE.filter((name) => name in asGitlabServes);
if (engineDeclared.length > 0) {
  fail(
    `The packed manifest declares the Editor engine: ${engineDeclared.join(", ")}.\n` +
      `The GitLab registry drops peerDependenciesMeta, so every consumer would install ` +
      `these packages, Editor or not. Keep them in devDependencies and on the Editor page.`
  );
}

/*
 * The fixture installs the engine the same way a consumer does, with the command from the
 * Editor page: every package in `EDITOR_ENGINE` is in its dependencies. A missing package
 * does not break the build. Next.js finds it in the kit's `node_modules` higher up the tree,
 * and a second copy of `@tiptap/core` and `@tiptap/pm` arrives with it. The Editor page then
 * silently grows by tens of kilobytes (OLDSUI-277: +93 kB because of
 * `@tiptap/extension-details`).
 */
step("the fixture installs every Editor engine package");
const fixtureManifest = JSON.parse(readFileSync(join(FIXTURE, "package.json"), "utf8"));
const fixtureDeclared = { ...fixtureManifest.dependencies, ...fixtureManifest.devDependencies };
const engineMissing = EDITOR_ENGINE.filter((name) => !(name in fixtureDeclared));
if (engineMissing.length > 0) {
  fail(
    `fixtures/consumer/package.json lacks Editor engine packages: ${engineMissing.join(", ")}.\n` +
      `A consumer installs them by the command on the Editor page; add them with the same range.`
  );
}

step("installing consumer dependencies");
run("npm", ["install", "--no-audit", "--no-fund"], FIXTURE);
run("npm", ["install", "--no-save", "--no-audit", "--no-fund", "./olddevs-ui.tgz"], FIXTURE);

step("building the consumer");
rmSync(join(FIXTURE, ".next"), { recursive: true, force: true });
const buildOutput = runCaptured("npx", ["next", "build"], FIXTURE);

step("kit classes reached the consumer CSS");
const cssDir = join(FIXTURE, ".next", "static", "css");
if (!existsSync(cssDir)) {
  fail("Next.js emitted no CSS file — Tailwind did not build for the consumer");
}
const css = readdirSync(cssDir)
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(cssDir, name), "utf8"))
  .join("\n");

const missing = CSS_PROBES.filter((probe) => !css.includes(probe));
if (missing.length > 0) {
  fail(
    `The consumer CSS has no package classes: ${missing.join(", ")}.\n` +
      `This is what a lost @source or @import "@olddevs/ui/styles.css" looks like: ` +
      `the build succeeds and the consumer components come out unstyled.`
  );
}

/**
 * KaTeX styles and fonts reached the consumer (OLDSUI-280, ADR-0070, item 9).
 *
 * The kit is built with plain `tsc`, and its KaTeX styles are not a file: they are an import
 * of `katex/dist/katex.min.css` in the lazy formula module. The consumer's bundler emits the
 * CSS of the lazy chunk and rewrites `url(fonts/…)` to the fonts of the consumer's `katex`
 * package. The build stays green even when the import is lost, and then formulas render
 * without styles or fonts. So the result is read: the `.katex` rules in the CSS and the font
 * files in `static/media`.
 */
step("KaTeX styles and fonts reached the consumer build");
const katexCssLost = [".katex", "KaTeX_Main"].filter((probe) => !css.includes(probe));
if (katexCssLost.length > 0) {
  fail(
    `The consumer CSS lacks the KaTeX stylesheet (${katexCssLost.join(", ")}).\n` +
      `The lazy formula module imports katex/dist/katex.min.css; if the bundler dropped it, ` +
      `check the import in dist/editor/features/mathematics/katexEngine.js and the ` +
      `sideEffects of the packages involved.`
  );
}
const mediaDir = join(FIXTURE, ".next", "static", "media");
const katexFonts = existsSync(mediaDir)
  ? readdirSync(mediaDir).filter((name) => name.startsWith("KaTeX_"))
  : [];
if (katexFonts.length === 0) {
  fail(
    "No KaTeX_* font files in .next/static/media: the bundler did not resolve url(fonts/…) " +
      "of katex.min.css from the consumer's katex package."
  );
}

/**
 * Excluding the Editor from `@source` (OLDSUI-197). The line from getting-started removes
 * its classes and keeps the classes of the main entry.
 *
 * The fixture imports the Editor, so its built CSS must contain the Editor's classes. That
 * also proves the probe catches anything at all: a probe that is absent even from the full
 * CSS would pass with a broken exclusion. A second Next build just for one line of CSS is
 * expensive, so the "consumer without the Editor" variant is the same `globals.css` with a
 * fourth line, run through the fixture's PostCSS and Tailwind. The line is taken from
 * getting-started verbatim (the path is relative to the fixture's `app/`, like its `@source`).
 * A check with its own copy of the line would miss a typo in the Reference.
 *
 * Tailwind's automatic source detection (`base`) is narrowed to `app/`. After the build, the
 * fixture root holds `.next` with the Editor inside it, and the check would depend on whether
 * `.gitignore` ignores it.
 */
const EDITOR_CSS_PROBE = "ProseMirror";
const documented = /^@source not "\.\/node_modules\/@olddevs\/ui\/dist\/editor";$/m.exec(
  readFileSync(join(ROOT, "docs", "getting-started.md"), "utf8")
)?.[0];
if (!documented) {
  fail(
    `docs/getting-started.md has no line @source not "./node_modules/@olddevs/ui/dist/editor"; — ` +
      `the exclusion for apps without the Editor is gone or its path changed.`
  );
}
const EDITOR_EXCLUSION = documented.replace('"./node_modules', '"../node_modules');

step("the editor exclusion from @source drops only the editor classes");
if (!css.includes(EDITOR_CSS_PROBE)) {
  fail(
    `The consumer CSS has no ${EDITOR_CSS_PROBE} classes although the fixture imports ` +
      `the Editor: the probe no longer matches what the Editor emits — fix the probe.`
  );
}
const fixtureRequire = createRequire(join(FIXTURE, "package.json"));
const { default: postcss } = await import(pathToFileURL(fixtureRequire.resolve("postcss")).href);
const { default: tailwind } = await import(
  pathToFileURL(fixtureRequire.resolve("@tailwindcss/postcss")).href
);
const globalsPath = join(FIXTURE, "app", "globals.css");
const withoutEditor = await postcss([tailwind({ base: join(FIXTURE, "app") })]).process(
  `${readFileSync(globalsPath, "utf8")}\n${EDITOR_EXCLUSION}\n`,
  { from: globalsPath }
);
if (withoutEditor.css.includes(EDITOR_CSS_PROBE)) {
  fail(
    `With ${EDITOR_EXCLUSION} the CSS still has ${EDITOR_CSS_PROBE} classes: the line ` +
      `from getting-started no longer removes the Editor (did dist/editor move?).`
  );
}
const lost = CSS_PROBES.filter((probe) => !withoutEditor.css.includes(probe));
if (lost.length > 0) {
  fail(`The editor exclusion also removed the kit classes: ${lost.join(", ")}`);
}

/**
 * The Editor page, rendered on the server: the display pipeline reached HTML.
 *
 * The build stays green when the cleanup removed nothing or the highlighting did not run,
 * so the prerender of `/editor` itself is read. It must contain the highlighting tokens
 * (`highlightCodeBlocks` on the server), the copy button's slot and the marker of the "Copy"
 * island (`RichTextView` with a code Block). It must not contain any forgery from the page's
 * document: `sanitizeRichText` with the consumer's DOMPurify has removed them.
 */
const EDITOR_PROBES = [
  '<span class="hljs-keyword">def</span>',
  "data-code-copy=",
  "<template data-code-copy-island",
  // A custom Block's island (OLDSUI-114): the client island sets this marker, and the
  // reference to the consumer's component crossed the RSC boundary. The Block's server HTML is in place.
  "<template data-block-island",
  "Server badge",
  // A formula (OLDSUI-280, ADR-0070): the server puts the LaTeX source into an empty element,
  // and the marker of the formula island is in the markup. There is no rendered KaTeX on the server.
  "<template data-math-island",
  'data-latex="e^{i\\pi}+1=0">e^{i\\pi}+1=0</span>',
];
const EDITOR_LEAKS = [
  "fixed inset-0",
  "position:fixed",
  "javascript:alert",
  "data:image/png",
  'class="katex"',
];

step("the editor page is sanitised, highlighted and has its copy island");
const editorHtmlPath = join(FIXTURE, ".next", "server", "app", "editor.html");
if (!existsSync(editorHtmlPath)) {
  fail("Next.js prerendered no /editor page — the editor route did not build as static");
}
const editorHtml = readFileSync(editorHtmlPath, "utf8");
const absent = EDITOR_PROBES.filter((probe) => !editorHtml.includes(probe));
if (absent.length > 0) {
  fail(`The /editor page lacks what the server pipeline must produce: ${absent.join(", ")}`);
}
const leaked = EDITOR_LEAKS.filter((leak) => editorHtml.includes(leak));
if (leaked.length > 0) {
  fail(`sanitizeRichText let through what it must remove: ${leaked.join(", ")}`);
}

step("consumer pages within budget");
const pages = [BUDGETS.consumer, BUDGETS.consumerEditor, BUDGETS.consumerEditorFull];
const measured = pages.map(({ route, firstLoadKb: budgetKb }) => {
  const actualKb = firstLoadKb(buildOutput, route);
  if (actualKb > budgetKb) {
    fail(
      `First Load JS for route ${route}: ${actualKb} kB against a budget of ${budgetKb} kB.\n` +
        `The usual cause is the client-graph boundary: without optimizePackageImports ` +
        `the root page weighs 408 kB instead of 114 and the editor page 435 instead of 137 ` +
        `(ADR-0029; the editor subpath needs its own line). If the growth is justified, ` +
        `raise the budget in scripts/bundle-size.budgets.mjs as a separate line in the MR.`
    );
  }
  return `${route} ${actualKb} kB against ${budgetKb} kB`;
});

console.log(
  `\n✓ the consumer is built; package classes are present in the CSS; ` +
    `the editor page is sanitised and highlighted; First Load JS ${measured.join(", ")}`
);

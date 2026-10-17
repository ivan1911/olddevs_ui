import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, expect, test } from "vitest";
import {
  GLASS_INVERSE_CLASS,
  GLASS_MENU_CLASS,
  GLASS_PANEL_CLASS,
} from "../src/editor/styles/glass.js";
import { renderMatrix } from "./matrix.js";

/**
 * Checks that EVERY class the primitives actually emit into the markup
 * is present in the built Tailwind CSS.
 *
 * Why: Tailwind scans the sources as text and does not execute the code. A class
 * assembled by concatenation (`hover:${t.bg}`) is invisible to the scanner: it does not
 * get into the CSS, and the build **succeeds without a single warning**. The component
 * simply ends up unstyled. Neither the compiler nor the linter catches this.
 *
 * Key detail: `@source` here points to the package's SOURCES, not to the rendered markup.
 * If the markup were scanned, the test would find the classes in the very place it took
 * the list from, and would always pass, proving nothing.
 */

const ROOT = resolve(import.meta.dirname, "..");

// The temp folder must live INSIDE the package: Tailwind resolves `@import "tailwindcss"`
// relative to the input file, and the system tmp has no node_modules.
const tmp = mkdtempSync(join(ROOT, ".tmp-coverage-"));

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * The reverse of escaping: we strip the backslashes from the CSS and look up the class
 * as it is written in the markup.
 *
 * Previously there was a list of characters to escape, and it turned out incomplete:
 * Tailwind writes `.transition-\[border-color\,box-shadow\]`, and the list had no comma,
 * so the class was reported missing although it lay in the CSS. Catching the full set of
 * special characters by hand is pointless: it grows with every new arbitrary value.
 * Removing the escaping once is more reliable than repeating its rules.
 */
const unescapeCss = (css: string) => css.replace(/\\/g, "");

function buildCss(): string {
  const input = join(tmp, "input.css");
  const output = join(tmp, "output.css");
  writeFileSync(
    input,
    [
      // `source(none)` is required. Without it, Tailwind adds the input file's folder to
      // the sources on its own, that is, the whole package, including `storybook-static/`
      // and `dist/`. They hold the PREVIOUSLY built CSS, and a class that has just
      // disappeared from the sources is found there: the check silently passes.
      // Verified: with a planted concatenation `bg-accent${"-soft"}` the test passed,
      // although `.bg-accent-soft` was missing from the fresh CSS.
      '@import "tailwindcss" source(none);',
      `@import "${join(ROOT, "styles.css")}";`,
      `@source "${join(ROOT, "src")}";`,
      "",
    ].join("\n")
  );
  execFileSync("npx", ["@tailwindcss/cli", "-i", input, "-o", output], {
    cwd: ROOT,
    stdio: "pipe",
  });
  return readFileSync(output, "utf8");
}

/** The CSS build takes seconds; both tests read one result. */
let css: string | undefined;
const builtCss = () => (css ??= unescapeCss(buildCss()));

/** Classes that are missing from the CSS. */
function missingFrom(css: string, classes: Iterable<string>): string[] {
  // A separator must follow the selector, otherwise `.bg-bg-1` would match the start of
  // `.bg-bg-10`, and the test would let a real missing class slip through.
  //
  // `[` is in the list because of the `data-[…]:` variants that came with the date pickers:
  // Tailwind appends the attribute to such a class itself, and the selector looks like
  // `.data-[selected]:bg-accent[data-selected]`. Without the square bracket among the
  // separators, every such class would be reported missing although it is in the CSS.
  const BOUNDARY = [" ", ",", ":", ">", "+", "~", "\n", "{", "["];
  return [...classes].filter((c) => {
    const sel = "." + c;
    let from = 0;
    for (;;) {
      const i = css.indexOf(sel, from);
      if (i < 0) return true;
      if (BOUNDARY.includes(css[i + sel.length] ?? "")) return false;
      from = i + 1;
    }
  });
}

test("every class from primitive markup is present in the built CSS", () => {
  const html = renderToStaticMarkup(renderMatrix());

  // The markup comes HTML-escaped: the class `after:content-['']` looks like
  // `after:content-[&#x27;&#x27;]` there and would not match the CSS.
  // The reverse replacement is needed for any arbitrary value with quotes.
  const unescapeHtml = (s: string) =>
    s
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

  /**
   * Classes that a third-party component sets rather than Tailwind, and that must NOT
   * be in our CSS. lucide puts a `lucide lucide-<name>` pair on every one of its `<svg>`:
   * these are its own hooks for styling on the consumer's side, not Tailwind utilities.
   * Without this exception the test would flag them as "missing" and fail on any
   * component with an icon.
   *
   * The exception is deliberately narrow: by a specific prefix, not by "ignore anything
   * unfamiliar". The point of the test is to fail on exactly what is unfamiliar.
   */
  const isThirdParty = (c: string) =>
    c === "lucide" ||
    c.startsWith("lucide-") ||
    // `react-aria-components` puts `react-aria-CalendarGrid` and similar classes on its
    // elements: the same kind of own styling hooks as lucide's.
    c.startsWith("react-aria-") ||
    /*
      `group` and `peer` are Tailwind MARKERS, not utilities: they produce no rule of
      their own at all, they only give an anchor to the `group-hover:` and `peer-checked:`
      variants. That is why they are absent from the CSS, and must be.

      The exception is narrow: exactly two names, no prefixes. Named variants
      (`group/item`) do not fall under it and are still checked.
    */
    c === "group" ||
    c === "peer";

  const classes = new Set<string>();
  for (const m of html.matchAll(/class="([^"]+)"/g))
    for (const c of unescapeHtml(m[1] ?? "").split(/\s+/))
      if (c && !isThirdParty(c)) classes.add(c);

  expect(classes.size).toBeGreaterThan(50); // a guard against the matrix rendering empty

  const missing = missingFrom(builtCss(), classes);

  expect(
    missing,
    `Classes present in the markup but missing from the CSS:\n${missing.join("\n")}`
  ).toEqual([]);
});

/**
 * The Editor's Glass (OLDSUI-118) is not in the matrix: the Editor is a separate entry
 * point. Yet it caught exactly what the test was written for: a backdrop assembled by a
 * template string from a token name never got into the CSS, and the menu was left with
 * only a blur over a transparent background.
 */
test("every class of the editor glass surfaces is present in the built CSS", () => {
  const classes = [GLASS_PANEL_CLASS, GLASS_MENU_CLASS, GLASS_INVERSE_CLASS].flatMap((surface) =>
    surface.split(/\s+/)
  );
  const missing = missingFrom(builtCss(), new Set(classes));

  expect(missing, `Glass classes missing from the CSS:\n${missing.join("\n")}`).toEqual([]);
});

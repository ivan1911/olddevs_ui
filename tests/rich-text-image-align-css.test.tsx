// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { RichTextView } from "../src/editor/index.js";
import { PROSE_CLASS } from "../src/editor/styles/prose.js";

afterEach(cleanup);

/**
 * Image alignment in the styles (OLDSUI-311, ADR-0081). jsdom has no layout, so what is checked is
 * what the browser is given: the Document's classes build into the rules of the ADR, with the
 * container query, the float, the `clear` and the reset for a table cell, and the saved markup the
 * View renders carries the attributes those rules select.
 */
const ROOT = resolve(import.meta.dirname, "..");
const tmp = mkdtempSync(join(ROOT, ".tmp-image-align-css-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let css = "";

beforeAll(() => {
  const input = join(tmp, "input.css");
  const output = join(tmp, "output.css");
  writeFileSync(
    input,
    [
      // `source(none)`: only the sources below, not a `dist/` built earlier (class-coverage test).
      '@import "tailwindcss" source(none);',
      `@import "${join(ROOT, "styles.css")}";`,
      `@source "${join(ROOT, "src", "editor")}";`,
      "",
    ].join("\n")
  );
  execFileSync("npx", ["@tailwindcss/cli", "-i", input, "-o", output], {
    cwd: ROOT,
    stdio: "pipe",
  });
  css = readFileSync(output, "utf8");
}, 60_000);

/** The declarations of the rules whose selector ends with `selector`, joined. */
function declarations(selector: string, within = css): string {
  const found: string[] = [];
  for (const rule of within.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (rule[1]!.trim().endsWith(selector)) found.push(rule[2]!);
  }
  return found.join("\n");
}

/** The body of the `@container` block with the 30 rem threshold. */
function container30(): string {
  const parts: string[] = [];
  for (const block of css.matchAll(/@container rte-document \(width >= 30rem\) \{/g)) {
    let depth = 1;
    let at = block.index + block[0].length;
    const start = at;
    for (; depth > 0; at++) {
      if (css[at] === "{") depth++;
      else if (css[at] === "}") depth--;
    }
    parts.push(css.slice(start, at - 1));
  }
  return parts.join("\n");
}

test("a left image floats left from 30 rem, a right one floats right, with a gap on the text side", () => {
  const query = container30();

  expect(declarations("figure[data-align='left']", query)).toMatch(/float:\s*left/);
  expect(declarations("figure[data-align='left']", query)).toMatch(/margin-right/);
  expect(declarations("figure[data-align='right']", query)).toMatch(/float:\s*right/);
  expect(declarations("figure[data-align='right']", query)).toMatch(/margin-left/);
});

test("there is no float outside the query: a narrow Document keeps the image on a line of its own", () => {
  const outside = css.replace(/@container[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");

  expect(outside).not.toMatch(/figure\[data-align='(?:left|right)'\]\s*\{[^}]*float/);
});

test("the root becomes the container named rte-document when it holds an aligned image", () => {
  const rule = declarations(":has(figure[data-align])");

  expect(rule).toMatch(/container-type:\s*inline-size/);
  expect(rule).toMatch(/container-name:\s*rte-document/);
});

test("the two new width presets are a quarter and a third of the container", () => {
  expect(declarations("figure:has(img[data-width='25'])")).toMatch(/calc\(1 \/ 4/);
  expect(declarations("figure:has(img[data-width='33'])")).toMatch(/calc\(1 \/ 3/);
});

test("an aligned image with no width, or at 100%, is 50% so the text can still wrap", () => {
  const query = container30();

  expect(declarations("figure[data-align]:not(:has(img[data-width]))", query)).toMatch(
    /calc\(1 \/ 2/
  );
  expect(declarations("figure[data-align]:has(img[data-width='100'])", query)).toMatch(
    /calc\(1 \/ 2/
  );
});

test("a heading, table, code Block, rule, centred image and containers start below the image", () => {
  const rule = css.match(/:is\(h1, h2, h3, h4, table, pre, hr,[^{]*\{[^}]*\}/)?.[0] ?? "";

  expect(rule).toMatch(/clear:\s*both/);
  for (const part of [
    "details",
    "div[data-block=layout]",
    "div[data-block=wrapper]",
    "div[data-block=video]",
    "section[data-block=footnotes]",
    "figure:not([data-align])",
  ]) {
    expect(rule, part).toContain(part);
  }
  // Paragraphs, lists and quotes wrap, and an aligned image does not clear (two can stand side by side).
  expect(rule).not.toMatch(/\b(?:p|ul|ol|blockquote)[,)]/);
  expect(rule).not.toContain("figure[data-align]");
});

test("containers hold the floats of their own children", () => {
  const rule = declarations(
    ":is(div[data-block=wrapper], div[data-block=column], div[data-type=detailsContent]):has(figure[data-align])"
  );

  expect(rule).toMatch(/display:\s*flow-root/);
});

test("a table cell resets the float and the margins, even against the more specific query rule", () => {
  const query = container30();

  expect(declarations(":is(td, th) figure", query)).toMatch(/float:\s*none\s*!important/);
  expect(declarations(":is(td, th) figure", query)).toMatch(/margin-inline:\s*auto\s*!important/);
});

test("the View renders the attributes the rules select and wears the classes", () => {
  const { container } = render(
    <RichTextView
      html={
        '<p>Text</p><figure data-align="right"><img src="https://cdn.example.com/a.png" alt="" data-width="25"></figure>'
      }
      data-testid="view"
    />
  );
  const view = container.firstElementChild as HTMLElement;
  const figure = view.querySelector("figure")!;

  expect(figure.getAttribute("data-align")).toBe("right");
  expect(figure.querySelector("img")!.getAttribute("data-width")).toBe("25");
  const classes = new Set(view.className.split(/\s+/));
  expect(classes.has("@min-[30rem]/rte-document:[&_figure[data-align='left']]:float-left")).toBe(
    true
  );
  expect(PROSE_CLASS).toContain("[&:has(figure[data-align])]:[container-type:inline-size]");
});

/**
 * The hint of an empty caption in the Editor. An aligned image is a quarter or a third of a narrow
 * Document, and "Caption (optional)" wraps there; a hint that was a zero-height float left the empty
 * caption one line high, and the second line ran over the next figure and the paragraph below.
 */
test("the hint of an empty caption takes its own height, so a wrapped hint does not overflow", () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    (rule) => rule[1]!.includes("rte-caption-empty") && rule[1]!.includes("::before")
  );
  const hint = rules.map((rule) => rule[2]).join("\n");

  expect(rules.length).toBeGreaterThan(0);
  expect(hint).toMatch(/display:\s*block/);
  expect(hint).not.toMatch(/float:/);
  expect(hint).not.toMatch(/(?:^|[;\s])height:\s*0/);
  // The caption keeps its trailing `<br>` for the caret: the hint is pulled up by that one line.
  expect(hint).toMatch(/margin-bottom:\s*calc\(1lh\s*\*\s*-1\)/);
});

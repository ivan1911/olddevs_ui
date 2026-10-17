// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  richTextSanitizeConfig,
  type RichTextEditorHandle,
} from "../src/editor/index.js";
import { PROSE_CLASS } from "../src/editor/styles/prose.js";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * `RichTextView` shows a saved Document without the engine (the spec, "RichTextView").
 * The promise is one: the text on the page looks the same as in the Editor. So the checks
 * compare not classes "in general", but exactly those that the Editor puts on the content.
 */

const DOCUMENT =
  "<h2>Release notes</h2><p>Text with <strong>bold</strong> and <code>code</code>.</p>" +
  '<ul><li><p>One</p></li></ul><ol start="3"><li><p>Three</p></li></ol>' +
  "<blockquote><p>Quote</p></blockquote><hr>";

/** The container's classes as a set: order and `cn` joining do not matter. */
function classesOf(element: Element): Set<string> {
  return new Set(element.className.split(/\s+/).filter(Boolean));
}

const PROSE_TOKENS = PROSE_CLASS.split(/\s+/).filter(Boolean);

test("renders the saved html inside a container", () => {
  render(<RichTextView html={DOCUMENT} data-testid="view" />);
  const view = screen.getByTestId("view");

  expect(view.querySelector("h2")?.textContent).toBe("Release notes");
  expect(view.querySelector("strong")?.textContent).toBe("bold");
  expect(view.querySelector("ol")?.getAttribute("start")).toBe("3");
  expect(view.querySelector("blockquote p")?.textContent).toBe("Quote");
  expect(view.querySelector("hr")).not.toBeNull();
});

test("an empty document renders an empty container", () => {
  render(<RichTextView html="" data-testid="view" />);
  expect(screen.getByTestId("view").innerHTML).toBe("");
});

test("wears the same prose classes as the editor content", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={DOCUMENT} />);
  const content = ref.current!.editor!.view.dom;
  render(<RichTextView html={DOCUMENT} data-testid="view" />);
  const view = screen.getByTestId("view");

  const missingInView = PROSE_TOKENS.filter((token) => !classesOf(view).has(token));
  const missingInEditor = PROSE_TOKENS.filter((token) => !classesOf(content).has(token));
  expect(missingInView).toEqual([]);
  expect(missingInEditor).toEqual([]);
});

/*
  An unquoted attribute value must be a CSS identifier, and one cannot start with a digit:
  `[data-width=50]` is an invalid selector. The browser drops such a rule, and the Tailwind
  optimizer builds `figure:has()` out of it: the image width presets never worked until the
  values were quoted.
*/
test("prose selectors quote attribute values that are not identifiers", () => {
  const unquoted = PROSE_TOKENS.filter((token) => /\[[\w-]+[~|^$*]?=-?\d/.test(token));
  expect(unquoted).toEqual([]);
  expect(PROSE_TOKENS).toContain("[&_figure:has(img[data-width='50'])]:w-1/2");
});

/*
  Tailwind reads the source as plain text. A class split by string concatenation becomes
  two incomplete ones: their brackets do not match, and there is no rule. And `\_`
  (an underscore in an arbitrary variant) ends up in the class name with a backslash and
  does not match the class in the markup: that is how the highlight theme would break
  (`hljs-built_in`, OLDSUI-50).
*/
test("every prose class is whole: brackets balance and no backslash escapes", () => {
  const count = (token: string, char: string) => token.split(char).length - 1;
  expect(PROSE_TOKENS.filter((token) => count(token, "[") !== count(token, "]"))).toEqual([]);
  expect(PROSE_TOKENS.filter((token) => count(token, "(") !== count(token, ")"))).toEqual([]);
  expect(PROSE_TOKENS.filter((token) => token.includes("\\"))).toEqual([]);
});

/*
  The highlight theme (OLDSUI-50, ADR-0051) has two halves. The `.hljs-*` rules are
  classes on the container, and they read only variables: the highlighted HTML from
  `highlightCodeBlocks` is colored in `RichTextView` without a single `style`. The colors
  are variables in `styles.css` on elements with `data-theme`: the Document inherits them
  from the NEAREST ancestor with a theme, so a nested light Paper inside a dark app gets
  GitHub Light. A theme value set on the container itself would override the inheritance,
  so it must not be there. The live cascade of a nested theme is checked by
  `tests-visual/interactions.spec.ts` ("code theme").
*/
const STYLES = readFileSync(resolve(import.meta.dirname, "..", "styles.css"), "utf8");
const HL_VARIABLES = [
  "--rte-code-block-background",
  "--rte-code-block-foreground",
  "--rte-hl-keyword",
  "--rte-hl-title",
  "--rte-hl-constant",
  "--rte-hl-string",
  "--rte-hl-variable",
  "--rte-hl-comment",
  "--rte-hl-tag",
  "--rte-hl-bullet",
];

/** Variable declarations in the `styles.css` block with this selector. */
function variablesOf(selector: string): Record<string, string> {
  const at = STYLES.indexOf(`${selector} {`);
  expect(at, `styles.css has no block ${selector}`).toBeGreaterThan(-1);
  const body = STYLES.slice(STYLES.indexOf("{", at) + 1, STYLES.indexOf("}", at));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()])
  );
}

test("the view carries the highlighting rules, and they read only theme variables", () => {
  expect(PROSE_TOKENS).toContain("[&_.hljs-title]:text-(--rte-hl-title)");
  expect(PROSE_TOKENS).toContain("[&_pre]:bg-(--rte-code-block-background)");
  // No theme variable is set on the container: otherwise it would override the value
  // inherited from the nearest `data-theme`.
  expect(
    PROSE_TOKENS.filter((token) => HL_VARIABLES.some((name) => token.includes(`${name}:`)))
  ).toEqual([]);
});

test("styles.css sets the highlighting variables on themed elements, light after dark", () => {
  const dark = variablesOf(':where(:root, [data-theme]:not([data-theme="light"]))');
  const light = variablesOf(':where([data-theme="light"])');

  expect(Object.keys(dark).sort()).toEqual([...HL_VARIABLES].sort());
  expect(Object.keys(light).sort()).toEqual([...HL_VARIABLES].sort());
  // GitHub Dark and GitHub Light: checked against the known theme values.
  expect(dark["--rte-hl-keyword"]).toBe("#ff7b72");
  expect(light["--rte-hl-keyword"]).toBe("#d73a49");
  expect(light["--rte-code-block-background"]).toBe("#ffffff");
  // On `<html data-theme="light">` both blocks match with zero specificity: the light one
  // must come last, otherwise the light theme would get the dark tokens.
  expect(STYLES.indexOf(':where([data-theme="light"]) {')).toBeGreaterThan(
    STYLES.indexOf(':where(:root, [data-theme]:not([data-theme="light"])) {')
  );
});

test("className is merged after the prose classes, other div props pass through", () => {
  render(
    <RichTextView
      html="<p>Text</p>"
      className="max-w-prose"
      id="body"
      aria-label="Article"
      data-testid="view"
    />
  );
  const view = screen.getByTestId("view");

  expect(classesOf(view).has("max-w-prose")).toBe(true);
  expect(PROSE_TOKENS.every((token) => classesOf(view).has(token))).toBe(true);
  expect(view.id).toBe("body");
  expect(view.getAttribute("aria-label")).toBe("Article");
});

test("forwards the ref to the container", () => {
  const ref = createRef<HTMLDivElement>();
  render(<RichTextView ref={ref} html="<p>Text</p>" />);
  expect(ref.current?.querySelector("p")?.textContent).toBe("Text");
});

/*
  Server safety is two views of one promise. The first: the component renders without DOM
  and effects, as a server component does. The second: its module graph has no directive
  and no engine. The directives cannot be covered by the first view alone: `rsc-gate`
  inspects files, not what a file pulls in with it.
*/

test("renders to a string without a DOM, as a server component does", () => {
  const markup = renderToStaticMarkup(<RichTextView html="<p>Server text</p>" className="x" />);

  expect(markup).toContain("<p>Server text</p>");
  expect(markup).toContain("x");
  expect(markup).toContain("[&amp;&gt;*:not(:last-child)]:mb-3");
});

const SRC = resolve(import.meta.dirname, "..", "src");

/** Module connections: `from "…"` and `import "…"`; type-only imports do not count. */
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

/** All kit modules that `entry` reaches through relative imports. */
function moduleGraph(entry: string): { files: string[]; packages: Set<string> } {
  const files: string[] = [];
  const packages = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.includes(file)) continue;
    files.push(file);
    for (const specifier of specifiers(readFileSync(file, "utf8"))) {
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier).replace(/\.js$/, "");
        queue.push(
          [".ts", ".tsx"].map((extension) => target + extension).find((path) => exists(path))!
        );
      } else packages.add(specifier);
    }
  }
  return { files, packages };
}

function exists(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}

/*
  The client boundary in the View's graph is exactly one file: the Island of the "Copy"
  button (OLDSUI-50, ADR-0029). Everything it pulls in is the kit's button and tooltip and
  their dependencies; the engine and the highlighter must not get in here.
*/
const ISLAND = join(SRC, "editor", "features", "code", "CodeCopyIsland.tsx");

test("the module graph of RichTextView has client islands and no engine", () => {
  const { files, packages } = moduleGraph(join(SRC, "editor", "RichTextView.tsx"));

  const clientFiles = files.filter((file) =>
    readFileSync(file, "utf8").trimStart().startsWith('"use client"')
  );
  // The View itself is not a client boundary; the boundary is the Island and what it pulls in:
  // kit files, each with its own directive.
  expect(clientFiles).toContain(ISLAND);
  // The second Island is for custom Blocks (OLDSUI-114): also its own file with a directive.
  expect(clientFiles).toContain(join(SRC, "editor", "ui", "BlockIsland.tsx"));
  expect(clientFiles).not.toContain(join(SRC, "editor", "RichTextView.tsx"));
  expect(
    readFileSync(join(SRC, "editor", "RichTextView.tsx"), "utf8")
      .trimStart()
      .startsWith('"use')
  ).toBe(false);
  // The same directives as the Island's, but on the kit's own files, not on the View's
  // server code: the server part of the graph is `RichTextView`, `codeHeader`,
  // `codeLanguages`, `prose` and data, with no directives.
  const serverFiles = files.filter((file) => !clientFiles.includes(file));
  expect(
    serverFiles.map((file) => file.slice(SRC.length + 1)).filter((f) => f.startsWith("editor/"))
  ).toEqual(
    expect.arrayContaining([
      "editor/RichTextView.tsx",
      "editor/features/code/codeHeader.ts",
      "editor/styles/prose.ts",
      "editor/core/viewIsland.ts",
    ])
  );
  // An allowlist, not "no @tiptap": a new dependency of a view module is a decision, not an
  // accident, and the test must force it to be accepted.
  // The Island brings the kit's button and tooltip: Radix (the slot and the tooltip), icons,
  // `react-dom` for the portal and `react-aria-components` for `useLocale` in the message
  // catalog, by the same route as any kit component.
  expect([...packages].sort()).toEqual([
    "@radix-ui/react-slot",
    "@radix-ui/react-tooltip",
    "clsx",
    "lucide-react",
    "react",
    "react-aria-components",
    "react-dom",
    "tailwind-merge",
  ]);
  expect(packages.has("lowlight")).toBe(false);
  expect([...packages].filter((name) => /^@tiptap\/|highlight\.js|lowlight/.test(name))).toEqual(
    []
  );
});

/*
  The DOMPurify config is data from the Schema, not a second copy, and it is CLOSED by
  default: a bare config without hooks does not know the attributes that are dangerous
  without a check by tag and value. This checks its shape; the real DOMPurify cleanup, with
  and without the `sanitizeRichText` hooks, is in
  `tests/editor-sanitize.test.tsx`.
*/

test("the bare sanitise config lists the schema minus what only hooks may admit", () => {
  const config = richTextSanitizeConfig();
  const schemaTags = [...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks];

  // `input` without `type` is a text field, `img` without `src` is a broken image.
  expect([...config.ALLOWED_TAGS].sort()).toEqual(
    schemaTags.filter((tag) => tag !== "input" && tag !== "img").sort()
  );
  // Harmless on any tag and with any value; `href` is checked by the URL expression.
  expect([...config.ALLOWED_ATTR].sort()).toEqual([
    "alt",
    "data-align",
    "data-block",
    "data-checked",
    "data-color",
    "data-latex",
    "data-layout",
    "data-provider",
    "data-tone",
    "data-type",
    "data-width",
    "href",
    "open",
    "rel",
    "start",
  ]);
});

test("the sanitise config closes the attribute families DOMPurify opens by default", () => {
  const config = richTextSanitizeConfig();

  expect(config.ALLOW_DATA_ATTR).toBe(false);
  expect(config.ALLOW_ARIA_ATTR).toBe(false);
  // `style` is a narrow exception for an arbitrary color (OLDSUI-46): the Schema names it
  // only on `span` and `mark`, and it stays out of the config's common list: only the
  // `sanitizeRichText` hook lets it through, after checking the tag and the value. The same
  // goes for `class`, `src`, cell merging and the checkbox attributes.
  for (const guarded of [
    "style",
    "class",
    "src",
    "colspan",
    "rowspan",
    "type",
    "checked",
    "data-src",
  ]) {
    expect(config.ALLOWED_ATTR, guarded).not.toContain(guarded);
  }
  expect(
    Object.keys(RICH_TEXT_SCHEMA.attributes).filter((tag) =>
      (RICH_TEXT_SCHEMA.attributes as Record<string, readonly string[]>)[tag]!.includes("style")
    )
  ).toEqual(["span", "mark"]);
  // DOMPurify's `ALLOWED_ATTR` is shared by all tags, and `ALLOW_DATA_ATTR` is off:
  // only the Schema's `data-*` names, listed one by one, get through.
  expect(config.ALLOWED_ATTR.filter((name) => name.startsWith("data-")).sort()).toEqual([
    "data-align",
    "data-block",
    "data-checked",
    "data-color",
    "data-latex",
    "data-layout",
    "data-provider",
    "data-tone",
    "data-type",
    "data-width",
  ]);
  expect(config.ALLOWED_ATTR.filter((name) => name.startsWith("aria-"))).toEqual([]);
});

/*
  The link address follows the same policy as in the Editor: only `http`, `https` and
  `mailto`. DOMPurify checks EVERY allowed attribute against `ALLOWED_URI_REGEXP`, except
  the "URI-safe" ones, so a strict expression without `ADD_URI_SAFE_ATTR` would strip
  `start="3"` and `data-type="taskList"` too. All Schema attributes except `href` are
  declared URI-safe: `href` alone goes through the address check.
*/
test("the sanitise config admits link addresses by the editor's protocol policy", () => {
  const { ALLOWED_URI_REGEXP: uri } = richTextSanitizeConfig();

  for (const href of [
    "https://example.com/a?b=1",
    "http://example.com",
    "mailto:team@example.com",
  ]) {
    expect(uri.test(href), href).toBe(true);
  }
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,x",
    "ftp://example.com",
    "/docs",
    "#top",
    "docs/page",
  ]) {
    expect(uri.test(href), href).toBe(false);
  }
});

test("the schema declares the style exception precisely: one property and one hex pattern per tag", () => {
  const { customColor } = RICH_TEXT_SCHEMA;

  expect(Object.keys(customColor.styles).sort()).toEqual(["mark", "span"]);
  const span = new RegExp(customColor.styles.span);
  const mark = new RegExp(customColor.styles.mark);
  for (const ok of ["color:#ff0000", "color:#0a1B2c".toLowerCase()])
    expect(span.test(ok)).toBe(true);
  expect(mark.test("background-color:#ffee00")).toBe(true);
  for (const bad of [
    "color:#fff",
    "color:#FF0000",
    "color: #ff0000",
    "color:#ff0000;",
    "color:#ff0000;x:y",
    "color:red",
    "background-color:#ff0000",
    "x-color:#ff0000",
  ]) {
    expect(span.test(bad), bad).toBe(false);
  }
  expect(mark.test("color:#ffee00")).toBe(false);
  expect(mark.test("background-color:#ffee0")).toBe(false);
});

test("only href is checked as an address; every other attribute of the bare config is URI-safe", () => {
  const config = richTextSanitizeConfig();

  expect([...config.ADD_URI_SAFE_ATTR].sort()).toEqual(
    config.ALLOWED_ATTR.filter((name) => name !== "href").sort()
  );
  expect(config.ALLOWED_ATTR).toContain("href");
  // An image's `src` is allowed only with the hook: DOMPurify lets `data:` through,
  // bypassing the expression.
  expect(config.ALLOWED_ATTR).not.toContain("src");
});

test("every call returns fresh arrays the caller may mutate", () => {
  const first = richTextSanitizeConfig();
  first.ALLOWED_TAGS.push("script");
  first.ALLOWED_ATTR.push("onclick");

  expect(richTextSanitizeConfig().ALLOWED_TAGS).not.toContain("script");
  expect(richTextSanitizeConfig().ALLOWED_ATTR).not.toContain("onclick");
});

/*
  The Schema table in the docs ⇔ `RICH_TEXT_SCHEMA`, in both directions. The epic's slices
  will extend the Schema, and a table that lags behind it would make a bad config for the
  sanitizer: people copy what is allowed from the page.
*/

/** A marker on the page: the table right after it is the allowlist; other tables do not count. */
const MARKER = "<!-- allow-list -->";
const DOCS = resolve(import.meta.dirname, "..", "docs", "components");

/** Backtick tokens from the table rows after the `<!-- allow-list -->` marker. */
function documentedAllowList(page: string): Set<string> {
  const text = readFileSync(join(DOCS, page), "utf8");
  const start = text.indexOf(MARKER);
  expect(start, `${page}: no ${MARKER} marker`).toBeGreaterThan(-1);
  const rows = text
    .slice(start)
    .split("\n")
    .filter((line) => line.startsWith("|"))
    // The table header and separator are not data; there is one table, and prose follows it.
    .slice(2);
  const tokens = new Set<string>();
  for (const row of rows) {
    // The first cell is the row name (e.g. "Blocks"), it has no tags.
    const cells = row.split("|").slice(2);
    const found = [...cells.join("|").matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
    // The Attributes row also quotes attribute VALUES in backticks (`language-go`, `50-50`):
    // only the `tag[attribute]` pairs are allow-list entries.
    const pairs = found.filter((token) => token.includes("["));
    for (const token of pairs.length > 0 ? pairs : found) tokens.add(token);
  }
  return tokens;
}

const SCHEMA_TOKENS = new Set<string>([
  ...RICH_TEXT_SCHEMA.blocks,
  ...RICH_TEXT_SCHEMA.marks,
  ...Object.entries(RICH_TEXT_SCHEMA.attributes).flatMap(([tag, names]) =>
    names.map((name) => `${tag}[${name}]`)
  ),
]);

for (const page of ["content/rich-text-view.md", "inputs/rich-text-editor.md"]) {
  test(`${page}: the allow-list table mirrors schema.ts`, () => {
    const documented = documentedAllowList(page);

    expect([...SCHEMA_TOKENS].filter((token) => !documented.has(token))).toEqual([]);
    expect([...documented].filter((token) => !SCHEMA_TOKENS.has(token))).toEqual([]);
  });
}

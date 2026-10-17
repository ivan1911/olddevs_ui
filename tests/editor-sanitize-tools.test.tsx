// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import createDOMPurify from "dompurify";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type CustomTool,
  type RichTextEditorHandle,
  type Tool,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  richTextSchema,
  sanitizeRichText,
} from "../src/editor/schema-entry.js";
import {
  TEST_TOOLS,
  testBoxTool,
  testCardTool,
  testMergeTagTool,
  testNoteTool,
} from "./editor-test-tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";

// The lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetDevWarnings();
});

/**
 * A custom Tool outside the engine: server-side sanitizing and the Schema as data, with the same
 * `tools` array as the Editor (OLDSUI-104, ADR-0058, sections 2.3 and 2.5).
 *
 * The seam is the light `@olddevs/ui/editor/schema` entry point and a real DOMPurify on
 * jsdom, as on the consumer's server. There are three promises: what the Editor produced with its own
 * Tools passes sanitizing byte for byte; everything else is stripped by the
 * rules of its custom Tool's Schema; without a third argument, sanitizing stays as before.
 */

const purify = createDOMPurify(window);

function load(html: string, tools: readonly Tool[]): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" tools={tools} defaultValue={html} />);
  return ref.current!.getHTML();
}

const tag = '<span data-block="test_mergeTag" data-test_key="first_name"></span>';
const box = (...blocks: string[]) => `<div data-block="test_box">${blocks.join("")}</div>`;
const card =
  '<div data-block="test_card" data-test_size="m" data-test_code="123" ' +
  'data-test_href="https://example.com/a">Card</div>';
const note = '<span data-mark="test_note" data-test_author="Ann">noted</span>';
const DOCUMENT =
  `<p>Hi ${tag} and <strong>${note}</strong></p>` +
  `${box("<p>a</p>", "<blockquote><p>b</p></blockquote>")}${card}` +
  "<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>";

const ALL_TOOLS: readonly Tool[] = [...TOOLS, ...TEST_TOOLS];

test("what the editor writes with custom tools passes the sanitiser with the same tools byte for byte", () => {
  const saved = load(DOCUMENT, ALL_TOOLS);
  expect(saved).toBe(DOCUMENT);

  expect(sanitizeRichText(saved, purify, ALL_TOOLS)).toBe(saved);
});

test("without the third argument the sanitiser keeps the kit schema only, as before", () => {
  expect(sanitizeRichText(DOCUMENT, purify)).toBe(
    "<p>Hi  and <strong>noted</strong></p><p>a</p><blockquote><p>b</p></blockquote>Card" +
      "<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>"
  );
  expect(sanitizeRichText(DOCUMENT, purify, [])).toBe(sanitizeRichText(DOCUMENT, purify));
});

/*
  Kit Tool names do not narrow the allowlist: screens with different sets
  write the same Document, and a server with `basic` has no right to strip a table that
  a screen with `full` wrote.
*/
test("kit tool names in tools do not narrow the allow list", () => {
  const kitOnly = "<h1>T</h1><table><tbody><tr><td><p>x</p></td></tr></tbody></table><hr>";
  expect(sanitizeRichText(kitOnly, purify, ["bold"])).toBe(kitOnly);
  expect(sanitizeRichText(DOCUMENT, purify, ["bold", testCardTool])).toBe(
    `<p>Hi  and <strong>noted</strong></p><p>a</p><blockquote><p>b</p></blockquote>${card}` +
      "<table><tbody><tr><td><p>cell</p></td></tr></tbody></table>"
  );
});

/*
  Forgeries that bypass the Editor: each one shows what a request can carry and what the
  sanitizer with `tools` turns it into. A custom element with an invalid value
  stays, losing the attribute, as it does in the Editor (`load` checks this below).
*/
const ATTACKS: [name: string, input: string, output: string][] = [
  [
    "foreign tags and attributes on a custom block",
    '<div data-block="test_card" class="x" style="color:red" data-uid="1" onclick="x()">' +
      "Card<script>x()</script></div>",
    '<div data-block="test_card">Card</div>',
  ],
  [
    "values outside the list, the pattern and the protocol policy",
    '<div data-block="test_card" data-test_size="xl" data-test_code="12a" ' +
      'data-test_href="javascript:alert(1)">Card</div>',
    '<div data-block="test_card">Card</div>',
  ],
  [
    "a relative address",
    '<div data-block="test_card" data-test_href="/admin">C</div>',
    '<div data-block="test_card">C</div>',
  ],
  [
    "html inside an attribute value",
    '<p><span data-mark="test_note" data-test_author="<b>Ann</b>">x</span></p>',
    '<p><span data-mark="test_note">x</span></p>',
  ],
  [
    "an attribute of another block",
    '<div data-block="test_box" data-test_size="m"><p>x</p></div>',
    '<div data-block="test_box"><p>x</p></div>',
  ],
  [
    "a block attribute without the data- prefix",
    '<div data-block="test_card" test_size="m">C</div>',
    '<div data-block="test_card">C</div>',
  ],
  [
    "an inline atom written as a block and a block written inline",
    '<div data-block="test_mergeTag"><p>x</p></div><p><span data-block="test_card">y</span></p>',
    "<p>x</p><p>y</p>",
  ],
  ["an unknown custom block", '<div data-block="test_other"><p>x</p></div>', "<p>x</p>"],
  ["an unknown custom mark", '<p><span data-mark="test_other">x</span></p>', "<p>x</p>"],
  [
    "a custom mark on a foreign tag",
    '<p><strong data-mark="test_note">x</strong></p>',
    "<p><strong>x</strong></p>",
  ],
  [
    "kit attributes on a custom element",
    '<p><span data-block="test_mergeTag" data-color="danger" style="color:#ff0000"></span></p>',
    '<p><span data-block="test_mergeTag"></span></p>',
  ],
  [
    "a kit block name written by a custom element",
    '<p><span data-block="wrapper">x</span></p>',
    "<p>x</p>",
  ],
];

test.each(ATTACKS)("%s", (_name, input, output) => {
  expect(sanitizeRichText(input, purify, ALL_TOOLS)).toBe(output);
});

test("the server drops what the editor drops: one rule on both sides", () => {
  const input =
    '<div data-block="test_card" class="x" data-test_size="xl" data-test_code="123" ' +
    'data-test_href="javascript:alert(1)">Card</div>' +
    '<p><span data-block="test_mergeTag" data-test_key="Bad Key"></span>' +
    '<span data-mark="test_note" data-test_author="<b>">x</span></p>';

  expect(sanitizeRichText(input, purify, ALL_TOOLS)).toBe(load(input, ALL_TOOLS));
});

/*
  The `top` place is only the top level of the Document, like a Column layout: a nested
  Block loses its wrapper, and its content stays.
*/
test("a top-level custom block nested anywhere loses its wrapper, its content stays", () => {
  const topBox: CustomTool = {
    ...testBoxTool,
    blocks: { test_box: { kind: "block", place: "top", container: true } },
  };
  const tools = [...TOOLS, topBox];
  const input =
    `${box("<p>a</p>")}<blockquote>${box("<p>b</p>")}</blockquote>` +
    `<div data-block="wrapper">${box("<p>c</p>")}</div>${box(box("<p>d</p>"))}`;

  expect(sanitizeRichText(input, purify, tools)).toBe(
    `${box("<p>a</p>")}<blockquote><p>b</p></blockquote>` +
      `<div data-block="wrapper"><p>c</p></div>${box("<p>d</p>")}`
  );
});

/*
  The Editor rejects a name without the consumer prefix with a field error. The server
  shows no errors: it simply does not read such rules, so that a description with
  a kit name (`wrapper`, `tone`) cannot open a bypass of the kit's Schema rules.
*/
test("rules named without a consumer prefix do not widen the allow list", () => {
  const bad = {
    name: "test_bad",
    engine: [],
    blocks: {
      wrapper: { kind: "inline" },
      test_bad: { kind: "block", attributes: { tone: { kind: "pattern", pattern: ".*" } } },
    },
  } as unknown as CustomTool;
  const input =
    '<p><span data-block="wrapper">x</span></p><div data-block="test_bad" data-tone="evil">y</div>';

  expect(sanitizeRichText(input, purify, [bad])).toBe('<p>x</p><div data-block="test_bad">y</div>');
});

/*
  The server shows no errors for the set: a rule with a pattern that is not a valid expression,
  is a field error in the Editor, and it has no right to break sanitizing. A value under such
  a rule does not pass, and the developer sees one warning per rule.
*/
test("a pattern that is not a regular expression drops the value, not the server", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const broken = {
    ...testCardTool,
    blocks: {
      test_card: { kind: "block", attributes: { test_code: { kind: "pattern", pattern: "[" } } },
    },
  } as CustomTool;
  const input = '<div data-block="test_card" data-test_code="123">Card</div>';

  expect(sanitizeRichText(input, purify, [broken])).toBe('<div data-block="test_card">Card</div>');
  expect(sanitizeRichText(input, purify, [broken])).toBe('<div data-block="test_card">Card</div>');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^sanitizeRichText: .*"\["/));
});

test("the helper with tools leaves the consumer's instance as it found it", () => {
  const own = createDOMPurify(window);
  expect(sanitizeRichText(card, own, ALL_TOOLS)).toBe(card);
  // The consumer's own sanitizing after the call, without the kit's hooks: a value outside
  // its own Block's rules does not get in its way.
  const foreign = '<div data-block="test_card" data-test_size="xl">Card</div>';
  expect(own.sanitize(foreign)).toBe(foreign);
});

// ── richTextSchema ─────────────────────────────────────────────────────────

test("richTextSchema without tools is the kit schema with no custom rules", () => {
  const schema = richTextSchema();

  expect(schema).toMatchObject(RICH_TEXT_SCHEMA);
  expect(schema.customBlocks).toEqual({});
  expect(schema.customMarks).toEqual({});
  expect(richTextSchema(TOOLS)).toEqual(schema);
});

test("richTextSchema adds the rules of custom blocks and marks with their defaults filled in", () => {
  const schema = richTextSchema([
    ...TOOLS,
    testMergeTagTool,
    testBoxTool,
    testCardTool,
    testNoteTool,
  ]);

  expect(schema.customBlocks).toEqual({
    test_mergeTag: {
      kind: "inline",
      place: "anywhere",
      attributes: { test_key: { kind: "pattern", pattern: "[a-z_]+" } },
    },
    test_box: { kind: "block", place: "anywhere", attributes: {} },
    test_card: {
      kind: "block",
      place: "anywhere",
      attributes: {
        test_size: { kind: "list", values: ["s", "m", "l"] },
        test_code: { kind: "pattern", pattern: "[0-9]{3}" },
        test_href: { kind: "url" },
      },
    },
  });
  expect(schema.customMarks).toEqual({
    test_note: { attributes: { test_author: { kind: "pattern", pattern: "[A-Za-z ]+" } } },
  });
  // Block traits are Editor behavior, not Schema: they do not go into the data.
  expect(schema.customBlocks.test_box).not.toHaveProperty("container");
  // The kit's Schema constant does not change.
  expect(RICH_TEXT_SCHEMA).not.toHaveProperty("customBlocks");
  expect(richTextSanitizeConfig().ALLOWED_ATTR).not.toContain("data-mark");
});

// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  tool,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { RICH_TEXT_SCHEMA } from "../src/editor/core/schema.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The Schema is the only source of allowed markup (ADR-0050): anything not in it
 * is dropped both when `value` is loaded and when content is pasted. This also checks that
 * the allowlist as DATA (`RICH_TEXT_SCHEMA`) matches what the editor actually returns,
 * in both directions: a list that allowed too much would be a bad config
 * for the consumer's server-side sanitizer.
 */

function load(html: string, tools?: RichTextEditorProps["tools"]): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={html} tools={tools} />);
  return ref.current!.editor!.getHTML();
}

function paste(html: string): string {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" />);
  const editor = ref.current!.editor!;
  // The same path as pasting from the clipboard: the HTML is parsed by the Schema, and the
  // transaction carries the `paste` meta. jsdom has no `ClipboardEvent`, so the event is a plain one.
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
  return editor.getHTML();
}

/** Tags and attributes of the markup: what the server-side sanitizer will see. */
function inventory(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  const tags = new Set<string>();
  const attributes = new Set<string>();
  for (const element of root.querySelectorAll("*")) {
    const tag = element.tagName.toLowerCase();
    tags.add(tag);
    for (const attribute of element.getAttributeNames()) attributes.add(`${tag}[${attribute}]`);
  }
  return { tags, attributes };
}

const HOSTILE =
  '<p style="color:red" onclick="steal()">Text<script>steal()</script></p>' +
  '<img src="data:image/png;base64,AAAA" onerror="steal()">' +
  '<p><a href="javascript:steal()">link</a> and <span class="x" style="font-size:40px">span</span></p>' +
  "<iframe src='https://example.com'></iframe><table style='width:9px' onclick='steal()'><colgroup><col style='width:1px'></colgroup>" +
  "<tr><td colspan='2' rowspan='2' colwidth='9' style='color:red' align='right' onclick='steal()'>cell</td></tr></table>" +
  "<h1>Top</h1><h5>Deep</h5><font color=red>font</font>" +
  // The checkbox and the wrappers are allowed only as the markup of a checklist item: outside it,
  // an input field, `label` and `div` are dropped.
  '<p><input type="text" value="x" onfocus="steal()"><label for="a">labelled</label></p>' +
  // `py`, not `js`: the full name `javascript` would match `script` in the check below.
  '<pre><code class="evil language-py" data-x="1">code()</code></pre>' +
  // Color and alignment: names outside the palette and outside the list are dropped, and so is `style`.
  '<p data-align="justify" data-color="danger"><span data-color="hotpink" style="color:red">c</span>' +
  '<mark style="background:yellow">m</mark><b data-color="danger">b</b></p>' +
  '<p data-align="center"><span data-color="danger">ok</span><mark data-color="green">ok</mark></p>' +
  // Palettes by tag: a marker name on a `span` and a text color name not covered by the migration are dropped.
  '<p><span data-color="yellow">x</span><mark data-color="hotpink">y</mark></p>' +
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true" data-evil="1">' +
  '<label><input type="checkbox" checked onclick="steal()"><span></span></label><div><p>todo</p></div></li></ul>' +
  // Image: only `src` (http/https), `alt` and `data-width` from the presets; neither `style`,
  // nor sizes, nor classes, nor handlers, on either `img` or `figure`.
  '<figure class="wide" style="float:left" data-width="50" src="javascript:steal()">' +
  '<img src="https://cdn.example.com/a.png" alt="ok" width="300" height="200" title="t" ' +
  'class="x" style="width:10px" data-width="33" loading="lazy" onerror="steal()">' +
  '<figcaption style="color:red" class="c">caption</figcaption></figure>' +
  '<img src="blob:https://example.com/0b6b"><img src="/relative.png"><img src=" java\tscript:steal()">';

const ALLOWED_TAGS = new Set<string>([...RICH_TEXT_SCHEMA.blocks, ...RICH_TEXT_SCHEMA.marks]);
const ALLOWED_ATTRIBUTES = new Set(
  Object.entries(RICH_TEXT_SCHEMA.attributes).flatMap(([tag, names]) =>
    names.map((name) => `${tag}[${name}]`)
  )
);

for (const [path, run] of [
  ["loading a value", load],
  ["pasting", paste],
] as const) {
  test(`${path} drops everything outside the schema`, () => {
    const html = run(HOSTILE);
    const { tags, attributes } = inventory(html);

    expect([...tags].filter((tag) => !ALLOWED_TAGS.has(tag))).toEqual([]);
    expect([...attributes].filter((name) => !ALLOWED_ATTRIBUTES.has(name))).toEqual([]);
    expect(html).not.toMatch(/script|javascript:|onerror|onclick|style=|base64/i);
    // Text from a disallowed wrapper is kept; only the wrapper itself is lost.
    expect(html).toContain("link");
    expect(html).toContain("cell");
    expect(html).toContain("labelled");
    // Of the `<code>` classes, only the code block's language is kept, by its full name.
    expect(html).toContain('<code class="language-python">code()</code>');
    expect(html.match(/<input/g)).toHaveLength(1);
    // Images outside the address policy are dropped entirely; the one within the policy stays,
    // with `src` and `alt`, and without a width outside the presets.
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain(
      '<figure><img src="https://cdn.example.com/a.png" alt="ok"><figcaption>caption</figcaption></figure>'
    );
    expect(html).not.toMatch(/blob:|relative\.png/);
  });
}

test("the schema names the two palettes by tag and the old marker names", () => {
  const { textColors, markerColors, legacyMarkerColors } = RICH_TEXT_SCHEMA;

  expect([...textColors]).toEqual(["accent", "success", "warning", "danger", "lime", "muted"]);
  // The order of the "Marker color" grid is by hue (OLDSUI-153).
  expect([...markerColors]).toEqual([
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
  ]);
  // The palettes do not overlap: the name alone shows which palette it belongs to.
  expect(textColors.filter((name) => (markerColors as readonly string[]).includes(name))).toEqual(
    []
  );
  // The old marker names are exactly the text color names, and all of them are migrated.
  expect(Object.keys(legacyMarkerColors).sort()).toEqual([...textColors].sort());
  for (const target of Object.values(legacyMarkerColors)) {
    expect(markerColors as readonly string[]).toContain(target);
  }
});

test("a text colour name on a mark migrates, a marker name on a span is dropped", () => {
  expect(load('<p><mark data-color="danger">a</mark><span data-color="red">b</span></p>')).toBe(
    '<p><mark data-color="red">a</mark>b</p>'
  );
});

test("every tag and attribute the schema lists survives a round trip", () => {
  const sample =
    "<h1>One</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>" +
    "<p><strong>b</strong> <em>i</em> <u>u</u> <s>s</s> <code>c</code> <sup>2</sup> <sub>1</sub>" +
    '<br>next <a href="https://example.com">link</a></p>' +
    '<p data-align="center"><span data-color="danger">c</span><mark data-color="green">m</mark></p>' +
    '<p><span style="color:#ff0000">c</span><mark style="background-color:#ffee00">m</mark></p>' +
    // The language of a fragment (OLDSUI-308): the one standard, non-`data-*` attribute of a Mark.
    '<p><span lang="de">l</span></p>' +
    '<h1 data-align="center">Top</h1><h2 data-align="right">Right</h2><h3 data-align="center">C</h3><h4 data-align="right">R</h4>' +
    '<ul><li><p>u</p></li></ul><ol start="3"><li><p>o</p></li></ol>' +
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul>' +
    '<pre><code class="language-typescript">const a = 1;</code></pre>' +
    "<blockquote><p>q</p></blockquote><hr>" +
    // Column widths (OLDSUI-310): the shares of three columns, a colgroup before the body.
    '<table><colgroup><col data-width="35"><col data-width="35"><col data-width="30"></colgroup><tbody>' +
    '<tr><th colspan="2" data-align="center"><p>h</p></th><th rowspan="2"><p>i</p></th></tr>' +
    '<tr><td colspan="2" data-align="right"><p>d</p></td></tr>' +
    '<tr><td rowspan="2"><p>e</p></td><td><p>f</p></td><td><p>g</p></td></tr>' +
    "<tr><td><p>j</p></td><td><p>k</p></td></tr>" +
    "</tbody></table>" +
    '<figure><img src="https://cdn.example.com/a.png" alt="A" data-width="75">' +
    "<figcaption>Caption</figcaption></figure>" +
    '<div data-block="layout" data-layout="60-40"><div data-block="column"><p>l</p></div>' +
    '<div data-block="column"><p>r</p></div></div>' +
    '<div data-block="wrapper" data-tone="warning"><p>w</p></div>' +
    // `open` is written only with the `persist` option (OLDSUI-277).
    '<details open=""><summary>s</summary><div data-type="detailsContent"><p>c</p></div></details>' +
    // Video (OLDSUI-281): the service and the video link are two attributes of the `div`.
    '<div data-block="video" data-provider="youtube" data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ">' +
    '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">https://www.youtube.com/watch?v=dQw4w9WgXcQ</a></div>' +
    // Formulas write only `data-type` and the source in `data-latex` (OLDSUI-280).
    '<p>f <span data-type="inline-math" data-latex="x^2"></span></p>' +
    '<div data-type="block-math" data-latex="\\frac{a}{b}"></div>';
  const { tags, attributes } = inventory(
    load(sample, [
      ...TOOLS.filter((name) => name !== "details"),
      tool("details", { persist: true }),
    ])
  );

  expect([...ALLOWED_TAGS].filter((tag) => !tags.has(tag))).toEqual([]);
  expect([...ALLOWED_ATTRIBUTES].filter((name) => !attributes.has(name))).toEqual([]);
});

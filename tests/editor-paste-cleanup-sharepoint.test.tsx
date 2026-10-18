// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import {
  RICH_TEXT_PRESETS,
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { cleanPastedHtml } from "../src/editor/features/pasteCleanup/cleanPastedHtml.js";
import { detectPasteSources } from "../src/editor/features/pasteCleanup/pasteSources.js";
import { resetDevWarnings } from "../src/lib/dev-warn.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

/*
  The SharePoint step of the paste cleanup (OLDSUI-274): headings, flat lists and end-of-paragraph
  markers of Word Online.

  THERE IS NO REAL CAPTURE of Word Online or SharePoint clipboard HTML: nobody publishes one under a
  compatible licence. The fixtures `sharepoint-synthetic-*.json` are written by hand, in the shape
  that public MIT-licensed projects quote from real copies. The sources, read on 2026-10-17:

  - contentful/field-editors (MIT), cypress/component/rich-text/RichTextEditor.Pasting.spec.ts: real
    Word Online lists, one `ListContainerWrapper` div per item with its own `ul.BulletListStyle1…3` /
    `ol.NumberListStyle1…2`, `li[data-listid][data-aria-level][data-aria-posinset][role=listitem]`
    with the class `OutlineElement`, `p.Paragraph[paraid]`, `span.TextRun > span.NormalTextRun` and
    `span.EOP[data-ccp-props]` holding a non-breaking space; a single `ul` with several `li` too.
    https://github.com/contentful/field-editors/blob/main/cypress/component/rich-text/RichTextEditor.Pasting.spec.ts
  - ueberdosis/tiptap issue 3751 (MIT), "Copying ordered lists with sub-lists does not work from
    Office 365": the same shape for a nested numbered list, with `ol[start]` on every item's own list
    and `data-aria-posinset` equal to it, and the remark that "every list item is a separated list
    element". https://github.com/ueberdosis/tiptap/issues/3751
  - portabletext/editor (MIT), packages/html/src/deserializer/word-online/preprocessor.word-online.ts:
    headings are `p.Paragraph[role="heading"][aria-level]`, the style name sits in
    `data-ccp-parastyle="heading N"`.
    https://github.com/portabletext/editor/blob/main/packages/html/src/deserializer/word-online/preprocessor.word-online.ts
  - adobe/da-live (Apache-2.0, a file under the MIT licence of HIS eG),
    blocks/edit/prose/plugins/sectionPasteHandler/paste-from-word.js: confirms the same markers
    (`role="heading"`, `data-listid`, `data-aria-level`, `EOP` spans).

  Not found: the claim that Tiptap's own changelog mentions Word Online's end-of-paragraph markers;
  its public changelogs say nothing of it. The `EOP` span is removed because its non-breaking space
  would otherwise be pasted as text at the end of every paragraph.
*/

beforeAll(loadLazyBuiltins);
beforeEach(resetDevWarnings);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FIXTURES = resolve(import.meta.dirname, "..", "fixtures", "paste");

interface Fixture {
  "text/html": string;
  "text/plain": string;
}

function fixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as Fixture;
}

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { handle, editor: handle.editor };
}

function paste(editor: Editor, payload: { text?: string; html?: string }) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) =>
        (type === "text/plain" ? payload.text : type === "text/html" ? payload.html : "") ?? "",
      types: Object.keys(payload).map((key) => (key === "text" ? "text/plain" : "text/html")),
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** Paste a fixture into an empty Editor and return the saved HTML. */
function pasted(name: string, props: Partial<RichTextEditorProps> = {}): string {
  const { editor, handle } = renderEditor(props);
  const { "text/html": html, "text/plain": text } = fixture(name);
  paste(editor, { html, text });
  return handle.getHTML();
}

const withoutCleanup = { tools: RICH_TEXT_PRESETS.full.filter((tool) => tool !== "pasteCleanup") };
const withoutHeading1 = { tools: RICH_TEXT_PRESETS.full.filter((tool) => tool !== "heading1") };

/** One list item as Word Online writes it, reduced to what the step reads. */
function item(kind: "ul" | "ol", id: number, level: number, position: number, text: string) {
  return (
    '<div class="ListContainerWrapper"><' +
    `${kind} class="${kind === "ul" ? "Bullet" : "Number"}ListStyle${level}" role="list" start="${position}">` +
    `<li data-listid="${id}" data-aria-level="${level}" data-aria-posinset="${position}" ` +
    `role="listitem" class="OutlineElement Ltr"><p class="Paragraph"><span class="TextRun">` +
    `<span class="NormalTextRun">${text}</span></span>` +
    '<span class="EOP" data-ccp-props="{}">\u00a0</span></p></li>' +
    `</${kind}></div>`
  );
}

describe("SharePoint headings", () => {
  test("role=heading with aria-level becomes a heading of that level", () => {
    const html = pasted("sharepoint-synthetic-headings");

    expect(html).toContain("<h1>Quarterly plan</h1>");
    expect(html).toContain("<h2>Goals</h2><p>Ship the editor.</p>");
    expect(html).toContain("<h3>Milestones</h3><h4>First milestone</h4>");
    // The Word Online character style and the blue of the heading colour do not follow.
    expect(html).not.toMatch(/data-ccp|style=|class=/);
  });

  test("levels 5 and 6 become paragraphs, as an h5 or h6 from any other paste does", () => {
    const html = pasted("sharepoint-synthetic-headings");

    expect(html).toContain("<p>Fifth level</p><p>Sixth level</p>");
  });

  test("without the heading1 Tool the Schema takes h1 out, as it does for any h1 paste", () => {
    const html = pasted("sharepoint-synthetic-headings", withoutHeading1);

    expect(html).not.toContain("<h1>");
    expect(html).toContain("Quarterly plan");
    expect(html).toContain("<h2>Goals</h2>");
  });

  test("a heading inside a list item stays the text of the item", () => {
    const html = cleanPastedHtml(
      '<div class="ListContainerWrapper"><ul class="BulletListStyle1" role="list">' +
        '<li data-listid="1" data-aria-level="1" role="listitem" class="OutlineElement">' +
        '<p class="Paragraph" role="heading" aria-level="2">Heading in an item</p></li></ul></div>'
    );
    const body = new DOMParser().parseFromString(html, "text/html").body;

    expect(body.querySelector("h2")).toBeNull();
    expect(body.querySelector("ul > li > p")?.textContent).toBe("Heading in an item");
  });

  test("without pasteCleanup in tools the heading stays a paragraph, as before", () => {
    const html = pasted("sharepoint-synthetic-headings", withoutCleanup);

    expect(html).not.toContain("<h2>");
  });
});

describe("SharePoint lists", () => {
  test("a flat bullet list of three levels is nested", () => {
    const html = pasted("sharepoint-synthetic-lists-bullet");

    expect(html).toContain(
      "<ul><li><p>Apples</p><ul><li><p>Green apples</p><ul><li><p>Granny Smith</p></li>" +
        "<li><p>Golden Delicious</p></li></ul></li><li><p>Red apples</p></li></ul></li>" +
        "<li><p>Pears</p></li><li><p>Plums</p></li></ul><p>A paragraph after the list.</p>"
    );
  });

  test("a numbered list that starts at 3 keeps its start, and its sub-list begins at 1", () => {
    const html = pasted("sharepoint-synthetic-lists-numbered");

    expect(html).toBe(
      '<ol start="3"><li><p>Item three</p></li><li><p>Item four</p><ol><li><p>Detail a</p></li>' +
        "<li><p>Detail b</p></li></ol></li><li><p>Item five</p></li></ol>"
    );
  });

  test("two different lists, and a bullet list, that follow each other stay apart", () => {
    const html = pasted("sharepoint-synthetic-lists-two-lists");

    expect(html).toBe(
      "<ol><li><p>First list, one</p></li><li><p>First list, two</p></li></ol>" +
        "<ol><li><p>Second list, one</p></li><li><p>Second list, two</p></li></ol>" +
        "<ul><li><p>A bullet list right after</p></li></ul>"
    );
  });

  test("items that share one ul, with no wrapper per item, make one list", () => {
    const html = pasted("sharepoint-synthetic-lists-shared-container");

    expect(html).toBe("<ul><li><p>Second item</p></li><li><p>Third item</p></li></ul>");
  });

  test("a paragraph between two items ends the list, and the numbers are kept", () => {
    const html = cleanPastedHtml(
      item("ol", 1, 1, 1, "One") +
        '<div class="OutlineElement"><p class="Paragraph">Between</p></div>' +
        item("ol", 1, 1, 2, "Two")
    );
    const body = new DOMParser().parseFromString(html, "text/html").body;

    expect(Array.from(body.children, (child) => child.tagName)).toEqual(["OL", "DIV", "OL"]);
    expect(body.children[0]!.hasAttribute("start")).toBe(false);
    expect(body.children[2]!.getAttribute("start")).toBe("2");
  });

  test("a level that skips one is still nested under the item above", () => {
    const html = cleanPastedHtml(item("ul", 1, 1, 1, "Top") + item("ul", 1, 3, 1, "Deep"));
    const body = new DOMParser().parseFromString(html, "text/html").body;

    expect(body.querySelectorAll("ul ul")).toHaveLength(1);
    expect(body.querySelector("ul > li > ul > li")?.textContent).toBe("Deep");
  });

  test("a different list at the same level starts a new list even when a deeper item came between", () => {
    const html = cleanPastedHtml(
      item("ol", 1, 1, 1, "A1") +
        item("ol", 1, 2, 1, "A1a") +
        item("ol", 2, 1, 1, "B1") +
        item("ol", 2, 1, 2, "B2")
    );
    const body = new DOMParser().parseFromString(html, "text/html").body;

    expect(Array.from(body.children, (child) => child.tagName)).toEqual(["OL", "OL"]);
    expect(body.children[1]!.querySelectorAll(":scope > li")).toHaveLength(2);
  });

  test("without pasteCleanup in tools the items stay flat one-item lists, as before", () => {
    const html = pasted("sharepoint-synthetic-lists-bullet", withoutCleanup);

    expect(html).not.toContain("<ul><li><p>Apples</p><ul>");
  });
});

describe("SharePoint end-of-paragraph markers", () => {
  test.each([
    "headings",
    "lists-bullet",
    "lists-numbered",
    "lists-two-lists",
    "lists-shared-container",
    "whole",
  ])("%s: no marker and no stray non-breaking space is pasted", (scenario) => {
    const html = pasted(`sharepoint-synthetic-${scenario}`);

    expect(html).not.toMatch(/&nbsp;|EOP|data-ccp-props/);
    expect(html).not.toContain("\u00a0");
  });

  test("a whole page keeps headings, runs, lists and paragraphs in order", () => {
    const html = pasted("sharepoint-synthetic-whole");

    expect(html).toBe(
      "<h2>Release notes</h2><p>Version <strong>4.10</strong> is out.</p>" +
        "<ul><li><p>Faster paste</p><ul><li><p>Lists keep their nesting</p></li></ul></li>" +
        "<li><p>Cleaner headings</p></li></ul><h3>Next steps</h3>" +
        "<ol><li><p>Write the docs</p></li><li><p>Publish</p></li></ol><p>Thanks for reading.</p>"
    );
  });

  test("a marker that carries real text is unwrapped, not lost", () => {
    const html = cleanPastedHtml(
      '<div class="OutlineElement"><p class="Paragraph">Text<span class="EOP">!</span></p></div>'
    );

    expect(html).toContain("Text!");
  });
});

describe("SharePoint detection", () => {
  test("Word Online markup is recognised", () => {
    for (const html of [
      '<span class="EOP SCXW1" data-ccp-props="{}">x</span>',
      '<div class="OutlineElement Ltr SCXW1 BCX0">x</div>',
      '<div class="Foo ListContainerWrapper SCXW1">x</div>',
      '<span class="NormalTextRun SCXW1">x</span>',
      "<div class='OutlineElement'>x</div>",
    ]) {
      expect(detectPasteSources(html).sharePoint).toBe(true);
    }
  });

  test("ordinary web pages and other Office sources are not", () => {
    for (const html of [
      '<div class="outline-element text-run">x</div>',
      '<div class="my-OutlineElement">x</div>',
      '<div class="TextRunner">x</div>',
      '<p class="MsoNormal">x</p>',
      '<b id="docs-internal-guid-1"><span>x</span></b>',
      '<div data-ccp="1" class="list-container-wrapper">x</div>',
      "<p>a class=OutlineElement in prose</p>".replace("class=", "class "),
    ]) {
      expect(detectPasteSources(html).sharePoint).toBe(false);
    }
  });

  test("HTML from a web page with similar class names passes through byte-identical", () => {
    const page =
      '<meta charset=\'utf-8\'><div class="text-run"><p class="paragraph">Hello</p></div>';

    expect(cleanPastedHtml(page)).toBe(page);
  });
});

/*
  Real captures of Word for the web (Microsoft 365, 2026-10-18), copied from the test document and
  pasted into Chrome, Safari and Firefox (`fixtures/paste/word-web-*-whole.json`). They confirm the
  synthetic shape above and show two things it lacked: a long copy is split into chunk `div`s that
  carry only Word's `SCXW…`/`BCX…` classes, and a table of contents leaves content-control
  boundaries (zero-width spaces) behind instead of its entries.
*/
describe("Word for the web, real captures", () => {
  const NESTED_NUMBERED =
    "<ol><li><p>First step</p><ol><li><p>Sub-step a</p><ol><li><p>Detail i</p></li>" +
    "<li><p>Detail ii</p></li></ol></li><li><p>Sub-step b</p></li></ol></li>" +
    "<li><p>Second step</p><ul><li><p>A bullet inside a numbered list</p></li></ul></li>" +
    "<li><p>Third step</p></li></ol>";

  test.each(["chrome", "safari", "firefox"])(
    "%s: a list split across Word's chunks stays one nested list",
    (browser) => {
      const html = pasted(`word-web-${browser}-whole`);

      expect(html).toContain(NESTED_NUMBERED);
      expect(html).toContain(
        '<ol start="3"><li><p>Item three</p></li><li><p>Item four</p></li></ol>'
      );
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "%s: the table of contents leaves no empty paragraphs of zero-width spaces",
    (browser) => {
      const html = pasted(`word-web-${browser}-whole`);

      expect(html).not.toContain("\u200b");
      expect(html).toMatch(
        /<p><em>OLDSUI-274\.[^<]*<\/em><\/p><h1>1\. Headings and inline marks<\/h1>/
      );
    }
  );

  test.each(["chrome", "safari", "firefox"])(
    "%s: headings, marks and highlights come through",
    (browser) => {
      const html = pasted(`word-web-${browser}-whole`);

      expect(html).toContain("<h2>Heading Two</h2><h3>Heading Three</h3>");
      expect(html).toContain('<mark data-color="yellow">yellow</mark>');
      expect(html).toContain("<s>lazy</s>");
      expect(html).not.toMatch(/style=|class=/);
    }
  );
});

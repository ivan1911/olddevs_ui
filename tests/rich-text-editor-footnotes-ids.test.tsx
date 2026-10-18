// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, RichTextView, type RichTextEditorHandle } from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/*
  The Editor and the View of one Document on one page (OLDSUI-314, ADR-0076). The saved HTML and the
  View keep the plain `fn-<key>` and `fnref-<key>`, so a link to `/page#fn-<key>` from outside still
  lands on the View. Only the Editor's own DOM carries a prefix of its instance: otherwise the View's
  anchors led into the Editor, whichever came first in the page.
*/

const KEY = "aaaaaaa1";
const HTML =
  `<p>One<sup data-footnote-ref="${KEY}"><a href="#fn-${KEY}" id="fnref-${KEY}" role="doc-noteref">1</a></sup>.</p>` +
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  `<li id="fn-${KEY}"><p>First</p><a href="#fnref-${KEY}" role="doc-backlink">↩</a></li>` +
  "</ol></section>";

function renderPair() {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={HTML} />
      <RichTextView html={HTML} data-testid="view" />
    </>
  );
  const handle = ref.current;
  if (!handle?.editor) throw new Error("the editor was not created inside render()");
  return { ...view, handle, field: handle.editor.view.dom, page: view.getByTestId("view") };
}

test("the View keeps the plain ids, and each id is in the page once", () => {
  const { container, page } = renderPair();
  expect(container.querySelectorAll(`[id="fn-${KEY}"]`)).toHaveLength(1);
  expect(container.querySelectorAll(`[id="fnref-${KEY}"]`)).toHaveLength(1);
  expect(page.querySelector(`[id="fn-${KEY}"]`)).not.toBeNull();
  expect(page.querySelector(`[id="fnref-${KEY}"]`)).not.toBeNull();
});

test("the Editor's anchors point at its own footnote and reference", () => {
  const { container, field } = renderPair();
  const note = field.querySelector("section[data-block=footnotes] li")!;
  const link = field.querySelector("sup[data-footnote-ref] > a")!;
  expect(note.id).toMatch(new RegExp(`.+fn-${KEY}$`));
  expect(link.id).toMatch(new RegExp(`.+fnref-${KEY}$`));
  expect(link.getAttribute("href")).toBe(`#${note.id}`);
  // The target of the Editor's link is the Editor's footnote, not the View's.
  expect(container.ownerDocument.getElementById(note.id)).toBe(note);
});

test("two Editors on one page do not share ids", () => {
  const { container } = render(
    <>
      <RichTextEditor aria-label="One" defaultValue={HTML} />
      <RichTextEditor aria-label="Two" defaultValue={HTML} />
    </>
  );
  const ids = Array.from(container.querySelectorAll("[id*='fn']"), (node) => node.id);
  expect(ids).toHaveLength(4);
  expect(new Set(ids).size).toBe(4);
});

test("the saved HTML and Markdown keep the plain anchors", () => {
  const { handle } = renderPair();
  expect(handle.getHTML()).toBe(HTML);
  expect(handle.getMarkdown()).toBe("One[^1].\n\n[^1]: First");
});

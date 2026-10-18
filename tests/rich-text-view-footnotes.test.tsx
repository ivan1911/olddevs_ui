// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import createDOMPurify from "dompurify";
import { afterEach, expect, test } from "vitest";
import { RichTextView } from "../src/editor/index.js";
import { sanitizeRichText, type RichTextPurifier } from "../src/editor/schema-entry.js";

afterEach(cleanup);

/**
 * Footnotes in `RichTextView` (OLDSUI-306, ADR-0076): the saved HTML is the whole story, so the
 * references and the list work as plain anchors with no JS and no Island.
 */
const KEY = "k3x9q2mf";
const OTHER = "a1b2c3d4";
const HTML =
  `<p>Text<sup data-footnote-ref="${KEY}"><a href="#fn-${KEY}" id="fnref-${KEY}" role="doc-noteref">1</a></sup></p>` +
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  `<li id="fn-${KEY}"><p>The note</p><a href="#fnref-${KEY}" role="doc-backlink">↩</a></li></ol></section>`;

test("the View shows the reference, the list and both ways of the jump as plain anchors", () => {
  const { container } = render(<RichTextView html={HTML} />);

  const reference = container.querySelector<HTMLAnchorElement>("sup[data-footnote-ref] a")!;
  expect(reference.getAttribute("href")).toBe(`#fn-${KEY}`);
  expect(reference.getAttribute("role")).toBe("doc-noteref");
  // The target of the jump exists, and so does the way back.
  const note = container.querySelector(`#fn-${KEY}`)!;
  expect(note.textContent).toContain("The note");
  expect(note.querySelector("a")!.getAttribute("href")).toBe(`#fnref-${KEY}`);
  expect(container.querySelector(`#fnref-${KEY}`)).toBe(reference);
  const list = container.querySelector("section")!;
  expect(list.getAttribute("role")).toBe("doc-endnotes");
  expect(list.getAttribute("aria-label")).toBe("Footnotes");
});

test("the server render holds the whole list: no JS, no Island, no placeholder", () => {
  const markup = renderToString(<RichTextView html={HTML} />);

  expect(markup).toContain(`href="#fn-${KEY}"`);
  expect(markup).toContain(`id="fn-${KEY}"`);
  expect(markup).toContain("The note");
  expect(markup).not.toContain("<script");
  expect(markup).not.toContain("data-island");
});

test("two Documents on one page do not share anchors: the keys differ", () => {
  const second = HTML.replaceAll(KEY, OTHER);
  const { container } = render(
    <>
      <RichTextView html={HTML} />
      <RichTextView html={second} />
    </>
  );

  const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("a Document cleaned on the server reaches the View unchanged", () => {
  const purify: RichTextPurifier = createDOMPurify(window);

  expect(sanitizeRichText(HTML, purify)).toBe(HTML);
});

test("the footnote look is in the class list of the Document", () => {
  const { container } = render(<RichTextView html={HTML} />);

  expect(container.firstElementChild!.className).toContain("section[data-block=footnotes]");
});

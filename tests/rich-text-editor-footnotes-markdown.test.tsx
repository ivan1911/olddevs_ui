// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Footnotes in Markdown (OLDSUI-306, ADR-0076, item 7): GFM's `[^1]` and `[^1]: text`, losing no text
 * in either direction.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  return ref.current!;
}

/** The document's footnote texts, in list order, and the reference numbers, in text order. */
function summary(handle: RichTextEditorHandle) {
  const notes: string[] = [];
  const numbers: number[] = [];
  handle.editor!.state.doc.descendants((node) => {
    if (node.type.name === "footnote") notes.push(node.textContent);
    if (node.type.name === "footnoteRef") numbers.push(node.attrs.number as number);
  });
  return { notes, numbers };
}

function load(markdown: string, props: Partial<RichTextEditorProps> = {}) {
  const handle = renderEditor(props);
  act(() => handle.setMarkdown(markdown));
  return handle;
}

test("getMarkdown writes the references as [^1]..[^n] and the definitions at the end", () => {
  const handle = renderEditor({
    defaultValue:
      '<p>One<sup data-footnote-ref="aaaaaaa1"><a href="#fn-aaaaaaa1" id="fnref-aaaaaaa1" role="doc-noteref">1</a></sup> two<sup data-footnote-ref="bbbbbbb2"><a href="#fn-bbbbbbb2" id="fnref-bbbbbbb2" role="doc-noteref">2</a></sup></p>' +
      '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
      '<li id="fn-aaaaaaa1"><p>First <strong>bold</strong></p></li>' +
      '<li id="fn-bbbbbbb2"><p>Second</p></li></ol></section>',
  });

  expect(handle.getMarkdown()).toBe("One[^1] two[^2]\n\n[^1]: First **bold**\n[^2]: Second");
});

test("a label becomes a number, and the definitions fill the list", () => {
  const handle = load("Text[^note] and[^2nd].\n\n[^note]: The note.\n[^2nd]: Another.");

  expect(summary(handle)).toEqual({ notes: ["The note.", "Another."], numbers: [1, 2] });
  expect(handle.getHTML()).toMatch(/^<p>Text<sup data-footnote-ref="[a-z0-9]{8}">/);
});

test("the definitions may stand before the text and the numbers follow the references", () => {
  const handle = load("[^b]: Second.\n\n[^a]: First.\n\nA[^a] B[^b]");

  expect(summary(handle)).toEqual({ notes: ["First.", "Second."], numbers: [1, 2] });
});

test("a reference with no definition stays as the text [^x]", () => {
  const handle = load("Lonely[^missing] text");

  expect(summary(handle)).toEqual({ notes: [], numbers: [] });
  expect(handle.getText()).toBe("Lonely[^missing] text");
});

test("a definition with no reference becomes a paragraph at the end, with its label", () => {
  const handle = load("Plain text.\n\n[^orphan]: Nobody points here.");

  expect(summary(handle)).toEqual({ notes: [], numbers: [] });
  expect(handle.getText()).toBe("Plain text.\n\n[^orphan]: Nobody points here.");
});

test("a label used twice gives two footnotes with the same text", () => {
  const handle = load("A[^x] and B[^x]\n\n[^x]: Shared.");

  expect(summary(handle)).toEqual({ notes: ["Shared.", "Shared."], numbers: [1, 2] });
});

test("the second and later paragraphs of a definition are joined by a hard break", () => {
  const handle = load(
    "Text[^1]\n\n[^1]: First para.\n\n    Second para.\n\n    Third para.\n\nAfter."
  );

  expect(handle.getHTML()).toContain("<p>First para.<br>Second para.<br>Third para.</p>");
  expect(handle.getMarkdown()).toBe(
    "Text[^1]\n\nAfter.\n\n[^1]: First para.  \n    Second para.  \n    Third para."
  );
});

test("a lazy continuation line stays in the definition as running text", () => {
  const handle = load("Text[^1]\n\n[^1]: first line\ncontinues here\n\nAfter.");

  expect(summary(handle).notes).toEqual(["first line continues here"]);
});

test("a round trip through Markdown keeps the text, the marks and the order", () => {
  const source =
    "Alpha[^1] beta[^2]\n\n[^1]: One with *italic* and [a link](https://example.com).\n[^2]: Two.";
  const handle = load(source);

  const written = handle.getMarkdown();
  expect(written).toBe(source);
  const again = load(written);
  expect(again.getMarkdown()).toBe(source);
});

test("a footnote definition in a Markdown paste becomes a footnote", () => {
  const handle = renderEditor();
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? "Pasted[^1] words\n\n[^1]: With a note." : "",
      types: ["text/plain"],
    },
  });
  act(() => void handle.editor!.view.dom.dispatchEvent(event));

  expect(summary(handle)).toEqual({ notes: ["With a note."], numbers: [1] });
});

test("without the Tool nothing is lost: the reference and the definition stay as text", () => {
  const handle = load("Text[^1]\n\n[^1]: A note.", {
    tools: TOOLS.filter((name) => name !== "footnotes"),
  });

  expect(handle.getText()).toBe("Text[^1]\n\n[^1]: A note.");
});

test("a Markdown paste with footnotes into the middle of a document puts the list at the end", () => {
  const handle = renderEditor({ defaultValue: "<p>Before</p><p>After</p>" });
  const editor = handle.editor!;
  act(() => void editor.commands.setTextSelection(7));
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? "# Title\n\nPasted[^1] words\n\n[^1]: With a note." : "",
      types: ["text/plain"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(event));

  const last = editor.state.doc.lastChild!;
  expect(last.type.name).toBe("footnoteList");
  expect(summary(handle)).toEqual({ notes: ["With a note."], numbers: [1] });
  expect(handle.getText()).toContain("After");
  expect(handle.getText()).toContain("Pasted[1] words");
});

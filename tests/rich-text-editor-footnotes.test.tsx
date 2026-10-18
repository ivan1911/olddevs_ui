// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { PRESETS, TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Footnotes (OLDSUI-306, ADR-0076) through the public `RichTextEditor` and its Handle. The caret is
 * set by engine commands: jsdom does not support typing into `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const A = "aaaaaaa1";
const B = "bbbbbbb2";

/** The reference as the Editor writes it. */
const reference = (key: string, number: number) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;

/** The list as the Editor writes it, with the English catalog's name. */
const list = (...notes: [key: string, html: string][]) =>
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  notes
    .map(
      ([key, html]) =>
        `<li id="fn-${key}"><p>${html}</p><a href="#fnref-${key}" role="doc-backlink">↩</a></li>`
    )
    .join("") +
  "</ol></section>";

const WHOLE = `<p>One${reference(A, 1)} and two${reference(B, 2)}.</p>${list([A, "First"], [B, "Second"])}`;

/** The text of the current footnote, or `null` if the caret is not in one. */
function caretNote(editor: RichTextEditorHandle["editor"]) {
  const { $from } = editor!.state.selection;
  return $from.parent.type.name === "footnote" ? $from.parent.textContent : null;
}

// ── The Tool and the presets ────────────────────────────────────────────────

test("the footnotes tool is in the full preset and not in basic", () => {
  expect(TOOLS).toContain("footnotes");
  expect(PRESETS.full).toContain("footnotes");
  expect(PRESETS.basic).not.toContain("footnotes");
});

// ── HTML ────────────────────────────────────────────────────────────────────

test("a whole document survives a round trip byte for byte", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  expect(editor.getHTML()).toBe(WHOLE);
});

test("a footnote's text keeps its marks, links and hard breaks", () => {
  const html = `<p>x${reference(A, 1)}</p>${list([A, 'a <strong>bold</strong> <a href="https://example.com" rel="noopener noreferrer">link</a><br>next'])}`;
  const { editor } = renderEditor({ defaultValue: html });
  expect(editor.getHTML()).toBe(html);
});

// ── Incomplete HTML is repaired without losing text (decision 18) ───────────

test("a reference without a footnote gets an empty footnote, and its number is set", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Text${reference(A, 7)}</p>`,
  });
  expect(editor.getHTML()).toBe(`<p>Text${reference(A, 1)}</p>${list([A, ""])}`);
});

test("a footnote without a reference becomes a paragraph before the list", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Text${reference(A, 1)}</p>${list([A, "Kept"], [B, "Lonely"])}`,
  });
  expect(editor.getHTML()).toBe(`<p>Text${reference(A, 1)}</p><p>Lonely</p>${list([A, "Kept"])}`);
});

test("a list with no references at all becomes plain paragraphs", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Text</p>${list([A, "One"], [B, "Two"])}` });
  expect(editor.getHTML()).toBe("<p>Text</p><p>One</p><p>Two</p>");
});

test("a list in the middle and several lists are collected into one at the end", () => {
  const { editor } = renderEditor({
    defaultValue:
      `<p>a${reference(A, 1)}</p>${list([A, "One"])}` +
      `<p>b${reference(B, 2)}</p>${list([B, "Two"])}<p>tail</p>`,
  });
  expect(editor.getHTML()).toBe(
    `<p>a${reference(A, 1)}</p><p>b${reference(B, 2)}</p><p>tail</p>${list([A, "One"], [B, "Two"])}`
  );
});

test("a repeated key gives the second reference its own footnote with a copy of the text", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>a${reference(A, 1)} b${reference(A, 2)}</p>${list([A, "Shared"])}`,
  });
  const html = editor.getHTML();
  const keys = [...html.matchAll(/data-footnote-ref="([a-z0-9]{8})"/g)].map((match) => match[1]);
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(2);
  expect(keys[0]).toBe(A);
  expect(html.match(/<li id="fn-/g)).toHaveLength(2);
  expect(html.match(/<p>Shared<\/p>/g)).toHaveLength(2);
});

test("footnotes follow the order of the references, not of the list", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>a${reference(B, 1)} b${reference(A, 2)}</p>${list([A, "Was first"], [B, "Was second"])}`,
  });
  expect(editor.getHTML()).toBe(
    `<p>a${reference(B, 1)} b${reference(A, 2)}</p>${list([B, "Was second"], [A, "Was first"])}`
  );
});

test("repairing a loaded document does not call onChange", () => {
  const changes: string[] = [];
  renderEditor({
    defaultValue: `<p>Text${reference(A, 7)}</p>`,
    onChange: (html) => changes.push(html),
  });
  expect(changes).toEqual([]);
});

// ── Inserting ───────────────────────────────────────────────────────────────

test("insert() puts a reference at the caret, a footnote in the list and the caret in its text", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>Hello world</p>" });
  act(() => void editor.commands.setTextSelection(6));

  let done = false;
  act(() => {
    done = handle.tool("footnotes")!.insert();
  });

  const html = editor.getHTML();
  expect(html).toMatch(
    /^<p>Hello<sup data-footnote-ref="[a-z0-9]{8}"><a [^>]+>1<\/a><\/sup> world<\/p><section data-block="footnotes"/
  );
  expect(html).toContain("<p></p>");
  expect(caretNote(editor)).toBe("");
  expect(done).toBe(true);
});

/** Position of reference `number` (from 1) in the Document. */
function referencePos(editor: NonNullable<RichTextEditorHandle["editor"]>, number: number) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnoteRef" && node.attrs.number === number) found = pos;
    return found < 0;
  });
  return found;
}

test("a second reference placed before the first renumbers both and puts its footnote first", () => {
  const { editor, handle } = renderEditor({ defaultValue: WHOLE });
  act(() => void editor.commands.setTextSelection(2));

  act(() => void handle.tool("footnotes")!.insert());

  const html = editor.getHTML();
  expect(
    [
      ...html.matchAll(
        /<a href="#fn-[a-z0-9]{8}" id="fnref-[a-z0-9]{8}" role="doc-noteref">(\d+)</g
      ),
    ].map((m) => m[1])
  ).toEqual(["1", "2", "3"]);
  // The new footnote is first in the list, the old two follow with new numbers.
  const items = [...html.matchAll(/<li id="fn-([a-z0-9]{8})"><p>([^<]*)<\/p>/g)];
  expect(items.map((match) => match[2])).toEqual(["", "First", "Second"]);
  expect(items[1]![1]).toBe(A);
  expect(items[2]![1]).toBe(B);
});

test("deleting a reference deletes its footnote in the same edit, and undo brings both back", () => {
  const { editor, handle } = renderEditor({ defaultValue: WHOLE });
  const pos = referencePos(editor, 1);

  act(
    () =>
      void editor
        .chain()
        .deleteRange({ from: pos, to: pos + 1 })
        .run()
  );

  expect(editor.getHTML()).toBe(`<p>One and two${reference(B, 1)}.</p>${list([B, "Second"])}`);
  act(() => handle.undo());
  expect(editor.getHTML()).toBe(WHOLE);
});

test("deleting the last reference removes the list", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Text${reference(A, 1)}</p>${list([A, "Note"])}`,
  });
  const pos = referencePos(editor, 1);

  act(
    () =>
      void editor
        .chain()
        .deleteRange({ from: pos, to: pos + 1 })
        .run()
  );

  expect(editor.getHTML()).toBe("<p>Text</p>");
});

test("the number of a reference is kept in step when text is moved", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  // Move the whole second reference before the first: a cut and a paste at another place.
  const second = referencePos(editor, 2);
  const node = editor.state.doc.nodeAt(second)!;
  act(() => {
    editor.view.dispatch(editor.state.tr.delete(second, second + 1).insert(1, node));
  });
  expect(editor.getHTML()).toBe(
    `<p>${reference(B, 1)}One${reference(A, 2)} and two.</p>${list([B, "Second"], [A, "First"])}`
  );
});

test("typing in a footnote keeps the list and the caret", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  let notePos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnote" && node.attrs.key === A) notePos = pos;
  });
  act(() => void editor.commands.setTextSelection(notePos + 1 + "First".length));

  act(() => void editor.commands.insertContent("!"));

  expect(editor.getHTML()).toBe(
    `<p>One${reference(A, 1)} and two${reference(B, 2)}.</p>${list([A, "First!"], [B, "Second"])}`
  );
  expect(caretNote(editor)).toBe("First!");
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  useRichTextToolState,
  type FootnotesToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import createDOMPurify from "dompurify";
import { countCharacters } from "../src/editor/core/maxLength.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
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

// ── The Slash menu and the "…" menu ─────────────────────────────────────────

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

test("the Slash menu offers Footnote, found by footnote and by its Russian name, and inserts it at the caret", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 1));
  act(() => void editor.commands.insertContent(" /foot"));

  expect(screen.getByRole("option", { name: /Footnote/ })).toBeDefined();
  const press = (key: string) =>
    act(() => {
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
  press("Enter");

  const html = editor.getHTML();
  // The text stays in one paragraph, no extra block is opened, and the caret is in the footnote.
  expect(html).toMatch(/^<p>Intro <sup data-footnote-ref="[a-z0-9]{8}">/);
  expect(html.match(/<p>/g)).toHaveLength(2);
  expect(caretNote(editor)).toBe("");
});

test("the Slash menu does not open inside a footnote", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 2));
  expect(caretNote(editor)).toBe("Second");

  act(() => void editor.commands.insertContent(" /"));

  expect(screen.queryByRole("listbox", { name: "Insert block" })).toBeNull();
});

test("the + button of the Toolbar is unavailable inside a footnote", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();
  const add = screen.getByRole("button", { name: "Insert block" });
  expect(add.getAttribute("aria-disabled")).toBeNull();

  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 2));

  expect(screen.getByRole("button", { name: "Insert block" }).getAttribute("aria-disabled")).toBe(
    "true"
  );
});

test("the … menu of the Toolbar has Footnote: it inserts a reference at the end of the selection in one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro text</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection({ from: 1, to: 6 }));

  await user.click(screen.getByRole("button", { name: "More formatting" }));
  await user.click(screen.getByRole("menuitem", { name: "Footnote" }));

  expect(editor.getHTML()).toMatch(
    /^<p>Intro<sup data-footnote-ref="[a-z0-9]{8}">.*<\/sup> text<\/p><section/
  );
  expect(caretNote(editor)).toBe("");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Intro text</p>");
});

test("insert() refuses in a code block and in a footnote", () => {
  const { editor, handle } = renderEditor({
    defaultValue: `<pre><code>a = 1</code></pre><p>x${reference(A, 1)}</p>${list([A, "Note"])}`,
  });
  // In a code block.
  act(() => void editor.commands.setTextSelection(3));
  let inCode = true;
  act(() => {
    inCode = handle.tool("footnotes")!.insert();
  });
  expect(inCode).toBe(false);
  // In a footnote.
  let notePos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnote") notePos = pos;
  });
  act(() => void editor.commands.setTextSelection(notePos + 2));
  let inNote = true;
  act(() => {
    inNote = handle.tool("footnotes")!.insert();
  });
  expect(inNote).toBe(false);
  expect(editor.getHTML().match(/data-footnote-ref/g)).toHaveLength(1);
});

test("a reference can stand in a heading, a list item, a quote and a table cell", () => {
  const { editor, handle } = renderEditor({
    defaultValue:
      "<h2>Head</h2><ul><li><p>Item</p></li></ul><blockquote><p>Quote</p></blockquote>" +
      "<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>",
  });
  const positions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock) positions.push(pos + 1 + node.content.size);
  });
  for (const at of [...positions].reverse()) {
    act(() => void editor.commands.setTextSelection(at));
    act(() => void handle.tool("footnotes")!.insert());
  }
  expect(editor.getHTML().match(/data-footnote-ref/g)).toHaveLength(4);
});

// ── Jumps (decision 8) ──────────────────────────────────────────────────────

test("goToFootnote puts the caret at the end of the footnote, and goToReference right after the reference", () => {
  const { editor, handle } = renderEditor({ defaultValue: WHOLE });
  let toNote = false;
  act(() => {
    toNote = handle.tool("footnotes")!.goToFootnote(2);
  });
  expect(toNote).toBe(true);
  expect(caretNote(editor)).toBe("Second");
  expect(editor.state.selection.$from.parentOffset).toBe("Second".length);

  let toText = false;
  act(() => {
    toText = handle.tool("footnotes")!.goToReference(2);
  });
  expect(toText).toBe(true);
  const { $from } = editor.state.selection;
  expect($from.nodeBefore?.type.name).toBe("footnoteRef");
  expect($from.nodeBefore?.attrs.number).toBe(2);
});

test("a jump to a footnote that does not exist is refused", () => {
  const { handle } = renderEditor({ defaultValue: WHOLE });
  const commands = handle.tool("footnotes")!;
  for (const number of [0, 3, -1, 1.5, Number.NaN]) {
    let done = true;
    act(() => {
      done = commands.goToFootnote(number);
    });
    expect(done, String(number)).toBe(false);
  }
});

test("a click on a reference goes to its footnote, and the number button goes back", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  const anchors = editor.view.dom.querySelectorAll<HTMLElement>("sup[data-footnote-ref] a");

  fireEvent.click(anchors[1]!);
  expect(caretNote(editor)).toBe("Second");

  const back = editor.view.dom.querySelectorAll<HTMLElement>("[data-footnote-back]");
  expect(back).toHaveLength(2);
  expect(back[0]!.textContent).toBe("1");
  expect(back[0]!.getAttribute("aria-label")).toBe("Back to text, footnote 1");
  fireEvent.click(back[0]!);
  expect(editor.state.selection.$from.nodeBefore?.attrs.number).toBe(1);
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
});

test("Enter on a selected reference goes to the footnote, and Enter in a footnote goes back", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();
  const pos = referencePos(editor, 1);
  act(() => void editor.commands.setNodeSelection(pos));

  expect(press(editor, "Enter")).toBe(false);
  expect(caretNote(editor)).toBe("First");

  const before = editor.getHTML();
  expect(press(editor, "Enter")).toBe(false);
  expect(editor.state.selection.$from.nodeBefore?.attrs.number).toBe(1);
  expect(editor.getHTML()).toBe(before);
});

/** A `keydown` on the Document; `true` means the Editor released the key to the browser. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

test("jumps work in readOnly and do not change the document", () => {
  const changes: string[] = [];
  const { editor, handle } = renderEditor({
    defaultValue: WHOLE,
    readOnly: true,
    onChange: (html) => changes.push(html),
  });
  const commands = handle.tool("footnotes")!;
  let toNote = false;
  let toText = false;
  act(() => {
    toNote = commands.goToFootnote(1);
  });
  expect(caretNote(editor)).toBe("First");
  act(() => {
    toText = commands.goToReference(1);
  });
  fireEvent.click(editor.view.dom.querySelectorAll<HTMLElement>("sup[data-footnote-ref] a")[1]!);

  expect(toNote && toText).toBe(true);
  expect(caretNote(editor)).toBe("Second");
  expect(editor.getHTML()).toBe(WHOLE);
  expect(changes).toEqual([]);
});

test("insert() is refused in readOnly and in a disabled field", () => {
  for (const props of [{ readOnly: true }, { disabled: true }]) {
    const { editor, handle, unmount } = renderEditor({ defaultValue: WHOLE, ...props });
    let done = true;
    act(() => {
      done = handle.tool("footnotes")!.insert();
    });
    expect(done).toBe(false);
    expect(editor.getHTML()).toBe(WHOLE);
    unmount();
  }
});

test("jumps are refused in a disabled field, and a click there follows nothing", () => {
  const { editor, handle } = renderEditor({ defaultValue: WHOLE, disabled: true });
  const before = editor.state.selection.from;
  const commands = handle.tool("footnotes")!;
  let toNote = true;
  let toText = true;
  act(() => {
    toNote = commands.goToFootnote(1);
    toText = commands.goToReference(1);
  });
  fireEvent.click(editor.view.dom.querySelectorAll<HTMLElement>("sup[data-footnote-ref] a")[0]!);

  expect(toNote || toText).toBe(false);
  expect(editor.state.selection.from).toBe(before);
});

// ── Keys in a footnote (decision 17) ────────────────────────────────────────

/** The caret at `offset` inside the footnote with this key. */
function caretInNote(editor: Editor, key: string, offset: number) {
  let notePos = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "footnote" && node.attrs.key === key) notePos = pos;
  });
  act(() => void editor.commands.setTextSelection(notePos + 1 + offset));
}

test("Backspace at the start of a footnote and Delete at its end do nothing", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();

  caretInNote(editor, B, 0);
  expect(press(editor, "Backspace")).toBe(false);
  caretInNote(editor, A, "First".length);
  expect(press(editor, "Delete")).toBe(false);

  expect(editor.getHTML()).toBe(WHOLE);
});

test("Shift+Enter in a footnote is a hard break, and it stays one footnote", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();
  caretInNote(editor, A, 2);

  press(editor, "Enter", { shiftKey: true, keyCode: 13 });

  expect(editor.getHTML()).toBe(
    `<p>One${reference(A, 1)} and two${reference(B, 2)}.</p>${list([A, "Fi<br>rst"], [B, "Second"])}`
  );
});

test("the list has no handle and moving or duplicating a block never takes it", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  focusField();
  caretInNote(editor, A, 1);

  expect(press(editor, "ArrowUp", { altKey: true, shiftKey: true })).toBe(true);
  expect(press(editor, "d", { metaKey: true, shiftKey: true })).toBe(true);

  expect(editor.getHTML()).toBe(WHOLE);
  expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
});

// ── The clipboard (decision 15) ─────────────────────────────────────────────

/** Copies the selection the way the Editor does: the HTML and the text the clipboard would hold. */
function copy(editor: Editor) {
  const { dom, text } = editor.view.serializeForClipboard(editor.state.selection.content());
  return { html: dom.innerHTML, text };
}

function pasteHtml(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

const TWO = `<p>Alpha${reference(A, 1)}</p><p>Beta</p>${list([A, "Note of alpha"])}`;

/** The footnote texts in list order, and the keys in list order. */
function notes(editor: Editor) {
  const found: { key: string; text: string }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "footnote") {
      found.push({ key: node.attrs.key as string, text: node.textContent });
    }
  });
  return found;
}

test("copying a reference carries the footnote's text, and pasting makes a new footnote with a new key", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 7 }));
  const { html } = copy(editor);
  expect(html).toContain("data-footnote-note");
  // At the end of the second paragraph.
  act(() => void editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 5));

  pasteHtml(editor, html);

  expect(editor.getHTML()).not.toContain("data-footnote-note");
  const found = notes(editor);
  expect(found.map((note) => note.text)).toEqual(["Note of alpha", "Note of alpha"]);
  expect(found[0]!.key).toBe(A);
  expect(found[1]!.key).not.toBe(A);
  expect(editor.getHTML().match(/data-footnote-ref/g)).toHaveLength(2);
});

test("cutting and pasting a reference moves its footnote with its text", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 7 }));
  const { html } = copy(editor);
  act(() => void editor.chain().deleteSelection().run());
  expect(editor.getHTML()).toBe("<p></p><p>Beta</p>");
  act(() => void editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 5));

  pasteHtml(editor, html);

  expect(notes(editor).map((note) => note.text)).toEqual(["Note of alpha"]);
  expect(editor.getHTML()).toMatch(/^<p><\/p><p>BetaAlpha<sup /);
});

test("the footnote's text travels to another Editor", () => {
  const first = renderEditor({ defaultValue: TWO });
  act(() => void first.editor.commands.setTextSelection({ from: 1, to: 7 }));
  const { html } = copy(first.editor);
  cleanup();

  const second = renderEditor({ defaultValue: "<p>Target</p>" });
  act(() => void second.editor.commands.setTextSelection(7));
  pasteHtml(second.editor, html);

  expect(notes(second.editor).map((note) => note.text)).toEqual(["Note of alpha"]);
});

test("a selection that holds both the reference and the list pastes one footnote, not two", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  act(() => void editor.commands.selectAll());
  const { html } = copy(editor);
  act(() => void editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 5));

  pasteHtml(editor, html);

  expect(editor.getHTML().match(/data-footnote-ref/g)).toHaveLength(2);
  expect(notes(editor)).toHaveLength(2);
});

test("a footnote in the clipboard without its reference pastes as a paragraph", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Target</p>" });
  act(() => void editor.commands.setTextSelection(7));

  pasteHtml(editor, list([A, "Orphan"]));

  expect(editor.getText()).toBe("Target\n\nOrphan");
  expect(notes(editor)).toEqual([]);
});

test("copying as text writes the number in brackets", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 7 }));

  expect(copy(editor).text).toBe("Alpha[1]");
});

test("pasting a reference into a footnote leaves no reference there", () => {
  const { editor } = renderEditor({ defaultValue: TWO });
  act(() => void editor.commands.setTextSelection({ from: 1, to: 7 }));
  const { html } = copy(editor);
  caretInNote(editor, A, 4);

  pasteHtml(editor, html);

  expect(editor.getHTML().match(/data-footnote-ref/g)).toHaveLength(1);
  expect(notes(editor)).toHaveLength(1);
});

test("an Editor without the Tool keeps the text of a pasted footnote reference and drops the markup", () => {
  const first = renderEditor({ defaultValue: TWO });
  act(() => void first.editor.commands.setTextSelection({ from: 1, to: 7 }));
  const { html } = copy(first.editor);
  cleanup();

  const second = renderEditor({
    defaultValue: "<p>Target</p>",
    tools: TOOLS.filter((name) => name !== "footnotes" && name !== "superscript"),
  });
  act(() => void second.editor.commands.setTextSelection(7));
  pasteHtml(second.editor, html);

  expect(second.editor.getHTML()).toBe("<p>TargetAlpha1</p>");
});

// ── Atom text, the counter, headings (decision 14) ──────────────────────────

test("the reference's Atom text is its number in brackets, and the footnotes count as plain text", () => {
  const { editor, handle } = renderEditor({ defaultValue: WHOLE });

  // "One" + "[1]" + " and two" + "[2]" + "." in the text, then "First" and "Second".
  expect(handle.getText().replace(/\n{2,}/g, "\n\n")).toBe("One[1] and two[2].\n\nFirst\n\nSecond");
  expect(countCharacters(editor.state.doc)).toBe(
    "One[1] and two[2].".length + "FirstSecond".length
  );
});

test("an edit that would pass maxLength with a reference is refused as a whole", () => {
  // 3 characters of text + a 3-character reference = 6: it fits; a fourth letter does not.
  const { editor, handle } = renderEditor({ defaultValue: "<p>abc</p>", maxLength: 6 });
  act(() => void editor.commands.setTextSelection(4));
  let done = false;
  act(() => {
    done = handle.tool("footnotes")!.insert();
  });
  expect(done).toBe(true);
  expect(countCharacters(editor.state.doc)).toBe(6);
  act(() => void editor.commands.setTextSelection(2));
  act(() => void editor.commands.insertContent("x"));
  expect(countCharacters(editor.state.doc)).toBe(6);
  expect(editor.getText()).toContain("abc[1]");

  // A second reference does not fit at all, and the document does not change.
  const before = editor.getHTML();
  act(() => {
    done = handle.tool("footnotes")!.insert();
  });
  expect(done).toBe(false);
  expect(editor.getHTML()).toBe(before);
});

test("the Table of contents does not show a footnote reference's number", async () => {
  const { RICH_TEXT_PRESETS } = await import("../src/editor/index.js");
  const { editor } = renderEditor({
    tools: [...RICH_TEXT_PRESETS.full, "toc"],
    defaultValue: `<h2>Title${reference(A, 1)}</h2><p>x</p>${list([A, "N"])}`,
  });
  const { tocDocumentHeadings } = await import("../src/editor/features/toc/documentHeadings.js");

  expect(
    tocDocumentHeadings(editor, { levels: [1, 2, 3, 4] }).map((heading) => heading.text)
  ).toEqual(["Title"]);
});

// ── State (decision 16) ─────────────────────────────────────────────────────

let snapshot: FootnotesToolState | null = null;

function Screen(props: Partial<RichTextEditorProps>) {
  const ref = useRef<RichTextEditorHandle>(null);
  snapshot = useRichTextToolState(ref, "footnotes");
  return <RichTextEditor ref={ref} aria-label="Body" {...props} />;
}

test("the State lists the footnotes in order and names the current one", () => {
  render(<Screen defaultValue={WHOLE} />);
  expect(snapshot).toEqual({
    footnotes: [
      { number: 1, text: "First" },
      { number: 2, text: "Second" },
    ],
    current: null,
  });
});

test("the State follows the caret into a footnote and onto a selected reference", () => {
  const ref = createRef<RichTextEditorHandle>();
  function Both() {
    snapshot = useRichTextToolState(ref, "footnotes");
    return <RichTextEditor ref={ref} aria-label="Body" defaultValue={WHOLE} />;
  }
  render(<Both />);
  const editor = ref.current!.editor!;

  caretInNote(editor, B, 2);
  expect(snapshot!.current).toBe(2);

  act(() => void editor.commands.setNodeSelection(referencePos(editor, 1)));
  expect(snapshot!.current).toBe(1);

  act(() => void editor.commands.setTextSelection(2));
  expect(snapshot!.current).toBeNull();
});

test("the State is null for an Editor without the Tool and has no footnotes for an empty one", () => {
  render(<Screen tools={TOOLS.filter((name) => name !== "footnotes")} />);
  expect(snapshot).toBeNull();
  cleanup();

  render(<Screen />);
  expect(snapshot).toEqual({ footnotes: [], current: null });
});

// ── Without the Tool, in other formats, other inputs ────────────────────────

test("an Editor without the Tool keeps the text of the numbers and of the footnotes", () => {
  const { editor } = renderEditor({
    defaultValue: WHOLE,
    tools: TOOLS.filter((name) => name !== "footnotes" && name !== "superscript"),
  });

  const html = editor.getHTML();
  expect(html).not.toContain("data-footnote-ref");
  expect(html).not.toContain("<section");
  expect(editor.getText()).toContain("First");
  expect(editor.getText()).toContain("Second");
  expect(editor.getText()).toContain("One1 and two2.");
});

test("the basic preset does not include footnotes", () => {
  const { editor } = renderEditor({ preset: "basic", defaultValue: WHOLE });
  expect(editor.getHTML()).not.toContain("data-footnote-ref");
});

test("the JSON envelope round-trips the footnotes", () => {
  const { handle } = renderEditor({ defaultValue: WHOLE });
  const json = handle.getJSON();
  cleanup();

  const again = renderEditor();
  let done = false;
  act(() => {
    done = again.handle.setJSON(json!);
  });
  expect(done).toBe(true);
  expect(again.editor.getHTML()).toBe(WHOLE);
});

test("a new value from outside is repaired the same way and is not reported", () => {
  const changes: string[] = [];
  const { editor, rerender } = renderEditor({
    value: "<p>Plain</p>",
    onChange: (html) => changes.push(html),
  });

  rerender(
    <RichTextEditor
      aria-label="Body"
      value={`<p>Text${reference(A, 5)}</p>`}
      onChange={(html) => changes.push(html)}
    />
  );

  expect(editor.getHTML()).toBe(`<p>Text${reference(A, 1)}</p>${list([A, ""])}`);
  expect(changes).toEqual([]);
});

test("Source mode applies HTML through the same repair", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Plain</p>" });

  await user.click(screen.getByRole("button", { name: "HTML" }));
  const field = screen.getByRole("textbox", { name: "HTML source" });
  await user.clear(field);
  await user.click(field);
  await user.paste(`<p>Text${reference(A, 9)}</p>`);
  await user.click(screen.getByRole("button", { name: "HTML" }));

  expect(editor.getHTML()).toBe(`<p>Text${reference(A, 1)}</p>${list([A, ""])}`);
});

test("an inline code span refuses a reference", () => {
  const { editor, handle } = renderEditor({ defaultValue: "<p>run <code>npm test</code> now</p>" });
  act(() => void editor.commands.setTextSelection(10));

  let done = true;
  act(() => {
    done = handle.tool("footnotes")!.insert();
  });

  expect(done).toBe(false);
  expect(editor.getHTML()).not.toContain("data-footnote-ref");
});

test("a reference can stand next to an inline formula when mathematics is on", () => {
  const { editor, handle } = renderEditor({
    tools: [...TOOLS],
    defaultValue: '<p>f <span data-type="inline-math" data-latex="x^2"></span> end</p>',
  });
  act(() => void editor.commands.setTextSelection(3));
  let done = false;
  act(() => {
    done = handle.tool("footnotes")!.insert();
  });
  expect(done).toBe(true);
  expect(editor.getHTML()).toContain('data-latex="x^2"');
});

test("the list name in the saved HTML follows the catalog", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });
  expect(editor.getHTML()).toContain('aria-label="Footnotes"');
});

// ── The Schema, in both directions ──────────────────────────────────────────

test("what the Editor writes passes the server cleanup unchanged", () => {
  const { editor } = renderEditor({ defaultValue: WHOLE });

  expect(sanitizeRichText(editor.getHTML(), createDOMPurify(window))).toBe(WHOLE);
});

test("the Editor drops an id, an anchor and a role that are not footnote markup", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<h2 id="top">Head</h2><p id="fn-aaaaaaa1" role="button" aria-label="x"><a href="#top" id="fnref-aaaaaaa1">jump</a></p>',
  });

  const html = editor.getHTML();
  expect(html).not.toMatch(/\bid=|role=|aria-label=|href=/);
  expect(editor.getText()).toContain("jump");
});

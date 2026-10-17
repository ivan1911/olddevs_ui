// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import createDOMPurify from "dompurify";
import { NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  RichTextView,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { sanitizeRichText } from "../src/editor/schema-entry.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` once the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * The Wrapper is a Block that gathers a group of Blocks (OLDSUI-77), like Wrapper in Redactor.
 *
 * Through the public `RichTextEditor`, `RichTextView`, and `sanitizeRichText`, as in the
 * Column layout tests: insertion goes through the Slash menu and the handle menu, keys are
 * real `keydown` events, and the result is the output HTML, Markdown, and an undo step. The
 * caret is placed by engine commands: jsdom cannot handle input in `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor, handle: ref.current! };
}

const wrapper = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;

// ── Schema ───────────────────────────────────────────────────────────────

test("a wrapper of any blocks survives a round trip with no other attributes", () => {
  const html = wrapper(
    "<p>Text</p>",
    "<h2>Heading</h2>",
    "<ul><li><p>Item</p></li></ul>",
    "<blockquote><p>Quote</p></blockquote>",
    "<pre><code>code</code></pre>",
    "<hr>"
  );
  const { editor } = renderEditor({ defaultValue: `<p>Before</p>${html}<p>After</p>` });
  expect(editor.getHTML()).toBe(`<p>Before</p>${html}<p>After</p>`);
});

const column = (...blocks: string[]) => `<div data-block="column">${blocks.join("")}</div>`;
const layout = (variant: string, ...columns: string[]) =>
  `<div data-block="layout" data-layout="${variant}">${columns.join("")}</div>`;

test("Redactor's wrapper HTML reads as a wrapper; foreign attributes are dropped", () => {
  const { editor } = renderEditor({
    defaultValue:
      '<div data-block="wrapper" class="rx-block" style="padding:20px" data-uid="1">' +
      "<p>One</p><p>Two</p></div>",
  });
  expect(editor.getHTML()).toBe(wrapper("<p>One</p>", "<p>Two</p>"));
});

test("a wrapper sits in a layout column", () => {
  const html = layout("50-50", column(wrapper("<p>a</p>", "<p>b</p>")), column("<p>c</p>"));
  const { editor } = renderEditor({ defaultValue: html });
  expect(editor.getHTML()).toBe(html);
});

test("a wrapper inside a wrapper, list, quote or cell unfolds into its blocks", () => {
  const nested = wrapper("<p>x</p>", "<p>y</p>");
  const { editor } = renderEditor({
    defaultValue:
      wrapper("<p>a</p>", nested) +
      `<blockquote>${nested}</blockquote>` +
      `<ul><li>${nested}</li></ul>` +
      `<table><tbody><tr><td>${nested}</td></tr></tbody></table>`,
  });

  expect(editor.getHTML()).toBe(
    wrapper("<p>a</p><p>x</p><p>y</p>") +
      "<blockquote><p>x</p><p>y</p></blockquote>" +
      "<ul><li><p>x</p><p>y</p></li></ul>" +
      "<table><tbody><tr><td><p>x</p><p>y</p></td></tr></tbody></table>"
  );
});

test("a layout inside a wrapper unfolds into its blocks and keeps the wrapper whole", () => {
  const { editor } = renderEditor({
    defaultValue: wrapper("<p>a</p>", layout("50-50", column("<p>x</p>"), column("<p>y</p>"))),
  });
  expect(editor.getHTML()).toBe(wrapper("<p>a</p>", "<p>x</p>", "<p>y</p>"));
});

test("without the wrapper tool a wrapper unfolds into blocks in a row", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${wrapper("<p>One</p>", "<h2>Two</h2>")}`,
    tools: TOOLS.filter((tool) => tool !== "wrapper"),
  });
  expect(editor.getHTML()).toBe("<p>Before</p><p>One</p><h2>Two</h2>");
});

test("without the wrapper tool a wrapper in a column unfolds there", () => {
  const { editor } = renderEditor({
    defaultValue: layout("100", column(wrapper("<p>One</p>"))),
    tools: TOOLS.filter((tool) => tool !== "wrapper"),
  });
  expect(editor.getHTML()).toBe(layout("100", column("<p>One</p>")));
});

test("a wrapper alone works without the layout tool", () => {
  const html = wrapper("<p>One</p>");
  const { editor } = renderEditor({
    defaultValue: html,
    tools: TOOLS.filter((tool) => tool !== "layout"),
  });
  expect(editor.getHTML()).toBe(html);
});

test("the basic preset has no wrapper", () => {
  const { editor } = renderEditor({ preset: "basic", defaultValue: wrapper("<p>One</p>") });
  expect(editor.getHTML()).toBe("<p>One</p>");
});

// ── Sanitizer ────────────────────────────────────────────────────────────

test("sanitizeRichText keeps a wrapper where the schema takes it and unwraps it elsewhere", () => {
  const purify = createDOMPurify(window);
  const saved = renderEditor({
    defaultValue:
      wrapper("<p>a</p>") + layout("50-50", column(wrapper("<p>b</p>")), column("<p>c</p>")),
  }).editor.getHTML();
  expect(sanitizeRichText(saved, purify)).toBe(saved);

  for (const [input, output] of [
    // Foreign attributes and handlers are stripped, and the Wrapper stays.
    [
      '<div data-block="wrapper" style="color:red" onclick="x()"><p>a</p></div>',
      wrapper("<p>a</p>"),
    ],
    // A Wrapper inside a Wrapper, in a list, a quote, and a cell: Blocks in a row.
    [wrapper("<p>a</p>", wrapper("<p>b</p>")), wrapper("<p>a</p><p>b</p>")],
    [`<ul><li>${wrapper("<p>a</p>")}</li></ul>`, "<ul><li><p>a</p></li></ul>"],
    [`<blockquote>${wrapper("<p>a</p>")}</blockquote>`, "<blockquote><p>a</p></blockquote>"],
    [
      `<table><tbody><tr><td>${wrapper("<p>a</p>")}</td></tr></tbody></table>`,
      "<table><tbody><tr><td><p>a</p></td></tr></tbody></table>",
    ],
    // Directly in a Column layout, outside a column, there is no Wrapper; the same goes for
    // columns inside a Wrapper.
    [
      '<div data-block="layout" data-layout="100">' + wrapper("<p>a</p>") + "</div>",
      '<div data-block="layout" data-layout="100"><p>a</p></div>',
    ],
    [wrapper(column("<p>a</p>")), wrapper("<p>a</p>")],
    // A Column layout inside a Wrapper is unwrapped, and the Wrapper stays.
    [wrapper(layout("50-50", column("<p>x</p>"), column("<p>y</p>"))), wrapper("<p>x</p><p>y</p>")],
    // `data-block="wrapper"` is only on a `div`.
    ['<p data-block="wrapper">a</p>', "<p>a</p>"],
  ] as [string, string][]) {
    expect(sanitizeRichText(input, purify), input).toBe(output);
  }
});

// ── Paste from the clipboard ─────────────────────────────────────────────

/** Pastes HTML from the clipboard: parsed by the Schema, in a transaction with the `paste` meta. */
function paste(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

/** Places the caret at the end of the text `text` (or at its start). */
function caretIn(editor: Editor, text: string, at: "end" | "start" = "end") {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) {
      found = at === "end" ? pos + node.nodeSize : pos;
    }
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

test("pasted Redactor wrapper HTML becomes a wrapper at the top level", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  caretIn(editor, "Intro");
  paste(editor, '<div data-block="wrapper"><p>a</p><p>b</p></div>');
  expect(editor.getHTML()).toBe("<p>Intro</p>" + wrapper("<p>a</p>", "<p>b</p>"));
});

test("a wrapper pasted into a wrapper unfolds and keeps the outer one whole", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p>Two</p>") });
  caretIn(editor, "One");
  paste(editor, wrapper("<p>x</p>", "<p>y</p>"));
  // The first paragraph of the paste continues the line, as with any text paste.
  expect(editor.getHTML()).toBe(wrapper("<p>Onex</p>", "<p>y</p>", "<p>Two</p>"));
});

test("a wrapper pasted into a list item unfolds there", () => {
  const { editor } = renderEditor({ defaultValue: "<ul><li><p>One</p></li></ul>" });
  caretIn(editor, "One");
  paste(editor, wrapper("<p>x</p>", "<p>y</p>"));
  expect(editor.getHTML()).not.toContain("data-block");
  expect(editor.getText()).toContain("Onex");
});

test("a wrapper pasted into a column stays a wrapper in that column", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column("<p>Left</p>"), column("<p>Right</p>")),
  });
  caretIn(editor, "Left");
  paste(editor, wrapper("<p>x</p>", "<p>y</p>"));
  expect(editor.getHTML()).toContain(wrapper("<p>x</p>", "<p>y</p>"));
  expect(editor.state.doc.childCount).toBe(1);
});

test("a layout with a wrapper in its column pasted into a wrapper loses both containers", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  caretIn(editor, "One");
  paste(editor, layout("50-50", column(wrapper("<p>x</p>"), "<p>y</p>"), column("<p>z</p>")));
  expect(editor.state.doc.childCount).toBe(1);
  expect(editor.getHTML()).toBe(wrapper("<p>Onex</p>", "<p>y</p>", "<p>z</p>"));
});

test("a whole wrapper copied inside the editor and pasted into another unfolds", () => {
  const { editor } = renderEditor({
    defaultValue: wrapper("<p>One</p>") + wrapper("<p>x</p>", "<p>y</p>"),
  });
  const second = editor.state.doc.child(0).nodeSize;
  const slice = NodeSelection.create(editor.state.doc, second).content();
  const { dom } = editor.view.serializeForClipboard(slice);
  caretIn(editor, "One");
  paste(editor, dom.innerHTML);
  expect(editor.getHTML()).toBe(
    wrapper("<p>One</p>", "<p>x</p>", "<p>y</p>") + wrapper("<p>x</p>", "<p>y</p>")
  );
});

// ── Paste ────────────────────────────────────────────────────────────────

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

/** `keydown` on the document; `true` means the Editor let the browser handle the key. */
function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

/** Text of the Block where the caret is. */
const here = (editor: Editor) => editor.state.selection.$from.parent.textContent;
/** Name of the node that holds the Block with the caret. */
const container = (editor: Editor) => editor.state.selection.$from.node(-1).type.name;

test("the Wrapper item of the insert menu adds an empty wrapper below, caret inside", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  caretIn(editor, "Intro");

  type(editor, " /wrapper");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe("<p>Intro </p>" + wrapper("<p></p>"));
  expect(container(editor)).toBe("wrapper");

  type(editor, "Typed");
  expect(editor.getHTML()).toBe("<p>Intro </p>" + wrapper("<p>Typed</p>"));
});

test("the Wrapper item of the toolbar insert menu is one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p><p>Outro</p>" });
  caretIn(editor, "Intro", "start");

  await user.click(screen.getByRole("button", { name: "Insert block" }));
  await user.click(screen.getByRole("menuitem", { name: "Wrapper" }));
  expect(editor.getHTML()).toBe("<p>Intro</p>" + wrapper("<p></p>") + "<p>Outro</p>");
  expect(container(editor)).toBe("wrapper");

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>Intro</p><p>Outro</p>");
});

test("from a column the new wrapper goes below the block in the same column", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column("<p>Left</p>", "<p>More</p>"), column("<p>Right</p>")),
  });
  focusField();
  caretIn(editor, "Left");

  type(editor, " /wrapper");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    layout(
      "50-50",
      column("<p>Left </p>", wrapper("<p></p>"), "<p>More</p>"),
      column("<p>Right</p>")
    )
  );
  expect(container(editor)).toBe("wrapper");
});

test("from inside a wrapper the new one goes below it, not into it, and leaves no empty line", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p></p>") });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 2));
  expect(here(editor)).toBe("");

  type(editor, "/wrapper");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(wrapper("<p>One</p>") + wrapper("<p></p>"));
  expect(editor.state.selection.$from.index(0)).toBe(1);
});

test("from a list or a quote the wrapper goes below the whole block", () => {
  const { editor } = renderEditor({
    defaultValue: "<ul><li><p>Item</p></li></ul><blockquote><p>Quote</p></blockquote>",
  });
  focusField();
  caretIn(editor, "Item");

  type(editor, " /wrapper");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    "<ul><li><p>Item </p></li></ul>" + wrapper("<p></p>") + "<blockquote><p>Quote</p></blockquote>"
  );
});

test("other blocks from the insert menu stay inside the wrapper", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  focusField();
  caretIn(editor, "One");

  type(editor, " /divider");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(wrapper("<p>One </p>", "<hr>", "<p></p>"));
});

test("a layout from inside a wrapper goes below it and leaves no empty line", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p></p>") });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 2));

  type(editor, "/layout");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    wrapper("<p>One</p>") + layout("50-50", column("<p></p>"), column("<p></p>"))
  );
});

test("the insert menu has no Wrapper without the wrapper tool", () => {
  const { editor } = renderEditor({ tools: TOOLS.filter((tool) => tool !== "wrapper") });
  focusField();
  type(editor, "/wrapper");
  expect(screen.queryByRole("option", { name: /Wrapper/ })).toBeNull();
});

// ── Keyboard ─────────────────────────────────────────────────────────────

test("Backspace at the start of a wrapper keeps the text inside", () => {
  const html = `<p>Above</p>${wrapper("<p>First</p>", "<p>Second</p>")}`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  caretIn(editor, "First", "start");

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(html);
  expect(here(editor)).toBe("First");
});

test("Backspace in the only empty paragraph removes the wrapper, one undo step", () => {
  const html = `<p>Above</p>${wrapper("<p></p>")}<p>Below</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  act(() => void editor.commands.setTextSelection(9));
  expect(container(editor)).toBe("wrapper");

  // Otherwise an empty Wrapper cannot be removed from the keyboard: the boundary guard swallowed
  // Backspace. Its place is taken by an empty paragraph with the caret in it; there is no text
  // to pass on.
  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe("<p>Above</p><p></p><p>Below</p>");
  expect(container(editor)).toBe("doc");
  expect(editor.state.selection.$from.index(0)).toBe(1);

  type(editor, "Typed");
  expect(editor.getHTML()).toBe("<p>Above</p><p>Typed</p><p>Below</p>");
  act(() => void editor.commands.undo());
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("an empty wrapper alone in the document leaves an empty document", () => {
  const { editor, handle } = renderEditor({ defaultValue: wrapper("<p></p>") });
  focusField();
  act(() => void editor.commands.setTextSelection(2));

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe("<p></p>");
  expect(handle.getHTML()).toBe("");
});

test("an empty wrapper in a column is removed inside that column", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column(wrapper("<p></p>")), column("<p>Right</p>")),
  });
  focusField();
  // Column layout › column › Wrapper › paragraph.
  act(() => void editor.commands.setTextSelection(4));
  expect(container(editor)).toBe("wrapper");

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(layout("50-50", column("<p></p>"), column("<p>Right</p>")));
  expect(container(editor)).toBe("layoutColumn");

  // After that, it works as in any column: Backspace at its start does not merge the columns.
  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(layout("50-50", column("<p></p>"), column("<p>Right</p>")));
});

test("an empty heading alone in a wrapper turns into text first, then the wrapper goes", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${wrapper("<h2></h2>")}` });
  focusField();
  act(() => void editor.commands.setTextSelection(9));

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(`<p>Above</p>${wrapper("<p></p>")}`);
  press(editor, "Backspace");
  expect(editor.getHTML()).toBe("<p>Above</p><p></p>");
});

test("Backspace in an empty first paragraph keeps a wrapper that holds more", () => {
  const html = `<p>Above</p>${wrapper("<p></p>", "<p>Second</p>")}`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  act(() => void editor.commands.setTextSelection(9));
  expect(container(editor)).toBe("wrapper");

  expect(press(editor, "Backspace")).toBe(false);
  expect(editor.getHTML()).toBe(html);
});

test("Delete in the only empty paragraph keeps the wrapper", () => {
  const html = `${wrapper("<p></p>")}<p>Below</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  act(() => void editor.commands.setTextSelection(2));

  expect(press(editor, "Delete")).toBe(false);
  expect(editor.getHTML()).toBe(html);
});

test("Delete at the end of a wrapper does not pull the block below in", () => {
  const html = `${wrapper("<p>First</p>", "<p>Last</p>")}<p>Below</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  caretIn(editor, "Last");

  expect(press(editor, "Delete")).toBe(false);
  expect(editor.getHTML()).toBe(html);
});

test("Backspace inside a wrapper joins its own blocks as usual", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>First</p>", "<p>Second</p>") });
  focusField();
  caretIn(editor, "Second", "start");

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(wrapper("<p>FirstSecond</p>"));
});

test("an empty heading at the start of a wrapper turns into text on Backspace", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<h2></h2>") });
  focusField();
  act(() => void editor.commands.setTextSelection(2));
  expect(editor.isActive("heading")).toBe(true);

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe(wrapper("<p></p>"));
});

test("Backspace on the block below selects the whole wrapper, the second one removes it", () => {
  const html = wrapper("<p>One</p>", "<p>Two</p>");
  const { editor } = renderEditor({ defaultValue: `${html}<p>Below</p>` });
  focusField();
  caretIn(editor, "Below", "start");

  press(editor, "Backspace");
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");
  expect(editor.getHTML()).toBe(`${html}<p>Below</p>`);

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe("<p>Below</p>");
});

test("Enter in the empty last paragraph moves it below the wrapper, one undo step", () => {
  const { editor } = renderEditor({ defaultValue: `${wrapper("<p>One</p>")}<p>After</p>` });
  focusField();
  caretIn(editor, "One");

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(`${wrapper("<p>One</p>", "<p></p>")}<p>After</p>`);

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(`${wrapper("<p>One</p>")}<p></p><p>After</p>`);
  expect(container(editor)).toBe("doc");
  expect(editor.state.selection.$from.index(0)).toBe(1);

  type(editor, "Out");
  expect(editor.getHTML()).toBe(`${wrapper("<p>One</p>")}<p>Out</p><p>After</p>`);
});

test("leaving a wrapper by Enter is one undo step", () => {
  const html = `${wrapper("<p>One</p>", "<p></p>")}<p>After</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusField();
  caretIn(editor, "One");
  act(() => void editor.commands.setTextSelection(editor.state.selection.from + 2));
  expect(here(editor)).toBe("");

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(`${wrapper("<p>One</p>")}<p></p><p>After</p>`);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("Enter in the only empty paragraph of a wrapper stays inside", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p></p>") });
  focusField();
  act(() => void editor.commands.setTextSelection(2));

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(wrapper("<p></p>", "<p></p>"));
  expect(container(editor)).toBe("wrapper");
});

test("Enter in an empty list item inside a wrapper belongs to the list", () => {
  const { editor } = renderEditor({
    defaultValue: wrapper("<p>One</p>", "<ul><li><p>Item</p></li><li><p></p></li></ul>"),
  });
  focusField();
  act(() => void editor.commands.setTextSelection(editor.state.doc.content.size - 4));
  expect(container(editor)).toBe("listItem");

  press(editor, "Enter");
  expect(editor.getHTML()).toBe(wrapper("<p>One</p>", "<ul><li><p>Item</p></li></ul>", "<p></p>"));
});

test("a wrapper at the edges of the document is left by a gap cursor", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>Only</p>") });
  focusField();
  caretIn(editor, "Only");

  press(editor, "ArrowDown");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
  expect(editor.state.selection.from).toBe(editor.state.doc.content.size);

  caretIn(editor, "Only", "start");
  press(editor, "ArrowUp");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
  expect(editor.state.selection.from).toBe(0);
});

test("Tab in a wrapper is left to the browser: no keyboard trap", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  focusField();
  caretIn(editor, "One");
  expect(press(editor, "Tab")).toBe(true);
  expect(press(editor, "Tab", { shiftKey: true })).toBe(true);
});

test("in a wrapper inside a column Tab still moves to the next column", () => {
  const { editor } = renderEditor({
    defaultValue: layout("50-50", column(wrapper("<p>Left</p>")), column("<p>Right</p>")),
  });
  focusField();
  caretIn(editor, "Left");
  expect(press(editor, "Tab")).toBe(false);
  expect(here(editor)).toBe("Right");
});

// ── Commands over Blocks ─────────────────────────────────────────────────

test("moving and duplicating a block stay inside its wrapper", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Above</p>${wrapper("<p>One</p>", "<p>Two</p>")}`,
  });
  focusField();
  caretIn(editor, "Two");

  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe(`<p>Above</p>${wrapper("<p>Two</p>", "<p>One</p>")}`);

  // At the edge of the Wrapper there is no neighbor: the Block stays in it.
  press(editor, "ArrowUp", { altKey: true, shiftKey: true });
  expect(editor.getHTML()).toBe(`<p>Above</p>${wrapper("<p>Two</p>", "<p>One</p>")}`);

  press(editor, "D", { ctrlKey: true, shiftKey: true, keyCode: 68 });
  expect(editor.getHTML()).toBe(`<p>Above</p>${wrapper("<p>Two</p>", "<p>Two</p>", "<p>One</p>")}`);
});

// ── Block handle ─────────────────────────────────────────────────────────

const HANDLE = "Block actions";

/** Focus in the Document: the handle is visible only then. */
function focusAt(editor: Editor, text: string) {
  caretIn(editor, text);
  act(() => editor.view.focus());
}

/**
 * The Wrapper as a whole is selected as a node, the way Backspace on the Block
 * below it selects it.
 */
function selectWrapper(editor: Editor, pos: number) {
  act(() => {
    editor.view.focus();
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
  });
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");
}

async function openHandleMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: HANDLE }));
  return screen.findByRole("menu", { name: HANDLE });
}

async function openSubmenu(
  user: ReturnType<typeof userEvent.setup>,
  menu: HTMLElement,
  name: string
) {
  await user.click(within(menu).getByRole("menuitem", { name }));
  return screen.findByRole("menu", { name });
}

test("Add › Wrapper puts an empty wrapper below the block, one undo step", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Wrapper" }));

  expect(editor.getHTML()).toBe("<p>One</p>" + wrapper("<p></p>") + "<p>Two</p>");
  expect(container(editor)).toBe("wrapper");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p>");
});

test("a block in a wrapper has its own handle: Add puts a block below it in the wrapper", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p>Two</p>") });
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Divider" }));

  expect(editor.getHTML()).toBe(wrapper("<p>One</p>", "<hr>", "<p>Two</p>"));
});

test("Add › Wrapper from a block in a wrapper puts the new one below the wrapper", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>", "<p>Two</p>") });
  focusAt(editor, "One");

  const add = await openSubmenu(user, await openHandleMenu(user), "Add");
  await user.click(within(add).getByRole("menuitem", { name: "Wrapper" }));

  expect(editor.getHTML()).toBe(wrapper("<p>One</p>", "<p>Two</p>") + wrapper("<p></p>"));
});

test("Delete of the only block in a wrapper leaves an empty paragraph", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${wrapper("<p>Only</p>")}` });
  focusAt(editor, "Only");

  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: "Delete" }));
  expect(editor.getHTML()).toBe(`<p>Above</p>${wrapper("<p></p>")}`);
  expect(container(editor)).toBe("wrapper");
});

test("Unwrap from the handle of a block inside puts the blocks in place, one undo step", async () => {
  const user = userEvent.setup();
  const html = `<p>Above</p>${wrapper("<p>One</p>", "<h2>Two</h2>")}<p>Below</p>`;
  const { editor } = renderEditor({ defaultValue: html });
  focusAt(editor, "Two");

  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: "Unwrap" }));

  expect(editor.getHTML()).toBe("<p>Above</p><p>One</p><h2>Two</h2><p>Below</p>");
  // The caret stayed in its own text.
  expect(here(editor)).toBe("Two");
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(html);
});

test("the handle of a block outside a wrapper has no Unwrap", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: `<p>Plain</p>${wrapper("<p>One</p>")}` });
  focusAt(editor, "Plain");

  const menu = await openHandleMenu(user);
  expect(within(menu).queryByRole("menuitem", { name: "Unwrap" })).toBeNull();
});

test("Unwrap stands in the section of tool actions right before Delete, for the wrapper and the block in it", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  focusAt(editor, "One");

  const menu = await openHandleMenu(user);
  const items = within(menu).getAllByRole("menuitem");
  expect(items.slice(-2).map((item) => item.textContent)).toEqual(["Unwrap", "Delete"]);
  // A separate section: "Unwrap" and "Delete" have their own groups, not one shared group.
  expect(items.at(-2)!.closest('[role="group"]')).not.toBe(items.at(-1)!.closest('[role="group"]'));
});

test("a wrapper selected as a whole: its handle moves, duplicates and unwraps all of it", async () => {
  const user = userEvent.setup();
  const box = wrapper("<p>One</p>", "<p>Two</p>");
  const { editor } = renderEditor({ defaultValue: `<p>Above</p>${box}<p>Below</p>` });

  selectWrapper(editor, 7);
  let menu = await openHandleMenu(user);
  // A Wrapper has no Block type: "Format" is visible but disabled.
  expect(within(menu).getByRole("menuitem", { name: "Format" }).getAttribute("aria-disabled")).toBe(
    "true"
  );
  await user.click(within(menu).getByRole("menuitem", { name: /Move down/ }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p>${box}`);

  selectWrapper(editor, 14);
  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: /Duplicate/ }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p>${box}${box}`);

  selectWrapper(editor, 14);
  menu = await openHandleMenu(user);
  await user.click(within(menu).getByRole("menuitem", { name: "Unwrap" }));
  expect(editor.getHTML()).toBe(`<p>Above</p><p>Below</p><p>One</p><p>Two</p>${box}`);
  expect(here(editor)).toBe("One");
});

test("a wrapper selected as a whole is deleted with its content", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({
    defaultValue: `<p>Above</p>${wrapper("<p>One</p>", "<p>Two</p>")}<p>Below</p>`,
  });
  selectWrapper(editor, 7);
  await user.click(within(await openHandleMenu(user)).getByRole("menuitem", { name: "Delete" }));
  expect(editor.getHTML()).toBe("<p>Above</p><p>Below</p>");
});

// ── Markdown ─────────────────────────────────────────────────────────────

test("getMarkdown writes the blocks of a wrapper in a row", () => {
  const { handle } = renderEditor({
    defaultValue: `<p>Intro</p>${wrapper("<h2>Title</h2>", "<p>One</p>")}<p>Outro</p>`,
  });
  expect(handle.getMarkdown()).toBe("Intro\n\n## Title\n\nOne\n\nOutro");
});

test("setMarkdown never creates a wrapper, even from raw HTML", () => {
  const { editor, handle } = renderEditor();
  act(() => handle.setMarkdown(`One\n\n${wrapper("<p>Two</p>")}\n\nThree`));
  expect(editor.getHTML()).not.toContain("data-block");
});

// ── Display ──────────────────────────────────────────────────────────────

test("RichTextView shows the wrapper as markup with its blocks in order", () => {
  const { container: root } = render(<RichTextView html={wrapper("<p>One</p>", "<p>Two</p>")} />);
  const box = root.querySelector('[data-block="wrapper"]');
  expect(box?.textContent).toBe("OneTwo");
  // The Wrapper has no role of its own: it is a group of the Document's Blocks, not a widget.
  expect(box?.getAttribute("role")).toBeNull();
});

test("in the editor the wrapper has no role either", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p>") });
  const box = editor.view.dom.querySelector('[data-block="wrapper"]');
  expect(box).not.toBeNull();
  expect(box?.getAttribute("role")).toBeNull();
});

test("Unwrap with an image selected inside keeps the image selected", () => {
  const { editor } = renderEditor({
    defaultValue: wrapper(
      "<p>One</p>",
      '<figure><img src="https://cdn.example.com/a.png" alt="A"></figure>'
    ),
  });
  act(() => {
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 6)));
  });
  expect(editor.state.selection.constructor.name).toBe("NodeSelection");

  act(() => void editor.commands.unwrapWrapper());
  expect(editor.getHTML()).not.toContain("data-block");
  expect((editor.state.selection as NodeSelection).node.type.name).toBe("image");
});

test("outside a wrapper Unwrap does nothing", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
  caretIn(editor, "Text");
  expect(editor.commands.unwrapWrapper()).toBe(false);
  expect(editor.getHTML()).toBe("<p>Text</p>");
});

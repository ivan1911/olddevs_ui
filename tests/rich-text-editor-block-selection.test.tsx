// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { Dialog } from "../src/components/overlays/Dialog.js";
import { Drawer } from "../src/components/overlays/Drawer.js";
import { UiProvider } from "../src/i18n/UiProvider.js";
import { messages as ru } from "../src/locales/ru.js";
import {
  RichTextEditor,
  useRichTextToolState,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Block selection (ADR-0077, OLDSUI-307): the `blockSelection` Tool.
 *
 * Through the public `RichTextEditor` and its Handle: `Esc` and the other keys are real
 * `keydown` events on the Document, the result is read from the output HTML, the selection and the
 * live region. jsdom has no layout and does not move the DOM selection, so how it looks and where
 * the handle stands is for the browser checks.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(
    <>
      <button type="button">Before</button>
      <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} {...props} />
    </>
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor };
}

/** Focus in the Document and the caret at the end of the text `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(found);
  });
}

interface KeyInit {
  shift?: boolean;
  mod?: boolean;
  alt?: boolean;
}

/** A `keydown` on the Document the way the keyboard sends it; `keyCode` is set for ProseMirror. */
function press(editor: Editor, key: string, init: KeyInit = {}): KeyboardEvent {
  const codes: Record<string, number> = {
    Escape: 27,
    Enter: 13,
    Backspace: 8,
    Delete: 46,
    ArrowUp: 38,
    ArrowDown: 40,
    d: 68,
  };
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey: init.shift,
    ctrlKey: init.mod,
    altKey: init.alt,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: codes[key] ?? key.toUpperCase().charCodeAt(0) });
  act(() => void editor.view.dom.dispatchEvent(event));
  return event;
}

const selection = (editor: Editor) => editor.state.selection;
const selectedCount = (editor: Editor) => {
  const current = selection(editor);
  return current instanceof BlockSelection ? current.count : 0;
};
const status = () => screen.getAllByRole("status").find((node) => node.className.includes("sr-only"));
const announced = () => document.querySelector('[role="status"].sr-only')?.textContent ?? "";

const THREE = "<p>One</p><p>Two</p><p>Three</p>";

// --- The way in ------------------------------------------------------------------

test("Esc in the text selects the current Block, and the event is taken", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");

  const event = press(editor, "Escape");

  expect(selection(editor)).toBeInstanceOf(BlockSelection);
  expect(selectedCount(editor)).toBe(1);
  const block = selection(editor) as BlockSelection;
  expect(editor.state.doc.textBetween(block.from, block.to)).toBe("Two");
  expect(event.defaultPrevented).toBe(true);
});

test("Esc in a list selects the item, in a table the whole table", () => {
  const { editor } = renderEditor({
    defaultValue:
      "<ul><li><p>a</p></li><li><p>b</p></li></ul><table><tbody><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>",
  });
  caretIn(editor, "b");
  press(editor, "Escape");
  const item = selection(editor) as BlockSelection;
  expect(item.count).toBe(1);
  expect(editor.state.doc.textBetween(item.from, item.to)).toBe("b");
  expect(item.nodeRange().parent.type.name).toBe("bulletList");

  caretIn(editor, "c2");
  press(editor, "Escape");
  const table = selection(editor) as BlockSelection;
  expect(table.count).toBe(1);
  expect(table.nodeRange().parent.child(table.nodeRange().startIndex).type.name).toBe("table");
});

test("Esc over a text selection across Blocks selects all of them", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: 2, to: 8 });
  });
  press(editor, "Escape");
  expect(selectedCount(editor)).toBe(2);
});

// --- Growing, moving, leaving ---------------------------------------------------

test("Shift+arrows grow and shrink the selection from its anchor", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");

  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(2);
  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(3);
  press(editor, "ArrowUp", { shift: true });
  expect(selectedCount(editor)).toBe(2);
  press(editor, "ArrowUp", { shift: true });
  expect(selectedCount(editor)).toBe(1);
  // The anchor is the first Block: upwards there is nothing, and the selection goes up a level.
  const one = selection(editor) as BlockSelection;
  expect(editor.state.doc.textBetween(one.from, one.to)).toBe("One");
});

test("Shift+ArrowUp from the middle grows upwards, and the same keys grow it back", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  press(editor, "ArrowUp", { shift: true });
  const grown = selection(editor) as BlockSelection;
  expect(grown.count).toBe(2);
  expect(grown.forward).toBe(false);
  expect(editor.state.doc.textBetween(grown.from, grown.to, "|")).toBe("One|Two");

  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(1);
});

test("an arrow key moves a single selection to the neighbour; at the edge it stays", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");

  press(editor, "ArrowDown");
  let block = selection(editor) as BlockSelection;
  expect(editor.state.doc.textBetween(block.from, block.to)).toBe("Two");
  press(editor, "ArrowDown");
  press(editor, "ArrowDown");
  block = selection(editor) as BlockSelection;
  expect(editor.state.doc.textBetween(block.from, block.to)).toBe("Three");
  press(editor, "ArrowUp");
  block = selection(editor) as BlockSelection;
  expect(editor.state.doc.textBetween(block.from, block.to)).toBe("Two");
});

test("Enter puts the caret at the end of the first Block", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  press(editor, "Enter");

  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  expect(selection(editor).empty).toBe(true);
  expect(selection(editor).from).toBe(4);
});

test("the second Esc ends the selection with the caret at the end of the first Block", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  press(editor, "Escape");

  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  expect(selection(editor).from).toBe(4);
});

// --- Keys and the clipboard -------------------------------------------------------

test("Backspace and Delete remove the Blocks as one edit, and undo brings the selection back", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  press(editor, "Backspace");
  expect(editor.getHTML()).toBe("<p>One</p>");
  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);

  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(THREE);
  expect(selectedCount(editor)).toBe(2);
});

test("Delete of every Block leaves one empty paragraph", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });
  press(editor, "ArrowDown", { shift: true });

  press(editor, "Delete");

  expect(editor.getHTML()).toBe("<p></p>");
});

test("a printable character is ignored: it does not replace the Blocks", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  const event = press(editor, "x");

  expect(event.defaultPrevented).toBe(true);
  expect(editor.getHTML()).toBe(THREE);
  expect(selectedCount(editor)).toBe(1);
});

test("Mod+Shift+D duplicates the group, Alt+Shift+arrows move it, and the group stays selected", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  press(editor, "d", { mod: true, shift: true });
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p><p>One</p><p>Two</p><p>Three</p>");
  expect(selectedCount(editor)).toBe(2);
  const copy = selection(editor) as BlockSelection;
  expect(copy.from).toBe(10);

  press(editor, "ArrowDown", { alt: true, shift: true });
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p><p>Three</p><p>One</p><p>Two</p>");
  expect(selectedCount(editor)).toBe(2);
});

test("copy puts whole Blocks on the clipboard, cut removes them, paste replaces them", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  const data = new Map<string, string>();
  const clipboardData = {
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    clearData: () => data.clear(),
    types: [] as string[],
  };
  const copy = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(copy, "clipboardData", { value: clipboardData });
  act(() => void editor.view.dom.dispatchEvent(copy));
  // The engine marks the slice with `data-pm-slice`; the Blocks themselves are whole.
  expect(data.get("text/html")).toMatch(/^<p[^>]*>Two<\/p>$/);
  expect(data.get("text/plain")).toBe("Two");
  expect(editor.getHTML()).toBe(THREE);

  const cut = new Event("cut", { bubbles: true, cancelable: true });
  Object.defineProperty(cut, "clipboardData", { value: clipboardData });
  act(() => void editor.view.dom.dispatchEvent(cut));
  expect(editor.getHTML()).toBe("<p>One</p><p>Three</p>");
});

test("paste replaces the selected Blocks with the pasted content", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  const paste = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(paste, "clipboardData", {
    value: {
      getData: (type: string) =>
        ({ "text/html": "<p>Pasted</p>", "text/plain": "Pasted" })[type] ?? "",
      types: ["text/html", "text/plain"],
    },
  });
  act(() => void editor.view.dom.dispatchEvent(paste));

  expect(editor.getHTML()).toBe("<p>One</p><p>Pasted</p><p>Three</p>");
});

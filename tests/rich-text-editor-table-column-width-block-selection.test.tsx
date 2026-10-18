// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { TOOLS } from "../src/editor/core/tools.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);
afterEach(cleanup);

/**
 * Column widths next to Block selection (OLDSUI-310 with OLDSUI-307): a table is ONE Block unit, so
 * `Esc` in a cell selects the whole table, and everything done to that unit (duplicate, move, copy and
 * paste) has to carry the table's `shares` with it, through the public component and the `full` set.
 */
function renderEditor(defaultValue: string) {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <RichTextEditor ref={ref} aria-label="Body" tools={[...TOOLS]} defaultValue={defaultValue} />
  );
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { editor, handle: ref.current! };
}

const cols = '<colgroup><col data-width="35"><col data-width="65"></colgroup>';
const TABLE = `<table>${cols}<tbody><tr><td><p>c1</p></td><td><p>c2</p></td></tr></tbody></table>`;
const DOCUMENT = `<p>Before</p>${TABLE}<p>After</p>`;

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

const codes: Record<string, number> = { Escape: 27, ArrowUp: 38, ArrowDown: 40, d: 68 };

function press(
  editor: Editor,
  key: string,
  init: { shift?: boolean; mod?: boolean; alt?: boolean } = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    shiftKey: init.shift,
    ctrlKey: init.mod,
    altKey: init.alt,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: codes[key] });
  act(() => void editor.view.dom.dispatchEvent(event));
}

/** The shares of every table of the document, in order. */
function allShares(editor: Editor): unknown[] {
  const found: unknown[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "table") found.push(node.attrs.shares);
    return true;
  });
  return found;
}

function selectTable(editor: Editor) {
  caretIn(editor, "c2");
  press(editor, "Escape");
  expect(editor.state.selection).toBeInstanceOf(BlockSelection);
}

function clipboard() {
  const data = new Map<string, string>();
  return {
    data,
    setData: (type: string, value: string) => void data.set(type, value),
    getData: (type: string) => data.get(type) ?? "",
    clearData: () => data.clear(),
    types: [] as string[],
  };
}

function fire(editor: Editor, type: "copy" | "paste", clipboardData: object) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  act(() => void editor.view.dom.dispatchEvent(event));
}

test("Mod+Shift+D duplicates the selected table with its widths, and both keep their colgroup", () => {
  const { editor, handle } = renderEditor(DOCUMENT);
  selectTable(editor);

  press(editor, "d", { mod: true, shift: true });

  expect(allShares(editor)).toEqual([
    [35, 65],
    [35, 65],
  ]);
  expect(handle.getHTML()).toBe(`<p>Before</p>${TABLE}${TABLE}<p>After</p>`);
});

test("Alt+Shift+Up and Down move the selected table with its widths", () => {
  const { editor, handle } = renderEditor(DOCUMENT);
  selectTable(editor);

  press(editor, "ArrowUp", { alt: true, shift: true });
  expect(handle.getHTML()).toBe(`${TABLE}<p>Before</p><p>After</p>`);
  expect(allShares(editor)).toEqual([[35, 65]]);

  press(editor, "ArrowDown", { alt: true, shift: true });
  press(editor, "ArrowDown", { alt: true, shift: true });
  expect(handle.getHTML()).toBe(`<p>Before</p><p>After</p>${TABLE}`);
  expect(allShares(editor)).toEqual([[35, 65]]);
});

test("copying the selected table and pasting it over a paragraph keeps the widths", () => {
  const { editor, handle } = renderEditor(DOCUMENT);
  selectTable(editor);
  const data = clipboard();
  fire(editor, "copy", data);
  expect(data.data.get("text/html")).toContain(cols);

  caretIn(editor, "After");
  press(editor, "Escape");
  fire(editor, "paste", {
    getData: (type: string) => data.data.get(type) ?? "",
    types: ["text/html", "text/plain"],
  });

  expect(handle.getHTML()).toBe(`<p>Before</p>${TABLE}${TABLE}`);
  expect(allShares(editor)).toEqual([
    [35, 65],
    [35, 65],
  ]);
});

test("the Block selection of a table with widths is one unit, and one undo takes a duplicate away", () => {
  const { editor, handle } = renderEditor(DOCUMENT);
  selectTable(editor);
  press(editor, "d", { mod: true, shift: true });

  act(() => void editor.commands.undo());

  expect(handle.getHTML()).toBe(DOCUMENT);
  expect(allShares(editor)).toEqual([[35, 65]]);
});

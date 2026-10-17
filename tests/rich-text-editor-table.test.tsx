// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { TOOLS } from "../src/editor/core/tools.js";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Editor tables (OLDSUI-45).
 *
 * Through the public `RichTextEditor`, like the other tests: insertion goes through the
 * insert menu, and the keys are real `keydown` events. The "Table" menu on the Toolbar is in
 * `rich-text-editor-table-menu.test.tsx`.
 * The caret is placed with engine commands: jsdom cannot type into `contenteditable`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

function focusField() {
  act(() => screen.getByRole("textbox", { name: "Body" }).focus());
}

function type(editor: Editor, text: string) {
  act(() => void editor.commands.insertContent(text));
}

function press(editor: Editor, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init })
    );
  });
}

const row = (cell: "th" | "td", count: number) =>
  `<tr>${`<${cell}><p></p></${cell}>`.repeat(count)}</tr>`;

test("the Table item of the insert menu adds a 3x3 table with a header row", () => {
  const { editor } = renderEditor({ defaultValue: "<p>Intro</p>" });
  focusField();
  act(() => void editor.commands.setTextSelection(6));

  type(editor, " /table");
  press(editor, "Enter");

  expect(editor.getHTML()).toBe(
    `<p>Intro </p><table><tbody>${row("th", 3)}${row("td", 3)}${row("td", 3)}</tbody></table>`
  );
  // The caret is in the first cell: typing continues in the table.
  expect(editor.state.selection.$from.parent.type.name).toBe("paragraph");
  expect(editor.isActive("tableHeader")).toBe(true);
});

/** A table as other editors send it: widths, merging, alignment, styles. */
const FOREIGN_TABLE =
  '<table class="grid" style="width:100%" border="1">' +
  '<colgroup><col style="width:30%"><col></colgroup>' +
  '<thead><tr><th colspan="2" scope="col" style="text-align:center" data-colwidth="120,80">Head</th></tr></thead>' +
  '<tbody><tr><td rowspan="2" colwidth="100" align="right" onclick="steal()">a</td><td>b</td></tr>' +
  "<tr><td>c</td></tr></tbody></table>";

/** What the Schema allows a cell, and only that: merging, `data-align`. */
const FOREIGN_LEFTOVERS =
  /style|colwidth|class|[^-]align=|scope|border|onclick|colgroup|<col[\s>]|thead|caption/;

test("a loaded table keeps its merges and nothing else: no style, widths, classes or handlers", () => {
  const { handle } = renderEditor({ defaultValue: FOREIGN_TABLE });

  const html = handle.getHTML();
  expect(html).toMatch(/^<table><tbody>.*<\/tbody><\/table>$/);
  expect(html).not.toMatch(FOREIGN_LEFTOVERS);
  // Merged cells from a foreign table (Word, Excel, Google Docs) are kept, and its
  // `text-align` and `align` become `data-align`.
  expect(html).toContain('<th colspan="2" data-align="center"><p>Head</p></th>');
  expect(html).toContain('<td rowspan="2" data-align="right"><p>a</p></td>');
  expect(html.match(/<tr>/g)).toHaveLength(3);
  for (const text of ["Head", ">a<", ">b<", ">c<"]) expect(html).toContain(text);
});

test("spans the Schema does not allow become 1: zero, fractions, units and over the limit", () => {
  const cell = (attrs: string) =>
    `<table><tbody><tr><td ${attrs}><p>x</p></td><td><p>y</p></td></tr></tbody></table>`;
  for (const attrs of [
    'colspan="0"',
    'colspan="1.5"',
    'colspan="2px"',
    'colspan="-2"',
    'colspan="21"',
    'rowspan="51"',
    'colspan="10000"',
  ]) {
    cleanup();
    const { handle } = renderEditor({ defaultValue: cell(attrs) });
    expect(handle.getHTML(), attrs).not.toMatch(/colspan|rowspan/);
  }
  cleanup();
  const { handle } = renderEditor({
    defaultValue:
      '<table><tbody><tr><td colspan="20"><p>x</p></td></tr><tr><td rowspan="50"><p>y</p></td></tr>' +
      '<tr><td colspan=" 2 "><p>z</p></td></tr></tbody></table>',
  });
  expect(handle.getHTML()).toContain('colspan="20"');
  // The browser and DOMPurify strip spaces at the edges, and so does the Editor.
  expect(handle.getHTML()).toContain('<td colspan="2"><p>z</p></td>');
  expect(handle.getHTML()).toContain('rowspan="50"');
});

test("data-align on a cell is kept only with a known value; left is the default and is not written", () => {
  const { handle } = renderEditor({
    defaultValue:
      "<table><tbody><tr>" +
      '<td data-align="center"><p>a</p></td><td data-align="right"><p>b</p></td>' +
      '<td data-align="left"><p>c</p></td><td data-align="justify"><p>d</p></td>' +
      "</tr></tbody></table>",
  });

  expect(handle.getHTML()).toBe(
    "<table><tbody><tr>" +
      '<td data-align="center"><p>a</p></td><td data-align="right"><p>b</p></td>' +
      "<td><p>c</p></td><td><p>d</p></td>" +
      "</tr></tbody></table>"
  );
});

/*
  A table from Word, Excel or Google Docs aligns cells with `style` or the obsolete
  `align`: they are read as `data-align`, and are not written themselves.
*/
test("text-align style and the align attribute on cells become data-align; justify writes nothing", () => {
  const { handle } = renderEditor({
    defaultValue:
      "<table><tbody>" +
      '<tr><th style="text-align: right"><p>h1</p></th><th align="center"><p>h2</p></th></tr>' +
      '<tr><td style="TEXT-ALIGN:Center"><p>a</p></td><td style="text-align:justify" align="justify"><p>b</p></td></tr>' +
      "</tbody></table>",
  });

  expect(handle.getHTML()).toBe(
    "<table><tbody>" +
      '<tr><th data-align="right"><p>h1</p></th><th data-align="center"><p>h2</p></th></tr>' +
      '<tr><td data-align="center"><p>a</p></td><td><p>b</p></td></tr>' +
      "</tbody></table>"
  );
});

test("a table typed by the toolbar commands never writes style or widths either", () => {
  const { editor } = renderEditor();
  focusField();

  act(() => void editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: false }));
  act(() => void editor.commands.addColumnAfter());

  expect(editor.getHTML()).toBe(`<table><tbody>${row("td", 3)}${row("td", 3)}</tbody></table>`);
});

/** A 2x2 table with a header and text in each cell; the caret is in the cell "a2". */
const TABLE =
  "<table><tbody>" +
  "<tr><th><p>h1</p></th><th><p>h2</p></th></tr>" +
  "<tr><td><p>a1</p></td><td><p>a2</p></td></tr>" +
  "<tr><td><p>b1</p></td><td><p>b2</p></td></tr>" +
  "</tbody></table>";

/** Puts the caret at the end of the cell with this text. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

const cells = (editor: Editor) =>
  Array.from(editor.view.dom.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.children).map((cell) => cell.textContent)
  );

/** The text of the cell under the caret. */
const here = (editor: Editor) => editor.state.selection.$from.parent.textContent;

test("Tab and Shift+Tab walk the cells in reading order", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "h2");

  press(editor, "Tab");
  expect(here(editor)).toBe("a1");
  press(editor, "Tab");
  expect(here(editor)).toBe("a2");
  press(editor, "Tab", { shiftKey: true });
  expect(here(editor)).toBe("a1");
  press(editor, "Tab", { shiftKey: true });
  expect(here(editor)).toBe("h2");
});

test("Tab in the last cell adds a row and moves into it; Shift+Tab in the first cell stays", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "b2");

  press(editor, "Tab");

  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["a1", "a2"],
    ["b1", "b2"],
    ["", ""],
  ]);
  expect(here(editor)).toBe("");
  expect(editor.state.selection.$from.index(-1)).toBe(0);

  caretIn(editor, "h1");
  press(editor, "Tab", { shiftKey: true });
  expect(here(editor)).toBe("h1");
});

/*
  The table is the last Block: `↓` from ANY cell of the last row places a gap
  cursor after the table. The table engine itself looked for a place through `Selection.near` and,
  not finding one after the table, moved the caret back into the last cell, so leaving took a
  second arrow. `↑` from the first row of a table that comes first places a gap cursor before it.
*/
test("an arrow out of the edge row of a table that ends the document puts a gap cursor past it", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  focusField();
  caretIn(editor, "b1");

  press(editor, "ArrowDown");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
  expect(editor.state.selection.from).toBe(editor.state.doc.content.size);

  caretIn(editor, "h2");
  press(editor, "ArrowUp");
  expect(editor.state.selection.constructor.name).toBe("GapCursor");
  expect(editor.state.selection.from).toBe(0);

  // Not an edge row: moving between cells stays with the table engine.
  caretIn(editor, "a1");
  press(editor, "ArrowDown");
  expect(here(editor)).toBe("b1");
});

test("with a paragraph past the table the arrow lands in it, not on a gap cursor", () => {
  const { editor } = renderEditor({ defaultValue: `${TABLE}<p>After</p>` });
  focusField();
  caretIn(editor, "b1");
  press(editor, "ArrowDown");
  expect(editor.state.selection.constructor.name).toBe("TextSelection");
  expect(editor.state.selection.$from.parent.textContent).toBe("After");
});

/*
  Alt+↓ (⌥↓) adds the row below the current one, with the caret in the same column of the
  new row (the owner's decision, OLDSUI-45). Only inside a table: elsewhere the shortcut
  stays with the browser.
*/
test("Alt+ArrowDown in a cell adds a row below and moves the caret into the same column", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "a2");

  press(editor, "ArrowDown", { altKey: true });

  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["a1", "a2"],
    ["", ""],
    ["b1", "b2"],
  ]);
  const { $from } = editor.state.selection;
  expect($from.parent.textContent).toBe("");
  expect($from.index(-3)).toBe(2); // row in the table
  expect($from.index(-2)).toBe(1); // cell in the row
});

test("one undo takes the row added by Alt+ArrowDown away", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  caretIn(editor, "b1");
  press(editor, "ArrowDown", { altKey: true });
  expect(cells(editor)).toHaveLength(4);

  act(() => void editor.commands.undo());

  expect(cells(editor)).toEqual([
    ["h1", "h2"],
    ["a1", "a2"],
    ["b1", "b2"],
  ]);
});

/** A key released by the Editor: `defaultPrevented` is cleared, so the browser receives it. */
function altDownReachesBrowser(editor: Editor): boolean {
  const event = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

test("outside a table Alt+ArrowDown is left to the browser and the document does not change", () => {
  const { editor } = renderEditor({ defaultValue: `<p>Before</p>${TABLE}` });
  caretIn(editor, "Before");
  const before = editor.getHTML();

  expect(altDownReachesBrowser(editor)).toBe(true);
  expect(editor.getHTML()).toBe(before);
});

test("without the table tool Alt+ArrowDown does nothing", () => {
  const { editor } = renderEditor({ tools: WITHOUT_TABLE, defaultValue: TABLE });
  caretIn(editor, "a1");
  const before = editor.getHTML();

  expect(altDownReachesBrowser(editor)).toBe(true);
  expect(editor.getHTML()).toBe(before);
});

function pasteHtml(editor: Editor, html: string) {
  act(() => void editor.view.pasteHTML(html, new Event("paste") as ClipboardEvent));
}

test("a pasted HTML table lands as a table with its merges and nothing else", () => {
  const { editor } = renderEditor();

  pasteHtml(editor, FOREIGN_TABLE);

  expect(editor.getHTML()).toMatch(/^<table><tbody>.*<\/tbody><\/table>$/);
  expect(editor.getHTML()).not.toMatch(FOREIGN_LEFTOVERS);
  expect(editor.getHTML()).toContain('<th colspan="2" data-align="center"><p>Head</p></th>');
  expect(editor.getHTML()).toContain('<td rowspan="2" data-align="right"><p>a</p></td>');
});

const WITHOUT_TABLE = TOOLS.filter((tool) => tool !== "table");

test("without the table tool a pasted table drops to its text and nothing offers one", () => {
  const { editor } = renderEditor({ tools: WITHOUT_TABLE });

  pasteHtml(editor, "<table><tr><th>Name</th></tr><tr><td>apple</td></tr></table>");

  expect(editor.getHTML()).not.toMatch(/table|<t[dhr]/);
  expect(editor.getText()).toContain("Name");
  expect(editor.getText()).toContain("apple");
  expect(screen.queryByRole("button", { name: "Table" })).toBeNull();

  focusField();
  type(editor, "/");
  expect(screen.queryByRole("option", { name: "Table" })).toBeNull();
});

test("the basic preset has no table", () => {
  renderEditor({ preset: "basic", defaultValue: TABLE });

  expect(screen.queryByRole("button", { name: "Table" })).toBeNull();
});

test("inserting a table from an empty cell puts it after the current table, not inside the cell", () => {
  const { editor } = renderEditor({ defaultValue: TABLE });
  focusField();
  caretIn(editor, "b2");
  act(
    () =>
      void editor.commands.deleteRange({
        from: editor.state.selection.from - 2,
        to: editor.state.selection.from,
      })
  );
  expect(here(editor)).toBe("");

  type(editor, "/table");
  press(editor, "Enter");

  const html = editor.getHTML();
  expect(html.match(/<table>/g)).toHaveLength(2);
  expect(html).toMatch(/<\/table><table>/);
  // The caret is in the first cell of the new table.
  expect(editor.isActive("tableHeader")).toBe(true);
});

test("the insert menu lists Table among the blocks to add, with no shortcut hint", () => {
  const { editor } = renderEditor();
  focusField();

  type(editor, "/");

  const insert = screen.getByRole("group", { name: "Insert" });
  expect(Array.from(insert.querySelectorAll('[role="option"]')).map((o) => o.textContent)).toEqual([
    "Code block```",
    "Divider---",
    "Table",
    "Image",
    "Layout",
    "Wrapper",
    "Collapsible block",
  ]);
});

test("a table with rows of unequal length is padded when the editor starts, without an onChange", async () => {
  const onChange = vi.fn();
  const { editor } = renderEditor({
    onChange,
    changeDelay: 0,
    defaultValue:
      "<table><tbody><tr><th>Head</th></tr><tr><td>a</td><td>b</td></tr></tbody></table>",
  });

  // The alignment runs on `create`, which Tiptap sends with a timer after mounting.
  await waitFor(() => expect(cells(editor).map((r) => r.length)).toEqual([2, 2]));
  expect(onChange).not.toHaveBeenCalled();
  // A command on an aligned table works: before the alignment, it threw.
  caretIn(editor, "a");
  act(() => void editor.commands.toggleHeaderRow());
  expect(editor.getHTML()).toContain("<td><p>Head</p></td>");
});

// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { tableCommands } from "../src/editor/features/table/tableActions.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Table column widths in the Editor's data (OLDSUI-310, ADR-0080): the `colgroup` is read on load and
 * on paste, written back, carried by the column commands and by JSON, and lost by Markdown. The
 * sanitizer side is in `editor-sanitize-table-column-width.test.tsx`; the menu, the keyboard and the
 * pointer handle are in `rich-text-editor-table-column-width-menu.test.tsx` and `…-handle.test.tsx`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

const cols = (...shares: number[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;

/** A table with the given column shares and one row of cells per entry of `rows`. */
const table = (colgroup: string, ...rows: string[][]) =>
  `<table>${colgroup}<tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td><p>${cell}</p></td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

const THREE = table(cols(35, 35, 30), ["a", "b", "c"], ["d", "e", "f"]);

/** The shares of the first table of the document. */
function sharesIn(editor: Editor): unknown {
  let shares: unknown = "no table";
  editor.state.doc.descendants((node) => {
    if (node.type.name === "table") {
      shares = node.attrs.shares;
      return false;
    }
    return true;
  });
  return shares;
}

function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

/* ── The Document ───────────────────────────────────────────────────── */

test("a table with widths is written back as it was read", () => {
  const { handle, editor } = renderEditor({ defaultValue: THREE });

  expect(handle.getHTML()).toBe(THREE);
  expect(sharesIn(editor)).toEqual([35, 35, 30]);
});

test("a table without widths stays as it was: no colgroup appears by itself", () => {
  const bare = table("", ["a", "b"], ["c", "d"]);
  const { handle, editor } = renderEditor({ defaultValue: bare });

  expect(handle.getHTML()).toBe(bare);
  expect(sharesIn(editor)).toBeNull();
});

test("a new table has no widths", () => {
  const { editor, handle } = renderEditor();

  act(() => void editor.commands.insertTable({ rows: 2, cols: 3, withHeaderRow: false }));

  expect(sharesIn(editor)).toBeNull();
  expect(handle.getHTML()).not.toContain("colgroup");
});

test("widths that break the rule are read as no widths: the table and its text stay", () => {
  for (const colgroup of [
    cols(35, 60),
    cols(33, 33, 34),
    cols(100, 0, 0),
    '<colgroup><col data-width="50"><col data-width="50" style="width:1px"><col></colgroup>',
  ]) {
    cleanup();
    const { handle, editor } = renderEditor({
      defaultValue: table(colgroup, ["a", "b", "c"]),
    });
    expect(sharesIn(editor), colgroup).toBeNull();
    expect(handle.getHTML(), colgroup).toBe(table("", ["a", "b", "c"]));
  }
});

test("widths for a different number of columns are dropped", () => {
  const { handle, editor } = renderEditor({
    defaultValue: table(cols(35, 65), ["a", "b", "c"], ["d", "e", "f"]),
  });

  expect(sharesIn(editor)).toBeNull();
  expect(handle.getHTML()).toBe(table("", ["a", "b", "c"], ["d", "e", "f"]));
});

test("widths count columns, not cells: a merged row is still three columns wide", () => {
  const merged =
    `<table>${cols(35, 35, 30)}<tbody><tr><td colspan="2"><p>ab</p></td><td><p>c</p></td></tr>` +
    "<tr><td><p>d</p></td><td><p>e</p></td><td><p>f</p></td></tr></tbody></table>";
  const { handle } = renderEditor({ defaultValue: merged });

  expect(handle.getHTML()).toBe(merged);
});

test("a foreign colgroup is turned into shares; style and the pixels themselves are not kept", () => {
  const { handle } = renderEditor({
    defaultValue:
      '<table style="width:100%"><colgroup><col width="176" style="width:132pt"><col width="112" ' +
      'style="width:84pt"><col width="112" style="width:84pt"></colgroup><tbody><tr><td><p>a</p></td>' +
      "<td><p>b</p></td><td><p>c</p></td></tr></tbody></table>",
  });

  expect(handle.getHTML()).toBe(table(cols(45, 30, 25), ["a", "b", "c"]));
});

test("a foreign colgroup with a missing width leaves the table to the content", () => {
  const { handle } = renderEditor({
    defaultValue:
      '<table><colgroup><col style="width:30%"><col></colgroup><tbody><tr><td><p>a</p></td>' +
      "<td><p>b</p></td></tr></tbody></table>",
  });

  expect(handle.getHTML()).toBe(table("", ["a", "b"]));
});

/* ── Editing the structure ──────────────────────────────────────────── */

test("merging and splitting cells leave the widths alone", () => {
  const { editor, handle } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "a");

  act(
    () =>
      void editor.commands.setCellSelection({
        anchorCell: tableCell(editor, "a"),
        headCell: tableCell(editor, "b"),
      })
  );
  act(() => void editor.commands.mergeCells());
  expect(sharesIn(editor)).toEqual([35, 35, 30]);
  expect(handle.getHTML()).toContain(cols(35, 35, 30));

  act(() => void editor.commands.splitCell());
  expect(sharesIn(editor)).toEqual([35, 35, 30]);
});

/** The position of the cell that holds this text. */
function tableCell(editor: Editor, text: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === "tableCell" && node.textContent === text) found = pos;
  });
  if (found < 0) throw new Error(`no cell "${text}"`);
  return found;
}

test("inserting a column takes half of the share beside it", () => {
  const { editor, handle } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "b");

  act(() => void editor.commands.addColumnBefore());
  // Beside the 35% column "b": 15% for the new one, 20% stays with "b".
  expect(sharesIn(editor)).toEqual([35, 15, 20, 30]);
  expect(handle.getHTML()).toContain(cols(35, 15, 20, 30));

  act(() => void editor.commands.undo());
  expect(sharesIn(editor)).toEqual([35, 35, 30]);
});

test("a column inserted on the right is taken from the column under the caret", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "c");

  act(() => void editor.commands.addColumnAfter());

  expect(sharesIn(editor)).toEqual([35, 35, 15, 15]);
});

test("beside a column at 5% the widest column gives its step", () => {
  const { editor } = renderEditor({ defaultValue: table(cols(5, 95), ["a", "b"]) });
  caretIn(editor, "a");

  act(() => void editor.commands.addColumnAfter());

  expect(sharesIn(editor)).toEqual([5, 5, 90]);
});

test("deleting a column gives its share to the left neighbour, the first column to the new first", () => {
  const { editor, handle } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "b");
  act(() => void editor.commands.deleteColumn());
  expect(sharesIn(editor)).toEqual([70, 30]);
  expect(handle.getHTML()).toBe(table(cols(70, 30), ["a", "c"], ["d", "f"]));

  cleanup();
  const second = renderEditor({ defaultValue: THREE });
  caretIn(second.editor, "a");
  act(() => void second.editor.commands.deleteColumn());
  expect(sharesIn(second.editor)).toEqual([70, 30]);
});

test("deleting down to one column leaves no widths", () => {
  const { editor, handle } = renderEditor({ defaultValue: table(cols(40, 60), ["a", "b"]) });
  caretIn(editor, "b");

  act(() => void editor.commands.deleteColumn());

  expect(sharesIn(editor)).toBeNull();
  expect(handle.getHTML()).toBe(table("", ["a"]));
});

test("a column added to a table without widths adds none", () => {
  const { editor } = renderEditor({ defaultValue: table("", ["a", "b"]) });
  caretIn(editor, "a");

  act(() => void editor.commands.addColumnAfter());

  expect(sharesIn(editor)).toBeNull();
});

test("a paste that grows the table past its widths drops them instead of sizing wrongly", () => {
  const { editor } = renderEditor({ defaultValue: table(cols(40, 60), ["a", "b"]) });
  caretIn(editor, "a");

  // Anything that changes the column count other than the two commands: the guard repairs it.
  act(() => {
    editor.chain().addColumnAfter().run();
    const { state, view } = editor;
    let tablePos = -1;
    state.doc.descendants((node, pos) => {
      if (node.type.name === "table") tablePos = pos;
    });
    view.dispatch(state.tr.setNodeMarkup(tablePos, undefined, { shares: [40, 60] }));
  });

  expect(sharesIn(editor)).toBeNull();
});

test("sorting the rows keeps the widths", () => {
  const { editor, handle } = renderEditor({
    defaultValue: table(cols(40, 60), ["h1", "h2"], ["b", "2"], ["a", "1"]).replace(
      /<tr><td><p>h1<\/p><\/td><td><p>h2<\/p><\/td><\/tr>/,
      "<tr><th><p>h1</p></th><th><p>h2</p></th></tr>"
    ),
  });
  caretIn(editor, "b");

  const sorted = tableCommands("en").sortAscending(editor.state, editor.view.dispatch);

  expect(sorted).toBe(true);
  expect(handle.getHTML()).toContain(cols(40, 60));
  expect(handle.getHTML().indexOf("<p>a</p>")).toBeLessThan(handle.getHTML().indexOf("<p>b</p>"));
  expect(sharesIn(editor)).toEqual([40, 60]);
});

/* ── Other formats ──────────────────────────────────────────────────── */

test("Markdown loses the widths and keeps the table", () => {
  const { handle } = renderEditor({
    defaultValue: table(cols(35, 65), ["h1", "h2"], ["a", "b"]).replace(/<td>/g, "<td>"),
  });

  const markdown = handle.getMarkdown();
  expect(markdown).toContain("| h1");
  expect(markdown).not.toMatch(/colgroup|data-width|35|65/);
});

test("a table read from Markdown has no widths", () => {
  const { handle, editor } = renderEditor();

  act(() => void handle.setMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |"));

  expect(sharesIn(editor)).toBeNull();
  expect(handle.getHTML()).not.toContain("colgroup");
});

test("JSON keeps the widths both ways", () => {
  const { handle, editor } = renderEditor({ defaultValue: THREE });

  const json = handle.getJSON();
  expect(JSON.stringify(json)).toContain('"shares":[35,35,30]');

  cleanup();
  const other = renderEditor({ defaultValue: "<p>x</p>" });
  act(() => void other.handle.setJSON(json));
  expect(sharesIn(other.editor)).toEqual([35, 35, 30]);
  expect(other.handle.getHTML()).toBe(THREE);
  expect(other.handle.getJSON()).toEqual(json);
  expect(editor).toBeTruthy();
});

test("JSON with shares that cannot be right loads the table without them", () => {
  const { handle } = renderEditor({ defaultValue: THREE });
  const json = JSON.parse(JSON.stringify(handle.getJSON())) as {
    doc: { content: { attrs: { shares: unknown } }[] };
  };

  for (const bad of [[35, 35], [33, 33, 34], "wide", [100], null]) {
    json.doc.content[0]!.attrs.shares = bad;
    const other = renderEditor({ defaultValue: "<p>x</p>" });
    act(() => void other.handle.setJSON(json));
    expect(sharesIn(other.editor), JSON.stringify(bad)).toBeNull();
    other.unmount();
  }
});

test("a change of widths reaches onChange and is one step of history", async () => {
  const changes: string[] = [];
  const { editor } = renderEditor({ defaultValue: THREE, onChange: (html) => changes.push(html) });
  caretIn(editor, "a");

  act(() => void editor.commands.addColumnAfter());
  await waitFor(() => expect(changes.at(-1)).toContain(cols(20, 15, 35, 30)));

  act(() => void editor.commands.undo());
  expect(sharesIn(editor)).toEqual([35, 35, 30]);
});

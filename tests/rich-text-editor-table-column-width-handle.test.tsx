// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

// Lazy `codeBlock` and `table` (OLDSUI-111): `full` is ready in `render` after the chunks load.
beforeAll(loadLazyBuiltins);

/**
 * The column width handle (OLDSUI-310, ADR-0080, decision 4). jsdom has no layout, so the cells' boxes
 * are stubbed from the table's structure: every column is 100 px wide and every row 20 px tall,
 * starting at the frame's top left. What the test checks is the handle's logic (which bars, what a
 * drag writes, how it snaps); that the bars sit on the real edges in real browsers is for Playwright.
 */

const COLUMN_PX = 100;
const ROW_PX = 20;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement
  ) {
    const box = (left: number, top: number, width: number, height: number) =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    if (this.tagName === "TD" || this.tagName === "TH") {
      const row = this.parentElement!;
      const rows = Array.from(row.parentElement!.children);
      const span = Number(this.getAttribute("colspan")) || 1;
      let column = 0;
      for (const cell of Array.from(row.children)) {
        if (cell === this) break;
        column += Number(cell.getAttribute("colspan")) || 1;
      }
      return box(column * COLUMN_PX, rows.indexOf(row) * ROW_PX, span * COLUMN_PX, ROW_PX);
    }
    if (this.tagName === "TABLE") {
      const rows = this.querySelectorAll(":scope > tbody > tr").length;
      const first = this.querySelector("tr")!;
      const columns = Array.from(first.children).reduce(
        (sum, cell) => sum + (Number(cell.getAttribute("colspan")) || 1),
        0
      );
      return box(0, 0, columns * COLUMN_PX, rows * ROW_PX);
    }
    return box(0, 0, 0, 0);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, ref, editor, handle: ref.current! };
}

const cols = (...shares: number[]) =>
  `<colgroup>${shares.map((share) => `<col data-width="${share}">`).join("")}</colgroup>`;
const row = (...cells: string[]) =>
  `<tr>${cells.map((cell) => `<td><p>${cell}</p></td>`).join("")}</tr>`;
const table = (colgroup: string, ...rows: string[]) =>
  `<table>${colgroup}<tbody>${rows.join("")}</tbody></table>`;

const BARE = table("", row("a", "b", "c"), row("d", "e", "f"));
const SIZED = table(cols(40, 30, 30), row("a", "b", "c"), row("d", "e", "f"));

function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

const bars = () => Array.from(document.querySelectorAll<HTMLElement>("[data-column-handle]"));
const bar = (boundary: number) => {
  const found = bars().find((candidate) => candidate.dataset.columnHandle === String(boundary));
  if (!found) throw new Error(`no bar for boundary ${boundary}`);
  return found;
};

/** The bars appear on the next animation frame after the caret moves into a table. */
async function waitForBars(count: number) {
  await waitFor(() => expect(bars()).toHaveLength(count));
}

const pointer = (clientX: number) => ({ button: 0, clientX, pointerId: 1 });

function dragBar(boundary: number, from: number, to: number) {
  fireEvent.pointerDown(bar(boundary), pointer(from));
  fireEvent.pointerMove(bar(boundary), pointer(to));
  fireEvent.pointerUp(bar(boundary), pointer(to));
}

const announced = () => screen.getByRole("status").textContent;

test("a bar sits on every boundary between two columns of the table with the caret, none at the right edge", async () => {
  const { editor } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a");

  await waitForBars(2);

  expect(bars().map((element) => element.dataset.columnHandle)).toEqual(["1", "2"]);
  // Positions come from the cells' right edges: 100 and 200 px (the frame starts at 0).
  expect(bars().map((element) => element.style.left)).toEqual(["100px", "200px"]);
});

test("a one-column table, a paragraph and a read-only field have no bars", async () => {
  const single = renderEditor({ defaultValue: table("", row("a"), row("b")) });
  caretIn(single.editor, "a");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(bars()).toHaveLength(0);
  single.unmount();

  const outside = renderEditor({ defaultValue: `<p>text</p>${BARE}` });
  caretIn(outside.editor, "text");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(bars()).toHaveLength(0);
  outside.unmount();

  const readOnly = renderEditor({ defaultValue: BARE, readOnly: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(bars()).toHaveLength(0);
  expect(readOnly.container.querySelector("[data-table-column-handles]")).toBeNull();
});

test("the bars are for the pointer: hidden from assistive technology and outside the Tab order", async () => {
  const { editor, container } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a");
  await waitForBars(2);

  const layer = container.querySelector("[data-table-column-handles]")!;
  expect(layer.getAttribute("aria-hidden")).toBe("true");
  for (const element of bars()) {
    expect(element.hasAttribute("tabindex")).toBe(false);
    expect(element.matches("a, button, input, [role], [tabindex]")).toBe(false);
  }
});

test("hovering a table shows its bars although the caret is elsewhere", async () => {
  const { editor, container } = renderEditor({ defaultValue: `<p>text</p>${BARE}` });
  caretIn(editor, "text");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(bars()).toHaveLength(0);

  fireEvent.pointerOver(container.querySelector("td")!);
  await waitForBars(2);

  fireEvent.pointerLeave(editor.view.dom);
  await waitFor(() => expect(bars()).toHaveLength(0));
});

test("dragging in a table without widths rounds all of them first, then moves the boundary once", async () => {
  const { editor, handle } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a");
  await waitForBars(2);

  // The columns are 100 px each: 35/35/30 once rounded. The first boundary is dragged from 100 px to
  // 140 px of the 200 px that the two columns around it share (70%): 140/200 of 70 is 49, so 50.
  dragBar(1, 100, 140);

  expect(handle.getHTML()).toBe(table(cols(50, 20, 30), row("a", "b", "c"), row("d", "e", "f")));
  expect(announced()).toBe("Column width: 50%");
});

test("the drag is one undo step that takes the widths away again", async () => {
  const { editor, handle } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a");
  await waitForBars(2);

  dragBar(1, 100, 140);
  act(() => void editor.commands.undo());

  expect(handle.getHTML()).toBe(BARE);
});

test("a table with widths: the boundary snaps to 5% when the pointer is released", async () => {
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a");
  await waitForBars(2);

  // Boundary 2 shares 60% over 200 px (100 to 300 px). Released at 255 px: 155/200 of 60 is 46.5,
  // which snaps to 45, leaving 15% for the third column.
  dragBar(2, 200, 255);

  expect(handle.getHTML()).toBe(table(cols(40, 45, 15), row("a", "b", "c"), row("d", "e", "f")));
  act(() => void editor.commands.undo());
  expect(handle.getHTML()).toBe(SIZED);
});

test("the two columns around the boundary keep their sum, and each keeps 5%", async () => {
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a");
  await waitForBars(2);

  dragBar(1, 100, 10_000);
  expect(handle.getHTML()).toContain(cols(65, 5, 30));

  act(() => void editor.commands.undo());
  caretIn(editor, "a");
  await waitFor(() => expect(bars()).toHaveLength(2));
  dragBar(1, 100, -10_000);
  expect(handle.getHTML()).toContain(cols(5, 65, 30));
});

test("the bar follows the pointer smoothly while the Document waits for the release", async () => {
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a");
  await waitForBars(2);

  fireEvent.pointerDown(bar(1), pointer(100));
  fireEvent.pointerMove(bar(1), pointer(123));

  // 23 px is no step of 5%, and the bar is where the pointer is; the Document still has its widths.
  expect(bar(1).style.left).toBe("123px");
  expect(handle.getHTML()).toContain(cols(40, 30, 30));

  fireEvent.pointerUp(bar(1), pointer(123));
  // 123/200 of the 70% the two columns share is 43, which snaps to 45.
  await waitFor(() => expect(handle.getHTML()).toContain(cols(45, 25, 30)));
});

test("a click on a bar, a drag back to where it was and a cancelled drag change nothing", async () => {
  const { editor, handle } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "a");
  await waitForBars(2);

  fireEvent.pointerDown(bar(1), pointer(100));
  fireEvent.pointerUp(bar(1), pointer(100));
  // Snaps back to 40/30: the same shares, no edit.
  dragBar(1, 100, 101);
  fireEvent.pointerDown(bar(1), pointer(100));
  fireEvent.pointerMove(bar(1), pointer(160));
  fireEvent.pointerCancel(bar(1), pointer(160));

  expect(handle.getHTML()).toBe(SIZED);
  expect(editor.can().undo()).toBe(false);
});

test("a table that had no widths still gets them when the bar snaps back", async () => {
  const { editor, handle } = renderEditor({ defaultValue: BARE });
  caretIn(editor, "a");
  await waitForBars(2);

  // Moved 4 px (a drag), which snaps back to 35: the table now has its rounded widths.
  dragBar(1, 100, 104);

  expect(handle.getHTML()).toBe(table(cols(35, 35, 30), row("a", "b", "c"), row("d", "e", "f")));
});

test("the field keeps its focus and caret while a bar is used", async () => {
  const { editor } = renderEditor({ defaultValue: SIZED });
  caretIn(editor, "b");
  await waitForBars(2);
  const before = editor.state.selection.from;

  const down = fireEvent.pointerDown(bar(1), pointer(100));

  // `preventDefault` on the press: the browser does not move focus or the selection to the bar.
  expect(down).toBe(false);
  expect(editor.state.selection.from).toBe(before);
});

test("a disabled field has no bars", async () => {
  renderEditor({ defaultValue: SIZED, disabled: true });
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(bars()).toHaveLength(0);
});

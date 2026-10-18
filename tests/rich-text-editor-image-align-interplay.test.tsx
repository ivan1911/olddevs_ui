// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../src/editor/index.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Image alignment next to the other Tools of the epic (OLDSUI-311 with OLDSUI-307 and OLDSUI-310),
 * through the public `RichTextEditor` with the `full` preset: Block selection selects, duplicates
 * and moves an aligned image whole, and a table with column widths takes no alignment from an image.
 */
function renderEditor(value: string) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={value} />);
  return ref.current!.editor!;
}

const PHOTO = "https://cdn.example.com/photo.png";
const figure = (caption = "") =>
  `<figure data-align="left"><img src="${PHOTO}" alt="A lake" data-width="33">` +
  (caption ? `<figcaption>${caption}</figcaption>` : "") +
  "</figure>";

function press(
  editor: Editor,
  key: string,
  init: { shift?: boolean; mod?: boolean; alt?: boolean }
) {
  const codes: Record<string, number> = { Escape: 27, ArrowDown: 40, d: 68 };
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

function figurePos(editor: Editor): number {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image") at = pos;
  });
  return at;
}

const DOC = `<p>Text</p>${figure()}<p>After</p>`;

test("Esc with the aligned image selected selects it as one Block", () => {
  const editor = renderEditor(DOC);
  act(() => {
    editor.view.focus();
    editor.commands.setNodeSelection(figurePos(editor));
  });

  press(editor, "Escape", {});

  const block = editor.state.selection as BlockSelection;
  expect(block).toBeInstanceOf(BlockSelection);
  expect(block.count).toBe(1);
  expect(block.nodeRange().parent.child(block.nodeRange().startIndex).type.name).toBe("image");
});

test("Esc with the caret in the caption selects the figure, not the caption", () => {
  const editor = renderEditor(`<p>Text</p>${figure("Dawn")}<p>After</p>`);
  let caret = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === "Dawn") caret = pos + node.nodeSize;
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(caret);
  });

  press(editor, "Escape", {});

  const block = editor.state.selection as BlockSelection;
  expect(block).toBeInstanceOf(BlockSelection);
  expect(block.count).toBe(1);
  expect(block.nodeRange().parent.child(block.nodeRange().startIndex).type.name).toBe("image");
});

test("Ctrl+Shift+D duplicates the aligned image with its side and width, and Alt+Shift+Down moves it", () => {
  const editor = renderEditor(DOC);
  act(() => {
    editor.view.focus();
    editor.commands.setNodeSelection(figurePos(editor));
  });
  press(editor, "Escape", {});

  press(editor, "d", { mod: true, shift: true });
  expect(editor.getHTML()).toBe(`<p>Text</p>${figure()}${figure()}<p>After</p>`);

  press(editor, "ArrowDown", { alt: true, shift: true });
  expect(editor.getHTML()).toBe(`<p>Text</p>${figure()}<p>After</p>${figure()}`);
  // The moved figure is still the selected Block.
  expect((editor.state.selection as BlockSelection).count).toBe(1);
});

test("Ctrl+Shift+R on the selected image aligns it and leaves its neighbours alone", () => {
  const editor = renderEditor(DOC);
  act(() => {
    editor.view.focus();
    editor.commands.setNodeSelection(figurePos(editor));
  });

  // Ctrl+Shift+R on the selected image: right, 33% kept; the neighbours are untouched.
  const event = new KeyboardEvent("keydown", {
    key: "R",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "keyCode", { value: 82 });
  act(() => void editor.view.dom.dispatchEvent(event));

  expect(editor.getHTML()).toBe(
    `<p>Text</p>${figure().replace('data-align="left"', 'data-align="right"')}<p>After</p>`
  );
});

const CELL_TABLE =
  '<table><colgroup><col data-width="40"><col data-width="60"></colgroup><tbody><tr>' +
  `<td><p>a</p>${figure()}</td><td><p>b</p></td></tr></tbody></table>`;

test("an image in a cell of a table with column widths keeps its data-align, and the toggles are off", async () => {
  const editor = renderEditor(CELL_TABLE);

  // The Document keeps what arrived; only the styles ignore it (the reset is in `prose.ts`).
  expect(editor.getHTML()).toContain('<figure data-align="left"><img');
  expect(editor.getHTML()).toContain(
    '<colgroup><col data-width="40"><col data-width="60"></colgroup>'
  );
  act(() => {
    editor.view.focus();
    editor.commands.setNodeSelection(figurePos(editor));
  });
  const toolbar = await screen.findByRole("toolbar", { name: "Image" });
  for (const name of ["Left, text wraps around", "Center", "Right, text wraps around"]) {
    expect(within(toolbar).getByRole("button", { name }).hasAttribute("disabled"), name).toBe(true);
  }
  // The centre is what is pressed there: the float does not apply.
  expect(within(toolbar).getByRole("button", { name: "Center" }).getAttribute("aria-pressed")).toBe(
    "true"
  );

  // Neither the keys nor the command change the side in a cell.
  act(() => void editor.chain().updateImage({ align: "right" }).run());
  expect(editor.getHTML()).toContain('<figure data-align="left"><img');
});

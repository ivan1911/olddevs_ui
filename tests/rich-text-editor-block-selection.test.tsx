// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  expect(announced()).toBe("Blocks copied: 1");

  const cut = new Event("cut", { bubbles: true, cancelable: true });
  Object.defineProperty(cut, "clipboardData", { value: clipboardData });
  act(() => void editor.view.dom.dispatchEvent(cut));
  expect(editor.getHTML()).toBe("<p>One</p><p>Three</p>");
  expect(announced()).toBe("Blocks cut: 1");
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
  expect(announced()).toBe("Blocks replaced: 1");
});

// --- Containers: the unit and the borders ---------------------------------------------

const column = (...blocks: string[]) => `<div data-block="column">${blocks.join("")}</div>`;
const layout = (...columns: string[]) =>
  `<div data-block="layout" data-layout="50-50">${columns.join("")}</div>`;
const wrapper = (...blocks: string[]) => `<div data-block="wrapper">${blocks.join("")}</div>`;
const nameOf = (editor: Editor) => {
  const block = selection(editor) as BlockSelection;
  const range = block.nodeRange();
  return range.parent.child(range.startIndex).type.name;
};

test("past the edge of a column the selection becomes the whole Column layout", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${layout(column("<p>L1</p>", "<p>L2</p>"), column("<p>R1</p>"))}<p>After</p>`,
  });
  caretIn(editor, "L1");
  press(editor, "Escape");
  expect((selection(editor) as BlockSelection).nodeRange().parent.type.name).toBe("layoutColumn");

  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(2);
  // L2 is the last Block of the column: one more press selects the Column layout whole.
  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(1);
  expect(nameOf(editor)).toBe("layout");

  // And the next one goes on at the Document's level.
  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(2);
  expect((selection(editor) as BlockSelection).nodeRange().parent.type.name).toBe("doc");
});

test("past the edge of a Wrapper the selection becomes the Wrapper whole", () => {
  const { editor } = renderEditor({
    defaultValue: `<p>Before</p>${wrapper("<p>In</p>")}<p>After</p>`,
  });
  caretIn(editor, "In");
  press(editor, "Escape");

  press(editor, "ArrowUp", { shift: true });

  expect(selectedCount(editor)).toBe(1);
  expect(nameOf(editor)).toBe("wrapper");
  press(editor, "ArrowUp", { shift: true });
  expect(selectedCount(editor)).toBe(2);
});

test("past the edge of a list the selection becomes the whole list", () => {
  const { editor } = renderEditor({
    defaultValue: "<p>Before</p><ul><li><p>a</p></li><li><p>b</p></li></ul>",
  });
  caretIn(editor, "b");
  press(editor, "Escape");
  expect(nameOf(editor)).toBe("listItem");

  press(editor, "ArrowDown", { shift: true });

  expect(nameOf(editor)).toBe("bulletList");
});

test("a Block in a Wrapper is selected inside it: the neighbours are the Wrapper's own", () => {
  const { editor } = renderEditor({ defaultValue: wrapper("<p>One</p><p>Two</p>") });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  expect(selectedCount(editor)).toBe(2);
  expect((selection(editor) as BlockSelection).nodeRange().parent.type.name).toBe("wrapper");
});

// --- Look ------------------------------------------------------------------------------

test("the selected Blocks are marked whole and the root marks the mode; the DOM carries no caret hint", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  const root = editor.view.dom;
  expect(root.hasAttribute("data-block-selection")).toBe(true);
  const marked = Array.from(root.querySelectorAll(".rte-block-selected"));
  expect(marked.map((node) => node.textContent)).toEqual(["One", "Two"]);

  press(editor, "Enter");
  expect(root.hasAttribute("data-block-selection")).toBe(false);
  expect(root.querySelector(".rte-block-selected")).toBeNull();
});

// --- The selection survives other edits -------------------------------------------------

test("an edit above the Blocks moves the selection along with them", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  const { schema } = editor.state;
  act(() =>
    editor.view.dispatch(
      editor.state.tr.insert(0, schema.nodes.paragraph!.create(null, schema.text("New")))
    )
  );

  const block = selection(editor) as BlockSelection;
  expect(selection(editor)).toBeInstanceOf(BlockSelection);
  expect(editor.state.doc.textBetween(block.from, block.to)).toBe("Two");
});

test("deleting the selected Blocks from outside ends the selection with a caret", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  act(() => void editor.commands.deleteRange({ from: 5, to: 10 }));

  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
});

// --- Announcements -------------------------------------------------------------------------

test("the screen reader hears the count, the end of the selection and the result of an action", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");

  press(editor, "Escape");
  expect(announced()).toBe("Blocks selected: 1");
  press(editor, "ArrowDown", { shift: true });
  expect(announced()).toBe("Blocks selected: 2");
  press(editor, "Enter");
  expect(announced()).toBe("Block selection cleared");

  press(editor, "Escape");
  press(editor, "Backspace");
  expect(announced()).toBe("Blocks deleted: 1");
});

test("the announcements speak the provider's language", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <UiProvider messages={ru}>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={THREE} />
    </UiProvider>
  );
  const editor = ref.current!.editor!;
  caretIn(editor, "One");

  press(editor, "Escape");

  expect(announced()).toBe(ru.editor.blocksSelected({ count: 1 }));
});

// --- Layers: Dialog and Drawer (ADR-0041) ----------------------------------------------------

test.each([
  [
    "Dialog",
    (onClose: () => void, child: React.ReactNode) => (
      <Dialog open onClose={onClose} title="Edit">
        {child}
      </Dialog>
    ),
  ],
  [
    "Drawer",
    (onClose: () => void, child: React.ReactNode) => (
      <Drawer open onClose={onClose} title="Edit">
        {child}
      </Drawer>
    ),
  ],
] as const)(
  "in a %s the first Esc selects the Block and the second closes the layer",
  async (_, wrap) => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const ref = createRef<RichTextEditorHandle>();
    render(wrap(onClose, <RichTextEditor ref={ref} aria-label="Body" defaultValue={THREE} />));
    const editor = ref.current!.editor!;
    caretIn(editor, "Two");

    await user.keyboard("{Escape}");
    expect(selectedCount(editor)).toBe(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
    expect(onClose).toHaveBeenCalledTimes(1);
  }
);

test("without the Tool a field in a Dialog keeps the one-Escape close", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Comment">
      <RichTextEditor ref={ref} aria-label="Body" preset="basic" defaultValue={THREE} />
    </Dialog>
  );
  caretIn(ref.current!.editor!, "Two");

  await user.keyboard("{Escape}");

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("an open layer of the Editor keeps its own Esc: the Slash menu closes, nothing is selected", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  const ref = createRef<RichTextEditorHandle>();
  render(
    <Dialog open onClose={onClose} title="Edit">
      <RichTextEditor ref={ref} aria-label="Body" defaultValue="<p></p>" />
    </Dialog>
  );
  const editor = ref.current!.editor!;
  act(() => editor.view.focus());
  await user.keyboard("/");
  await screen.findByRole("listbox");

  await user.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  expect(onClose).not.toHaveBeenCalled();
});

// --- readOnly and disabled --------------------------------------------------------------------

test("readOnly keeps the selection and the copy, and no key that changes the Document", () => {
  const { editor } = renderEditor({ readOnly: true, defaultValue: THREE });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(3);
  });

  press(editor, "Escape");
  expect(selectedCount(editor)).toBe(1);
  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(2);

  press(editor, "Backspace");
  press(editor, "d", { mod: true, shift: true });
  expect(editor.getHTML()).toBe(THREE);
  expect(selectedCount(editor)).toBe(2);

  const data = new Map<string, string>();
  const copy = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(copy, "clipboardData", {
    value: {
      setData: (type: string, value: string) => void data.set(type, value),
      clearData: () => data.clear(),
    },
  });
  act(() => void editor.view.dom.dispatchEvent(copy));
  expect(data.get("text/plain")).toBe("One\n\nTwo");
  // The handle is not mounted in a read-only field.
  expect(screen.queryByRole("button", { name: "Block actions" })).toBeNull();
});

test("a disabled field does nothing", () => {
  const { editor } = renderEditor({ disabled: true, defaultValue: THREE });
  act(() => editor.commands.setTextSelection(3));

  const event = press(editor, "Escape");

  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  expect(event.defaultPrevented).toBe(false);
  expect(editor.commands.selectBlocks()).toBe(false);
});

// --- Mouse, touch -----------------------------------------------------------------------------

const paragraph = (editor: Editor, text: string) =>
  Array.from(editor.view.dom.querySelectorAll("p")).find((node) => node.textContent === text)!;

test("Shift+click on another Block draws the selection to it", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");

  fireEvent.mouseDown(paragraph(editor, "Three"), { shiftKey: true });

  expect(selectedCount(editor)).toBe(3);
  fireEvent.mouseDown(paragraph(editor, "Two"), { shiftKey: true });
  expect(selectedCount(editor)).toBe(2);
});

test("Shift+click above the anchor grows the selection upwards", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Three");
  press(editor, "Escape");

  fireEvent.mouseDown(paragraph(editor, "One"), { shiftKey: true });

  const block = selection(editor) as BlockSelection;
  expect(block.count).toBe(3);
  expect(block.forward).toBe(false);
});

test("Shift+click in another column lifts the selection to the Column layout", () => {
  const { editor } = renderEditor({
    defaultValue: layout(column("<p>L1</p>", "<p>L2</p>"), column("<p>R1</p>")),
  });
  caretIn(editor, "L1");
  press(editor, "Escape");

  fireEvent.mouseDown(paragraph(editor, "R1"), { shiftKey: true });

  expect(selectedCount(editor)).toBe(1);
  expect(nameOf(editor)).toBe("layout");
});

/** jsdom has no layout: the engine's own mouse handling asks where a point is, and finds nothing. */
function noPointLookup() {
  const doc = document as unknown as { elementFromPoint?: () => null };
  doc.elementFromPoint = () => null;
  return () => void delete doc.elementFromPoint;
}

test("a plain click leaves the mode with a caret", () => {
  const restore = noPointLookup();
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");

  fireEvent.mouseDown(paragraph(editor, "Three"));
  restore();

  // The engine places the caret itself; the click does not extend the Blocks.
  expect(selectedCount(editor)).toBe(1);
});

function tap(editor: Editor, target: HTMLElement) {
  const down = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(down, "pointerType", { value: "touch" });
  act(() => void editor.view.dom.dispatchEvent(down));
  fireEvent.mouseDown(target);
}

test("on a touch screen a tap on another Block draws the selection to it, a tap in a selected Block is a caret", () => {
  const restore = noPointLookup();
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  act(() => void editor.commands.selectBlocks());

  tap(editor, paragraph(editor, "Three"));
  expect(selectedCount(editor)).toBe(3);

  // A tap in the text of a selected Block is left to the engine: the selection is not extended.
  tap(editor, paragraph(editor, "Two"));
  restore();
  expect(selectedCount(editor)).toBe(3);
});

test("the selected Blocks cannot be dragged away, and typing through an input method is cancelled", () => {
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "Two");
  press(editor, "Escape");

  const drag = new Event("dragstart", { bubbles: true, cancelable: true });
  act(() => void editor.view.dom.dispatchEvent(drag));
  expect(drag.defaultPrevented).toBe(true);

  const input = new Event("beforeinput", { bubbles: true, cancelable: true });
  Object.defineProperty(input, "inputType", { value: "insertText" });
  act(() => void editor.view.dom.dispatchEvent(input));
  expect(input.defaultPrevented).toBe(true);
  expect(editor.getHTML()).toBe(THREE);
});

// --- State and commands ---------------------------------------------------------------------------

/** The result of a command called inside `act`. */
function run<T>(command: () => T): T {
  let result!: T;
  act(() => {
    result = command();
  });
  return result;
}

function Probe({ handle }: { handle: React.RefObject<RichTextEditorHandle | null> }) {
  const count = useRichTextToolState(handle, "blockSelection", (state) => state.count);
  return <output data-testid="count">{count === null ? "null" : String(count)}</output>;
}

test("the state is the number of selected Blocks, and the commands select and clear", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <>
      <RichTextEditor ref={ref} aria-label="Body" defaultValue={THREE} />
      <Probe handle={ref} />
    </>
  );
  const editor = ref.current!.editor!;
  const count = () => screen.getByTestId("count").textContent;
  caretIn(editor, "Two");
  expect(count()).toBe("0");

  const commands = ref.current!.tool("blockSelection")!;
  expect(run(() => commands.selectCurrent())).toBe(true);
  expect(count()).toBe("1");
  expect(selectedCount(editor)).toBe(1);

  press(editor, "ArrowDown", { shift: true });
  expect(count()).toBe("2");

  expect(run(() => commands.clear())).toBe(true);
  expect(count()).toBe("0");
  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  // Nothing to clear the second time.
  expect(run(() => commands.clear())).toBe(false);
});

test("without the Tool there is no state and no commands", () => {
  const ref = createRef<RichTextEditorHandle>();
  render(
    <>
      <RichTextEditor ref={ref} aria-label="Body" preset="basic" defaultValue={THREE} />
      <Probe handle={ref} />
    </>
  );
  expect(screen.getByTestId("count").textContent).toBe("null");
  expect(ref.current!.tool("blockSelection")).toBeNull();
});

test("selectCurrent is false in Source mode", async () => {
  const user = userEvent.setup();
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" defaultValue={THREE} />);
  await user.click(screen.getByRole("button", { name: "HTML" }));

  expect(ref.current!.tool("blockSelection")!.selectCurrent()).toBe(false);
});

// --- No trace in the Document ------------------------------------------------------------------

test("the mode leaves no trace in the HTML, Markdown or JSON, and does not call onChange", () => {
  const onChange = vi.fn();
  const { ref, editor } = renderEditor({ defaultValue: THREE, onChange });
  const before = {
    html: ref.current!.getHTML(),
    markdown: ref.current!.getMarkdown(),
    json: ref.current!.getJSON(),
  };
  caretIn(editor, "Two");

  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  expect(selectedCount(editor)).toBe(2);
  expect(ref.current!.getHTML()).toBe(before.html);
  expect(ref.current!.getMarkdown()).toBe(before.markdown);
  expect(ref.current!.getJSON()).toEqual(before.json);
  expect(onChange).not.toHaveBeenCalled();
});

test("a Tool list without blockSelection has no mode: Esc does nothing", () => {
  const { editor } = renderEditor({ tools: ["bold", "italic"], defaultValue: THREE });
  caretIn(editor, "Two");

  press(editor, "Escape");

  expect(selection(editor)).not.toBeInstanceOf(BlockSelection);
  expect(selection(editor).empty).toBe(true);
});

// --- The handle menu and the Toolbar over a Block selection -------------------------------------

/** Three Blocks selected the way a user does: `Esc`, then `Shift+↓` twice. */
function selectThree(editor: Editor) {
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });
  press(editor, "ArrowDown", { shift: true });
  expect(selectedCount(editor)).toBe(3);
}

test("Mod+/ over three selected Blocks opens the handle menu, and Duplicate copies all three in one edit", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  selectThree(editor);

  const slash = new KeyboardEvent("keydown", {
    key: "/",
    code: "Slash",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(slash, "keyCode", { value: 191 });
  act(() => void editor.view.dom.dispatchEvent(slash));
  expect(slash.defaultPrevented).toBe(true);

  const menu = await screen.findByRole("menu", { name: "Block actions" });
  await user.click(within(menu).getByRole("menuitem", { name: /^Duplicate/ }));

  expect(editor.getHTML()).toBe(THREE + THREE);
  expect(announced()).toBe("Blocks duplicated: 3");
  // The copy is selected, and one undo takes it away whole.
  expect(selectedCount(editor)).toBe(3);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe(THREE);
});

test("the Bold button makes the text of every selected Block bold in one edit, and the Blocks stay selected", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p><p>Three</p>" });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  await user.click(screen.getByRole("button", { name: "Bold" }));

  expect(editor.getHTML()).toBe(
    "<p><strong>One</strong></p><p><strong>Two</strong></p><p>Three</p>"
  );
  // The mark steps do not touch the Block edges, so the selection maps to itself.
  expect(selectedCount(editor)).toBe(2);
  act(() => void editor.commands.undo());
  expect(editor.getHTML()).toBe("<p>One</p><p>Two</p><p>Three</p>");
});

test("the alignment menu aligns every selected Block", async () => {
  const user = userEvent.setup();
  const { editor } = renderEditor({ defaultValue: THREE });
  caretIn(editor, "One");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });

  await user.click(screen.getByRole("button", { name: /^Alignment/ }));
  await user.click(await screen.findByRole("menuitemradio", { name: /Align center/ }));

  expect(editor.getHTML()).toBe(
    '<p data-align="center">One</p><p data-align="center">Two</p><p>Three</p>'
  );
  expect(selection(editor)).toBeInstanceOf(BlockSelection);
  expect(selectedCount(editor)).toBe(2);
});

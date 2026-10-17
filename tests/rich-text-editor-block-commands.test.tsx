// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Editor } from "@tiptap/react";
import { AllSelection, NodeSelection } from "@tiptap/pm/state";
import { createRef } from "react";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
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
 * Commands over Blocks (OLDSUI-63): duplicate, move, select a Block's text, indent a list
 * item, clear styles.
 *
 * Through the public `RichTextEditor`, like the other Editor tests: the keys are real
 * `keydown` events on the document, the result is the output HTML and an undo step.
 * The caret is placed with engine commands: jsdom cannot type into `contenteditable`.
 * jsdom is not Apple, so `Mod` here is `Ctrl`. Real key presses in a browser are covered
 * by `tests-visual/interactions.spec.ts`.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  const view = render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const editor = ref.current?.editor;
  if (!editor) throw new Error("the editor was not created inside render()");
  return { ...view, editor };
}

/**
 * `keydown` on the document. `keyCode` is as in a real browser: ProseMirror uses it to
 * recognise the letter under Shift and on another layout. Returns whether the Editor
 * released the key to the browser (`defaultPrevented` is not set).
 */
function press(editor: Editor, key: string, init: KeyboardEventInit & { keyCode?: number } = {}) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(event, "keyCode", { value: init.keyCode });
  act(() => void editor.view.dom.dispatchEvent(event));
  return !event.defaultPrevented;
}

const duplicate = (editor: Editor) =>
  press(editor, "D", { ctrlKey: true, shiftKey: true, keyCode: 68 });
const moveUp = (editor: Editor) => press(editor, "ArrowUp", { altKey: true, shiftKey: true });
const moveDown = (editor: Editor) => press(editor, "ArrowDown", { altKey: true, shiftKey: true });
const selectBlock = (editor: Editor) => press(editor, "a", { ctrlKey: true, keyCode: 65 });
const indent = (editor: Editor) => press(editor, "]", { ctrlKey: true, keyCode: 221 });
const outdent = (editor: Editor) => press(editor, "[", { ctrlKey: true, keyCode: 219 });
const clearStyles = (editor: Editor) => press(editor, "\\", { ctrlKey: true, keyCode: 220 });

/** The caret goes to the end of the text `text`. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text === text) found = pos + node.nodeSize;
  });
  if (found < 0) throw new Error(`no text "${text}" in the document`);
  act(() => void editor.commands.setTextSelection(found));
}

/** The text in which the caret stands. */
const here = (editor: Editor) => editor.state.selection.$from.parent.textContent;

function undo(editor: Editor) {
  act(() => void editor.commands.undo());
}

const PHOTO = "https://cdn.example.com/photo.png";
const FIGURE = `<figure><img src="${PHOTO}" alt="A lake"><figcaption>Lake</figcaption></figure>`;
const TABLE =
  "<table><tbody><tr><th><p>h1</p></th></tr><tr><td><p>c1</p></td></tr></tbody></table>";

/**
 * Blocks that the commands move and copy as a whole: the Block's markup and the text the
 * caret is placed in. An image is selected as a node — the way it is selected with a click
 * and the arrows.
 */
const BLOCKS: readonly (readonly [name: string, html: string, caret: string | "node"])[] = [
  ["paragraph", "<p>Body</p>", "Body"],
  ["heading", "<h2>Title</h2>", "Title"],
  ["quote", "<blockquote><p>Said</p></blockquote>", "Said"],
  ["code block", '<pre><code class="language-typescript">let x</code></pre>', "let x"],
  ["image", FIGURE, "node"],
  ["table", TABLE, "c1"],
];

/** The caret in a Block's text or, for `"node"`, the selection of the Document's second Block as a node. */
function placeIn(editor: Editor, caret: string | "node") {
  if (caret !== "node") return caretIn(editor, caret);
  const { doc, tr } = editor.state;
  act(
    () =>
      void editor.view.dispatch(tr.setSelection(NodeSelection.create(doc, doc.child(0).nodeSize)))
  );
}

describe("duplicate a block: Mod+Shift+D", () => {
  test("the copy lands right under the block and the caret moves into it", () => {
    const { editor } = renderEditor({ defaultValue: "<p>One</p><p>Two</p>" });
    caretIn(editor, "One");

    duplicate(editor);

    expect(editor.getHTML()).toBe("<p>One</p><p>One</p><p>Two</p>");
    expect(editor.state.selection.$from.index(0)).toBe(1);
    expect(editor.state.selection.$from.parentOffset).toBe(3);
  });

  test.each(BLOCKS)(
    "a %s is duplicated as a whole, and one undo takes the copy away",
    (_, html, caret) => {
      const doc = `<p>Before</p>${html}<p>After</p>`;
      const { editor } = renderEditor({ defaultValue: doc });
      placeIn(editor, caret);

      duplicate(editor);

      expect(editor.getHTML()).toBe(`<p>Before</p>${html}${html}<p>After</p>`);
      // The caret or selection is in the copy, that is, in the second of the two identical Blocks.
      expect(editor.state.selection.$from.index(0)).toBe(2);
      undo(editor);
      expect(editor.getHTML()).toBe(doc);
    }
  );

  test("a list item is duplicated inside its list", () => {
    const { editor } = renderEditor({
      defaultValue: "<ul><li><p>a</p></li><li><p>b</p></li></ul>",
    });
    caretIn(editor, "a");

    duplicate(editor);

    expect(editor.getHTML()).toBe("<ul><li><p>a</p></li><li><p>a</p></li><li><p>b</p></li></ul>");
    expect(editor.state.selection.$from.index(1)).toBe(1);
  });

  test("a checklist item keeps its state in the copy", () => {
    const { editor } = renderEditor({
      defaultValue:
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul>',
    });
    caretIn(editor, "done");

    duplicate(editor);

    expect(editor.getHTML().match(/data-checked="true"/g)).toHaveLength(2);
  });
});

describe("move a block: Alt+Shift+ArrowUp and ArrowDown", () => {
  test("a paragraph moves down and up past its neighbour, the caret goes with it", () => {
    const { editor } = renderEditor({ defaultValue: "<p>A</p><p>B</p><p>C</p>" });
    caretIn(editor, "A");

    moveDown(editor);
    expect(editor.getHTML()).toBe("<p>B</p><p>A</p><p>C</p>");
    expect(here(editor)).toBe("A");

    moveDown(editor);
    expect(editor.getHTML()).toBe("<p>B</p><p>C</p><p>A</p>");

    moveUp(editor);
    expect(editor.getHTML()).toBe("<p>B</p><p>A</p><p>C</p>");
    expect(here(editor)).toBe("A");
  });

  test("one undo puts the block back", () => {
    const { editor } = renderEditor({ defaultValue: "<p>A</p><p>B</p>" });
    caretIn(editor, "A");
    moveDown(editor);

    undo(editor);

    expect(editor.getHTML()).toBe("<p>A</p><p>B</p>");
  });

  // The table is below: the shortcut does not work from inside a cell.
  test.each(BLOCKS.filter(([name]) => name !== "table"))(
    "a %s moves as a whole",
    (_, html, caret) => {
      const { editor } = renderEditor({ defaultValue: `<p>Before</p>${html}<p>After</p>` });
      placeIn(editor, caret);

      moveUp(editor);
      expect(editor.getHTML()).toBe(`${html}<p>Before</p><p>After</p>`);
      moveDown(editor);
      moveDown(editor);
      expect(editor.getHTML()).toBe(`<p>Before</p><p>After</p>${html}`);
    }
  );

  test("at the edge of the document nothing changes", () => {
    const { editor } = renderEditor({ defaultValue: "<p>A</p><p>B</p>" });
    caretIn(editor, "A");
    moveUp(editor);
    expect(editor.getHTML()).toBe("<p>A</p><p>B</p>");

    caretIn(editor, "B");
    moveDown(editor);
    expect(editor.getHTML()).toBe("<p>A</p><p>B</p>");
    expect(editor.can().undo()).toBe(false);
  });

  test("a list item moves among its neighbours and stays in the list", () => {
    const { editor } = renderEditor({
      defaultValue: "<p>Intro</p><ol><li><p>a</p></li><li><p>b</p></li></ol>",
    });
    caretIn(editor, "b");

    moveUp(editor);
    expect(editor.getHTML()).toBe("<p>Intro</p><ol><li><p>b</p></li><li><p>a</p></li></ol>");

    // The first item does not go up: a move does not take it out of the list.
    moveUp(editor);
    expect(editor.getHTML()).toBe("<p>Intro</p><ol><li><p>b</p></li><li><p>a</p></li></ol>");
  });

  test("a selection across several blocks moves as a whole", () => {
    const { editor } = renderEditor({ defaultValue: "<p>A</p><p>B</p><p>C</p>" });
    // From the middle of A to the middle of B.
    act(() => void editor.commands.setTextSelection({ from: 1, to: 5 }));

    moveDown(editor);

    expect(editor.getHTML()).toBe("<p>C</p><p>A</p><p>B</p>");
    expect(
      editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
    ).toBe("AB");
  });

  test("a table moves as a whole inside a selection that starts outside it", () => {
    const { editor } = renderEditor({ defaultValue: `<p>Before</p>${TABLE}<p>After</p>` });
    let cell = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === "c1") cell = pos + 1;
    });
    // From "Before" to the middle of the cell: the selection starts outside the table.
    act(() => void editor.commands.setTextSelection({ from: 2, to: cell }));

    moveDown(editor);

    expect(editor.getHTML()).toBe(`<p>After</p><p>Before</p>${TABLE}`);
  });

  test("in a table cell the shortcut does not move the table and is left to the browser", () => {
    const doc = `<p>Before</p>${TABLE}<p>After</p>`;
    const { editor } = renderEditor({ defaultValue: doc });
    caretIn(editor, "c1");

    expect(moveUp(editor)).toBe(true);
    expect(moveDown(editor)).toBe(true);
    expect(editor.getHTML()).toBe(doc);

    // Alt+↓ still adds a row.
    press(editor, "ArrowDown", { altKey: true });
    expect(editor.view.dom.querySelectorAll("tr")).toHaveLength(3);
  });
});

describe("select a block: Mod+A", () => {
  test("the first press selects the text of the block, the second the whole document", () => {
    const { editor } = renderEditor({ defaultValue: "<p>Hello</p><p>World</p>" });
    caretIn(editor, "World");

    selectBlock(editor);
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("World");

    selectBlock(editor);
    expect(editor.state.selection).toBeInstanceOf(AllSelection);
  });

  test("when the text of the block is already selected the first press selects the document", () => {
    const { editor } = renderEditor({ defaultValue: "<p>Hello</p><p>World</p>" });
    act(() => void editor.commands.setTextSelection({ from: 8, to: 13 }));

    selectBlock(editor);

    expect(editor.state.selection).toBeInstanceOf(AllSelection);
  });

  test("in an empty block the first press selects the document", () => {
    const { editor } = renderEditor({ defaultValue: "<p>Hello</p><p></p>" });
    act(() => void editor.commands.setTextSelection(8));

    selectBlock(editor);

    expect(editor.state.selection).toBeInstanceOf(AllSelection);
  });
});

describe("indent and outdent a list item: Mod+] and Mod+[", () => {
  const LIST = "<ul><li><p>a</p></li><li><p>b</p></li></ul>";

  test("Mod+] nests the item under the one above, Mod+[ brings it back", () => {
    const { editor } = renderEditor({ defaultValue: LIST });
    caretIn(editor, "b");

    expect(indent(editor)).toBe(false);
    expect(editor.getHTML()).toBe("<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>");

    expect(outdent(editor)).toBe(false);
    expect(editor.getHTML()).toBe(LIST);
  });

  test("each shift is one undo step", () => {
    const { editor } = renderEditor({ defaultValue: LIST });
    caretIn(editor, "b");
    indent(editor);

    undo(editor);

    expect(editor.getHTML()).toBe(LIST);
  });

  test("a checklist item shifts the same way", () => {
    const { editor } = renderEditor({
      defaultValue:
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>a</p></li>' +
        '<li data-type="taskItem" data-checked="false"><p>b</p></li></ul>',
    });
    caretIn(editor, "b");

    indent(editor);

    expect(editor.view.dom.querySelectorAll('ul[data-type="taskList"]')).toHaveLength(2);
  });

  test("outside a list the shortcuts are left to the browser and the document does not change", () => {
    const { editor } = renderEditor({ defaultValue: "<p>Text</p>" });
    caretIn(editor, "Text");

    expect(indent(editor)).toBe(true);
    expect(outdent(editor)).toBe(true);
    expect(editor.getHTML()).toBe("<p>Text</p>");
  });
});

describe("clear styles: Mod+\\", () => {
  test("removes every mark from the selection in one undo step", () => {
    const doc = "<p><strong>Bold</strong> and <em>italic</em></p>";
    const { editor } = renderEditor({ defaultValue: doc });
    act(() => void editor.commands.selectAll());

    clearStyles(editor);
    expect(editor.getHTML()).toBe("<p>Bold and italic</p>");

    undo(editor);
    expect(editor.getHTML()).toBe(doc);
  });

  test("the Clear formatting item of the More menu is signed with the shortcut", async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByRole("button", { name: "More formatting" }));
    const item = screen.getByRole("menuitem", { name: /Clear formatting/ });

    // `aria-keyshortcuts` is absent on the item: react-aria's `MenuItem` does not pass it
    // through (`TableMenuButton.tsx`); the shortcut is in the label and in the reference.
    expect(item.querySelector("kbd")?.textContent).toBe("Ctrl+\\");
  });

  test("without the clearFormatting tool the shortcut does nothing", () => {
    const doc = "<p><strong>Bold</strong></p>";
    const { editor } = renderEditor({ tools: ["bold"], defaultValue: doc });
    act(() => void editor.commands.selectAll());

    expect(clearStyles(editor)).toBe(true);
    expect(editor.getHTML()).toBe(doc);
  });
});

describe.each([
  ["readOnly", { readOnly: true }] as const,
  ["disabled", { disabled: true }] as const,
])("%s", (_, props) => {
  test("no block command changes the document", () => {
    const doc = "<p><strong>A</strong></p><ul><li><p>a</p></li><li><p>b</p></li></ul>";
    const { editor } = renderEditor({ ...props, defaultValue: doc });

    caretIn(editor, "A");
    duplicate(editor);
    moveDown(editor);
    act(() => void editor.commands.setTextSelection({ from: 1, to: 2 }));
    clearStyles(editor);
    caretIn(editor, "b");
    indent(editor);
    moveUp(editor);
    outdent(editor);

    expect(editor.getHTML()).toBe(doc);
  });
});

test("a gap cursor between two tables is in no Block: duplicate and move leave the key to the browser", async () => {
  const { GapCursor } = await import("@tiptap/pm/gapcursor");
  const { editor } = renderEditor({ defaultValue: TABLE + TABLE });
  const html = editor.getHTML();
  // The gap is at the Document level, between two tables.
  const between = editor.state.doc.child(0).nodeSize;
  act(() =>
    editor.view.dispatch(
      editor.state.tr.setSelection(new GapCursor(editor.state.doc.resolve(between)))
    )
  );

  expect(duplicate(editor)).toBe(true);
  expect(moveDown(editor)).toBe(true);
  expect(moveUp(editor)).toBe(true);
  expect(editor.getHTML()).toBe(html);
});

// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import {
  RichTextEditor,
  type RichTextEditorHandle,
  type RichTextEditorProps,
} from "../src/editor/index.js";
import { handleBlocks } from "../src/editor/core/blockCommands.js";
import { BlockSelection } from "../src/editor/core/blockSelection.js";
import { loadLazyBuiltins } from "./editor-lazy-builtins.js";

beforeAll(loadLazyBuiltins);

afterEach(cleanup);

/**
 * Footnotes and Block selection (OLDSUI-306 with OLDSUI-307, ADR-0076 and ADR-0077): the footnote
 * list is never a Block unit. The `full` preset has both Tools. The rule is `spec.blockUnit === false`
 * on the list node (`blockUnit.ts`), so every caller agrees: Block selection, the Block keys and the
 * handle.
 */
function renderEditor(props: Partial<RichTextEditorProps> = {}) {
  const ref = createRef<RichTextEditorHandle>();
  render(<RichTextEditor ref={ref} aria-label="Body" {...props} />);
  const handle = ref.current!;
  return { editor: handle.editor!, handle };
}

const A = "aaaaaaa1";
const B = "bbbbbbb2";

const reference = (key: string, number: number) =>
  `<sup data-footnote-ref="${key}"><a href="#fn-${key}" id="fnref-${key}" role="doc-noteref">${number}</a></sup>`;

const list = (...notes: [key: string, html: string][]) =>
  '<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes"><ol>' +
  notes
    .map(
      ([key, html]) =>
        `<li id="fn-${key}"><p>${html}</p><a href="#fnref-${key}" role="doc-backlink">↩</a></li>`
    )
    .join("") +
  "</ol></section>";

const DOC =
  `<p>First${reference(A, 1)}</p><p>Second${reference(B, 2)}</p><p>Plain</p>` +
  list([A, "Note one"], [B, "Note two"]);

function press(
  editor: Editor,
  key: string,
  init: { shift?: boolean; mod?: boolean; alt?: boolean } = {}
) {
  const codes: Record<string, number> = {
    Escape: 27,
    Backspace: 8,
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

/** Focus in the Document and the caret inside the paragraph or footnote that holds this text. */
function caretIn(editor: Editor, text: string) {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isTextblock && node.textContent.startsWith(text)) found = pos + 1;
  });
  if (found < 0) throw new Error(`no block "${text}"`);
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection(found);
  });
}

const count = (editor: Editor) => {
  const { selection } = editor.state;
  return selection instanceof BlockSelection ? selection.count : 0;
};

test("Esc with the caret in a footnote does not enter Block selection, and nothing happens", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "Note one");

  const before = editor.state.selection;
  press(editor, "Escape");

  // Nothing happens: the caret stays in the footnote's text (the key is not taken by Block selection).
  expect(count(editor)).toBe(0);
  expect(editor.state.selection.eq(before)).toBe(true);
  expect(editor.state.selection.$from.parent.type.name).toBe("footnote");
});

test("Shift+↓ from the last text Block does not extend into the list", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "Plain");
  press(editor, "Escape");
  expect(count(editor)).toBe(1);

  press(editor, "ArrowDown", { shift: true });

  expect(count(editor)).toBe(1);
  const selected = editor.state.selection as BlockSelection;
  expect(editor.state.doc.textBetween(selected.from, selected.to)).toBe("Plain");
});

test("a text selection that reaches into the list gives the handle only the text Blocks", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  let plainStart = -1;
  let noteEnd = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent === "Plain") plainStart = pos + 1;
    if (node.type.name === "footnote" && node.textContent === "Note one")
      noteEnd = pos + node.nodeSize - 1;
  });
  act(() => {
    editor.view.focus();
    editor.commands.setTextSelection({ from: plainStart, to: noteEnd });
  });

  const range = handleBlocks(editor.state)!;
  expect(range.endIndex - range.startIndex).toBe(1);
  expect(range.parent.child(range.startIndex).textContent).toBe("Plain");

  // `Esc` takes the same Blocks.
  press(editor, "Escape");
  expect(count(editor)).toBe(1);
});

test("deleting selected Blocks that hold references deletes their footnotes in the same undo step", () => {
  const { editor, handle } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "First");
  press(editor, "Escape");
  press(editor, "ArrowDown", { shift: true });
  expect(count(editor)).toBe(2);

  press(editor, "Backspace");

  expect(editor.getHTML()).toBe("<p>Plain</p>");
  act(() => handle.undo());
  expect(editor.getHTML()).toContain(`<p>First${reference(A, 1)}</p>`);
  expect(editor.getHTML()).toContain("Note one");
  expect(editor.getHTML()).toContain("Note two");
});

test("deleting one selected Block renumbers the footnotes of the Blocks after it", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "First");
  press(editor, "Escape");

  press(editor, "Backspace");

  expect(editor.getHTML()).toBe(
    `<p>Second${reference(B, 1)}</p><p>Plain</p>${list([B, "Note two"])}`
  );
});

test("duplicating a Block selection copies the footnotes and keeps the list last", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "First");
  press(editor, "Escape");

  press(editor, "d", { mod: true, shift: true });

  const html = editor.getHTML();
  expect(html.match(/data-footnote-ref/g)).toHaveLength(3);
  expect(html.match(/<li id="fn-/g)).toHaveLength(3);
  expect(html.match(/<p>Note one<\/p>/g)).toHaveLength(2);
  expect(editor.state.doc.lastChild!.type.name).toBe("footnoteList");
});

test("moving a Block selection down never goes past the list", () => {
  const { editor } = renderEditor({ defaultValue: DOC });
  caretIn(editor, "Plain");
  press(editor, "Escape");

  press(editor, "ArrowDown", { alt: true, shift: true });

  expect(editor.getHTML()).toBe(DOC);
});

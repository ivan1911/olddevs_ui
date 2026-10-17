"use client";

import { Extension, mergeAttributes, Node, type Extensions } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import {
  NodeSelection,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from "@tiptap/pm/state";
import { containerFreeContext, placeContainerBlock, WRAPPER_NODE } from "../../core/containers.js";
import type { EditorWrapperTone } from "../../../i18n/messages.js";
import { WRAPPER_TONE_ALERTS, wrapperToneFrom } from "./wrapperTones.js";

/**
 * Wrapper is a Block that gathers a group of Blocks: `div[data-block="wrapper"]`,
 * with Blocks inside. Without a tone it has no look of its own, as is the case
 * for Wrapper in Redactor: in the Editor a gray dashed outline shows it, and the
 * reader does not need a border.
 *
 * MARKUP FOLLOWS REDACTOR, LETTER FOR LETTER: its HTML with a wrapper reads
 * without translation, and ours reads the same way for a Redactor user. The only
 * attribute of our own is the tone: `data-tone` with a name from the kit's `Tone`
 * vocabulary (`wrapperTones.ts`). For the reader it is a soft background and a
 * tone stripe (`prose.ts`); in Markdown it is a GitHub alert. The tone is styling:
 * it adds no roles or `aria-*` to the markup.
 *
 * NESTING IS NOT ALLOWED AT THE ENGINE SCHEMA LEVEL, as for Column layout (ADR-0056).
 * A Wrapper is not in the `block` group: only the Document and a Column layout's
 * column accept it (their content expressions name it explicitly: `document.ts`
 * and `layout.ts`), while the Wrapper itself holds `block+`. So there is no way to
 * get a Wrapper inside a Wrapper, a Column layout inside a Wrapper, or a Wrapper
 * inside a list, a quote or a cell: not by paste, not by `value`, not by a command.
 * HTML parsing covers that case by unwrapping and passing its Blocks through in a
 * row: a parse rule with `skip` in the container context. Paste is parsed in the
 * context of the insertion point, so the same rule unwraps it too: the Wrapper
 * needs no `transformPasted` of its own, unlike Column layout.
 *
 * `isolating`, as for a Column layout's column: Backspace at the start of a Wrapper
 * does not pull the text out or merge it with the Block above, and "Turn into" does
 * not cross its boundary. The `blockContainer` flag (`blockCommands.ts`): Blocks
 * inside get their own Block handle at the left edge of the Wrapper, and their
 * commands do not leave it.
 *
 * The decision is recorded in ADR-0057.
 */

/** Name of the Wrapper node in the engine Schema (defined in `containers.ts`). */
export { WRAPPER_NODE };

const WRAPPER_TAG = 'div[data-block="wrapper"]';

/**
 * Containers that do not accept a Wrapper: another Wrapper, a quote, a list item and
 * a cell (`containers.ts`). A Column layout's column is not in this list: it accepts
 * a Wrapper.
 */
const NO_WRAPPER_CONTEXT = containerFreeContext();

export const Wrapper = Node.create({
  name: WRAPPER_NODE,
  content: "block+",
  isolating: true,
  extendNodeSchema: (extension) =>
    extension.name === WRAPPER_NODE ? { blockContainer: true } : {},
  /*
    The tone is a name from the kit's `Tone` vocabulary, in `data-tone`; without a
    tone there is no attribute. Parsing drops an unknown value, and the Wrapper stays.
  */
  addAttributes: () => ({
    tone: {
      default: null,
      parseHTML: (element) => wrapperToneFrom(element.getAttribute("data-tone")),
      renderHTML: ({ tone }) => (tone ? { "data-tone": tone } : {}),
    },
  }),
  parseHTML: () => [
    { tag: WRAPPER_TAG, context: NO_WRAPPER_CONTEXT, skip: true, priority: 60 },
    { tag: WRAPPER_TAG },
  ],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes({ "data-block": "wrapper" }, HTMLAttributes),
    0,
  ],
  /*
    A Wrapper with a tone is a GitHub alert: a quote whose first line is the tone's
    label (`> [!NOTE]`), then its Blocks, each line starting with `> `, and an empty
    line between Blocks becomes `>`, as in the engine's quote. Without a tone a
    Wrapper has no Markdown form of its own: its Blocks are exported in a row. The
    reverse parsing of the alert is done by `markdown.ts`.
  */
  renderMarkdown: (node, helpers) => {
    const blocks = node.content ? helpers.renderChildren(node.content, "\n\n") : "";
    const tone = wrapperToneFrom(node.attrs?.tone);
    if (!tone) return blocks;
    // An empty line between Blocks becomes a bare `>`; a line of spaces alone (inside
    // a code Block) keeps its spaces, or the reverse parsing would lose them.
    const lines = blocks.split("\n").map((line) => (line === "" ? ">" : `> ${line}`));
    // A `---` or `===` line right under the label would turn it into a setext heading
    // underline: the label would become an `<h2>` instead of an alert. The empty
    // quote line separates them.
    const label = `> [!${WRAPPER_TONE_ALERTS[tone]}]`;
    const setext = /^> *(?:-+|=+) *$/.test(lines[0] ?? "");
    return [label, ...(setext ? [">"] : []), ...lines].join("\n");
  },

  addCommands() {
    return {
      insertWrapper:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) placeWrapper(tr);
          return true;
        },
      unwrapWrapper:
        () =>
        ({ tr, dispatch }) => {
          const found = wrapperAt(tr.selection);
          if (!found) return false;
          if (dispatch) unwrap(tr, found.pos, found.node);
          return true;
        },
      setWrapperTone:
        (tone) =>
        ({ tr, dispatch }) => {
          const found = wrapperAt(tr.selection);
          // The command does not write a name outside the vocabulary: the consumer's code calls it too.
          const value = wrapperToneFrom(tone);
          if (!found || (tone !== null && value === null)) return false;
          // One attribute step: positions and the selection do not shift, and undo is a single step.
          if (dispatch) tr.setNodeAttribute(found.pos, "tone", value);
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wrapper: {
      /**
       * Insert an empty Wrapper with one paragraph below the current Block; an empty
       * paragraph in the Document or a column is replaced. From a column, the Wrapper
       * goes into the same column; from a Wrapper, list, quote or cell, below their
       * Block. The caret goes into the Wrapper's paragraph.
       */
      insertWrapper: () => ReturnType;
      /**
       * Unwrap the Wrapper under the selection: its Blocks take its place. Outside
       * a Wrapper, returns `false`.
       */
      unwrapWrapper: () => ReturnType;
      /**
       * The Callout tone of the Wrapper under the selection: a name from the Tone
       * vocabulary, or `null` for no tone. Outside a Wrapper, or with a name outside
       * the vocabulary, returns `false`.
       */
      setWrapperTone: (tone: EditorWrapperTone | null) => ReturnType;
    };
  }
}

/** The Wrapper under the selection: the one selected as a node, or the one holding the caret. */
export function wrapperAt(selection: Selection): { pos: number; node: PmNode } | null {
  if (selection instanceof NodeSelection && selection.node.type.name === WRAPPER_NODE) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === WRAPPER_NODE) return { pos: $from.before(depth), node };
  }
  return null;
}

/**
 * Unwrap the Block at `pos`: either the Wrapper Block itself or a Block directly
 * inside it. It is the Block action of the Block handle menu (`features/builtins.ts`),
 * which passes a position instead of a selection.
 */
export function unwrapWrapperAt(tr: Transaction, pos: number): boolean {
  const node = tr.doc.nodeAt(pos);
  if (node?.type.name === WRAPPER_NODE) {
    unwrap(tr, pos, node);
    return true;
  }
  const $pos = tr.doc.resolve(pos);
  if ($pos.parent.type.name !== WRAPPER_NODE) return false;
  unwrap(tr, $pos.before(), $pos.parent);
  return true;
}

/**
 * An empty Wrapper with one paragraph goes below the current Block, in the nearest
 * container up the tree that accepts it (the Document or a Column layout's column).
 * The placement rules are shared with Column layout (`placeContainerBlock`,
 * `containers.ts`).
 */
function placeWrapper(tr: Transaction): void {
  const { schema } = tr.doc.type;
  placeContainerBlock(
    tr,
    schema.nodes[WRAPPER_NODE]!.create(null, schema.nodes.paragraph!.create())
  );
}

/**
 * Unwrap the Wrapper at `pos`: its Blocks are lifted one level up in a single
 * `lift` step, so the caret inside them stays in place and undo is one step.
 * A Wrapper selected as a node disappears, and the caret moves to the start of its
 * first Block.
 */
function unwrap(tr: Transaction, pos: number, node: PmNode): void {
  // The Wrapper itself is selected, not an image inside it: a selected image keeps its selection.
  const wasNode = tr.selection instanceof NodeSelection && tr.selection.from === pos;
  const $start = tr.doc.resolve(pos + 1);
  const $end = tr.doc.resolve(pos + node.nodeSize - 1);
  const range = $start.blockRange($end);
  if (!range) return;
  tr.lift(range, range.depth - 1);
  if (wasNode) tr.setSelection(Selection.near(tr.doc.resolve(pos), 1));
  tr.scrollIntoView();
}

/**
 * Enter in the empty last paragraph of a Wrapper that has other Blocks is the exit:
 * the paragraph moves below the Wrapper, and the caret goes with it. One transaction.
 * Without this there is no way out of a Wrapper at the end of the Document without a
 * mouse: `isolating` stops the core from lifting the empty paragraph out, and Enter
 * would only add empty lines.
 */
function exitOnEnter(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 2) return false;
  const wrapper = $from.node(-1);
  const block = $from.parent;
  if (
    wrapper.type.name !== WRAPPER_NODE ||
    block.type.name !== "paragraph" ||
    block.content.size > 0 ||
    wrapper.childCount < 2 ||
    $from.indexAfter(-1) !== wrapper.childCount
  ) {
    return false;
  }
  if (dispatch) {
    const tr = state.tr;
    const after = $from.after(-1);
    tr.delete($from.before(), $from.after());
    const pos = tr.mapping.map(after);
    tr.insert(pos, block.type.create());
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/** The Enter exit from a Wrapper runs before the core's Enter, which would split the paragraph inside. */
const WrapperKeys = Extension.create({
  name: "wrapperKeys",
  priority: 101,
  addKeyboardShortcuts() {
    return {
      Enter: () =>
        this.editor.isEditable && exitOnEnter(this.editor.state, this.editor.view.dispatch),
    };
  },
});

/**
 * The caret is at the very start of a Wrapper (`dir < 0`) or at its very end
 * (`dir > 0`), with an empty selection: at the edge of the text, and each ancestor
 * of the text Block up to the Wrapper is at the edge of its parent.
 */
function atWrapperBoundary(state: EditorState, dir: 1 | -1): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $head } = selection;
  const atTextEdge =
    dir < 0 ? $head.parentOffset === 0 : $head.parentOffset === $head.parent.content.size;
  if (!atTextEdge) return false;
  for (let depth = $head.depth - 1; depth > 0; depth--) {
    const parent = $head.node(depth);
    const atEdge =
      dir < 0 ? $head.index(depth) === 0 : $head.indexAfter(depth) === parent.childCount;
    if (!atEdge) return false;
    if (parent.type.name === WRAPPER_NODE) return true;
  }
  return false;
}

/**
 * Backspace in the only empty paragraph of a Wrapper removes the whole Wrapper:
 * this paragraph stays in its place, with the caret in it. One transaction.
 * Otherwise an empty Wrapper cannot be removed from the keyboard: the boundary guard
 * below swallows Backspace, and the Wrapper can be selected as a node only from the
 * Block below it. It has no text in it, so the guard rule, "do not pull text out",
 * is not broken. In a Column layout's column the paragraph stays in the same column:
 * it is that column's Block, not the Document's.
 *
 * Delete does not remove the Wrapper symmetrically: it deletes what comes AFTER the
 * caret, and at the end of a Wrapper what follows is the boundary, not its content.
 */
function removeEmptyWrapper(state: EditorState, dispatch?: (tr: Transaction) => void): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  const { $from } = selection;
  if ($from.depth < 2) return false;
  const wrapper = $from.node(-1);
  const block = $from.parent;
  if (
    wrapper.type.name !== WRAPPER_NODE ||
    wrapper.childCount !== 1 ||
    block.type.name !== "paragraph" ||
    block.content.size > 0
  ) {
    return false;
  }
  if (dispatch) {
    const pos = $from.before(-1);
    const tr = state.tr.replaceWith(pos, $from.after(-1), block);
    tr.setSelection(TextSelection.create(tr.doc, pos + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
}

/**
 * Backspace at the start of a Wrapper and Delete at its end run last, after all the
 * core rules (as for a Column layout's column, `layout.ts`). The core still turns
 * an empty heading into a paragraph and lifts a list item out of its list. Backspace
 * on the only empty paragraph removes it together with the Wrapper
 * (`removeEmptyWrapper`). If nobody handles the key, it is consumed: `isolating`
 * stops ProseMirror commands from pulling text out of the Wrapper, and without
 * consuming the key the browser would make the edit itself, through the DOM,
 * bypassing the Schema.
 *
 * A Wrapper in a column: it runs before the column's guard, which has the same
 * priority, because among equal priorities Tiptap asks the later-registered
 * extension first (`extensions.ts`), and the Wrapper comes after the Column layout.
 */
const WrapperBoundary = Extension.create({
  name: "wrapperBoundary",
  priority: 1,
  addKeyboardShortcuts() {
    const guard = (dir: 1 | -1) => () =>
      this.editor.isEditable && atWrapperBoundary(this.editor.state, dir);
    return {
      Backspace: () =>
        (this.editor.isEditable &&
          removeEmptyWrapper(this.editor.state, this.editor.view.dispatch)) ||
        guard(-1)(),
      Delete: guard(1),
    };
  },
});

/** Everything the Wrapper needs apart from the Document (`document.ts`): the node and the keyboard. */
export const WRAPPER_EXTENSIONS: Extensions = [Wrapper, WrapperKeys, WrapperBoundary];

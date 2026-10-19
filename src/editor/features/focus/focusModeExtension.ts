"use client";

import { Extension } from "@tiptap/core";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import { BlockSelection } from "../../core/blockSelection.js";
import { LIST_ITEMS, viewUnitRange } from "../../core/blockUnit.js";
import { FOOTNOTE_LIST_NODE } from "../footnotes/footnoteNames.js";
import { FOCUS_MODE_KEY, toggleFocusMode } from "./focusModeState.js";

/**
 * The focus mode (ADR-0082): everything outside the Block with the caret is shown in secondary
 * color. A view only: decorations over the Document, so `value`, `onChange`, the HTML and the
 * history do not see it.
 *
 * "THE BLOCK" IS THE BLOCK UNIT OF ADR-0077 (`viewUnitRange`, which is `blockUnitRange` plus the
 * children of a node that opted out of being a unit), the same as for the keys, the
 * handle and Block selection: a list item, a table as a whole, a Block of a column. Tiptap's own
 * Focus extension marks the nodes around the caret and knows none of these.
 *
 * FOUR KINDS OF DECORATION. Text outside the unit gets ONE inline decoration for each side (before
 * and after), which wraps the text runs. A Block that goes faint whole (an image, a video, a code
 * Block, a quote, a Wrapper, a table and the rest of `MEDIA_NODES`) gets a node decoration. A list
 * item whose own text is outside the unit gets a node decoration too, for its marker: the marker is
 * the item's, not the text's, and the inline decoration does not reach it. So does every text Block
 * outside the unit, for what sits beside its text runs (invisible characters, a footnote's number).
 *
 * NO DIMMING where the Document is not the place of work: without focus in it (the Toolbar or the
 * page has it), over a Block selection (the selected Blocks are already marked), and in a read-only
 * field. A caret in the footnote list keeps that one footnote as it is and dims the rest, the text
 * Blocks and the other footnotes alike; a caret in the text dims the whole list like any other Block.
 */

/** CSS class of dimmed text, of a dimmed Block without text and of a list item with a dimmed marker. */
export const FOCUS_DIM_CLASS = "rte-focus-dim";
export const FOCUS_DIM_MEDIA_CLASS = "rte-focus-dim-media";
export const FOCUS_DIM_ITEM_CLASS = "rte-focus-dim-item";
/**
 * A text Block outside the unit: for what the text decoration does not wrap — the invisible characters'
 * widgets, and a footnote's number (the footnote is a text Block of its own).
 */
export const FOCUS_DIM_BLOCK_CLASS = "rte-focus-dim-block";

/**
 * What the classes do: everything outside the Block goes to 40% opacity (OLDSUI-315, the owner's
 * choice among four variants). Opacity, not a color: a link, an author color, a marker fill and a
 * code Block's highlight keep their own colors, only fainter, so one rule fits the theme, the Paper,
 * the toned Wrappers and the code themes alike. Opacity multiplies, so an element that is already
 * faint (a code Block, a `mark`) keeps the text inside it as it is. A list marker has no opacity of
 * its own (`::marker` takes only a color), so it gets its item's color at the same 40%.
 *
 * THE CONTRAST IS BELOW 4.5:1 ON PURPOSE (3.1:1 on the dark theme, 2.4:1 on the Paper; ADR-0082,
 * decision 6 and its 2026-10-18 amendment). The dimmed text is not the text being read: it is the background around the
 * Block being written, and it comes back in full as soon as the caret reaches it or the focus leaves
 * the Document. The a11y check leaves it out of the contrast rule for that reason (`a11y.spec.ts`).
 *
 * THE RULES COME WITH THE EXTENSION, as a class on the Document's root, and not from `prose.ts`: that
 * module is shared with `RichTextView`, which has no use for them. The root carries the class only
 * while the mode is on.
 */
const FOCUS_MODE_CLASS =
  "[&_:is(.rte-focus-dim,.rte-focus-dim-media)]:opacity-40 " +
  // The decoration lies inside a marker's `mark` and inside inline `code`, so it would dim the letters
  // and leave the fill bright: the element goes faint as a whole instead, its text as it is inside.
  "[&_:is(mark,code):has(>.rte-focus-dim)]:opacity-40 [&_:is(mark,code)>.rte-focus-dim]:opacity-100 " +
  "[&_li.rte-focus-dim-item]:marker:text-[color-mix(in_srgb,currentColor_40%,transparent)] " +
  // A task item has no `::marker`: its marker is the checkbox in a `label`, which goes faint whole.
  "[&_li.rte-focus-dim-item>label]:opacity-40 " +
  // Outside the text decoration of a text Block: the invisible characters (widgets between the text
  // runs) and a footnote's number (a button back to the reference, next to the footnote's text).
  "[&_.rte-focus-dim-block>:is(.tiptap-invisible-character,[data-footnote-back])]:opacity-40 " +
  // Opacity multiplies: inside a Block already at 40% (a code Block, a Wrapper, a table) nothing goes
  // faint a second time, or it would sink to 16%.
  "[&_.rte-focus-dim-media_:is(.rte-focus-dim,.rte-focus-dim-media,mark,code)]:opacity-100 " +
  "[&_.rte-focus-dim-media_li.rte-focus-dim-item]:marker:text-inherit " +
  "[&_.rte-focus-dim-media_li.rte-focus-dim-item>label]:opacity-100 " +
  "[&_.rte-focus-dim-media_.rte-focus-dim-block>:is(.tiptap-invisible-character,[data-footnote-back])]:opacity-100";

/**
 * Blocks that go faint whole, not only their text: media, code and a horizontal rule have no text of
 * their own or keep their theme's colors, and a toned Wrapper, a Details Block, a table, a quote, a
 * column and the footnote list have a fill, a frame or a line that would stay bright around faint text
 * (OLDSUI-315, OLDSUI-317). Only a node that lies wholly outside the unit: a Wrapper with the caret
 * inside keeps its frame, and its other Blocks dim as text.
 */
const MEDIA_NODES: ReadonlySet<string> = new Set([
  "image",
  "video",
  "codeBlock",
  "blockMath",
  "horizontalRule",
  "blockquote",
  "wrapper",
  "details",
  "table",
  "layout",
  "layoutColumn",
  FOOTNOTE_LIST_NODE,
]);

function dim(editor: Editor, state: EditorState): DecorationSet | null {
  if (!FOCUS_MODE_KEY.getState(state)?.enabled) return null;
  if (!editor.isEditable || !editor.isFocused) return null;
  const { doc, selection } = state;
  if (selection instanceof BlockSelection) return null;
  const range = viewUnitRange(selection.$from, selection.$to);
  if (!range) return null;
  const end = doc.content.size;
  const marks: Decoration[] = [];
  if (range.start > 0) marks.push(Decoration.inline(0, range.start, { class: FOCUS_DIM_CLASS }));
  if (range.end < end) marks.push(Decoration.inline(range.end, end, { class: FOCUS_DIM_CLASS }));
  const dimMedia = (from: number, to: number) =>
    doc.nodesBetween(from, to, (node, pos) => {
      if (!MEDIA_NODES.has(node.type.name)) return true;
      // A container around the unit is not outside it: its own children are judged instead.
      if (pos < range.end && pos + node.nodeSize > range.start) return true;
      marks.push(Decoration.node(pos, pos + node.nodeSize, { class: FOCUS_DIM_MEDIA_CLASS }));
      return false;
    });
  dimMedia(0, range.start);
  dimMedia(range.end, end);
  // A marker is dimmed when its item's own text (the first child) is outside the unit.
  doc.descendants((node, pos) => {
    // A list item never lies inside text: a textblock and its inline content are not walked.
    if (node.isTextblock) {
      if (pos + node.nodeSize <= range.start || pos >= range.end) {
        marks.push(Decoration.node(pos, pos + node.nodeSize, { class: FOCUS_DIM_BLOCK_CLASS }));
      }
      return false;
    }
    if (!LIST_ITEMS.has(node.type.name)) return true;
    const text = node.firstChild;
    const from = pos + 1;
    const to = from + (text?.nodeSize ?? 0);
    if (to <= range.start || from >= range.end) {
      marks.push(Decoration.node(pos, pos + node.nodeSize, { class: FOCUS_DIM_ITEM_CLASS }));
    }
    return true;
  });
  return DecorationSet.create(doc, marks);
}

export interface FocusModeOptions {
  /** The mode is on from the start (the Tool's `enabled` option). */
  enabled: boolean;
}

export const FocusModeExtension = Extension.create<FocusModeOptions>({
  name: "focusMode",

  addOptions: () => ({ enabled: false }),

  // `Mod+Shift+J`: the same switch as the "Focus mode" item of the "…" menu (OLDSUI-316).
  addKeyboardShortcuts() {
    return { "Mod-Shift-j": () => toggleFocusMode(this.editor) };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    return [
      new Plugin({
        key: FOCUS_MODE_KEY,
        state: {
          init: () => ({ enabled: options.enabled }),
          apply: (tr, value) =>
            (tr.getMeta(FOCUS_MODE_KEY) as { enabled: boolean } | undefined) ?? value,
        },
        props: {
          decorations: (state) => dim(editor, state),
          attributes: (state): Record<string, string> =>
            FOCUS_MODE_KEY.getState(state)?.enabled ? { class: FOCUS_MODE_CLASS } : {},
        },
      }),
    ];
  },
});

"use client";

import { Extension } from "@tiptap/core";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import { BlockSelection } from "../../core/blockSelection.js";
import { LIST_ITEMS, viewUnitRange } from "../../core/blockUnit.js";
import { FOCUS_MODE_KEY } from "./focusModeState.js";

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
 * THREE KINDS OF DECORATION. Text outside the unit gets ONE inline decoration for each side (before
 * and after), which wraps the text runs. Blocks without text of their own (an image, a video, a
 * code Block, a block formula) get a node decoration. A list item whose own text is outside the unit
 * gets a node decoration too, for its marker: the marker is the item's, not the text's, and the
 * inline decoration does not reach it.
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
 * What the classes do: everything outside the Block goes to 40% opacity (OLDSUI-315, the owner's
 * choice among four variants). Opacity, not a color: a link, an author color, a marker fill and a
 * code Block's highlight keep their own colors, only fainter, so one rule fits the theme, the Paper,
 * the toned Wrappers and the code themes alike. A list marker has no opacity of its own (`::marker`
 * takes only a color), so it gets its item's color at the same 40%.
 *
 * THE CONTRAST IS BELOW 4.5:1 ON PURPOSE (3.1:1 on the dark theme, 2.4:1 on the Paper; ADR-0082,
 * decision 9 revised). The dimmed text is not the text being read: it is the background around the
 * Block being written, and it comes back in full as soon as the caret reaches it or the focus leaves
 * the Document. The a11y check leaves it out of the contrast rule for that reason (`a11y.spec.ts`).
 *
 * THE RULES COME WITH THE EXTENSION, as a class on the Document's root, and not from `prose.ts`: that
 * module is shared with `RichTextView`, which has no use for them. The root carries the class only
 * while the mode is on.
 */
const FOCUS_MODE_CLASS =
  "[&_:is(.rte-focus-dim,.rte-focus-dim-media)]:opacity-40 " +
  "[&_li.rte-focus-dim-item]:marker:text-[color-mix(in_srgb,currentColor_40%,transparent)]";

/** Blocks dimmed by opacity: they have no text of their own to recolor, or their colors are the theme's. */
const MEDIA_NODES: ReadonlySet<string> = new Set(["image", "video", "codeBlock", "blockMath"]);

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
      marks.push(Decoration.node(pos, pos + node.nodeSize, { class: FOCUS_DIM_MEDIA_CLASS }));
      return false;
    });
  dimMedia(0, range.start);
  dimMedia(range.end, end);
  // A marker is dimmed when its item's own text (the first child) is outside the unit.
  doc.descendants((node, pos) => {
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

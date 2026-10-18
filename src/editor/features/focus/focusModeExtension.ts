"use client";

import { Extension } from "@tiptap/core";
import { Plugin, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import { BlockSelection } from "../../core/blockSelection.js";
import { blockUnitRange } from "../../core/blockUnit.js";
import { FOCUS_MODE_KEY } from "./focusModeState.js";

/**
 * The focus mode (ADR-0082): everything outside the Block with the caret is shown in secondary
 * color. A view only: decorations over the Document, so `value`, `onChange`, the HTML and the
 * history do not see it.
 *
 * "THE BLOCK" IS THE BLOCK UNIT OF ADR-0077 (`blockUnitRange`), the same as for the keys, the
 * handle and Block selection: a list item, a table as a whole, a Block of a column. Tiptap's own
 * Focus extension marks the nodes around the caret and knows none of these.
 *
 * TWO KINDS OF DECORATION. Text outside the unit gets ONE inline decoration for each side (before
 * and after), which wraps the text runs: the color lands on the text itself, so a link, a quote or
 * an author color does not keep its own. Blocks without text of their own (an image, a video, a
 * code Block, a block formula) get a node decoration and are dimmed by opacity.
 *
 * NO DIMMING where the Document is not the place of work: without focus in it (the Toolbar or the
 * page has it), over a Block selection (the selected Blocks are already marked), and in a read-only
 * field. A caret in a node that is not a unit (the footnote list) dims nothing.
 */

/** CSS class of dimmed text and of a dimmed Block without text. */
export const FOCUS_DIM_CLASS = "rte-focus-dim";
export const FOCUS_DIM_MEDIA_CLASS = "rte-focus-dim-media";

/**
 * What the classes do. Text outside the Block takes the secondary role `--rte-muted`, the one that
 * holds 4.5:1 on the sheet, on the theme and on the Wrapper backings (`tokens.ts`). Images, videos,
 * code Blocks and block formulas have no text of their own to recolor, so they go translucent.
 *
 * Two exceptions. Text on a marker keeps the marker's dark text: a gray one would sink on the bright
 * fill. In a toned Wrapper the secondary role IS the main text (the only step that holds 4.5:1 on all
 * five backings), so the dimming there is a little opacity instead of a color.
 *
 * THE RULES COME WITH THE EXTENSION, as a class on the Document's root, and not from `prose.ts`: that
 * module is shared with `RichTextView`, which has no use for them. The root carries the class only
 * while the mode is on.
 */
const FOCUS_MODE_CLASS =
  "[&_.rte-focus-dim]:text-(--rte-muted) [&_mark_.rte-focus-dim]:text-(--marker-text) " +
  "[&_[data-block=wrapper][data-tone]_.rte-focus-dim]:opacity-75 " +
  "[&_.rte-focus-dim-media]:opacity-60";

/** Blocks dimmed by opacity: they have no text of their own to recolor, or their colors are the theme's. */
const MEDIA_NODES: ReadonlySet<string> = new Set(["image", "video", "codeBlock", "blockMath"]);

function dim(editor: Editor, state: EditorState): DecorationSet | null {
  if (!FOCUS_MODE_KEY.getState(state)?.enabled) return null;
  if (!editor.isEditable || !editor.isFocused) return null;
  const { doc, selection } = state;
  if (selection instanceof BlockSelection) return null;
  const range = blockUnitRange(selection.$from, selection.$to);
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

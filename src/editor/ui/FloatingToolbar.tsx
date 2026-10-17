"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useRef } from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { showOverSelection, useOutOfTabOrder, useSelectionMenuOptions } from "./selectionMenu.js";
import type { ToolList } from "../core/toolDescriptor.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";

/** Plugin key of the floating Toolbar, used to show it by command (`Alt+F10`). */
export const FLOATING_TOOLBAR_KEY = "richTextFloatingToolbar";

export interface FloatingToolbarProps {
  editor: Editor;
  tools: ToolList;
  disabled: boolean;
  /** The "Insert table…" item of the Table menu: the Editor owns the dialog. */
  onInsertTable?: () => void;
  /** The Document area that scrolls on its own (ADR-0059); without it, the window scrolls. */
  scrollTarget?: HTMLElement;
}

/**
 * Floating Toolbar: the same `EditorToolbar`, shown over a non-empty selection.
 *
 * POSITION AND VISIBILITY come from Tiptap's `BubbleMenu` (`@tiptap/react/menus`,
 * built on floating-ui). It hides the Toolbar on an empty selection, in a non-editable
 * field, and when focus is neither in the document nor in the Toolbar itself. It shows
 * the Toolbar after a delay, once the selection has stopped changing: while the mouse is
 * dragging a selection, the Toolbar does not flicker. It inserts the Toolbar's node next
 * to the document and removes it from the DOM when it hides, so a hidden Toolbar is in
 * neither the screen reader's nor the Tab order.
 *
 * The show condition and the position are shared with the selection menu
 * (`selectionMenu.ts`): there is no Toolbar over an image, and near the window edge it
 * flips and shifts.
 *
 * LAYER: `OVERLAY_LAYER.popover`. The Toolbar floats over the text, like a popover.
 * It takes no part in the Escape stack: it holds no focus and has nothing to close, so
 * Escape stays with the dialog or drawer around the Editor.
 */
export function FloatingToolbar({
  editor,
  tools,
  disabled,
  onInsertTable,
  scrollTarget,
}: FloatingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useSelectionMenuOptions(scrollTarget);
  useOutOfTabOrder(ref, editor);

  return (
    <BubbleMenu
      ref={ref}
      editor={editor}
      pluginKey={FLOATING_TOOLBAR_KEY}
      shouldShow={showOverSelection}
      options={options}
      className={cn(
        OVERLAY_LAYER.popover,
        GLASS_PANEL_CLASS,
        "border-line-soft shadow-2 rounded-md border px-1.5 py-1",
        // Narrow screen: the Toolbar wraps onto a second row instead of running past the edge.
        "max-w-[min(40rem,calc(100vw-1rem))]"
      )}
    >
      <EditorToolbar
        editor={editor}
        tools={tools}
        disabled={disabled}
        onInsertTable={onInsertTable}
      />
    </BubbleMenu>
  );
}

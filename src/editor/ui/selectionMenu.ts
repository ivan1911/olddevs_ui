"use client";

import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { BubbleMenuProps } from "@tiptap/react/menus";
import { useEffect, useMemo, type RefObject } from "react";
import { focusWithin } from "./focusWithin.js";
import { isImageSelection } from "../features/image/image.js";

/**
 * Shared by everything that floats above the selection on Tiptap's `BubbleMenu`: the
 * floating toolbar (`toolbar="floating"`) and the bubble menu (`toolbar="bubble"`). They
 * share the show condition and the position. Two copies would drift apart silently, and
 * the bubble menu would show where the Toolbar does not.
 */

/**
 * The show condition is the `BubbleMenu` default plus two exceptions. Over a selected
 * image, its own image toolbar (`ImageToolbar`) is shown, and the formatting menu would compete
 * with it for the same place. Over a selected custom Block with the Block trait "atom
 * without a formatting menu" (`plainAtom` in the node spec), no Marks are offered.
 *
 * An empty selection, empty text under the selection, a non-editable field, and focus
 * outside both the document and the menu itself do not show the menu.
 *
 * OPENED FROM THE MENU IS ALSO "FOCUS WITHIN". The "¶", "…", color and emoji grid menus
 * live in a portal, outside the menu's node, so for `focusWithin` focus in them is
 * outside. The condition is also recalculated by a timer after every edit: applying bold
 * just before opening "¶" hid the bubble menu together with its menu button, and Escape
 * sent focus nowhere. While the menu button has `aria-expanded="true"` inside the menu
 * (react-aria and Radix both set it), the user is working with the menu, so it must not
 * be hidden.
 */
export const showOverSelection: NonNullable<BubbleMenuProps["shouldShow"]> = ({
  editor,
  view,
  state,
  from,
  to,
  element,
}) => {
  const { selection } = state;
  if (selection.empty || !editor.isEditable || isImageSelection(selection)) return false;
  // Block trait "atom without a formatting menu" on a custom Block (ADR-0058, item 1.4).
  if (selection instanceof NodeSelection && selection.node.type.spec.plainAtom === true) {
    return false;
  }
  const emptyText = !state.doc.textBetween(from, to).length && selection instanceof TextSelection;
  if (emptyText) return false;
  return focusWithin(view, element) || element.querySelector('[aria-expanded="true"]') !== null;
};

/**
 * The position is above the selection. Near the window's top edge it flips below the
 * selection, and it shifts away from the side edges.
 *
 * `strategy: "absolute"` (default), not `fixed`: the menu lives in the Editor's DOM and
 * moves with the text inside any scroll container, whether the window, a drawer or a
 * card. `fixed` would only be recalculated on window scroll. The cost: an ancestor with
 * `overflow: hidden` clips the menu at its edge. The component's page says so.
 */
export const SELECTION_MENU_OPTIONS = {
  placement: "top",
  offset: 8,
  flip: true,
  shift: { padding: 8 },
} as const satisfies BubbleMenuProps["options"];

/**
 * Options for the bubble menu when the Document's scroll area scrolls (ADR-0059). The
 * `BubbleMenu` plugin recalculates the position on window scroll. When the Document
 * scrolls inside its frame (`maxHeight`, `resizable`), the plugin must listen to that
 * area instead. Otherwise the bubble menu stays in place while the text under it moves
 * away. Without an area, it listens to the window.
 */
export function useSelectionMenuOptions(
  scrollTarget: HTMLElement | undefined,
  options: NonNullable<BubbleMenuProps["options"]> = SELECTION_MENU_OPTIONS
): NonNullable<BubbleMenuProps["options"]> {
  return useMemo(
    () => (scrollTarget ? { ...options, scrollTarget } : options),
    [scrollTarget, options]
  );
}

/**
 * Take the `BubbleMenu` node out of the Tab order.
 *
 * The plugin sets `tabindex="0"` on its node, so that clicks on empty space in the menu do
 * not take focus away from the document. But that adds an extra Tab stop before
 * `role="toolbar"`, which already has one. `-1` keeps the node focusable by click and
 * removes it from the Tab order. The parent's effect runs after the effect of the
 * `BubbleMenu` that creates the plugin, so the value survives.
 */
export function useOutOfTabOrder(ref: RefObject<HTMLElement | null>, dependency: unknown): void {
  useEffect(() => {
    ref.current?.setAttribute("tabindex", "-1");
  }, [ref, dependency]);
}

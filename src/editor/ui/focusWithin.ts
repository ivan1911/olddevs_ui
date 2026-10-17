import type { EditorView } from "@tiptap/pm/view";

/**
 * Focus is inside the Editor's document or inside its floating Toolbar. This is the
 * condition for showing the `BubbleMenu` (the Toolbar above the selection, the image
 * toolbar).
 *
 * THE ACTIVE ELEMENT COMES FROM THE TOOLBAR'S OWN DOCUMENT, not from the global
 * `document`. An Editor inside an `iframe` or a shadow root lives in a foreign document:
 * there the global `document.activeElement` is the `iframe` itself, and the Toolbar
 * would hide itself from its own focused button. The second reason: `BubbleMenu` calls
 * the condition from a timer that can fire after the window has already been torn down
 * (unmount, end of a test). Accessing the global `document` then throws, while the
 * element's `ownerDocument` always exists.
 */
export function focusWithin(view: Pick<EditorView, "hasFocus">, element: HTMLElement): boolean {
  return view.hasFocus() || element.contains(element.ownerDocument.activeElement);
}

/**
 * Where a click outside a popover or menu deliberately places focus: a field, a button,
 * a link, the document. Focus on such an element is not taken back after closing. Focus
 * on the page body or on the window container (the `Dialog` focus trap puts it there
 * when the focused node has disappeared) ended up there on its own, so it is returned.
 */
export const FOCUS_TARGET =
  'a[href], button, input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

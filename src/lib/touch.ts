/**
 * A touch screen without hover: a phone or a tablet with no trackpad.
 * There are no keyboard shortcuts there, so everything that describes them (menu
 * labels, the help button) only takes up space.
 *
 * A media query rather than device detection in JS: the class works from the first
 * frame and on the server (ADR-0018). A tablet with a trackpad attached
 * (`pointer: fine`) keeps the hints. Both conditions are needed so that a laptop with
 * a touch screen is not affected: it has a mouse, and it does not report `hover: none`.
 *
 * The class is kept whole, on one line: Tailwind finds it in the source as a word
 * (for consumers, through `@source` on `dist`), and a class assembled from pieces
 * would never reach the CSS.
 */
export const TOUCH_HIDDEN_CLASS = "[@media(hover:none)_and_(pointer:coarse)]:hidden";

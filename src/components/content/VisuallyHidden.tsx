"use client";

/**
 * Content for screen readers that is invisible to sighted users.
 *
 * A re-export of react-aria's component, not our own implementation, and this is deliberate:
 * "hide it, but keep it accessible" is easy to get wrong without noticing. `display: none` and
 * `visibility: hidden` remove the node from the accessibility tree altogether; `width: 0`
 * collapses the text to nothing, and some screen readers skip it; `text-indent: -9999px` breaks
 * horizontal page scrolling in RTL.
 *
 * The correct set is a 1×1 square with `clip-path`, `overflow: hidden` and `white-space: nowrap`.
 * react-aria maintains it and updates it along with browser changes. Tailwind's `sr-only` utility
 * does the same and is enough where a class will do; the component is needed when a whole subtree
 * has to be hidden.
 *
 * INSIDE A LINE YOU NEED `elementType="span"`. By default react-aria renders a `<div>`, and putting
 * it inside a `<p>` or a heading gives invalid nesting: React logs a hydration error to the console,
 * and the browser breaks the paragraph. For a long time this went unnoticed: the tests were green,
 * and the warning went to stderr.
 */
export { VisuallyHidden } from "react-aria-components";
export type { VisuallyHiddenProps } from "react-aria-components";

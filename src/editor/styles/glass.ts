/**
 * Glass for the Editor's floating surfaces: a semi-transparent backing of the
 * surface itself, blurring whatever lies behind it.
 *
 * VALUES ARE THE SAME AS FOR TOASTS (ADR-0010): 82 % of the color in `color-mix`
 * and a 14px blur. This is the kit's glass already, and a second set of values
 * would drift away from it at the first edit. Tooltips do not count: they have
 * their own 85 % and 10px, and the Editor does not touch them.
 *
 * THE COLOR IS THE TOKEN OF ITS OWN SURFACE, not a new one. The Toolbar sits on
 * `bg-1`, menu lists on `surface-elevated`, the Bubble menu on the inverse
 * surface. A theme changes the token, and the glass changes with it, without
 * separate values per theme. Inside the Bubble menu only the `--color-*` bridge
 * is reassigned (`SelectionBubble.tsx`), while the raw `--bg-1` and
 * `--surface-inverse` are not, which is why they are read here.
 *
 * WHY ONLY IN THE EDITOR. Surfaces get the glass through a class: `Menu` and
 * `PopoverContent` accept `className`, and `tailwind-merge` in `cn` removes the
 * solid backing of the Toolbar. The same components outside the Editor stay solid,
 * and the public API does not change.
 *
 * SOLID FALLBACK. `prefers-reduced-transparency` (the system's request to remove
 * transparency) and `prefers-contrast: more` return the solid token and remove
 * the blur. Under a semi-transparent backing, text contrast depends on what lies
 * under the menu, and `scripts/contrast.mjs` cannot check that.
 *
 * ON iOS THE SURFACE IS SOLID TOO. In Safari on iOS 27 the Editor's menus came
 * out with no backing at all: the items lay over the Document's text at full
 * strength. iOS WebKit did not draw the backing of a glass element, and this
 * could not be reproduced off the device: headless WebKit does not draw the blur
 * at all, so the difference is not visible there. The
 * `@supports (-webkit-touch-callout: none)` condition matches only WebKit on iOS
 * (Chrome there is WebKit too). Desktop does not match it and keeps the glass.
 */

/*
  CLASS NAMES ARE WRITTEN IN FULL, NOT ASSEMBLED FROM PIECES. Tailwind (in our
  build and in the consumer's build through `@source` on `dist`) finds a class
  only as a whole word in the source. A backing built by a template string from
  a token name never made it into the CSS: the blur was there, but the backing
  stayed transparent.
*/

/** The blur, and its removal when the user asks to reduce transparency or raise contrast. */
const BLUR =
  "backdrop-blur-[14px] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none " +
  "contrast-more:backdrop-blur-none [@supports(-webkit-touch-callout:none)]:backdrop-blur-none";

/** Floating Toolbar, image panel and Editor popovers: the `bg-1` surface. */
export const GLASS_PANEL_CLASS =
  "bg-[color-mix(in_srgb,var(--bg-1)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-bg-1 contrast-more:bg-bg-1 " +
  "[@supports(-webkit-touch-callout:none)]:bg-bg-1 " +
  BLUR;

/** Editor menu lists: the `surface-elevated` surface, as in `Menu`. */
export const GLASS_MENU_CLASS =
  "bg-[color-mix(in_srgb,var(--surface-elevated)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-surface-elevated " +
  "contrast-more:bg-surface-elevated [@supports(-webkit-touch-callout:none)]:bg-surface-elevated " +
  BLUR;

/** Bubble menu: the inverse surface. */
export const GLASS_INVERSE_CLASS =
  "bg-[color-mix(in_srgb,var(--surface-inverse)_82%,transparent)] " +
  "[@media(prefers-reduced-transparency:reduce)]:bg-surface-inverse " +
  "contrast-more:bg-surface-inverse [@supports(-webkit-touch-callout:none)]:bg-surface-inverse " +
  BLUR;

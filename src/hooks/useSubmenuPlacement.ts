"use client";

import { useMediaQuery } from "./useMediaQuery.js";

/** Already `sm` (640): at this width a submenu does not fit beside its item. */
const NARROW_QUERY = "(max-width: 639px)";

/**
 * Whether the screen is narrow by the kit's rule. The boundary is one and the same for
 * submenus and mega menus.
 *
 * An internal hook, like `useSubmenuPlacement`. Before hydration and without `matchMedia`
 * it returns `false`, that is, wide: there is no server width, and guessing it would
 * produce a markup mismatch (ADR-0018, see `useMediaQuery`).
 */
export function useNarrowScreen(): boolean {
  return useMediaQuery(NARROW_QUERY);
}

/**
 * Where to open a submenu: beside its item or below it.
 *
 * One rule for the whole kit: the nested `Menu` and the Editor's submenu both apply it.
 *
 * Beside is the usual choice on desktop. On a phone there is no room on either side: the
 * menu itself takes the middle of the screen, and react-aria, when it flips the submenu to
 * the other side, does not shrink its width. On iPhone the table's size grid went past the
 * left edge. So on a narrow screen the submenu opens below its item, over the parent menu,
 * as in the phone's own menus. On the cross axis react-aria shifts it into the screen.
 *
 * The width decides, not the pointer (`useCoarsePointer`): what matters is the space. A
 * phone turned sideways, and a tablet, keep the submenu beside its item.
 *
 * JS, not CSS: the submenu's place is a prop of the popover, not a class. The subscription
 * is there because the screen can be rotated on the fly. On the server and without
 * `matchMedia` it is beside: a submenu opens only in the browser, on a user action.
 *
 * An internal hook, not exported. A consumer of the kit sets the `placement` prop of `Menu`
 * itself, and the default for a nested menu is already defined here.
 */
export function useSubmenuPlacement(): "bottom start" | "right top" {
  return useNarrowScreen() ? "bottom start" : "right top";
}

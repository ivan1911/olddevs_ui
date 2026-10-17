"use client";

import { useState } from "react";

/**
 * An unavailable menu button uses `aria-disabled`, not `disabled`. The APG advises keeping
 * Toolbar actions focusable; otherwise arrow keys silently skip the button (as with the
 * Toolbar buttons, `EditorToolbar`). The `MenuButton` type does not know this attribute,
 * but the react-aria button passes it through to the DOM.
 */
export function unavailableProps(unavailable: boolean | undefined): object {
  return unavailable ? { "aria-disabled": true } : {};
}

/**
 * A Toolbar menu that can become unavailable (HTML mode, `aria-disabled`): a controlled
 * `MenuTrigger`. An unavailable button can still be pressed (it keeps focus and arrow
 * keys), but it does not open the menu, and an open menu that becomes unavailable is
 * closed. The shared scaffold for "¶", "…", "Alignment", "Lists", "+" and "Table":
 * `trigger` holds the props of `MenuTrigger`, `button` the props of the menu button,
 * and `close` closes the menu from code (a selection made not as an item but, for
 * example, in a grid).
 *
 * It lives in a separate module, not in `FormatMenus.tsx`: feature menus (table) use the
 * scaffold too, and a feature must not have to pull in the formatting menus for it.
 * Otherwise the shared UI and the feature would import each other (ADR-0060, item 14).
 */
export function useLockableMenu(unavailable: boolean) {
  const [open, setOpen] = useState(false);
  return {
    trigger: {
      isOpen: open && !unavailable,
      onOpenChange: (next: boolean) => setOpen(next && !unavailable),
    },
    button: unavailableProps(unavailable),
    close: () => setOpen(false),
  };
}

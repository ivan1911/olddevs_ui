"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Returns focus to whoever opened the modal layer.
 *
 * Radix returns focus to its own `Dialog.Trigger`, but the kit has none: windows open from
 * application state, not from a wrapped button. The modal content unconditionally calls
 * `event.preventDefault()` and focuses `triggerRef`, which does not exist. Focus goes to
 * `<body>`, and a keyboard user has to start tabbing through the page from the beginning.
 *
 * `Dialog` got the wiring first, then `Drawer` repeated it, and it had not reached
 * `CommandPalette` yet, even though the palette exists ONLY for keyboard users, so losing
 * focus there breaks its main function rather than being an inconvenience. Hence a shared
 * hook: the third copy is the reason to extract it.
 *
 * The copies had DIVERGED, which is the second argument. `Drawer` had two checks that
 * `Dialog` lacked (see `isOpenerCandidate`), so one and the same technique lived in two
 * versions of different quality. All three components now call one.
 */
/**
 * Whether this node can be the one that opened the layer.
 *
 * TWO cases are excluded, and both were found through live defects:
 *
 * - **`<body>`.** In StrictMode the layer mounts twice, and on the second pass focus has
 *   already moved away: `document.activeElement` is `body`. The naive version overwrote
 *   the real opener, and there was nowhere left to return focus to. The production build
 *   does not have this, but developers look at dev, and the mismatch reads as a bug.
 * - **Content of ITS OWN layer.** Remounting while the layer is already open would
 *   remember the layer's own close button. After closing, focus would go nowhere, because
 *   that button no longer exists at that point.
 *
 * ITS OWN, not "any dialog". The first version of this hook excluded everything inside
 * `[role="dialog"]`, and that broke NESTED windows: the button that opened a confirmation
 * lies inside the parent window by definition, so it was rejected, and after closing,
 * focus went to `<body>`. Before wave 26, `Dialog` had no such condition and worked
 * correctly. The `Drawer` rule ("not my own content") is strictly stronger and was taken
 * as the basis.
 */
function isOpenerCandidate(
  node: EventTarget | Element | null,
  content: HTMLElement | null
): node is HTMLElement {
  return node instanceof HTMLElement && node !== document.body && !content?.contains(node);
}

export function useOpenerFocus(
  open: boolean,
  /** The layer's own content. Focus inside it does not count as the opener. */
  contentRef: RefObject<HTMLElement | null>
): {
  /** In `onOpenAutoFocus`: remember whoever opened the layer. */
  remember: () => void;
  /** In `onCloseAutoFocus`: return focus to them. */
  restore: (event: Event) => void;
} {
  const opener = useRef<HTMLElement | null>(null);
  const lastOutside = useRef<HTMLElement | null>(null);

  /*
    `activeElement` in `onOpenAutoFocus` is NOT ALWAYS the one who opened the layer.

    For `Dialog` it is: Radix calls the callback before it moves focus inside. But the
    layer's content may take focus earlier. `CommandPalette` does exactly that: its search
    field autofocuses on mount. The palette's `input` was remembered, but by the time the
    layer closed it was already detached, so the `isConnected` check discarded it and focus
    went to `<body>`. The fix did not work in exactly the component it was written for.

    Hence we keep a history: the last focused node OUTSIDE the modal layer.

    The listener stays attached WHILE THE LAYER IS CLOSED, because that is when the thing to
    remember happens. The note about saving work that used to stand here claimed the opposite:
    we pay on every closed layer, and there are far more closed layers on a page than open
    ones. If this becomes measurable (a list where each row has its own `Dialog`), the history
    should become shared at module level, like the counter in `useScrollLock` and the stack in
    `overlay-layer.ts`. It is global in meaning too.
  */
  useEffect(() => {
    if (open) return;
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target;
      if (!isOpenerCandidate(el, contentRef.current)) return;
      lastOutside.current = el;
    };
    document.addEventListener("focusin", onFocusIn, true);
    return () => document.removeEventListener("focusin", onFocusIn, true);
  }, [open]);

  return {
    remember: () => {
      const active = document.activeElement;
      opener.current = isOpenerCandidate(active, contentRef.current) ? active : lastOutside.current;
    },
    restore: (event) => {
      /*
        `remember` MAY NOT RUN AT ALL, and you cannot rely on it.

        Radix does not always call `onOpenAutoFocus`. If the layer's content took focus during
        mount itself, as the palette's search field does, the callback never arrives (verified).
        So the `lastOutside` history is not a safety net but a full source: `remember` refines
        it wherever it gets the chance.
      */
      const el = opener.current ?? lastOutside.current;
      // `isConnected` is required: the button that opened the layer could have been removed
      // together with the list item that the layer was editing.
      if (!el?.isConnected) return;
      event.preventDefault();
      el.focus();
    },
  };
}

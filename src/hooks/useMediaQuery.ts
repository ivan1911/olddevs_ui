"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether the media query matches the window right now, and it tracks changes.
 *
 * THIS IS NOT A WAY TO LAY OUT THE PAGE. To show or hide a block by width, use a class
 * (`hidden lg:block`): a class works from the first frame and on the server, while a
 * layout that depends on JS shows the wrong one until hydration (ADR-0018). The hook is
 * for cases where the width decides not the look but the STRUCTURE or the BEHAVIOR:
 * what to mount, how many months to draw, whether to close a drawer on Escape. A class
 * cannot express those.
 *
 * BEFORE HYDRATION THE HOOK RETURNS `serverValue`, which defaults to `false`. The server
 * does not know the width, and guessing it would produce a markup mismatch. `false` is
 * the choice because the scale is mobile-first, like Tailwind itself: a `min-width`
 * query is "not matched yet" on the server, so the first frame is always narrow. During
 * hydration React takes the server value by itself and swaps in the real one right
 * after, with no mismatch error but with one extra render. On a wide screen that is a
 * visible jump, so anything that can be expressed with a class should be expressed with
 * a class.
 *
 * With no `matchMedia` at all (jsdom, server), it also returns `serverValue`: the hook
 * does not throw.
 *
 * The query is a plain string: `(min-width: 1024px)`. The kit's breakpoints are the
 * stock Tailwind 4 ones: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () =>
      typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue,
    [query, serverValue]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => serverValue);
}

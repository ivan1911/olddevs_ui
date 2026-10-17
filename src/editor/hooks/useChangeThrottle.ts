"use client";

// Origin: minimal-tiptap, `hooks/use-throttle.ts` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Rewritten: `flush` and `cancel`
// are added, and the call runs on the trailing edge. License: see NOTICE at the package root.

import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Runs at most once per `delay` ms, and only on the trailing edge.
 *
 * WHY THE TRAILING EDGE, NOT THE LEADING ONE, unlike the original. Handing over the value
 * means serializing the document to HTML, which walks the whole tree. A leading edge would
 * pay that cost on the first letter after a pause, which means almost every keystroke during
 * normal typing. The trailing edge accumulates edits and serializes once, when typing settles.
 * `emit` reads the document itself, at the moment of the call, instead of receiving a value
 * computed on every keystroke.
 *
 * `flush` does the same, but right away and only if something is pending: on `blur` and before
 * a form is submitted the value must be fresh, not lagging behind by `delay`. `cancel` drops a
 * pending call when the document was replaced from outside and there is no previous edit left
 * to hand over.
 *
 * Unmounting also flushes any pending call: otherwise the last letters typed before the form
 * closes would be silently lost.
 */
export function useChangeThrottle(emit: () => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const flush = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
    emitRef.current();
  }, []);

  const cancel = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const schedule = useCallback(() => {
    if (delay <= 0) {
      emitRef.current();
      return;
    }
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      emitRef.current();
    }, delay);
  }, [delay]);

  useEffect(() => flush, [flush]);

  // One object for the whole lifetime while the delay is unchanged: consumer effects
  // keep it in their dependencies and must not re-run on every render.
  return useMemo(() => ({ schedule, flush, cancel }), [schedule, flush, cancel]);
}

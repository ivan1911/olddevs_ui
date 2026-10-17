"use client";

import { useEffect, useRef } from "react";

/**
 * The lock counter is MODULE-LEVEL, and that is deliberate.
 *
 * Modals nest: a confirmation dialog opens on top of the editing window. When the nested
 * dialog closes, it must not unlock scrolling while the outer window is still open. So we
 * count the locks and release the scroll lock on the last one.
 *
 * It follows that the application must contain EXACTLY ONE copy of this module. Two
 * counters (say, one in the app and one in the package) cannot see each other, and the
 * nested case breaks silently: the inner dialog releases the lock that the outer one set.
 * That is why the hook lives here, next to the `body.scroll-locked` class in `styles.css`,
 * rather than being duplicated in the consumer.
 */
let lockCount = 0;

/**
 * Whose padding was on `<body>` before the first lock.
 *
 * The lock RETURNS the previous value instead of erasing it. Previously the release
 * assigned `paddingRight = ""` unconditionally, so an app that kept its own inline padding
 * on `<body>` (say, compensation for its fixed panel) lost it for good after the first
 * dialog the kit opened, until the page was reloaded.
 *
 * The module variable sits next to the counter for the same reason: locks nest, and the
 * original state can only be remembered on the 0→1 transition.
 */
let paddingBeforeLock = "";
/** What the lock itself set, so that it does not overwrite someone else's change. */
let paddingSetByLock = "";

function applyLock() {
  // The scrollbar disappears together with scrolling, and the content jumps sideways
  // by its width. We compensate with padding.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  paddingBeforeLock = document.body.style.paddingRight;
  document.body.classList.add("scroll-locked");
  paddingSetByLock = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
  if (paddingSetByLock) document.body.style.paddingRight = paddingSetByLock;
}

function removeLock() {
  document.body.classList.remove("scroll-locked");

  /*
    Restore the previous value, but only if OUR value is still in the style.

    The app may change the padding even while the lock is up (its own panel appeared while
    the dialog was open). An unconditional restore would overwrite that change, which is the
    same defect this code fixes, only from the other side.
  */
  if (document.body.style.paddingRight === paddingSetByLock) {
    if (paddingBeforeLock) document.body.style.paddingRight = paddingBeforeLock;
    else document.body.style.removeProperty("padding-right");
  }
  paddingBeforeLock = "";
  paddingSetByLock = "";
}

/** Locks page scrolling while `isLocked` is true. */
export function useScrollLock(isLocked: boolean): void {
  const wasLocked = useRef(false);

  useEffect(() => {
    if (isLocked && !wasLocked.current) {
      if (lockCount === 0) applyLock();
      lockCount++;
      wasLocked.current = true;
    } else if (!isLocked && wasLocked.current) {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) removeLock();
      wasLocked.current = false;
    }
  }, [isLocked]);

  // Unmounting while the lock is up is a normal case: a component with a modal can
  // disappear along with it. Without this, the counter would get stuck forever.
  useEffect(() => {
    return () => {
      if (wasLocked.current) {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) removeLock();
        wasLocked.current = false;
      }
    };
  }, []);
}

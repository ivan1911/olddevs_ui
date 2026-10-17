"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * The primary pointer is a finger (`pointer: coarse`): a phone or a tablet.
 *
 * WHY JS, NOT A CSS MEDIA QUERY. A media query would hide the floating Toolbar but
 * would not replace it with the fixed one: they are different nodes with different
 * layouts, and choosing between them is a render branch. Before hydration the branch
 * does not exist at all: the engine and the Toolbars appear only in the browser
 * (`immediatelyRender: false`), so a flicker of "the wrong Toolbar before hydration"
 * never happens here.
 *
 * It is a subscription, not a one-time measurement: a tablet with a mouse connected
 * and a convertible laptop change the primary pointer on the fly.
 *
 * On the server, and without `matchMedia`, it is `false`: the device is unknown, so
 * whatever the consumer chose stays in effect.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

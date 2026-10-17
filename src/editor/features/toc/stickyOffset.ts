"use client";

import { toPixels } from "../../../hooks/useStickyOffset.js";

/**
 * The last measurement of the top bar. The highlight reads the offset on every scroll
 * frame, and `toPixels` for a value that is not in pixels (`4rem`) measures it with a
 * probe element, which costs two layout passes. The measurement is repeated only when
 * the raw value changes, as in `useStickyOffset`.
 */
let measured: { raw: string; px: number | null } = { raw: "", px: null };

/** Height of the sticky top bar in pixels; if there is no such variable, `null`. */
export function stickyOffset(offsetVar: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
  if (!raw) return null;
  if (raw !== measured.raw) {
    const px = parseFloat(toPixels(raw, "0px"));
    measured = { raw, px: Number.isFinite(px) && px > 0 ? px : null };
  }
  return measured.px;
}

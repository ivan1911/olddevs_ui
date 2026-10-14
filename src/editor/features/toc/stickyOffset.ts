"use client";

import { toPixels } from "../../../hooks/useStickyOffset.js";

/**
 * Последний замер шапки. Подсветка читает отступ на каждом кадре прокрутки, а
 * `toPixels` для значения не в пикселях (`4rem`) меряет зонд — две раскладки.
 * Замер повторяется только при смене сырого значения, как в `useStickyOffset`.
 */
let measured: { raw: string; px: number | null } = { raw: "", px: null };

/** Высота липкой шапки в пикселях; переменной нет — `null`. */
export function stickyOffset(offsetVar: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
  if (!raw) return null;
  if (raw !== measured.raw) {
    const px = parseFloat(toPixels(raw, "0px"));
    measured = { raw, px: Number.isFinite(px) && px > 0 ? px : null };
  }
  return measured.px;
}

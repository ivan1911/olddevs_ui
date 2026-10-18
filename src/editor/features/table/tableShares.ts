/*
  Column widths of a table as shares of the table's width (ADR-0080), in 5% steps: the LIGHT part.

  The Document stores `<colgroup><col data-width="35">…</colgroup>`: values from 5 to 95, a multiple
  of 5, summing to 100. This module is what the start bundle and the server need: the check of one
  share and of a whole list, the reader of the Editor's own markup, and the `colgroup` the table
  writes. The Schema (`schema.ts`) sanitizes with it on the consumer's server, and the Skeleton shape
  of the table (`tableTool.ts`) parses with it, so it has no `"use client"` and no imports.

  The rest is in the table's lazy chunk: the arithmetic of the shares (`tableShareMath.ts`: rounding,
  moving a boundary, inserting and removing a column) and the reader of widths that other
  applications write (`tableShareForeign.ts`: points, pixels, percent).

  A share is counted in UNITS of 5% in the arithmetic, so that "the sum is 100" is "the sum is 20" and
  no rounding error can creep in. The public values are the units times five.
*/

/** The step of a share, in percent: the finest width the Document keeps. */
export const SHARE_STEP = 5;
/** Steps in a whole table. It is also the most columns that can each keep a share (20). */
export const SHARE_UNITS = 100 / SHARE_STEP;

/** Whether the value is a list of shares the Document may keep: 2 to 20 steps of 5% summing to 100. */
export function isShares(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > SHARE_UNITS) return false;
  let sum = 0;
  for (const share of value) {
    if (!Number.isInteger(share) || share < SHARE_STEP || share > 100 - SHARE_STEP) return false;
    if (share % SHARE_STEP !== 0) return false;
    sum += share;
  }
  return sum === 100;
}

/** Whether a value of `data-width` on a `col` is one share: digits only, a multiple of 5 from 5 to 95. */
export function isShareValue(value: string): boolean {
  if (!/^\d{1,2}$/.test(value)) return false;
  const share = Number(value);
  return share >= SHARE_STEP && share <= 100 - SHARE_STEP && share % SHARE_STEP === 0;
}

/**
 * The shares in the Editor's own markup: every `col` of the table has a `data-width`. `undefined` means
 * this is not that markup (no `colgroup`, or a `col` without the attribute: widths of another
 * application, for the reader in `tableShareForeign.ts`). `null` means it is, but the list breaks the
 * Schema's rules (the sum is not 100, a value is not a step), and it is dropped whole rather than
 * repaired.
 */
export function readStoredShares(table: Element): number[] | null | undefined {
  const columns = Array.from(table.querySelectorAll(":scope > colgroup > col, :scope > col"));
  if (columns.length === 0 || !columns.every((col) => col.hasAttribute("data-width"))) {
    return undefined;
  }
  const values = columns.map((col) => col.getAttribute("data-width")!.trim());
  const shares = values.map(Number);
  return values.every(isShareValue) && isShares(shares) ? shares : null;
}

/** The DOM spec of a table's `colgroup`, or nothing for a table without shares. */
export function colgroupSpec(shares: unknown): readonly [string, ...unknown[]] | null {
  if (!isShares(shares)) return null;
  return ["colgroup", {}, ...shares.map((share) => ["col", { "data-width": String(share) }])];
}

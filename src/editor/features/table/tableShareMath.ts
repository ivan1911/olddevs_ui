"use client";

import { SHARE_STEP, SHARE_UNITS } from "./tableShares.js";

/*
  The arithmetic of column shares (ADR-0080): rounding widths to steps of 5%, moving a boundary,
  inserting and removing a column, one step wider or narrower. Pure data in, data out, so the table
  node, the commands, the pointer handle and the paste cleanup share one set of rules. It lives in the
  table's lazy chunk; the start bundle has only the light part (`tableShares.ts`).
*/

/**
 * Proportions rounded to shares: positive weights (pixels, points, percent: only the ratio counts)
 * become multiples of 5 with a minimum of 5 and a sum of 100. The largest remainder wins the spare
 * steps, and ties go to the earlier column, so the result is the same for the same input. `null`
 * when there is nothing to share: fewer than two columns, more than twenty, or a weight that is not
 * a positive number.
 */
export function snapShares(weights: readonly number[]): number[] | null {
  const count = weights.length;
  if (count < 2 || count > SHARE_UNITS) return null;
  if (!weights.every((weight) => Number.isFinite(weight) && weight > 0)) return null;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const ideal = weights.map((weight) => (weight / total) * SHARE_UNITS);
  const units = ideal.map((value) => Math.max(1, Math.floor(value)));
  let spare = SHARE_UNITS - units.reduce((sum, value) => sum + value, 0);
  while (spare > 0) {
    let best = 0;
    for (let i = 1; i < count; i++)
      if (ideal[i]! - units[i]! > ideal[best]! - units[best]!) best = i;
    units[best]!++;
    spare--;
  }
  while (spare < 0) {
    let best = -1;
    for (let i = 0; i < count; i++) {
      if (units[i]! > 1 && (best < 0 || ideal[i]! - units[i]! < ideal[best]! - units[best]!))
        best = i;
    }
    units[best]!--;
    spare++;
  }
  return units.map((value) => value * SHARE_STEP);
}

/** Equal columns: the spare steps (20 is not divisible by 3) go to the leading columns. */
export function equalShares(columns: number): number[] | null {
  return snapShares(Array.from({ length: columns }, () => 1));
}

/** The share rounded to the nearest step. */
export function nearestShare(percent: number): number {
  return Math.round(percent / SHARE_STEP) * SHARE_STEP;
}

/**
 * The boundary before column `boundary` (from 1) moved so that the column on its left has `left`
 * percent. The two columns around it keep their sum, so the rest of the table does not move. The
 * value is rounded to a step and kept within 5% of either edge. `null` when nothing changes.
 */
export function moveBoundary(
  shares: readonly number[],
  boundary: number,
  left: number
): number[] | null {
  const a = shares[boundary - 1];
  const b = shares[boundary];
  if (a === undefined || b === undefined) return null;
  const pair = a + b;
  const next = Math.min(pair - SHARE_STEP, Math.max(SHARE_STEP, nearestShare(left)));
  if (next === a) return null;
  const result = [...shares];
  result[boundary - 1] = next;
  result[boundary] = pair - next;
  return result;
}

/**
 * One step wider (`1`) or narrower (`-1`) for a column, at the expense of its neighbour on the right,
 * or on the left for the last column. `null` when the neighbour or the column itself is at the minimum.
 */
export function nudgeShare(
  shares: readonly number[],
  column: number,
  direction: 1 | -1
): number[] | null {
  if (column < 0 || column >= shares.length || shares.length < 2) return null;
  const neighbour = column === shares.length - 1 ? column - 1 : column + 1;
  const result = [...shares];
  result[column]! += direction * SHARE_STEP;
  result[neighbour]! -= direction * SHARE_STEP;
  return result[column]! >= SHARE_STEP && result[neighbour]! >= SHARE_STEP ? result : null;
}

/**
 * Shares after a column is inserted at `at`, next to the column `donor` (ADR-0080, item 9): the new
 * column takes half of the donor's share, rounded down to a step. A donor at 5% has nothing to give,
 * and the widest column gives instead. `null` when there is no room: the table would have more than
 * twenty columns, or every column is at the minimum.
 */
export function insertShare(shares: readonly number[], at: number, donor: number): number[] | null {
  if (shares.length + 1 > SHARE_UNITS || donor < 0 || donor >= shares.length) return null;
  const result = [...shares];
  const half = Math.max(SHARE_STEP, nearestShareDown(shares[donor]! / 2));
  let give = half;
  let from = donor;
  if (shares[donor]! - half < SHARE_STEP) {
    from = shares.reduce((widest, share, i) => (share > shares[widest]! ? i : widest), 0);
    give = SHARE_STEP;
    if (shares[from]! - give < SHARE_STEP) return null;
  }
  result[from]! -= give;
  result.splice(at, 0, give);
  return result;
}

function nearestShareDown(percent: number): number {
  return Math.floor(percent / SHARE_STEP) * SHARE_STEP;
}

/**
 * Shares after columns `[from, to)` are removed: their share goes to the neighbour on the left, or
 * to the new first column when the first ones are removed. `null` when fewer than two columns remain
 * (a single column has no shares).
 */
export function removeShares(shares: readonly number[], from: number, to: number): number[] | null {
  const removed = shares.slice(from, to).reduce((sum, share) => sum + share, 0);
  const result = [...shares.slice(0, from), ...shares.slice(to)];
  if (result.length < 2) return null;
  result[Math.max(0, from - 1)]! += removed;
  return result;
}

export function sameShares(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b;
  return a.length === b.length && a.every((share, i) => share === b[i]);
}

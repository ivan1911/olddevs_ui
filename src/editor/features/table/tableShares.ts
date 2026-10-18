/*
  Column widths of a table as shares of the table's width (ADR-0080), in 5% steps.

  The Document stores `<colgroup><col data-width="35">…</colgroup>`: values from 5 to 95, a multiple
  of 5, summing to 100. Every function here is pure data in, data out, so the same rules serve the
  table node (`tables.ts`), its Skeleton shape (`tableTool.ts`), the commands and the pointer handle,
  and the paste cleanup step. It is not part of the lazy chunk (the Skeleton parses a table with it)
  and has no `"use client"`: the server-side Schema (`schema.ts`) checks a share with it.

  A share is counted in UNITS of 5%, so that "the sum is 100" is "the sum is 20" and no rounding
  error can creep in. The public values are the units times five.
*/

/** The step of a share, in percent: the finest width the Document keeps. */
export const SHARE_STEP = 5;
/** The widest table the Editor builds, which is also the most columns that can each keep a share. */
const TOTAL_UNITS = 100 / SHARE_STEP;

/** Whether the value is a list of shares the Document may keep: 2 to 20 steps of 5% summing to 100. */
export function isShares(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > TOTAL_UNITS) return false;
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
 * Proportions rounded to shares: positive weights (pixels, points, percent: only the ratio counts)
 * become multiples of 5 with a minimum of 5 and a sum of 100. The largest remainder wins the spare
 * steps, and ties go to the earlier column, so the result is the same for the same input. `null`
 * when there is nothing to share: fewer than two columns, more than twenty, or a weight that is not
 * a positive number.
 */
export function snapShares(weights: readonly number[]): number[] | null {
  const count = weights.length;
  if (count < 2 || count > TOTAL_UNITS) return null;
  if (!weights.every((weight) => Number.isFinite(weight) && weight > 0)) return null;
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const ideal = weights.map((weight) => (weight / total) * TOTAL_UNITS);
  const units = ideal.map((value) => Math.max(1, Math.floor(value)));
  let spare = TOTAL_UNITS - units.reduce((sum, value) => sum + value, 0);
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
  if (shares.length + 1 > TOTAL_UNITS || donor < 0 || donor >= shares.length) return null;
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

/* ── Reading widths from foreign HTML ───────────────────────────────── */

const PX_PER_UNIT: Readonly<Record<string, number>> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  em: 16,
  rem: 16,
};

/** A width in the unit it is written in: `%` is a share of the table, anything else is a length. */
export interface CssWidth {
  value: number;
  percent: boolean;
}

/**
 * `120`, `120px`, `90pt`, `1.5in`, `35%`: a width as Word, Excel and Google write it. A bare number is
 * pixels, as in the HTML `width` attribute. `auto`, `0` and anything else are not a width.
 */
export function parseCssWidth(text: string | null | undefined): CssWidth | null {
  const match = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(px|pt|pc|in|cm|mm|em|rem|%)?\s*$/i.exec(text ?? "");
  if (!match) return null;
  const number = Number(match[1]);
  if (!(number > 0)) return null;
  const unit = (match[2] ?? "px").toLowerCase();
  return unit === "%"
    ? { value: number, percent: true }
    : { value: number * PX_PER_UNIT[unit]!, percent: false };
}

/** The `width` of an inline `style` attribute, if the declaration is there. */
function styleWidth(element: Element): string | null {
  const match = /(?:^|;)\s*width\s*:\s*([^;]+)/i.exec(element.getAttribute("style") ?? "");
  return match ? match[1]!.trim() : null;
}

/**
 * The width an element declares: its inline `style` first (Word and Excel write the exact value in
 * points there, and a rounded pixel count in the attribute), then the `width` attribute.
 */
export function declaredWidth(element: Element): CssWidth | null {
  return parseCssWidth(styleWidth(element)) ?? parseCssWidth(element.getAttribute("width"));
}

/**
 * Weights for `snapShares` from a list of widths, or `null` when they cannot be compared: one is
 * missing, or percentages are mixed with lengths.
 */
export function weightsOf(widths: readonly (CssWidth | null)[]): number[] | null {
  if (widths.some((width) => width === null)) return null;
  const known = widths as CssWidth[];
  if (known.some((width) => width.percent !== known[0]!.percent)) return null;
  return known.map((width) => width.value);
}

/** The columns of a table as HTML declares them, a `span` expanded (Excel writes `<col span="2">`). */
export function columnElements(table: Element): Element[] {
  const columns: Element[] = [];
  for (const col of table.querySelectorAll(":scope > colgroup > col, :scope > col")) {
    const span = Number(col.getAttribute("span"));
    const repeat = Number.isInteger(span) && span > 1 ? Math.min(span, TOTAL_UNITS + 1) : 1;
    for (let i = 0; i < repeat; i++) columns.push(col);
  }
  return columns;
}

/**
 * The shares a table's HTML carries, or `null`.
 *
 * Two kinds of input, and they are told apart by the attribute. A `col` with `data-width` is the
 * Editor's own markup (and the output of the paste cleanup steps): it is taken as it is, and a list
 * that is not valid (the Schema's rules: multiples of 5, summing to 100) is dropped whole rather
 * than repaired. Anything else is a foreign `colgroup`, from a web page or a source without a cleanup
 * step: `width` and `style="width"` of each column are rounded to shares. A column without a width
 * leaves the table to the content, since the missing ones cannot be guessed.
 */
export function readColumnShares(table: Element): number[] | null {
  const columns = columnElements(table);
  if (columns.length < 2 || columns.length > TOTAL_UNITS) return null;
  if (columns.every((col) => col.hasAttribute("data-width"))) {
    const shares = columns.map((col) => Number(col.getAttribute("data-width")?.trim()));
    return isShares(shares) &&
      columns.every((col) => isShareValue(col.getAttribute("data-width")!.trim()))
      ? shares
      : null;
  }
  const weights = weightsOf(columns.map(declaredWidth));
  return weights ? snapShares(weights) : null;
}

/** The DOM spec of a table's `colgroup`, or nothing for a table without shares. */
export function colgroupSpec(shares: unknown): readonly [string, ...unknown[]] | null {
  if (!isShares(shares)) return null;
  return ["colgroup", {}, ...shares.map((share) => ["col", { "data-width": String(share) }])];
}

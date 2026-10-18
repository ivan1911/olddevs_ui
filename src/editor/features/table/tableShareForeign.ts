"use client";

import { snapShares } from "./tableShareMath.js";
import { readStoredShares, SHARE_UNITS } from "./tableShares.js";

/*
  Reading column widths that other applications write (ADR-0080, decision 7): `width` and
  `style="width"` in pixels, points, inches and percent, on a `col` (Excel, Google Docs and Sheets,
  any web page) or on the cells of a row (Word). They are rounded to shares with the same arithmetic
  the table uses everywhere else. It lives in the table's lazy chunk and in the paste cleanup chunk.
*/

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
    const repeat = Number.isInteger(span) && span > 1 ? Math.min(span, SHARE_UNITS + 1) : 1;
    for (let i = 0; i < repeat; i++) columns.push(col);
  }
  return columns;
}

/**
 * The shares a table's HTML carries, or `null`: the Editor's own markup as it is (`readStoredShares`),
 * otherwise a foreign `colgroup`, from a web page or a source without a cleanup step, whose `width`
 * and `style="width"` of each column are rounded to shares. A column without a width leaves the table
 * to the content, since the missing ones cannot be guessed.
 */
export function readColumnShares(table: Element): number[] | null {
  const stored = readStoredShares(table);
  if (stored !== undefined) return stored;
  const columns = columnElements(table);
  if (columns.length < 2 || columns.length > SHARE_UNITS) return null;
  const weights = weightsOf(columns.map(declaredWidth));
  return weights ? snapShares(weights) : null;
}

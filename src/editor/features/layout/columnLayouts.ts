import type { EditorLayoutVariant } from "../../../i18n/messages.js";

/**
 * The variants of the Column layout Block, as DATA. The Schema data, server-side sanitization
 * (`schema.ts`), the Editor and the Document styles (`prose.ts`) all read them.
 *
 * THE VARIANT NAME IS THE COLUMN WIDTHS IN PERCENT, JOINED BY A HYPHEN: `50-50`, `60-40`,
 * `25-25-25-25`. One entry covers all six variants. From the name alone, with no dictionary, you
 * can read both the number of columns and their fractions. That works in the consumer's database,
 * in the sanitizer, and in HTML from a foreign editor, where the widths come as the same
 * `flex-basis: 50%`. The order is the menu order (the owner's sample): one, two, three and four
 * columns, then 60/40, then 40/60.
 *
 * The module is safe for the server: it has data and pure functions, and no engine.
 */
export const EDITOR_LAYOUTS = [
  "100",
  "50-50",
  "33-33-33",
  "25-25-25-25",
  "60-40",
  "40-60",
] as const satisfies readonly EditorLayoutVariant[];

export type EditorLayout = (typeof EDITOR_LAYOUTS)[number];

/** The default variant, used by the Column layout item of the Insert menu: two equal columns. */
export const DEFAULT_LAYOUT: EditorLayout = "50-50";

/** The column limit: the Schema has no more than four. */
export const MAX_LAYOUT_COLUMNS = 4;

const known: ReadonlySet<string> = new Set(EDITOR_LAYOUTS);

/** The variant name from the Schema, or `null`. */
export function layoutFrom(value: unknown): EditorLayout | null {
  return typeof value === "string" && known.has(value) ? (value as EditorLayout) : null;
}

/** The column fractions of the variant, in percent. */
export function layoutWidths(layout: EditorLayout): number[] {
  return layout.split("-").map(Number);
}

/** The number of columns in the variant. */
export function layoutColumnCount(layout: EditorLayout): number {
  return layoutWidths(layout).length;
}

/**
 * The nearest variant for `count` columns (1–4) with the fractions `widths`.
 *
 * Foreign HTML carries widths as numbers (`flex-basis: 55%`), while the Schema has six presets.
 * Dragging does not change widths (the owner's decision). So the variant with the same number of
 * columns and the smallest total deviation of fractions is taken. Without usable fractions, the
 * columns are equal. The fractions are normalized to 100, so `1fr 1fr` and `30% 20%` are also 60/40.
 */
export function nearestLayout(count: number, widths: readonly number[] = []): EditorLayout {
  const columns = Math.min(Math.max(1, Math.floor(count) || 1), MAX_LAYOUT_COLUMNS);
  const candidates = EDITOR_LAYOUTS.filter((layout) => layoutColumnCount(layout) === columns);
  const total = widths.reduce((sum, width) => sum + width, 0);
  const usable =
    widths.length === columns && total > 0 && widths.every((width) => width > 0)
      ? widths.map((width) => (width / total) * 100)
      : null;
  if (!usable) return candidates[0]!;
  const distance = (layout: EditorLayout) =>
    layoutWidths(layout).reduce((sum, width, index) => sum + Math.abs(width - usable[index]!), 0);
  return candidates.reduce((best, layout) => (distance(layout) < distance(best) ? layout : best));
}

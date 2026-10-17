/**
 * A custom Editor color as DATA: the only form in which it exists in the document, and the parser
 * that guards that form.
 *
 * WHY `style` WHEN EVERYWHERE ELSE THERE ARE NAMES. The palettes (`palette.ts`) are names, and the
 * theme substitutes the value. A custom color is the author's value, and it has no name. The only
 * carrier of a value in HTML that the browser, the email client and the export all understand is
 * `style`. The exception to "no `style` in a Document" is NARROW and was approved by the owner: one
 * declaration, one hex color, two tags.
 *
 *   - `<span style="color:#rrggbb">` — text color;
 *   - `<mark style="background-color:#rrggbb">` — highlight.
 *
 * Lowercase letters, exactly six digits, nothing else in `style`, and never together with
 * `data-color` on the same element: a Mark has one color, either from the palette or a custom one.
 *
 * WHAT IS ACCEPTED FROM FOREIGN HTML (loading and pasting). Only this declaration, case- and
 * whitespace-insensitive, with an optional trailing semicolon; the case is lowered. Everything else
 * (`#abc`, `rgb()`, `red`, `var(--x)`, `!important`, a second declaration next to it) is dropped
 * together with the wrapper, and the text stays. Converting `rgb(255, 0, 0)` to `#ff0000` (as Word
 * and Google Docs write it) is technically simple, but it would widen the parser with formats that
 * the consumer's server sanitizer would also have to know, and guessing on the author's behalf is
 * something the kit already rejected for the palette (`styleExtensions.ts`). The strict form is
 * also what the sanitization in `sanitizeRichText` checks with one regular expression
 * (`RICH_TEXT_SCHEMA.customColor`).
 *
 * The module is safe on the server: data and pure functions, no imports.
 */

/** The CSS property that carries the color, by the tag of the Mark. */
export const CUSTOM_COLOR_PROPERTY = {
  span: "color",
  mark: "background-color",
} as const;

/** Kind of custom color: text or highlight. */
export type CustomColorKind = "text" | "highlight";

/** CSS property by kind of color. */
export const CUSTOM_COLOR_PROPERTY_BY_KIND: Record<CustomColorKind, string> = {
  text: CUSTOM_COLOR_PROPERTY.span,
  highlight: CUSTOM_COLOR_PROPERTY.mark,
};

/** Hex color in its canonical form: `#rrggbb`, lowercase. */
export const CUSTOM_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/**
 * `#RRGGBB` → `#rrggbb`; anything else gives `null`. This is used both in the commands and in
 * parsing, so a value with another case does not create two entries for one color.
 */
export function normalizeCustomColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return CUSTOM_COLOR_PATTERN.test(lower) ? lower : null;
}

/**
 * A color from a `style` value, only if it is ONE declaration of the needed property with
 * `#rrggbb`. Spaces around it and a trailing `;` are tolerated, since that is how the browser
 * itself writes `style` after an edit through the DOM.
 */
export function customColorFromStyle(
  style: string | null,
  property: (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY]
): string | null {
  if (style === null) return null;
  const match = /^\s*([a-z-]+)\s*:\s*(#[0-9a-f]{6})\s*;?\s*$/i.exec(style);
  return match && match[1]!.toLowerCase() === property ? normalizeCustomColor(match[2]) : null;
}

/** The `style` value as the Editor writes it: `color:#ff0000`, with no spaces and no `;`. */
export function customColorStyle(
  property: (typeof CUSTOM_COLOR_PROPERTY)[keyof typeof CUSTOM_COLOR_PROPERTY],
  color: string
): string {
  return `${property}:${color}`;
}

/**
 * The allowed `style` value by tag, as a regular expression STRING, the way the Schema publishes it
 * (`RICH_TEXT_SCHEMA.customColor.styles`). A string does not depend on the sanitizer's regex engine,
 * so it is carried into the config as is. The value has no spaces and no `;`, which is exactly how
 * the Editor writes it.
 */
export const CUSTOM_COLOR_STYLE_PATTERN = {
  span: `^${CUSTOM_COLOR_PROPERTY.span}:#[0-9a-f]{6}$`,
  mark: `^${CUSTOM_COLOR_PROPERTY.mark}:#[0-9a-f]{6}$`,
} as const;

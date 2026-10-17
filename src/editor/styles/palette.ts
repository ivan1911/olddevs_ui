/**
 * Editor text and marker color palettes as DATA: names, kit tokens and alignments.
 *
 * THERE ARE TWO PALETTES, AND THEY SHARE NO NAMES. The text color palette has six status
 * tones of the kit; the marker palette has nine colors: three bright ones and six older ones.
 * Both are written to `data-color`, but on different tags: `span[data-color]` takes its name
 * from the text palette, `mark[data-color]` from the marker palette. A name from the other
 * palette is not accepted on a tag.
 *
 * ONE TABLE FOR FOUR CONSUMERS: the Schema (`schema.ts`) takes the allowlist of names from
 * here, the extensions (`extensions.ts`) take the allowed attribute values, the Toolbar
 * (`EditorToolbar.tsx`) takes the set of swatches, and `scripts/contrast.mjs` takes the pairs
 * to check the contrast of. A color name added in one place and forgotten in another would be
 * a silent defect: the swatch exists, but the saved HTML does not have it. So there is one
 * place, and `tests/rich-text-editor-color.test.tsx` checks that the names match the classes
 * in `prose.ts`.
 *
 * WHY NAMES AND NOT VALUES. The Document stores `data-color="danger"`, not `#eea8a0`: the value
 * is the theme's business (`dark`, `light`, `dim`), and the same saved text reads correctly in
 * each of them. The name goes into the consumer's database and survives changes to token values.
 *
 * TEXT COLOR. The `strong` step of a tone is chosen for 4.5:1 on all of the app's backings.
 * The label shades (`--label-*`) were chosen for 3:1 (the dot next to a name), and as text on
 * `surface-elevated` in the dark themes they do not hold: blue 3.5, red 3.56. The cost is that the color is
 * tied to the accent: `accent` is the app's brand color, not a fixed blue. Indigo
 * (`accent-alt`) is not in the list: the token has no `strong` step and gives 2.3–3.5:1 as text.
 *
 * MARKER. Bright, like a real highlighter pen: yellow `#ffea80`, bright green `#aaff80`, pink
 * `#ff80bf`, the same in all themes (`dark`, `light`, `dim`) and on the `surface="paper"` sheet.
 * Text on a marker is always dark: the `--marker-text` token (about 14:1 on yellow and green,
 * 7.5:1 on pink) is what holds the 4.5:1 threshold, not `fg-0`. The six older Notion colors
 * live with their own values (the component layer's `--marker-*`, ADR-0003): each theme has
 * its own, and the text on them is the main text color. The menu offers them again (the
 * "Marker color" grid, the owner's decision): see `EDITOR_MARKERS`. The token is not named
 * after a status color and does not depend on the brand accent: `blue` does not change along
 * with `data-accent`.
 *
 * The module is server-safe: data, with no React, no engine and no imports. `scripts/contrast.mjs`
 * reads it directly.
 */
export const EDITOR_TEXT_COLORS = [
  { name: "accent", text: "accent-strong" },
  { name: "success", text: "success-strong" },
  { name: "warning", text: "warning-strong" },
  { name: "danger", text: "danger-strong" },
  { name: "lime", text: "draft-strong" },
  { name: "muted", text: "fg-2" },
] as const;

/** Text color name: what is written to `span[data-color]`. */
export type EditorTextColorName = (typeof EDITOR_TEXT_COLORS)[number]["name"];

/** Text color names in palette order: the allowlist for `span[data-color]`. */
export const EDITOR_TEXT_COLOR_NAMES: readonly EditorTextColorName[] = EDITOR_TEXT_COLORS.map(
  (color) => color.name
);

/**
 * Marker: a name, a backing token (`--marker-<name>`) and a "bright" flag.
 *
 * ALL NINE IN THE MENU (the owner's decision). Before that the menu offered only the three
 * bright ones, while the six older Notion colors stayed readable: the Schema, `RichTextView`
 * and the prose styles understood them, but they could not be chosen. The "Marker color" grid
 * shows all nine as dots: colors are picked by eye, and nine distinct dots are not clutter,
 * unlike nine rows of a menu.
 *
 * BRIGHT MEANS A DIFFERENT TEXT TREATMENT. The backing of a bright marker (yellow, green, pink)
 * is the same in all themes, and text on it is always dark: `--marker-text`. The backings of the
 * older ones are their own in each theme (dark in the dark themes), and text on them is the main
 * text color. The same distinction is made by the pairs in `scripts/contrast.mjs`.
 *
 * The menu order is the order of this array: by hue, as in Notion.
 */
export const EDITOR_MARKERS = [
  { name: "gray", token: "marker-gray", bright: false },
  { name: "brown", token: "marker-brown", bright: false },
  { name: "orange", token: "marker-orange", bright: false },
  { name: "yellow", token: "marker-yellow", bright: true },
  { name: "green", token: "marker-green", bright: true },
  { name: "blue", token: "marker-blue", bright: false },
  { name: "purple", token: "marker-purple", bright: false },
  { name: "pink", token: "marker-pink", bright: true },
  { name: "red", token: "marker-red", bright: false },
] as const;

/** Marker name: what is written to `mark[data-color]`. */
export type EditorMarkerName = (typeof EDITOR_MARKERS)[number]["name"];

/** Marker names in menu order: the allowlist for `mark[data-color]`. */
export const EDITOR_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.map(
  (marker) => marker.name
);

/** Bright markers: one backing in all themes, with `--marker-text` as the text color on it. */
export const EDITOR_BRIGHT_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.filter(
  (marker) => marker.bright
).map((marker) => marker.name);

/** The older Notion markers: each theme has its own backing, and the main text color is used on it. */
export const EDITOR_PALE_MARKER_NAMES: readonly EditorMarkerName[] = EDITOR_MARKERS.filter(
  (marker) => !marker.bright
).map((marker) => marker.name);

/**
 * Marker names from BEFORE the Notion palette, and their mapping to the nearest color.
 *
 * An older marker shared its names with the text color and painted the backing with the
 * `soft` step of a tone. Documents saved then carry one of the six names on `mark`, and
 * dropping them would silently remove the highlight from someone's text. So the name is
 * mapped on load and on paste, and `RichTextView` paints it with the same color (`prose.ts`)
 * when the server kept the old HTML as it is.
 *
 * The mapping goes by the hue of the backing, not by the meaning of the tone:
 *
 * - `accent` → `blue`: the kit's accent is blue (the brand's is a different one, but a saved
 *   document showed blue);
 * - `success` → `green`, `danger` → `red`, `muted` → `gray`: colors with the same names;
 * - `warning` → `yellow`: the amber of `warning-soft` is closer to Notion's yellow than to
 *   orange, which is redder;
 * - `lime` → `green`: the lime backing reads as green (hue 83° lies between yellow and green,
 *   but `warning` already takes yellow, and merging "draft" into it would give it the meaning
 *   of a warning).
 *
 * This works only on `mark`: text colors on `span` are not renamed.
 */
export const LEGACY_MARKER_NAMES = {
  accent: "blue",
  success: "green",
  warning: "yellow",
  danger: "red",
  lime: "green",
  muted: "gray",
} as const satisfies Record<EditorTextColorName, EditorMarkerName>;

/** Marker name from the `mark[data-color]` attribute: a current name as is, an older one mapped. */
export function markerNameFromAttribute(value: string | null | undefined): EditorMarkerName | null {
  if (value === null || value === undefined) return null;
  if ((EDITOR_MARKER_NAMES as readonly string[]).includes(value)) return value as EditorMarkerName;
  return Object.hasOwn(LEGACY_MARKER_NAMES, value)
    ? LEGACY_MARKER_NAMES[value as keyof typeof LEGACY_MARKER_NAMES]
    : null;
}

/**
 * Block alignment. `left` is the default: the attribute is not written, so a document
 * without alignment stays as it was before the cutover. `justify` is deliberately absent:
 * justified text without hyphenation breaks into "rivers" of spaces, and WCAG (1.4.8, AAA)
 * advises against it.
 */
export const EDITOR_ALIGNMENTS = ["left", "center", "right"] as const;

/** The `data-align` value. */
export type EditorAlignment = (typeof EDITOR_ALIGNMENTS)[number];

/** The default alignment: the value that is not written to the attribute. */
export const DEFAULT_ALIGNMENT: EditorAlignment = "left";

/**
 * Alignment that is written to the Schema, from a foreign attribute: `center` or `right`.
 * `left` (the default), `start`, `justify` and anything else give `null`.
 */
function writtenAlignment(value: string | null | undefined): EditorAlignment | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === "center" || normalized === "right" ? normalized : null;
}

/**
 * Alignment of an element of incoming HTML (`value` and paste).
 *
 * The Editor's own is `data-align`, with the exact value the Editor writes. A foreign one is
 * read too, but only by mapping it to a Schema name: `style="text-align: …"` (this is how Word,
 * Excel and Google Docs align) and the obsolete `align` attribute. The `style` and `align`
 * themselves do not get into the document: the output has only `data-align`.
 */
export function alignmentFromElement(element: HTMLElement): EditorAlignment | null {
  const own = element.getAttribute("data-align");
  if (own !== null) {
    return (EDITOR_ALIGNMENTS as readonly string[]).includes(own) && own !== DEFAULT_ALIGNMENT
      ? (own as EditorAlignment)
      : null;
  }
  // Parse the string instead of `element.style`: CSSOM in different environments
  // (browser, jsdom, server) handles the case of the property name and the spaces
  // around the colon differently, and here one value is needed.
  const style = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)/i.exec(element.getAttribute("style") ?? "");
  return writtenAlignment(style?.[1]) ?? writtenAlignment(element.getAttribute("align"));
}

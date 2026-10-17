import type { EditorWrapperTone } from "../../../i18n/messages.js";

/**
 * Callout tones are DATA: they are read by the data Schema and by server-side
 * sanitizing (`schema.ts`), by the Wrapper node and the Editor's Markdown
 * (`wrapper.ts`, `markdown.ts`), by the Block handle menu and the contrast gate
 * (`scripts/contrast.mjs`).
 *
 * THE NAMES ARE the kit's `Tone` vocabulary, not the words of the menu. The
 * Document gets `data-tone="warning"`: the name survives a change of label and
 * interface language, while the color value comes from the theme, as with
 * `data-color` (`palette.ts`). The menu labels are the GitHub alert words: Note,
 * Tip, Important, Warning, Caution. A tone is chosen by the meaning of the note,
 * not by its color.
 *
 * The order is the menu order and the GitHub alert order: NOTE, TIP, IMPORTANT,
 * WARNING, CAUTION.
 *
 * The module is server-safe: data and pure functions, without the engine.
 */
export const EDITOR_WRAPPER_TONES = [
  "accent",
  "success",
  "neutral",
  "warning",
  "danger",
] as const satisfies readonly EditorWrapperTone[];

const known: ReadonlySet<string> = new Set(EDITOR_WRAPPER_TONES);

/**
 * The tone from the `data-tone` attribute, or `null`. The value must match exactly
 * as the Editor writes it: `Accent`, ` accent` and names outside the vocabulary are
 * dropped, and the Wrapper stays without a tone.
 */
export function wrapperToneFrom(value: unknown): EditorWrapperTone | null {
  return typeof value === "string" && known.has(value) ? (value as EditorWrapperTone) : null;
}

/**
 * The GitHub alert label for a tone: a Wrapper with a tone in Markdown is a quote
 * whose first line is this label (`> [!NOTE]`). The mapping follows the meaning of
 * each label, as in the menu: NOTE is accent, TIP is success, IMPORTANT is neutral
 * (GitHub shows it purple, but the kit has no such tone), WARNING is warning,
 * CAUTION is danger.
 */
export const WRAPPER_TONE_ALERTS = {
  accent: "NOTE",
  success: "TIP",
  neutral: "IMPORTANT",
  warning: "WARNING",
  danger: "CAUTION",
} as const satisfies Record<EditorWrapperTone, string>;

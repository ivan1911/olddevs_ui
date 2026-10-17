/**
 * The kit's shared vocabulary of component props.
 *
 * Before the package was extracted, the same concept was named differently in each
 * primitive: `kind` on Button, `active` on Chip, `status` on StatusBadge, `tone` on
 * Tone. Below is the single permitted set of names. New primitives use it
 * rather than inventing their own.
 *
 * Three independent axes:
 *
 *   size    — size: means the same thing in every primitive
 *   tone    — semantic color: "what it means", not "how it looks"
 *   variant — the visual treatment of a tone: how prominently it is shown
 *
 * Boolean states are named `selected`, `disabled`, `loading`, not `active`, not
 * `isOpen`, not `enabled`. Names never contain negations.
 */

/** Size. Not every primitive supports all three, but the names mean the same thing. */
export type Size = "sm" | "md" | "lg";

/**
 * Button size: the shared scale plus `xs`.
 *
 * `xs` is taken out of `Size` rather than added to it, and that is a deliberate
 * decision. `Size` is the vocabulary for the whole kit: widen it, and every primitive
 * with a size axis starts accepting a value it cannot handle, and the compiler stays
 * silent. The button is the only one that needs a fourth step, and that is where it lives.
 */
export type ButtonSize = Size | "xs";

/**
 * Hues of user labels: project, tag, category.
 *
 * These are NOT tones. A tone describes meaning (`danger` means "the action is
 * destructive"), while a label means exactly what the person put into it. Semantic
 * tones must not be used for labels: a `danger`-colored dot next to a project will
 * read as an error, and the tone will stop meaning what it means.
 *
 * Names come from the hue, not from the purpose. The name is stored in the consumer's
 * database as a color key and outlives any change of values. The purpose differs for
 * every consumer, and `label-1` will tell nobody anything six months from now.
 *
 * The set is closed and does not depend on the accent or the brand: after switching
 * the accent, the user should not discover that all their projects changed color.
 */
export const LABEL_HUES = [
  "blue",
  "violet",
  "teal",
  "green",
  "amber",
  "red",
  "pink",
  "steel",
] as const;

export type LabelHue = (typeof LABEL_HUES)[number];

/**
 * Fill class by hue.
 *
 * A dictionary, not the concatenation `bg-label-${hue}`: Tailwind scans sources as
 * text, and a class assembled at runtime would never reach the CSS, silently and with
 * no build error. The same ban applies as in `lib/field.ts`.
 */
export const LABEL_BG_CLASS: Record<LabelHue, string> = {
  blue: "bg-label-blue",
  violet: "bg-label-violet",
  teal: "bg-label-teal",
  green: "bg-label-green",
  amber: "bg-label-amber",
  red: "bg-label-red",
  pink: "bg-label-pink",
  steel: "bg-label-steel",
};

/** The text class in the same hue, for a caption next to a label, not inside it. */
export const LABEL_TEXT_CLASS: Record<LabelHue, string> = {
  blue: "text-label-blue",
  violet: "text-label-violet",
  teal: "text-label-teal",
  green: "text-label-green",
  amber: "text-label-amber",
  red: "text-label-red",
  pink: "text-label-pink",
  steel: "text-label-steel",
};

/**
 * Semantic color. It describes meaning, not hue: `danger` means "the action is
 * destructive", not "red". So when the theme or accent changes, the meaning is kept
 * and the color changes.
 */
export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

/**
 * How prominently a tone is shown.
 *
 *   solid   — filled with the tone color, contrasting text
 *   soft    — a muted backing (`*-soft`)
 *   outline — border and text only
 *   ghost   — neither border nor background; a backing appears on hover
 */
export type Variant = "solid" | "soft" | "outline" | "ghost";

/**
 * Layout density: how much air there is inside a data row.
 *
 * A system-level axis, not a table one: the default is set by `UiProvider`, and a
 * table overrides it (ADR-0023). Two steps, not three: a "medium" density is
 * indistinguishable from one of its neighbors, and choosing among three turns into
 * guesswork.
 */
export type Density = "comfortable" | "compact";

/**
 * Numeral style.
 *
 * `tabular` — digits of equal width (`font-variant-numeric: tabular-nums`): anything
 * that ticks, recalculates or sits in a column stops shifting sideways when the
 * digits change. A measurement by a consumer on Inter, `md` size: for strings of ONE
 * length ("0:00", "0:11", "1:38", "8:21") the width varies by 4.65 px, while for
 * monospaced digits it is zero. In other words, a seconds timer jitters back and
 * forth on every tick.
 *
 * This is NOT a monospace face: the typeface stays the same, and only the digit width
 * changes. Anyone who needs a second font (`font-mono`) sets it separately.
 *
 * The axis is a string with a single value on purpose: `oldstyle` and `slashed-zero`
 * will join it over time, if the need appears, and that will not require a second
 * prop or make the boolean `tabular` a misnomer.
 */
export type Numeric = "tabular";

/** One class per axis value. The strings are literal: Tailwind scans them. */
export const NUMERIC_CLASS: Record<Numeric, string> = {
  tabular: "tabular-nums",
};

/**
 * Tone atoms: ready-made Tailwind classes from which the primitives build their look.
 *
 * IMPORTANT: every value here is a **whole literal string**. Tailwind scans sources as
 * text and does not execute code, so a class assembled at runtime (`hover:${t.bg}`)
 * would never reach the CSS, silently and with no build error. For the same reason
 * there is no `variant × tone` matrix generated on the fly: only a flat list of
 * ready-made strings, each of which the scanner sees.
 *
 * All tones are named by their full names, not by historical aliases: `bg-success`,
 * not `bg-ok`; `bg-danger`, not `bg-err`; `--accent`, not the Telegram-era `--tg`.
 * The values are identical (`--ok: var(--success)` and so on), so the look does not
 * change, but the tone dictionary and the class dictionary stop diverging in their
 * names. The aliases remain in `styles.css` for the front end, where there are still
 * dozens of them.
 */
export interface ToneAtoms {
  /** Text in the tone's color. */
  fg: string;
  /** Muted backing. */
  bg: string;
  /** Border in the tone's color. */
  border: string;
  /**
   * Fill with the tone + contrasting text.
   *
   * The text color here is NOT the same for all tones: `warning` and `success` take a
   * dark one (`--text-on-warning`/`--text-on-success`), and the rest take white
   * `--text-on-accent`. White on yellow gives 1.87 against the required 4.5, and this
   * cannot be fixed by picking a different shade. This is the second such exception,
   * after `softFg` on `neutral`; for text over `warning` and `success`, see
   * docs/palette.md.
   */
  solid: string;
  /** Hover for `solid`. */
  solidHover: string;
  /** Hover backing for `outline` and `ghost`. */
  softHover: string;
  /**
   * Text over the muted backing in `soft`.
   *
   * For `neutral` it is deliberately more contrasting than `fg`: `soft/neutral` is a
   * secondary button with a full-strength label, while `ghost`/`outline` of the same
   * tone are muted. A single `fg` for both cases made the label of a secondary button
   * washed out.
   */
  softFg: string;
  /** Hover backing for `soft`. */
  softBgHover: string;
  /** A solid fill in the tone, without text: for dot indicators and stripes. */
  dotBg: string;
  /**
   * Backing of a selected element: a menu item, a list option, a table row, a checked
   * checkbox.
   *
   * The `selected:` variant comes from the `tailwindcss-react-aria-components` plugin,
   * and it is the only one in this dictionary with no CSS equivalent at all: there is
   * no "selected" pseudo-class in CSS, and react-aria elements are very often rendered
   * as divs with a role, where even `:checked` would not apply. The plugin rewrites
   * the other atoms (`hover:`, `disabled:`) to a doubled selector, so they needed no
   * RAC-specific changes; see `styles.css`.
   */
  selectedBg: string;
  /** Text of a selected element. The pair of `selectedBg`. */
  selectedFg: string;
  /**
   * Backing while pressed: a menu item under a held mouse button.
   *
   * Deferred from T2 until `Menu` appeared, as the first component to render it. Class
   * coverage checks only the classes present in the primitives' markup, and an atom
   * that nobody renders would sit in the dictionary unchecked.
   *
   * `pressed:` instead of `active:`: the native `:active` also fires on the mouse, but
   * react-aria sets `data-pressed` the same way for mouse, touch and keyboard, while
   * `:active` does not fire from the keyboard at all.
   */
  pressedBg: string;
}

/**
 * The border of a field that failed validation.
 *
 * Deliberately outside the tone dictionary: "invalid" always means `danger`, regardless
 * of which tone colors the control itself. A field in the tone table that is identical
 * in all five rows is a constant pretending to be an axis.
 */
export const INVALID_BORDER_CLASS = "invalid:border-danger-strong";

export const TONE_TOKENS: Record<Tone, ToneAtoms> = {
  neutral: {
    fg: "text-fg-1",
    bg: "bg-bg-2",
    border: "border-line",
    solid: "bg-bg-4 text-fg-0",
    solidHover: "hover:bg-bg-3",
    softHover: "hover:bg-bg-2",
    softFg: "text-fg-0",
    softBgHover: "hover:bg-bg-3",
    dotBg: "bg-fg-3",
    selectedBg: "selected:bg-bg-3",
    selectedFg: "selected:text-fg-0",
    pressedBg: "pressed:bg-bg-4",
  },
  accent: {
    fg: "text-accent-strong",
    bg: "bg-accent-soft",
    border: "border-accent-strong",
    solid: "bg-accent text-text-on-accent",
    // The only tone with its own hover token; the others are dimmed with opacity.
    solidHover: "hover:bg-accent-hover",
    softHover: "hover:bg-accent-soft",
    softFg: "text-accent-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-accent-strong",
    selectedBg: "selected:bg-accent-soft",
    selectedFg: "selected:text-accent-strong",
    pressedBg: "pressed:bg-accent-soft",
  },
  success: {
    fg: "text-success-strong",
    bg: "bg-success-soft",
    border: "border-success-strong",
    // Not `text-on-accent`: white on green gives 2.61. See docs/palette.md.
    solid: "bg-success text-text-on-success",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-success-soft",
    softFg: "text-success-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-success-strong",
    selectedBg: "selected:bg-success-soft",
    selectedFg: "selected:text-success-strong",
    pressedBg: "pressed:bg-success-soft",
  },
  warning: {
    fg: "text-warning-strong",
    bg: "bg-warning-soft",
    border: "border-warning-strong",
    // Not `text-on-accent`: white on yellow gives 1.87, and it cannot be fixed by picking a different shade.
    solid: "bg-warning text-text-on-warning",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-warning-soft",
    softFg: "text-warning-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-warning-strong",
    selectedBg: "selected:bg-warning-soft",
    selectedFg: "selected:text-warning-strong",
    pressedBg: "pressed:bg-warning-soft",
  },
  danger: {
    fg: "text-danger-strong",
    bg: "bg-danger-soft",
    border: "border-danger-strong",
    solid: "bg-danger text-text-on-accent",
    solidHover: "hover:opacity-90",
    softHover: "hover:bg-danger-soft",
    softFg: "text-danger-strong",
    softBgHover: "hover:opacity-90",
    dotBg: "bg-danger-strong",
    selectedBg: "selected:bg-danger-soft",
    selectedFg: "selected:text-danger-strong",
    pressedBg: "pressed:bg-danger-soft",
  },
};

/**
 * The border of a "selected / checked" state indicator.
 *
 * A separate dictionary, not `TONE_TOKENS[tone].border`: for `neutral` that is
 * `border-line`, a divider border that the contrast gate lets through as decorative.
 * The border of a state indicator carries meaning and must hold 3:1 under WCAG
 * 1.4.11, so here `neutral` gets `fg-3`, and the rest get the same `*-strong` values.
 *
 * Why the checked checkbox and the `Toggle` in its on state need it: their fill (`solid`,
 * `bg-accent`) against the backing gives 1.07–2.9, for four of the five tones, in the
 * dark themes on `surface-elevated`, and in the light theme for `neutral`/`warning`.
 * Changing token values for this would visibly alter the look of the whole kit, so the
 * component's boundary is drawn by the border instead: it is what separates the box
 * from the backing. A check mark on the fill clears the threshold by itself (the
 * `solid/<tone> — text` pairs).
 *
 * Literal strings in full: Tailwind scans sources as text. `scripts/contrast.mjs`
 * reads this dictionary and measures each entry against the application's backings
 * and against the card, `bg-2`.
 */
export const STATE_BORDER: Record<Tone, string> = {
  neutral: "border-fg-3",
  accent: "border-accent-strong",
  success: "border-success-strong",
  warning: "border-warning-strong",
  danger: "border-danger-strong",
};

/** Classes for a `variant` + `tone` pair. Shared logic for all primitives with both axes. */
export function variantClasses(variant: Variant, tone: Tone): string {
  const t = TONE_TOKENS[tone];
  switch (variant) {
    case "solid":
      return `border-transparent ${t.solid} ${t.solidHover}`;
    case "soft":
      // The border and the contrasting text are not decoration: without them a secondary
      // button blends into the panel background. Reproduces the former `kind="ghost"`.
      return `${t.border} ${t.bg} ${t.softFg} ${t.softBgHover}`;
    case "outline":
      return `${t.border} ${t.fg} bg-transparent ${t.softHover}`;
    case "ghost":
      return `border-transparent ${t.fg} bg-transparent ${t.softHover}`;
  }
}

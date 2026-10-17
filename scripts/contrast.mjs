/**
 * Checks the contrast of the tokens against WCAG 2.x.
 *
 * Why this is separate from the a11y addon in Storybook: the addon checks the rendered DOM of
 * particular stories, so it only sees the combinations those stories happen to show. Here ALL
 * the combinations of `variant × tone × theme × accent` are enumerated, including the ones
 * that are not rendered anywhere yet. A difference in the numbers between the two tools is
 * not a contradiction: they measure different things.
 *
 * The pairs come from `variantClasses()`, that is, from the real output of the dictionary,
 * not from a list rewritten by hand. A hand-written list had already fallen behind the code:
 * after the `soft` change in 0.1.1 its contents no longer matched.
 *
 * `.ts` is imported directly: Node strips the types itself (without a flag since 22.18). The
 * lower Node bound of this package is already higher anyway: Storybook 10 requires 22.19+.
 *
 *   node scripts/contrast.mjs          failures only
 *   node scripts/contrast.mjs --all    the whole table
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_BORDER, TONE_TOKENS, variantClasses } from "../src/lib/variants.ts";
import { CHOICE_CARD_SELECTED_BORDER } from "../src/lib/choice-card.ts";
import { EDITOR_MARKERS, EDITOR_TEXT_COLORS } from "../src/editor/styles/palette.ts";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "../src/editor/styles/tokens.ts";
import { EDITOR_WRAPPER_TONES } from "../src/editor/features/wrapper/wrapperTones.ts";

const ROOT = resolve(import.meta.dirname, "..");

/**
 * The border of a selected card and the border of a checked box inside it are one signal in
 * one colour, but there are two dictionaries: `choice-card.ts` cannot import `variants.ts` at
 * runtime (Node does not map `.js` to `.ts`). The gate catches a drift between the dictionaries
 * here, instead of relying on a comment.
 */
for (const [tone, cls] of Object.entries(STATE_BORDER))
  if (CHOICE_CARD_SELECTED_BORDER[tone] !== cls)
    throw new Error(
      `CHOICE_CARD_SELECTED_BORDER.${tone} (${CHOICE_CARD_SELECTED_BORDER[tone]}) differs from ` +
        `STATE_BORDER.${tone} (${cls}) — the selected card and its checked box must share one colour.`
    );
const css = readFileSync(resolve(ROOT, "styles.css"), "utf8");

/** Text: 4.5:1. All text in the primitives is smaller than 18.66px bold / 24px, so there is no relaxation. */
const TEXT = 4.5;
/** Borders, dot indicators and icon indicators: 3:1, WCAG 1.4.11 Non-text Contrast. */
const NON_TEXT = 3;

/**
 * ALL the app's surfaces, not just two. The check uses the worst of the four: `*-soft` are
 * semi-transparent, so the same token gives less contrast on a lighter surface than on the
 * app background.
 *
 * **The list had two entries, `surface-app` and `surface-panel`, and that cost two missed
 * defects.** Both were found by the axe audit on the front end while the script reported zero
 * failures: the character counter of `TextControl` and the hint of `FormField`. Widening it to
 * four exposed 36 more combinations, and they are not theoretical: the `StatusBadge` pill of
 * the `warning` tone in a details card gave a real 4.42.
 *
 * Closed by recalibrating the palette on 2026-08-06: thirteen tokens (the `*-strong` tokens of
 * four tones, `text-muted`, `text-muted-2`) were moved to the 4.6 threshold, with some margin,
 * because a value of exactly 4.50 is rounded down to 4.49 by the browser. The user's decision:
 * the app became noticeably more contrasty, and the tones in the dark themes became lighter.
 *
 * Adding a new surface here means checking it honestly. If a fifth one appears, the gate will
 * turn red, and that is correct.
 */
const SURFACES = ["surface-app", "surface-panel", "surface-panel-hover", "surface-elevated"];

/**
 * Tokens the threshold does not apply to.
 *
 * `line` (`--border-default`) is the neutral border and divider. WCAG 1.4.11 requires 3:1 only
 * for the borders *needed to identify* a component. `soft` is identified by its fill and its
 * contrasting label, and cards and dividers by their placement. Raising it to 3:1 would mean
 * `#d9e2ec → #7192b8` in the light theme, which would make every border in the app harsh at
 * once. The user's decision, 2026-07-25.
 *
 * The borders of the TONES (`accent`, `danger`, `warning`, `success`) stay under the threshold:
 * they carry meaning, rather than separating one block from another.
 */
const DECORATIVE = new Set(["line", "line-soft"]);

const THEMES = ["dark", "light", "dim"];
const ACCENTS = ["blue", "violet"];

/**
 * Brands. `base` is the kit without a `data-brand` attribute; the others come in as overlays.
 *
 * The list is written by hand ON PURPOSE and is checked against the CSS below: a brand declared
 * in `styles.css` and forgotten here makes the script fail. Auto-discovery would look more
 * convenient and would be worse: the gate would quietly measure something other than what ships.
 * This is exactly how pairs were lost before: a coloured token lived in the CSS, and the check
 * did not see it.
 */
const BRANDS = ["base", "teal"];

// ─── parsing styles.css ───────────────────────────────────────────────────────

/** The body of a block, found by its selector. Braces are counted: `@theme` contains `@keyframes`. */
function blockBody(pattern) {
  const m = css.match(pattern);
  if (!m) throw new Error(`styles.css has no block ${pattern}`);
  let i = css.indexOf("{", m.index) + 1;
  const start = i;
  for (let depth = 1; depth > 0; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return css.slice(start, i - 1);
}

function decls(body) {
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** The bridge from a Tailwind utility to a token: `--color-accent-soft: var(--accent-soft)`. */
const themeBridge = decls(blockBody(/@theme\s*\{/));

/**
 * The Editor's highlight-marker tokens live in their own blocks on `[data-theme]` of ANY
 * element (a nested theme, OLDSUI-46), not on `:root[data-theme]`: the dark values are on
 * `:root` and on every theme except `light`, the light ones on `light`. Here they are added to
 * the base and to the light theme, as if they stood in those blocks.
 */
const MARKER_DARK = decls(blockBody(/:root,\s*\[data-theme\]:not\(\[data-theme="light"\]\)\s*\{/));
const MARKER_LIGHT = decls(blockBody(/^\[data-theme="light"\]\s*\{/m));
/**
 * The bright markers and the dark text on them (OLDSUI-61): one block for `:root` and any
 * theme, with a value shared by all themes. So here they are added to the base, not to the
 * dark or the light theme.
 */
const MARKER_BRIGHT = decls(blockBody(/^:root,\s*\[data-theme\]\s*\{/m));

const BASE = { ...decls(blockBody(/:root\s*\{/)), ...MARKER_DARK, ...MARKER_BRIGHT };
const THEME_VARS = {
  dark: {},
  light: { ...decls(blockBody(/:root\[data-theme="light"\]\s*\{/)), ...MARKER_LIGHT },
  dim: decls(blockBody(/:root\[data-theme="dim"\]\s*\{/)),
};
const ACCENT_VARS = {
  blue: {},
  violet: decls(blockBody(/:root\[data-accent="violet"\]\s*\{/)),
};

/**
 * Blocks where the theme and the accent stop being independent. Such a block is more specific
 * and comes after both in the CSS, so here it is also applied last.
 */
const COMBINED = {
  "light/violet": decls(blockBody(/:root\[data-theme="light"\]\[data-accent="violet"\]\s*\{/)),
};

/**
 * Brand overlays. A brand declares its own primitives inside its block, so `decls` picks up
 * both the palette and the role assignments. `resolveVar` then follows the same chain as it
 * does for the base.
 */
const BRAND_VARS = {
  base: {},
  teal: decls(blockBody(/:root\[data-brand="teal"\]\s*\{/)),
};

/** Blocks where the brand and the theme stop being independent, as with the accent above. */
const BRAND_COMBINED = {
  "light/teal": decls(blockBody(/:root\[data-theme="light"\]\[data-brand="teal"\]\s*\{/)),
};

/**
 * Checks the list against the CSS contents. A brand added to `styles.css` and not entered here
 * must not pass silently: the gate has to either measure it or fail.
 */
const declaredBrands = [
  ...new Set([...css.matchAll(/\[data-brand="([\w-]+)"\]/g)].map((m) => m[1])),
];
const unmeasured = declaredBrands.filter((b) => !BRANDS.includes(b));
if (unmeasured.length) {
  throw new Error(
    `Brand(s) ${unmeasured.map((b) => `"${b}"`).join(", ")} are declared in styles.css but absent from BRANDS ` +
      `in scripts/contrast.mjs. The gate would not measure them — add the brand to BRANDS and to BRAND_VARS.`
  );
}

/**
 * The Document's `--rte-*` roles in the app theme (`EDITOR_TOKENS_CLASS`): classes on the
 * Document's container, not a `styles.css` block. The values are references to the kit's
 * tokens, so they can be placed on any theme: `resolveVar` follows the reference to the
 * theme's value. The pairs of the Wrapper's Callout tone (OLDSUI-78) measure roles, not tokens: whatever
 * is in the class string is what gets checked.
 */
const rteRoles = (classes, pattern) =>
  Object.fromEntries([...classes.matchAll(pattern)].map((m) => [m[1], m[2]]));
/** Secondary text in a Wrapper with a Callout tone: the `--rte-tone-<role>` roles (`tokens.ts`). */
const TONE_TEXT_ROLES = ["link", "secondary", "muted", "muted-foreground"];

const THEME_ROLES = rteRoles(EDITOR_TOKENS_CLASS, /(?:^|\s)\[--(rte-[\w-]+):([^\]]+)\]/g);

/**
 * The order of application repeats the cascade in the CSS: base → theme → accent → the
 * "theme + accent" pair → brand → the "theme + brand" pair. The brand comes AFTER the accent,
 * because its block sits lower in the file at equal specificity: a set brand overrides the
 * accent axis entirely.
 */
const varsFor = (theme, accent, brand) => ({
  ...THEME_ROLES,
  ...BASE,
  ...THEME_VARS[theme],
  ...ACCENT_VARS[accent],
  ...(COMBINED[`${theme}/${accent}`] ?? {}),
  ...BRAND_VARS[brand],
  ...(BRAND_COMBINED[`${theme}/${brand}`] ?? {}),
});

function resolveVar(name, vars, depth = 0) {
  if (depth > 10) throw new Error(`Circular reference to --${name}`);
  const value = vars[name];
  if (value === undefined) throw new Error(`Token --${name} is not declared in any theme`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolveVar(ref[1], vars, depth + 1) : value;
}

// ─── color ────────────────────────────────────────────────────────────────────

const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((c) => c + c)
            .join("")
        : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = value.match(/^rgba?\(([^)]+)\)$/);
  if (fn) {
    const [r, g, b, a = "1"] = fn[1].split(/[,/]/).map((p) => p.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  throw new Error(`Could not parse colour: ${value}`);
}

/**
 * Alpha compositing: a semi-transparent `fg` over an opaque `bg`.
 *
 * The channels are rounded to whole numbers, as the browser rounds them before painting.
 * Without rounding the result drifts from axe by about 0.02, and a token tuned to "exactly
 * 4.50" comes out as 4.49 in the browser. This happened once: the script was green while axe
 * was red on the same element.
 */
const composite = (fg, bg) => ({
  r: Math.round(fg.a * fg.r + (1 - fg.a) * bg.r),
  g: Math.round(fg.a * fg.g + (1 - fg.a) * bg.g),
  b: Math.round(fg.a * fg.b + (1 - fg.a) * bg.b),
  a: 1,
});

function luminance({ r, g, b }) {
  const ch = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour of a Tailwind class: `bg-accent-soft` → `--color-accent-soft` → `--accent-soft`. */
function colorOfClass(className, vars) {
  if (className === "bg-transparent") return TRANSPARENT;
  // A direct reference to a variable: `bg-(--marker-gray)`. The marker reads the token
  // without the `@theme` bridge, which would substitute the root's value inside a nested theme.
  const direct = className.match(/^(?:bg|text|border)-\(--([\w-]+)\)$/);
  if (direct) return parseColor(resolveVar(direct[1], vars));
  // The Tailwind opacity modifier: `bg-label-red/25` is the token with 25% alpha.
  const [utility, opacity] = className.split("/");
  const name = utility.replace(/^(bg|text|border)-/, "");
  const bridged = themeBridge[`color-${name}`];
  if (bridged === undefined) throw new Error(`Class ${className} leads to no token`);
  const ref = bridged.match(/^var\(--([\w-]+)\)$/);
  const color = parseColor(ref ? resolveVar(ref[1], vars) : bridged);
  return opacity === undefined ? color : { ...color, a: color.a * (Number(opacity) / 100) };
}

// ─── pairs ────────────────────────────────────────────────────────────────────

/**
 * The worst contrast of a pair across all surfaces. It returns the surface as well: without it
 * it is unclear what to fix, the colour or the place where the primitive sits.
 */
function worstRatio(fgClass, bgClass, vars) {
  let worst = null;
  for (const surface of SURFACES) {
    const base = parseColor(resolveVar(surface, vars));
    const bg = composite(colorOfClass(bgClass, vars), base);
    const fg = composite(colorOfClass(fgClass, vars), bg);
    const ratio = contrast(fg, bg);
    if (!worst || ratio < worst.ratio) worst = { ratio, surface };
  }
  return worst;
}

/** The token without the utility prefix: `border-accent` and `bg-accent` are the same colour. */
const token = (cls) => cls.replace(/^(bg|text|border)-/, "");

/**
 * Pairs from the real output of the dictionary.
 *
 * Deduplication is by "kind × token × surface", not by class: `outline` and `ghost` give the
 * same pair, and a tone's border and its dot indicator are one colour on one surface, so it is
 * one computation. Otherwise the table swells with rows that differ only in their label.
 */
function pairs() {
  const out = new Map();
  const add = (kind, required, fgClass, bgClass, label) => {
    if (DECORATIVE.has(token(fgClass))) return;
    const key = `${kind}|${token(fgClass)}|${token(bgClass)}`;
    if (!out.has(key)) out.set(key, { kind, required, fgClass, bgClass, label });
  };

  for (const tone of Object.keys(TONE_TOKENS)) {
    for (const variant of ["solid", "soft", "outline", "ghost"]) {
      const classes = variantClasses(variant, tone)
        .split(/\s+/)
        .filter((c) => !c.startsWith("hover:"));
      const text = classes.find((c) => c.startsWith("text-"));
      const bg = classes.find((c) => c.startsWith("bg-")) ?? "bg-transparent";
      const border = classes.find((c) => c.startsWith("border-") && c !== "border-transparent");

      if (text) add("text", TEXT, text, bg, `${variant}/${tone} — text`);
      // The border is compared with what is outside it: it separates the primitive from the surface.
      if (border)
        add("non-text", NON_TEXT, border, "bg-transparent", `${token(border)} — border/indicator`);
    }
    const dot = TONE_TOKENS[tone].dotBg;
    add("non-text", NON_TEXT, dot, "bg-transparent", `${token(dot)} — border/indicator`);

    // The selected state is a separate pair, because `variantClasses()` does not return it.
    // It is not a variant of the tone's presentation, but a state on top of any of them.
    // Without this line, `selected:bg-bg-3` on `neutral` would remain the only combination
    // in the dictionary that the script does not see. For the other tones the pair matches
    // `soft` and is checked there, but the neutral one has its own surface, one step darker
    // than hover, otherwise a selected item cannot be told apart from a hovered one.
    const strip = (c) => c.replace(/^selected:/, "");
    add(
      "text",
      TEXT,
      strip(TONE_TOKENS[tone].selectedFg),
      strip(TONE_TOKENS[tone].selectedBg),
      `selected/${tone} — text`
    );
  }

  /*
   * User labels: eight hues, a non-text threshold.
   *
   * A label is a dot or a stripe next to a name, so it is a graphic signal rather than a
   * caption: WCAG 1.4.11, 3:1. The caption next to it is drawn as ordinary text on the app
   * surface and is checked by its own pairs above.
   *
   * They must be checked, and in every theme: a set chosen in the dark theme usually falls
   * apart in the light one, with half the hues merging into the background. Without these
   * lines, the comment in `styles.css` that says it "checks contrast" would be a promise
   * nobody keeps.
   */
  for (const hue of ["blue", "violet", "teal", "green", "amber", "red", "pink", "steel"])
    add("non-text", NON_TEXT, `bg-label-${hue}`, "bg-transparent", `label/${hue} — indicator`);

  /*
    The border of a selected choice card (`appearance="card"`).

    It is a state signal, not decoration: WCAG 1.4.11, 3:1. It is measured twice: against the
    app surfaces (outside the border) and against the card itself, `bg-2` (inside). The pairs
    `border-<tone>-strong` against the surfaces are already above, but the `neutral` border of
    the card has its own colour (`border-fg-3`, not `border-line`, which the gate skips as
    decorative), and the inner side is a new context for all five. Next to the border the card
    always has a second signal, a dot or a tick, but the border must hold the threshold on its own too.
  */
  for (const [tone, cls] of Object.entries(CHOICE_CARD_SELECTED_BORDER)) {
    add("non-text", NON_TEXT, cls, "bg-transparent", `card/${tone} — selected border outside`);
    add("non-text", NON_TEXT, cls, "bg-bg-2", `card/${tone} — selected border on the card`);
  }

  /*
    The border of a checked `Checkbox` box (and `mixed` uses the same box) and of an on
    `Toggle` track: `STATE_BORDER` from `variants.ts`.

    Being checked is a state signal, WCAG 1.4.11, 3:1. **The fill of a checked box does not
    hold the threshold against a surface**: `solid/<tone>` gives 1.07–2.9 for four of the five
    tones (`success` passes), in the dark themes on `surface-elevated` and in the light theme
    for `neutral` and `warning`. The gate with the pairs "fill against the surface and against
    `bg-2`" failed on 48 of 288 combinations. The kit's token values did not change (a visible
    change of look), so the box's edge is carried by its border, and what is measured is what
    the component actually draws: the border against the app surfaces (a checkbox in a row or
    a table) and against `bg-2`, the surface of the card inside which the box sits with
    `appearance="card"`. The tick on the fill is measured by the `solid/<tone> — text` pairs above.
  */
  for (const [tone, cls] of Object.entries(STATE_BORDER)) {
    add("non-text", NON_TEXT, cls, "bg-transparent", `checkbox/${tone} — checked box edge outside`);
    add("non-text", NON_TEXT, cls, "bg-bg-2", `checkbox/${tone} — checked box edge on the card`);
  }

  /*
    The Editor's text colour and highlight-marker palettes (`src/editor/styles/palette.ts`, OLDSUI-46).

    This is document text that people read, so the threshold is the text one, 4.5:1, on all
    surfaces: the Editor sits on `bg-2`, and `RichTextView` sits on the page background.

    The text colour is the `strong` step of a tone, right on the app surface. A marker is an
    opaque `--marker-<name>` surface. The three bright ones (yellow, green, pink) are the same
    in every theme, and the text on them is ALWAYS dark: `--marker-text`, not the theme's
    `fg-0` (OLDSUI-61). The six older Notion colours kept their values (light pastel, dark
    muted; the dusk theme takes the dark one) and the `fg-0` text: a `mark` with their name
    leaves the colour inheritable. Nine markers × three themes × brand are all enumerated
    below, like any pair. The gate does not measure coloured text on a marker of a DIFFERENT
    colour: the author chose that and sees the result.
  */
  for (const { name, text } of EDITOR_TEXT_COLORS)
    add("text", TEXT, `text-${text}`, "bg-transparent", `editor text colour ${name}`);
  for (const { name, token, bright } of EDITOR_MARKERS)
    add(
      "text",
      TEXT,
      bright ? "text-(--marker-text)" : "text-fg-0",
      `bg-(--${token})`,
      `editor marker ${name} — ${bright ? "dark marker text" : "body text"}`
    );

  // Text tokens outside the tone dictionary: they set the hierarchy of the labels.
  for (const [cls, label] of [
    ["text-fg-1", "text-secondary on a surface"],
    ["text-fg-2", "text-muted on a surface"],
    ["text-fg-3", "text-muted-2 on a surface"],
  ])
    add("text", TEXT, cls, "bg-transparent", label);

  /*
    Selected text (OLDSUI-116): the global `::selection` and the Document's `--rte-selection`
    role in the theme both sit on `--selection`, and the text on top of it is the primary one.
    The selection fill is now dense (up to 45% alpha), and light text on it in the dark themes
    is exactly what can drop below 4.5. The gate does not measure how distinct the fill itself
    is from the surface (1.5–2:1): 3:1 is not the target there, see `--selection` in `styles.css`.
  */
  add("text", TEXT, "text-fg-0", "bg-(--selection)", "selected text");

  // The same tokens INSIDE an input field, on `bg-2`.
  //
  // This is a separate context, not the same one: the field's surface is lighter than the page
  // background, and muted text that passes the threshold on the second fails it on the first.
  // This is exactly what happened with the character counter of `TextControl`: `text-fg-3` gave
  // 4.0 against the required 4.5, and only the axe audit caught it, because the script did not
  // know this pair.
  add("text", TEXT, "text-fg-2", "bg-bg-2", "text-muted inside a field");

  /*
    Muted text INSIDE A CARD, also on `bg-2`.

    A separate pair, because this is a separate context: the `FormField` hint, a caption under
    a value, a second line in a block are all `text-fg-3` used as TEXT, not as an icon. The
    script knew `fg-3` on `bg-2` only with the non-text threshold (the icon slot, 3:1), and let
    the text failure through.

    The axe audit on the front end found it: the hint "Optional. Specify the plot…" in the upload
    block gave 4.0 against the required 4.5, and the same pair hit the "Full access" row in the
    sidebar. The script reported zero failures the whole time.
  */
  add("text", TEXT, "text-fg-3", "bg-bg-2", "text-muted-2 inside a card");

  // `fg-3` inside a field is the colour of an ICON SLOT (the search magnifier, the unit of
  // measure), not of text, so the threshold is the non-text one. It is never used as text
  // inside a field: the character counter takes `fg-2` precisely because 4.5 did not pass on
  // this surface, and the kit does not colour the placeholder at all: that uses the browser's colour.
  add("non-text", NON_TEXT, "text-fg-3", "bg-bg-2", "text-muted-2 — icon inside a field");

  /*
    The `draft` tone marks unsaved edits. It is not in `TONE_TOKENS`: it has no variant of its
    own, the components do not accept it, and it is a palette for an application screen (the
    border of a changed card and the label next to it).

    So the pairs are added by hand. Otherwise the token would remain the only coloured one in
    `styles.css` that the gate cannot see. This is how pairs were lost before, and the reason
    three separate `add` calls for `fg-2`/`fg-3` appear below.
  */
  add("text", TEXT, "text-draft-strong", "bg-transparent", "draft-strong — label");
  add("non-text", NON_TEXT, "border-draft-strong", "bg-transparent", "draft-strong — border");
  add("non-text", NON_TEXT, "border-draft", "bg-transparent", "draft — border/indicator");

  /*
    The `Rating` star is the same case as `draft`: its own token of the component layer
    (ADR-0040), absent from both `TONE_TOKENS` and the component axes. Without this pair the
    gate would not see it at all.

    The threshold is non-text: a row of stars carries the value visually, so it is not decoration.
    The empty star is taken as a second pair: it means "not selected", and it has to be told
    apart from the filled one by eye.
  */
  add("non-text", NON_TEXT, "text-rating-star", "bg-bg-1", "rating-star — filled star");
  add("non-text", NON_TEXT, "text-fg-3", "bg-bg-1", "text-muted-2 — empty star");

  /*
    The inverse surface is the Editor's selection menu (`toolbar="bubble"`, OLDSUI-69): a light
    pill in the dark themes, a dark one in the light theme.

    The pill is opaque, so the app surface under it does not enter the calculation. The pair
    measured is "what is on the pill against the pill itself" in its three states: at rest,
    hovered, pressed (a pressed mark, an open menu). The pill has no captions, only icons, but
    its text threshold is the text one: the token is named "text on inverse", and a caption on it
    has to be readable. The icons are measured separately, at 3:1 (WCAG 1.4.11). The focus ring is
    `accent-on-inverse`, also 3:1, and also on all three surfaces, since focus can land on a
    pressed button too.
  */
  for (const [bg, state] of [
    ["bg-surface-inverse", "at rest"],
    ["bg-surface-inverse-hover", "hovered"],
    ["bg-surface-inverse-pressed", "pressed"],
  ]) {
    add("text", TEXT, "text-text-on-inverse", bg, `inverse surface ${state} — text`);
    add("non-text", NON_TEXT, "text-text-on-inverse", bg, `inverse surface ${state} — icon`);
    add(
      "non-text",
      NON_TEXT,
      "text-accent-on-inverse",
      bg,
      `inverse surface ${state} — focus ring`
    );
  }

  /*
    The Editor's Wrapper Callout tone (OLDSUI-78): the soft tone surface and a 3 px stripe on the left,
    roles `--rte-tone-<tone>-background` and `-border` (`tokens.ts`).

    The text on the surface is the ordinary Document text (`--rte-foreground`) and the secondary
    text that a Wrapper with a Callout tone takes from the `--rte-tone-*` roles: a link, a quote, muted
    text (a caption, a completed item, grey text) and a hint. The threshold is the text one, on
    all the app surfaces: the tone surfaces are semi-transparent, and the contrast is lower on
    the lightest of them. The gate does not measure the author's own text colour (the palette and
    a custom colour), since that is the author's choice. The stripe is a tone signal: WCAG 1.4.11,
    3:1, against what surrounds the Wrapper: the app surfaces outside and its own fill inside.
  */
  for (const tone of EDITOR_WRAPPER_TONES) {
    const background = `bg-(--rte-tone-${tone}-background)`;
    const border = `border-(--rte-tone-${tone}-border)`;
    add("text", TEXT, "text-(--rte-foreground)", background, `wrapper tone ${tone} — body text`);
    for (const role of TONE_TEXT_ROLES)
      add("text", TEXT, `text-(--rte-tone-${role})`, background, `wrapper tone ${tone} — ${role}`);
    add("non-text", NON_TEXT, border, "bg-transparent", `wrapper tone ${tone} — stripe outside`);
    add("non-text", NON_TEXT, border, background, `wrapper tone ${tone} — stripe on its fill`);
  }

  return [...out.values()];
}

// ─── the Editor's Paper (`surface="paper"`) ───────────────────────────────────

/*
  Paper (OLDSUI-52) is a light Document in ANY app theme, so the pairs above, which measure the
  kit's tokens on the theme's surfaces, do not cover it: the `--rte-*` roles of the Paper look
  at the light theme's primitives, and the accent looks at the app theme's fill. Here each pair
  is measured against the Paper itself (`--rte-background`) across all themes × accents × brands.

  The role values come from `EDITOR_PAPER_TOKENS_CLASS`, the same class string that is on the
  Paper, not from a hand-written list. The Paper carries a nested `data-theme="light"`, so the
  markers and the highlighting theme take the light blocks of `styles.css`. In a light app the
  accent roles are the root variant.
*/
const PAPER = rteRoles(EDITOR_PAPER_TOKENS_CLASS, /(?:^|\s)\[--(rte-[\w-]+):([^\]]+)\]/g);
const PAPER_LIGHT_ROOT = rteRoles(
  EDITOR_PAPER_TOKENS_CLASS,
  /\[:root\[data-theme=light\]_&\]:\[--(rte-[\w-]+):([^\]]+)\]/g
);
const CODE_LIGHT = decls(blockBody(/:where\(\[data-theme="light"\]\)\s*\{/));
if (!PAPER["rte-background"] || !CODE_LIGHT["rte-code-block-background"])
  throw new Error(
    "The paper roles or the light code theme could not be read — the gate would be blind."
  );

const paperVarsFor = (theme, accent, brand) => ({
  ...varsFor(theme, accent, brand),
  ...MARKER_LIGHT,
  ...CODE_LIGHT,
  ...PAPER,
  ...(theme === "light" ? PAPER_LIGHT_ROOT : {}),
});

function paperPairs() {
  const out = [];
  const add = (kind, required, fg, bg, label) => out.push({ kind, required, fg, bg, label });
  for (const role of [
    "rte-foreground",
    "rte-secondary",
    "rte-muted",
    "rte-muted-foreground",
    "rte-link",
    ...EDITOR_TEXT_COLORS.map(({ name }) => `rte-text-${name}`),
  ])
    add("text", TEXT, role, null, `paper: ${role}`);
  for (const { name, token, bright } of EDITOR_MARKERS)
    add(
      "text",
      TEXT,
      bright ? "marker-text" : "rte-foreground",
      token,
      `paper: marker ${name} — ${bright ? "dark marker text" : "body text"}`
    );
  add("text", TEXT, "rte-foreground", "rte-code-background", "paper: inline code, table header");
  add("text", TEXT, "rte-foreground", "rte-selection", "paper: selected text and cells");
  add("text", TEXT, "rte-secondary", "rte-control-hover", "paper: code header button, hovered");
  add("text", TEXT, "rte-secondary", "rte-code-block-background", "paper: code header text");
  for (const role of Object.keys(CODE_LIGHT))
    if (role !== "rte-code-block-background")
      add("text", TEXT, role, "rte-code-block-background", `paper: code ${role}`);
  add("non-text", NON_TEXT, "rte-ring", null, "paper: focus of a control in the document");
  add("non-text", NON_TEXT, "rte-primary", null, "paper: checkbox, selected image outline");
  // The Wrapper Callout tone on the Paper (OLDSUI-78): the same three pairs as in the theme, against the Paper.
  for (const tone of EDITOR_WRAPPER_TONES) {
    const background = `rte-tone-${tone}-background`;
    const border = `rte-tone-${tone}-border`;
    add("text", TEXT, "rte-foreground", background, `paper: wrapper tone ${tone} — body text`);
    for (const role of TONE_TEXT_ROLES)
      add("text", TEXT, `rte-tone-${role}`, background, `paper: wrapper tone ${tone} — ${role}`);
    add("non-text", NON_TEXT, border, null, `paper: wrapper tone ${tone} — stripe outside`);
    add(
      "non-text",
      NON_TEXT,
      border,
      background,
      `paper: wrapper tone ${tone} — stripe on its fill`
    );
  }
  return out;
}

/** A pair on the Paper: the surface (if any) over the Paper, the text over that. */
function paperRatio({ fg, bg }, vars) {
  const sheet = parseColor(resolveVar("rte-background", vars));
  const under = bg ? composite(parseColor(resolveVar(bg, vars)), sheet) : sheet;
  return contrast(composite(parseColor(resolveVar(fg, vars)), under), under);
}

// ─── self-check of the calculation ────────────────────────────────────────────

/**
 * An anchor from the original contrast specification: `#1f7ae0` on `rgba(31,122,224,0.16)` over
 * `#26272d` = 2.95. These are the token values at the time of measurement in the spec.
 *
 * The colours here are LITERAL, not taken from `styles.css`, and that is deliberate: what is
 * verified is the formula and the alpha compositing, not the current palette. Had the anchor been
 * read from the tokens, it would fail on every legitimate change to `--accent`, which is exactly
 * when the script is most needed. This happened once.
 */
function selfCheck() {
  const bg = composite(parseColor("rgba(31, 122, 224, 0.16)"), parseColor("#26272d"));
  const ratio = contrast(parseColor("#1f7ae0"), bg);
  if (Math.abs(ratio - 2.95) > 0.06) {
    console.error(
      `The self-check did not add up: #1f7ae0 on rgba(31,122,224,0.16) over #26272d = ` +
        `${ratio.toFixed(2)}, expected 2.95. The formula is broken — the table below cannot be trusted.`
    );
    process.exit(2);
  }
}

// ─── run ──────────────────────────────────────────────────────────────────────

selfCheck();

const showAll = process.argv.includes("--all");
const ALL_PAIRS = pairs();
const rows = [];

for (const pair of ALL_PAIRS)
  for (const theme of THEMES)
    for (const accent of ACCENTS)
      for (const brand of BRANDS) {
        // A brand has its own accent axis. Measuring it twice, once per accent,
        // would double the rows without adding a single combination.
        if (brand !== "base" && accent !== ACCENTS[0]) continue;
        const vars = varsFor(theme, accent, brand);
        const { ratio, surface } = worstRatio(pair.fgClass, pair.bgClass, vars);
        rows.push({ ...pair, theme, accent, brand, ratio, surface, ok: ratio >= pair.required });
      }

const PAPER_PAIRS = paperPairs();
for (const pair of PAPER_PAIRS)
  for (const theme of THEMES)
    for (const accent of ACCENTS)
      for (const brand of BRANDS) {
        if (brand !== "base" && accent !== ACCENTS[0]) continue;
        const ratio = paperRatio(pair, paperVarsFor(theme, accent, brand));
        rows.push({
          ...pair,
          theme,
          accent,
          brand,
          ratio,
          surface: "paper sheet",
          ok: ratio >= pair.required,
        });
      }

/** `dark/blue` for the base, `dark/teal` for a brand: a brand has its own accent. */
const variantLabel = (r) => `${r.theme}/${r.brand === "base" ? r.accent : r.brand}`;

const failed = rows.filter((r) => !r.ok);
const shown = (showAll ? rows : failed).sort((a, b) => a.ratio - b.ratio);

if (shown.length) {
  const col = (rs, get) => Math.max(...rs.map((r) => get(r).length));
  const w = {
    label: col(shown, (r) => r.label),
    theme: col(shown, (r) => variantLabel(r)),
    surface: col(shown, (r) => r.surface),
  };
  console.log(
    `${"pair".padEnd(w.label)}  ${"theme/accent".padEnd(w.theme)}  ${"surface".padEnd(w.surface)}  actual  required`
  );
  for (const r of shown)
    console.log(
      `${r.label.padEnd(w.label)}  ${variantLabel(r).padEnd(w.theme)}  ` +
        `${r.surface.padEnd(w.surface)}  ${r.ratio.toFixed(2).padStart(7)}  ${r.required.toFixed(1).padStart(9)}`
    );
  console.log();
}

const textRows = rows.filter((r) => r.kind === "text");
console.log(
  `Checked ${rows.length} combinations: ${ALL_PAIRS.length} pairs + ${PAPER_PAIRS.length} paper-sheet pairs × ${THEMES.length} themes × ` +
    `(${ACCENTS.length} base accents + ${BRANDS.length - 1} brand).\n` +
    `Failures: ${failed.length} — of them text ${failed.filter((r) => r.kind === "text").length} ` +
    `of ${textRows.length}, non-text ${failed.length - failed.filter((r) => r.kind === "text").length} ` +
    `of ${rows.length - textRows.length}.`
);

process.exit(failed.length ? 1 : 0);

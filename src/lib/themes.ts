/**
 * The registry of the kit's themes: which axes exist, how to bring a value to an
 * allowed one, and how to apply it to the document.
 *
 * Why this lives in the kit and not in the consumer. The axes are declared in
 * `styles.css`, but until 2.1.0 they were not exported, so every consumer rewrote
 * the lists as constants of its own. In one consumer product that is
 * `["light","dark","dim"]` in one place and `value === "violet" ? "violet" : "blue"`
 * in another; a second project would write them a third time, and they would drift
 * apart silently. The decision is recorded in ADR-0020.
 *
 * There is no theme switcher component here, and there will not be one: `Segmented`
 * already gives the right shape, and a button ties to the storage and layout of a
 * particular application. The ready-made recipe is `docs/recipes/theme-switcher.md`.
 */

/**
 * Themes. The order matters in exactly one place: the first one is the default,
 * because it is the one that lives in `:root` without its own attribute.
 */
export const UI_THEMES = ["dark", "light", "dim"] as const;

/** Accents. `blue` is the base of `:root`, `violet` is an overlay on `[data-accent]`. */
export const UI_ACCENTS = ["blue", "violet"] as const;

/** Brands. `base` means no overlay, not an overlay with that name. */
export const UI_BRANDS = ["base", "teal"] as const;

export type UiTheme = (typeof UI_THEMES)[number];
export type UiAccent = (typeof UI_ACCENTS)[number];
export type UiBrand = (typeof UI_BRANDS)[number];

export interface UiThemePrefs {
  theme?: UiTheme;
  accent?: UiAccent;
  brand?: UiBrand;
}

/** The defaults of each axis: the state in which no overlay is set. */
export const DEFAULT_THEME_PREFS: Required<UiThemePrefs> = {
  theme: "dark",
  accent: "blue",
  brand: "base",
};

/**
 * Coercion of a value to an allowed one.
 *
 * The argument is typed as `unknown` on purpose: the only interesting call comes
 * from storage, and `localStorage` returns anything, including a string left by an
 * earlier version of the application. A function that takes `UiTheme` would only
 * protect the case where no protection is needed.
 */
function normalize<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

export const normalizeTheme = (value: unknown): UiTheme =>
  normalize(UI_THEMES, value, DEFAULT_THEME_PREFS.theme);

export const normalizeAccent = (value: unknown): UiAccent =>
  normalize(UI_ACCENTS, value, DEFAULT_THEME_PREFS.accent);

export const normalizeBrand = (value: unknown): UiBrand =>
  normalize(UI_BRANDS, value, DEFAULT_THEME_PREFS.brand);

/**
 * Set the axes on an element, usually `document.documentElement`.
 *
 * ALL THREE axes are applied, and missing values are taken from the defaults: the
 * function sets the state as a whole rather than patching one axis over an unknown
 * current state. Partial application would look more convenient right up to the first
 * time a brand was left over from a previous screen and nobody understood why.
 *
 * `base` REMOVES `data-brand` rather than writing `data-brand="base"`: there is no
 * block with that name in the CSS, and a leftover attribute would look like a working
 * overlay. The showcase decorator makes the same choice; otherwise snapshots and the
 * application would differ for no reason.
 */
export function applyTheme(root: HTMLElement, prefs: UiThemePrefs = {}): void {
  root.setAttribute("data-theme", normalizeTheme(prefs.theme));
  root.setAttribute("data-accent", normalizeAccent(prefs.accent));

  const brand = normalizeBrand(prefs.brand);
  if (brand === "base") root.removeAttribute("data-brand");
  else root.setAttribute("data-brand", brand);
}

/**
 * A script string that applies the saved theme BEFORE the first render.
 *
 * A string is returned, not code executed: the consumer's framework, not the kit,
 * knows where to insert it. In Next it is `<Script strategy="beforeInteractive">`;
 * in a regular application it is a `<script>` in the template. The kit stays
 * framework-neutral and still covers the spot where people usually go wrong: without
 * early application the user sees a flash of the wrong theme between rendering and
 * hydration.
 *
 * The kit now starts emitting executable JavaScript here, a deliberate extension of
 * its boundary; the analysis and its cost are in ADR-0020.
 *
 * Storage format: a JSON object `{ theme, accent, brand }` under the key `storageKey`.
 * The consumer writes it and this script reads it; any field may be missing or wrong,
 * and normalize handles that.
 *
 * The axis lists are substituted from the constants above, not written into the
 * template by hand: otherwise the script would drift from the registry, which is
 * exactly the defect the registry exists to prevent.
 */
/**
 * A literal to insert into the BODY of a `<script>`.
 *
 * `JSON.stringify` closes the quotes but not `<`, and that is not enough: the value
 * lands inside a tag, and the sequence `</script>` closes it in place, so the rest of
 * the code spills into the markup as text. There is no live XSS here, because the
 * developer sets the key. But the kit generates code for `dangerouslySetInnerHTML`,
 * so a one-character guard is applied here by default, not in response to an actual
 * attack.
 */
const scriptLiteral = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

export function themeInitScript({ storageKey }: { storageKey: string }): string {
  const t = JSON.stringify(UI_THEMES);
  const a = JSON.stringify(UI_ACCENTS);
  const b = JSON.stringify(UI_BRANDS);
  const d = DEFAULT_THEME_PREFS;

  //
  // `try` wraps ONLY the reading and parsing, the only things here that can throw:
  // `localStorage` is unavailable in private mode, and the key may hold anything left
  // by an earlier version of the application. A single `try` around the whole body
  // would look more careful, but on broken JSON it would set NO attribute at all, and
  // the document would be left with no axes. The test caught exactly that.
  return (
    `(function(){` +
    `var r=document.documentElement,p={};` +
    `try{p=JSON.parse(localStorage.getItem(${scriptLiteral(storageKey)})||"{}")||{}}catch(e){}` +
    `var n=function(l,v,f){return l.indexOf(v)===-1?f:v};` +
    `r.setAttribute("data-theme",n(${t},p.theme,${JSON.stringify(d.theme)}));` +
    `r.setAttribute("data-accent",n(${a},p.accent,${JSON.stringify(d.accent)}));` +
    `var b=n(${b},p.brand,${JSON.stringify(d.brand)});` +
    `if(b==="base"){r.removeAttribute("data-brand")}else{r.setAttribute("data-brand",b)}` +
    `})();`
  );
}

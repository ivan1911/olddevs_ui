// Color origins: highlight.js, `styles/github.css` and `styles/github-dark.css`
// (BSD-3-Clause, © 2006 Ivan Sagalaev, https://github.com/highlightjs/highlight.js).
// The color values are moved to `styles.css`; the mapping of `hljs-*` classes to roles
// is here, as Tailwind classes. The license is in NOTICE at the package root.

/**
 * Syntax highlight theme for the code Block (ADR-0051): GitHub Light in the `light`
 * theme, GitHub Dark in `dark` and `dim`. This is the kit's SECOND COLOR SYSTEM, and it
 * lives only in the code Block: the kit's tokens know nothing about `hljs-*`, and the
 * highlight theme knows nothing about tokens. The owner decided to use the familiar
 * highlight colors instead of mapping them to tokens (ADR-0051, item 5).
 *
 * TWO HALVES, EACH IN ITS OWN PLACE.
 *
 * - COLORS are the `--rte-hl-*` and `--rte-code-block-*` variables in `styles.css`, on
 *   elements with `data-theme` (and on `:root` without it). The code Block inherits them
 *   from the NEAREST ancestor with a theme, so a Document inside a nested light "paper"
 *   (`data-theme="light"` inside a dark app) gets GitHub Light. The values are not set
 *   here on purpose: a class on the container would override the inherited ones, and the
 *   nested theme would stop working.
 * - RULES are this class string, part of `PROSE_CLASS` on the Document container (the
 *   Editor and `RichTextView`). The same string is on the root of the token markup made
 *   by `highlightCodeNodes` for `CodeView` (ADR-0052): token role → variable, and nothing
 *   about the theme.
 *   The consumer's Tailwind finds the classes in `dist` through the same `@source` line as
 *   the rest of the kit's classes; there are no CSS modules and no separate stylesheet.
 *   Classes only: the markup has no `style` attribute.
 *
 * THE BACKGROUND COMES FROM THE THEME, NOT FROM THE KIT. The GitHub colors are chosen for
 * their own background (`#ffffff` and `#0d1117`); on the kit's code backing (`--bg-3`) the
 * dark tones do not hold 4.5:1 (keyword — 3.95, comment — 3.24). So the code Block as a
 * whole takes the background and the base color of the highlight theme, while inline
 * `code` stays on the kit's tokens. One deviation from GitHub Light: `built_in` and `symbol`
 * (`#953800` instead of `#e36209`, see `styles.css`). `section`, `addition` and `deletion`
 * are not carried over: they come from the Markdown and diff grammars, which the Editor
 * does not have (and the dark theme's `section` does not hold the contrast).
 *
 * WHY `[class*=hljs-built]` AND NOT `.hljs-built_in`. In an arbitrary Tailwind variant `_`
 * stands for a space, and `\_` ends up in the class name with a backslash, so it does not
 * match the class in the markup. The substring is unambiguous: highlight.js has no other
 * `built` areas. For the same reason `this` and `self` (`hljs-variable language_`) are
 * matched as `.hljs-variable[class*=language]`.
 *
 * COMPOUND SELECTORS AND DECORATIONS. In `RichTextView` the tokens are nested, as lowlight
 * emits them (`.hljs-meta > .hljs-string`), while the Editor's decorations flatten the
 * nesting into one `span class="hljs-meta hljs-string"`. So the string and keyword groups
 * are also named as a pair of classes (`.hljs-meta.hljs-string`): this raises the
 * specificity of their group above `.hljs-meta`, so the same code is colored the same way
 * while editing and on the page.
 *
 * The module is server-safe: a class string, with no React and no engine.
 */
export const CODE_THEME_CLASS =
  // Each class is kept whole on one line: Tailwind reads the source as plain text
  // and would not find a class broken up by `+`.
  "[&_:is(.hljs-doctag,.hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable[class*=language],.hljs-meta.hljs-keyword)]:text-(--rte-hl-keyword) " +
  "[&_.hljs-title]:text-(--rte-hl-title) " +
  // Markdown: a heading takes the title color and bold, as in the GitHub theme; a link is underlined.
  "[&_.hljs-section]:text-(--rte-hl-title) [&_.hljs-section]:font-bold [&_.hljs-link]:underline " +
  "[&_:is(.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id)]:text-(--rte-hl-constant) " +
  "[&_:is(.hljs-regexp,.hljs-string,.hljs-meta.hljs-string)]:text-(--rte-hl-string) " +
  "[&_:is([class*=hljs-built],.hljs-symbol)]:text-(--rte-hl-variable) " +
  "[&_:is(.hljs-comment,.hljs-code,.hljs-formula)]:text-(--rte-hl-comment) " +
  "[&_:is(.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo)]:text-(--rte-hl-tag) " +
  "[&_.hljs-subst]:text-(--rte-code-block-foreground) [&_.hljs-bullet]:text-(--rte-hl-bullet) " +
  "[&_.hljs-emphasis]:italic [&_.hljs-strong]:font-bold ";

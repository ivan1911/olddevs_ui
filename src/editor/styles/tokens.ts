/**
 * Mapping of shadcn and minimal-tiptap variables to the kit's tokens, in one place
 * (ADR-0050, the "tokens" contract).
 *
 * HOW IT WORKS. The transferred code speaks the shadcn language: `--primary`,
 * `--muted-foreground`, `--border`. The minimal-tiptap styling also has its own
 * `--mt-hr`, `--mt-code-background` and `--mt-secondary`, whose values are literal and
 * separate for `.dark`. Here each such role gets a variable with the `--rte-` prefix,
 * and its value is a kit variable. The Document's classes refer only to `--rte-*`
 * (`bg-(--rte-hr)`); they contain no literal colors or radii.
 *
 * WHY A PREFIX AND NOT THE shadcn NAMES THEMSELVES. The consumer's app may well be built
 * on shadcn and declare `--primary` in its own format (HSL without a wrapper). Redeclaring
 * it at the Editor's root would recolor foreign components placed inside it, and the
 * consumer's values are not ours to change.
 *
 * WHY CLASSES AND NOT `style`. Tailwind arbitrary properties (`[--rte-hr:var(--line)]`)
 * work both in the server render of `RichTextView` and without a single inline style in
 * the markup. Each name is written in full: Tailwind reads the source as text and would
 * not see a name assembled by concatenation.
 *
 * THEMES. The values are kit variables, not colors, so `dark`, `light` and `dim` switch by
 * themselves, without a second table under `.dark` as in the original.
 *
 * | Role (`--rte-*`)          | Where in the Document                  | Kit token          | Sheet (`paper`)    |
 * | ------------------------- | -------------------------------------- | ------------------ | ------------------ |
 * | `background`              | sheet background, author color marker  | `--bg-2`           | `--od-cloud-12`    |
 * | `foreground`              | main text, gap cursor                  | `--fg-0`           | `--od-cloud-1`     |
 * | `secondary`               | quote, code Block header (language, copy) | `--fg-1`        | `--od-cloud-2`     |
 * | `muted`                   | image caption, completed task item     | `--fg-2`           | `--od-cloud-3`     |
 * | `muted-foreground`        | placeholders                           | `--fg-3`           | `--od-cloud-4`     |
 * | `primary`                 | checkbox, image outline and handle     | `--accent`         | `--accent`         |
 * | `ring`                    | focus of controls inside the Document  | `--accent-strong`  | `--accent` ¹       |
 * | `link`                    | link                                   | `--accent-strong`  | `--accent` ¹       |
 * | `text-accent`             | `accent` text color                    | `--accent-strong`  | `--accent` ¹       |
 * | `text-success`            | `success` text color                   | `--success-strong` | `--od-green-1`     |
 * | `text-warning`            | `warning` text color                   | `--warning-strong` | `--od-amber-1`     |
 * | `text-danger`             | `danger` text color                    | `--danger-strong`  | `--od-red-1`       |
 * | `text-lime`               | `lime` text color                      | `--draft-strong`   | `--od-lime-1`      |
 * | `text-muted`              | `muted` text color                     | `--fg-2`           | `--od-cloud-3`     |
 * | `selection`               | text and cell selection                | `--selection`      | `--selection-light` ¹ |
 * | `selection-marker`        | selection on top of a bright marker ²  | `--accent` 38 %    | `--accent` 38 %    |
 * | `control-hover`           | hover on a button inside the Document  | `--bg-2`           | `--od-cloud-9`     |
 * | `quote`                   | quote bar                              | `--line`           | `--od-cloud-6`     |
 * | `hr`                      | rule, cell borders                     | `--line`           | `--od-cloud-6`     |
 * | `code-background`         | inline code, table header              | `--bg-3`           | `--od-cloud-11`    |
 * | `code-border`             | code border                            | `--line-soft`      | `--od-cloud-8`     |
 * | `radius`                  | corner radii                           | `--r-xs`           | `--r-xs`           |
 * | `tone-neutral-background` | backing of the Important-tone Wrapper ³ | `--bg-3`          | `--od-cloud-11`    |
 * | `tone-neutral-border`     | stripe of the Important-tone Wrapper ³ | `--fg-3`           | `--od-cloud-4`     |
 * | `tone-accent-background`  | backing of the Note-tone Wrapper       | `--accent-soft`    | `--accent-soft`    |
 * | `tone-accent-border`      | stripe of the Note-tone Wrapper        | `--accent-strong`  | `--accent` ¹       |
 * | `tone-success-background` | backing of the Tip-tone Wrapper        | `--success-soft`   | `--od-green-2-a12` |
 * | `tone-success-border`     | stripe of the Tip-tone Wrapper         | `--success-strong` | `--od-green-1`     |
 * | `tone-warning-background` | backing of the Warning-tone Wrapper    | `--warning-soft`   | `--od-amber-2-a14` |
 * | `tone-warning-border`     | stripe of the Warning-tone Wrapper     | `--warning-strong` | `--od-amber-1`     |
 * | `tone-danger-background`  | backing of the Caution-tone Wrapper    | `--danger-soft`    | `--od-red-3-a12`   |
 * | `tone-danger-border`      | stripe of the Caution-tone Wrapper     | `--danger-strong`  | `--od-red-1`       |
 * | `tone-link`               | link in a toned Wrapper ⁴              | `--fg-0`           | `--od-cloud-1`     |
 * | `tone-secondary`          | quote and code header in a toned Wrapper ⁴ | `--fg-0`       | `--od-cloud-2`     |
 * | `tone-muted`              | caption, item, gray text in a tone ⁴  | `--fg-0`           | `--od-cloud-3`     |
 * | `tone-muted-foreground`   | hints in a toned Wrapper ⁴             | `--fg-0`           | `--od-cloud-3`     |
 *
 * The module is server-safe: class strings, with no React and no engine.
 */
export const EDITOR_TOKENS_CLASS =
  "[--rte-background:var(--bg-2)] [--rte-foreground:var(--fg-0)] " +
  "[--rte-secondary:var(--fg-1)] [--rte-muted:var(--fg-2)] [--rte-muted-foreground:var(--fg-3)] " +
  "[--rte-primary:var(--accent)] [--rte-ring:var(--accent-strong)] [--rte-link:var(--accent-strong)] " +
  "[--rte-text-accent:var(--accent-strong)] [--rte-text-success:var(--success-strong)] " +
  "[--rte-text-warning:var(--warning-strong)] [--rte-text-danger:var(--danger-strong)] " +
  "[--rte-text-lime:var(--draft-strong)] [--rte-text-muted:var(--fg-2)] [--rte-selection:var(--selection)] [--rte-selection-marker:color-mix(in_srgb,var(--accent)_38%,transparent)] " +
  "[--rte-control-hover:var(--bg-2)] [--rte-quote:var(--line)] [--rte-hr:var(--line)] " +
  "[--rte-code-background:var(--bg-3)] [--rte-code-border:var(--line-soft)] " +
  "[--rte-radius:var(--r-xs)] " +
  "[--rte-tone-neutral-background:var(--bg-3)] [--rte-tone-neutral-border:var(--fg-3)] " +
  "[--rte-tone-accent-background:var(--accent-soft)] [--rte-tone-accent-border:var(--accent-strong)] " +
  "[--rte-tone-success-background:var(--success-soft)] [--rte-tone-success-border:var(--success-strong)] " +
  "[--rte-tone-warning-background:var(--warning-soft)] [--rte-tone-warning-border:var(--warning-strong)] " +
  "[--rte-tone-danger-background:var(--danger-soft)] [--rte-tone-danger-border:var(--danger-strong)] " +
  "[--rte-tone-link:var(--fg-0)] [--rte-tone-secondary:var(--fg-0)] " +
  "[--rte-tone-muted:var(--fg-0)] [--rte-tone-muted-foreground:var(--fg-0)]";

/**
 * The same roles for the `surface="paper"` sheet: the values of the LIGHT theme in
 * any app theme.
 *
 * WHY PRIMITIVES AND NOT A NESTED `data-theme="light"`. The kit's semantic tokens
 * (`--fg-0`, `--bg-2`, `--accent-strong`) are declared only on `:root[data-theme]` and do
 * not react to a nested theme; the `@theme` bridge (`text-fg-0` → `--color-fg-0`) substitutes
 * the root's value. Changing that is a decision for the kit (ADR-0003, ADR-0020), not for the
 * Editor. So the sheet assigns the `--rte-*` roles the same `--od-*` primitives that the light
 * theme assigns to its tokens: the primitives are declared on `:root` without a theme and are
 * visible everywhere. Matching the light theme is checked by `tests/rich-text-paper.test.tsx`,
 * which parses `styles.css` rather than comparing copies of the values.
 *
 * The nested `data-theme="light"` on the sheet stays anyway, for whatever is declared on
 * `[data-theme]` of any element: the markers (`--marker-*`) and the highlight theme
 * (`--rte-hl-*`, `--rte-code-block-*`, `styles.css`).
 *
 * ¹ ACCENT IS THE APP THEME'S FILL, NOT THE LIGHT `accent-strong`. The light `accent-strong`
 * of the brand and of the violet accent is declared only as a paired block
 * `:root[data-theme="light"][data-…]`, and in the dark app it does not exist as a variable at
 * all. `--accent`, however, is calibrated for white text on top of it (4.5:1 with
 * `--text-on-accent`, the contrast gate), so as text on a white sheet it also holds 4.5:1,
 * for any brand and accent. In a light app the sheet takes exactly the light `accent-strong`,
 * through a variant on the root.
 *
 * `primary` and the Note tone's backing do not change: the semi-transparent `accent-soft`
 * also lies well on a white sheet, and the checkbox fill is the same `--accent`. The selection
 * is `--selection-light`: the dark app's `--selection` is a light step of the accent for a dark
 * backing, and on a white sheet it is almost invisible. The light variant is declared under any
 * theme, exactly for the sheet. The Note stripe is treated as accent text: `--accent`, and in a
 * light app, the light `accent-strong`.
 *
 * ² SELECTION ON A MARKER. The ordinary selection is semi-transparent and calibrated for the
 * document's background. On top of a bright marker (`#ffea80`) the previous `accent-soft`
 * (14–16 % alpha) disappeared, and the marked text looked unselected. There is one bright
 * marker in all themes, so the role is one too: `--accent` at 38 %. The yellow under it turns
 * into a visible gray-green, and the dark marker text stays readable. It is the accent, not a
 * fixed blue: the selection follows the brand, as everywhere else.
 *
 * ³ THE WRAPPER TONE uses the kit's status tokens: the soft step of the tone is the backing,
 * and the strong one is the stripe on the left, as `soft` in `Alert`. The neutral tone is
 * differs from `TONE_TOKENS.neutral` in both places. The backing is `bg-3` (the step of the
 * chosen neutral), not `bg-2`: `bg-2` is the Editor's own field, and the Important Wrapper
 * would have no backing on it. Not `bg-4` either: `bg-3` is the app's backing, which ALL text
 * tokens are calibrated for. The link, quote, caption and text color inside Important hold
 * 4.5:1, while on `bg-4` the muted text drops to 3.7. The price: in the light theme the backing
 * is almost white on a white panel, and there the tone is carried by the stripe. The stripe is
 * `fg-3`, not `line`: the tone stripe carries meaning and holds 3:1 (WCAG 1.4.11), while `line`
 * is a decorative rule (as is the border of a state indicator, `STATE_BORDER`).
 * The contrast is checked by `npm run contrast`, on the tone pairs.
 *
 * ⁴ SECONDARY TEXT ON A TONE BACKING. The steps `fg-1`–`fg-3` and `accent-strong` are calibrated
 * for 4.5:1 on the app's backings, not on the colored tone backings. There the quote dropped to
 * 4.23, the link to 3.97, the caption and gray text to 3.59, and the hint to 3.61. So in a
 * Wrapper with a tone, `prose.ts` substitutes the `link`, `secondary`, `muted`, `text-muted` and
 * `muted-foreground` roles with these. In the app theme only `fg-0` holds 4.5:1 on all five
 * backings. There is no intermediate step (`fg-1` gives 4.23 on Note and 4.27 on Warning), so
 * inside a tone all secondary text is the main text color. The hierarchy is kept by form (the
 * quote bar, strikethrough, the caption's size), and the link by underlining. On the sheet,
 * `cloud-2` and `cloud-3` pass on the tone backings too: the quote and the caption keep their own
 * step, and only the link (the accent gave 3.68) and the hint (`cloud-4` gave 4.25) are raised.
 */
export const EDITOR_PAPER_TOKENS_CLASS =
  "[--rte-background:var(--od-cloud-12)] [--rte-foreground:var(--od-cloud-1)] " +
  "[--rte-secondary:var(--od-cloud-2)] [--rte-muted:var(--od-cloud-3)] " +
  "[--rte-muted-foreground:var(--od-cloud-4)] " +
  "[--rte-primary:var(--accent)] [--rte-ring:var(--accent)] [--rte-link:var(--accent)] " +
  "[--rte-text-accent:var(--accent)] [--rte-text-success:var(--od-green-1)] " +
  "[--rte-text-warning:var(--od-amber-1)] [--rte-text-danger:var(--od-red-1)] " +
  "[--rte-text-lime:var(--od-lime-1)] [--rte-text-muted:var(--od-cloud-3)] [--rte-selection:var(--selection-light)] [--rte-selection-marker:color-mix(in_srgb,var(--accent)_38%,transparent)] " +
  "[--rte-control-hover:var(--od-cloud-9)] [--rte-quote:var(--od-cloud-6)] [--rte-hr:var(--od-cloud-6)] " +
  "[--rte-code-background:var(--od-cloud-11)] [--rte-code-border:var(--od-cloud-8)] " +
  "[--rte-radius:var(--r-xs)] " +
  "[--rte-tone-neutral-background:var(--od-cloud-11)] [--rte-tone-neutral-border:var(--od-cloud-4)] " +
  "[--rte-tone-accent-background:var(--accent-soft)] [--rte-tone-accent-border:var(--accent)] " +
  "[--rte-tone-success-background:var(--od-green-2-a12)] [--rte-tone-success-border:var(--od-green-1)] " +
  "[--rte-tone-warning-background:var(--od-amber-2-a14)] [--rte-tone-warning-border:var(--od-amber-1)] " +
  "[--rte-tone-danger-background:var(--od-red-3-a12)] [--rte-tone-danger-border:var(--od-red-1)] " +
  "[--rte-tone-link:var(--od-cloud-1)] [--rte-tone-secondary:var(--od-cloud-2)] " +
  "[--rte-tone-muted:var(--od-cloud-3)] [--rte-tone-muted-foreground:var(--od-cloud-3)] " +
  "[:root[data-theme=light]_&]:[--rte-ring:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-link:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-text-accent:var(--accent-strong)] " +
  "[:root[data-theme=light]_&]:[--rte-tone-accent-border:var(--accent-strong)]";

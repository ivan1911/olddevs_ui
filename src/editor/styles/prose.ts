// Origin: minimal-tiptap, `styles/partials/typography.css`, `lists.css`,
// `code.css` and `styles/index.css` (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Rewritten with Tailwind classes
// on the kit's tokens. The license is in NOTICE at the package root.

import { CODE_THEME_CLASS } from "./codeTheme.js";
import type { EditorWrapperTone } from "../../i18n/messages.js";
import type { EditorMarkerName, EditorTextColorName } from "./palette.js";
import type { RichTextSurface } from "./surface.js";
import { EDITOR_PAPER_TOKENS_CLASS, EDITOR_TOKENS_CLASS } from "./tokens.js";

/**
 * Text and marker color classes, by palette names (`palette.ts`).
 *
 * WHY LITERALS AND NOT ASSEMBLY FROM A TOKEN NAME. Tailwind reads the source as text:
 * it would not see `text-${token}`, and the class would be missing from the build. So
 * each class is written in full. A test (`tests/rich-text-editor-color.test.tsx`) keeps
 * the entries in line with the palette tokens, and `Record` stops a name from being
 * forgotten when a color is added.
 *
 * Used in two places: by selectors on the Document container (below) and by the
 * swatches in the Toolbar menu.
 */
export const EDITOR_TEXT_COLOR_CLASS: Record<EditorTextColorName, string> = {
  accent: "text-accent-strong",
  success: "text-success-strong",
  warning: "text-warning-strong",
  danger: "text-danger-strong",
  lime: "text-draft-strong",
  muted: "text-fg-2",
};

/**
 * Marker background: the `--marker-<name>` token of the component layer, with a value of
 * its own in each theme (`styles.css`).
 *
 * THE VARIABLE IS READ DIRECTLY: `bg-(--marker-gray)`, not `bg-marker-gray` through the
 * `@theme` bridge. The bridge (`--color-x: var(--x)`) is declared on the root, and `var()`
 * in it is substituted THERE: a nested theme (`data-theme="light"` on a wrapper inside a
 * dark app) no longer changes the bridge's values. A direct reference is substituted on
 * the `mark` itself and takes the value of the nearest ancestor with `data-theme`. The class
 * reads the global token, not `--rte-*`: the Toolbar menu opens in a portal outside the
 * Document container, where `--rte-*` does not exist.
 *
 * TEXT ON A MARKER. For the three bright markers the swatch also carries
 * `text-(--marker-text)`: their background is the same and bright in all themes, and the
 * light text of the dark theme would not be readable on it. The six older Notion colors have
 * backgrounds of their own in each theme (dark ones in the dark themes), and they keep the
 * inherited main text (`EDITOR_BRIGHT_MARKER_NAMES` in `palette.ts`).
 */
export const EDITOR_MARKER_CLASS: Record<EditorMarkerName, string> = {
  yellow: "bg-(--marker-yellow) text-(--marker-text)",
  green: "bg-(--marker-green) text-(--marker-text)",
  pink: "bg-(--marker-pink) text-(--marker-text)",
  gray: "bg-(--marker-gray)",
  brown: "bg-(--marker-brown)",
  orange: "bg-(--marker-orange)",
  purple: "bg-(--marker-purple)",
  blue: "bg-(--marker-blue)",
  red: "bg-(--marker-red)",
};

/**
 * Swatch of a Wrapper tone in the "Tone ›" submenu of the Block handle: the item's label on
 * the soft tone backing with a stripe on the left. It has the same look as the Wrapper in
 * the Document, only in miniature. The tone's name is given in words; the swatch only
 * reinforces it.
 *
 * The kit's tokens directly, not the `--rte-tone-*` roles: the menu opens in a portal outside
 * the Document container, where the roles do not exist (as with `EDITOR_MARKER_CLASS`). The
 * match between the swatch tokens and the theme's roles is checked by
 * `tests/rich-text-editor-wrapper-tone.test.tsx`.
 */
export const EDITOR_WRAPPER_TONE_CLASS: Record<EditorWrapperTone, string> = {
  neutral: "rounded-xs border-l-[3px] border-(--fg-3) bg-(--bg-3) px-1.5",
  accent: "rounded-xs border-l-[3px] border-(--accent-strong) bg-(--accent-soft) px-1.5",
  success: "rounded-xs border-l-[3px] border-(--success-strong) bg-(--success-soft) px-1.5",
  warning: "rounded-xs border-l-[3px] border-(--warning-strong) bg-(--warning-soft) px-1.5",
  danger: "rounded-xs border-l-[3px] border-(--danger-strong) bg-(--danger-soft) px-1.5",
};

/**
 * Color and marker in the document: `span[data-color]` and `mark[data-color]`.
 *
 * A selector for each name, not one `--rte-color` variable: the variable would have to be
 * set from the same list, while a literal class stays checkable by the contrast gate, which
 * measures the same token pairs.
 *
 * OLD MARKER NAMES (`mark[data-color=accent]` and five more) are painted with the color the
 * Editor maps them to on load (`LEGACY_MARKER_NAMES`). The View does not parse the HTML again:
 * if the server saved a document from before the new palette and did not map its names with
 * the cleanup (`sanitizeRichText`), the highlight would disappear without these rules.
 */
const COLOR_CLASS =
  "[&_span[data-color=accent]]:text-(--rte-text-accent) [&_span[data-color=success]]:text-(--rte-text-success) " +
  "[&_span[data-color=warning]]:text-(--rte-text-warning) [&_span[data-color=danger]]:text-(--rte-text-danger) " +
  "[&_span[data-color=lime]]:text-(--rte-text-lime) [&_span[data-color=muted]]:text-(--rte-text-muted) " +
  "[&_mark[data-color=gray]]:bg-(--marker-gray) [&_mark[data-color=brown]]:bg-(--marker-brown) " +
  "[&_mark[data-color=orange]]:bg-(--marker-orange) [&_mark[data-color=yellow]]:bg-(--marker-yellow) " +
  "[&_mark[data-color=green]]:bg-(--marker-green) [&_mark[data-color=blue]]:bg-(--marker-blue) " +
  "[&_mark[data-color=purple]]:bg-(--marker-purple) [&_mark[data-color=pink]]:bg-(--marker-pink) " +
  "[&_mark[data-color=red]]:bg-(--marker-red) " +
  "[&_mark[data-color=accent]]:bg-(--marker-blue) [&_mark[data-color=success]]:bg-(--marker-green) " +
  "[&_mark[data-color=warning]]:bg-(--marker-yellow) [&_mark[data-color=danger]]:bg-(--marker-red) " +
  "[&_mark[data-color=lime]]:bg-(--marker-green) [&_mark[data-color=muted]]:bg-(--marker-gray) " +
  // The text on a marker is dark (`--marker-text`), not inherited: the background is bright
  // and the same in all themes, and the browser's `color: MarkText` would otherwise turn the
  // text black in any theme. The rule is general, so the dark text gets the author's color too.
  // The exception is the six older Notion colors and the old names that map to them: their
  // backgrounds are their own (dark in the dark themes), and the inherited main text stays
  // under them.
  //
  // No rounded corners and no side padding (the owner's decision): ProseMirror splits one
  // marker into several `mark`s at each boundary of another mark (bold, italic, link), and each
  // piece had its own corners and margins, so a solid highlight broke up into "bubbles" with
  // gaps at the dots and spaces. Rectangular pieces without margins merge into one band, like
  // the trail of a highlighter pen.
  "[&_mark]:text-(--marker-text) " +
  // The selection on top of a bright marker is denser than the common one (`selection-marker`,
  // `tokens.ts`), and its text is the marker's dark text. The readable names are excluded: their
  // backgrounds are dark in the dark themes, and the common selection is visible on them.
  "[&_mark:not(:is([data-color=gray],[data-color=brown],[data-color=orange],[data-color=blue],[data-color=purple],[data-color=red],[data-color=accent],[data-color=danger],[data-color=muted]))]:selection:bg-(--rte-selection-marker) " +
  "[&_mark:not(:is([data-color=gray],[data-color=brown],[data-color=orange],[data-color=blue],[data-color=purple],[data-color=red],[data-color=accent],[data-color=danger],[data-color=muted]))]:selection:text-(--marker-text) " +
  "[&_mark[data-color=gray]]:text-inherit [&_mark[data-color=brown]]:text-inherit " +
  "[&_mark[data-color=orange]]:text-inherit [&_mark[data-color=blue]]:text-inherit " +
  "[&_mark[data-color=purple]]:text-inherit [&_mark[data-color=red]]:text-inherit " +
  "[&_mark[data-color=accent]]:text-inherit [&_mark[data-color=danger]]:text-inherit " +
  "[&_mark[data-color=muted]]:text-inherit " +
  // Alignment of a Block (`p`, `h1`–`h4`) and of a table column (`th`, `td`): `left` is not
  // written. The attribute selector is more specific than the `text-left` of the cell below
  // (`[&_:is(th,td)]`), so a column is aligned without `!important`. A paragraph with its own
  // `data-align` inside a cell outranks the column, because it is closer to the text.
  "[&_[data-align=center]]:text-center [&_[data-align=right]]:text-right ";

/**
 * Document table: `table > tbody > tr > th|td` with no class and no `style` in the markup
 * (`tables.ts`), so all the styling comes from here, and the same text looks the same in the
 * Editor and in `RichTextView`.
 *
 * HORIZONTAL SCROLLING IS ON THE `<table>` ITSELF: `display: block` with `overflow-x: auto`
 * and `max-width: 100%`. A table cannot have a wrapper: `RichTextView` puts the saved HTML on
 * the page as it is, and the Schema knows neither `div.tableWrapper` nor `tabindex`. Inside
 * the block the browser builds an anonymous table, and its width is set by the columns:
 * `min-w-24` on the cell (6 rem) keeps the columns from shrinking into a slit, so a five-column
 * table on a 375 px screen scrolls inside its own block instead of pushing the page wider.
 * A short table stays as wide as its content.
 *
 * THE PRICE OF `display: block`. Some screen readers lose the table semantics of a `table`
 * with this `display` (the cells are read without rows and columns). Chrome and Firefox fixed
 * it long ago; Safari with VoiceOver depends on the version. The other approach,
 * `table-layout: fixed` without scrolling, makes the columns equal and narrow and cuts a long
 * column into syllables. For a document read on a phone, scrolling is the lesser evil. A
 * scrollable region without focusable content in `RichTextView` (axe:
 * `scrollable-region-focusable`) fires only when the table is actually wider than the screen;
 * in the Editor each cell has a caret in it.
 *
 * `.selectedCell` is the class the table engine marks cells with when they are selected by
 * mouse across cells; without the rule the selection is not visible.
 *
 * `.ProseMirror-gapcursor` is the "gap cursor": after an arrow down from the last cell of a
 * table that is the last Block, the caret has nowhere to be, and the engine draws a thin line
 * between Blocks (typing there creates a paragraph). The extension has no style of its own:
 * without the rule the line is invisible, and a keyboard user would not know where they are.
 * It is shown only in a focused field.
 */
const TABLE_CLASS =
  "[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse " +
  "[&_:is(th,td)]:min-w-24 [&_:is(th,td)]:border [&_:is(th,td)]:border-(--rte-hr) " +
  "[&_:is(th,td)]:px-3 [&_:is(th,td)]:py-1.5 [&_:is(th,td)]:text-left [&_:is(th,td)]:align-top " +
  "[&_th]:bg-(--rte-code-background) [&_th]:font-semibold " +
  "[&_:is(th,td)>*:not(:last-child)]:mb-2 [&_.selectedCell]:bg-(--rte-selection) " +
  "[&_.ProseMirror-gapcursor]:pointer-events-none [&_.ProseMirror-gapcursor]:relative " +
  "[&_.ProseMirror-gapcursor]:hidden [&.ProseMirror-focused_.ProseMirror-gapcursor]:block " +
  "[&_.ProseMirror-gapcursor]:after:absolute [&_.ProseMirror-gapcursor]:after:-top-0.5 " +
  "[&_.ProseMirror-gapcursor]:after:w-5 [&_.ProseMirror-gapcursor]:after:border-t-2 " +
  "[&_.ProseMirror-gapcursor]:after:border-(--rte-foreground)";

/**
 * Column layout: `div[data-block=layout]` is a grid, its columns are its cells, and the
 * shares come from the variant in `data-layout` (`columnLayouts.ts`). There are no classes
 * and no `style` in the markup, so the grid is the same in the Editor and in `RichTextView`.
 *
 * NARROW SCREEN IS A CONTAINER QUERY, NOT A SCREEN BREAKPOINT. The Document lives in a page
 * column, in a Dialog and in a Drawer, and the window width says nothing about its width: a
 * 400 px Drawer on a 1920 px monitor would get four 80 px columns. So the columns sit side by
 * side only when the Document itself has about 14 rem for each of them: two from 30 rem
 * (480 px), three from 40 rem (640 px), four from 48 rem (768 px). Narrower than that, they
 * stack in reading order. The threshold depends on the column count, not one common value: a
 * two-column layout fits a 560 px Dialog, while four columns there would be 110 px each.
 * The container is the Document root, and only when it contains a layout (`:has`):
 * `container-type: inline-size` stops the element's width from depending on its content, and in a
 * shrinking context (an element of a flex row with no width) a Document without a layout could
 * still shrink. The layout itself cannot be the container: a container query does not measure
 * the element it applies to, and the layout has no wrapper in the Schema.
 *
 * `minmax(0, …)` and `min-w-0` on the column: a long word, a table and a code Block scroll
 * inside their own column instead of pushing the grid apart.
 *
 * THE FRAME IS IN THE EDITOR ONLY (`.ProseMirror`): the dashed line shows the author where one
 * column ends and another begins, especially an empty one (the owner's reference). The reader
 * of `RichTextView` does not need the border: there the columns are separated by the gap alone.
 * The color is the placeholder gray (`--rte-muted-foreground`), not the rule color (`--rte-hr`):
 * the frame of an empty column is the only thing that shows where its area is, and the pale
 * rule of a table was lost against the field background in the light theme.
 */
const LAYOUT_CLASS =
  "[&:has(>[data-block=layout])]:[container-type:inline-size] " +
  "[&:has(>[data-block=layout])]:[container-name:rte-document] " +
  "[&_[data-block=layout]]:grid [&_[data-block=layout]]:gap-4 " +
  "[&_[data-block=column]]:min-w-0 [&_[data-block=column]>*:not(:last-child)]:mb-3 " +
  "[&_[data-block=column]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "@min-[30rem]/rte-document:[&_[data-layout='50-50']]:grid-cols-2 " +
  "@min-[30rem]/rte-document:[&_[data-layout='60-40']]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] " +
  "@min-[30rem]/rte-document:[&_[data-layout='40-60']]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] " +
  "@min-[40rem]/rte-document:[&_[data-layout='33-33-33']]:grid-cols-3 " +
  "@min-[48rem]/rte-document:[&_[data-layout='25-25-25-25']]:grid-cols-4 " +
  "[&.ProseMirror_[data-block=column]]:rounded-(--rte-radius) " +
  "[&.ProseMirror_[data-block=column]]:border [&.ProseMirror_[data-block=column]]:border-dashed " +
  "[&.ProseMirror_[data-block=column]]:border-(--rte-muted-foreground) " +
  "[&.ProseMirror_[data-block=column]]:p-2";

/**
 * Wrapper: `div[data-block=wrapper]` is a group of Blocks with no look of its own, as in
 * Redactor. The spacing between its Blocks is the same as in the Document, both in the Editor
 * and in `RichTextView`: the reader sees the text as if there were no Wrapper.
 *
 * THE FRAME WITHOUT A TONE IS IN THE EDITOR ONLY, as for the column of a Column layout, and
 * with the same look: a gray dashed placeholder line and inner padding. Without it the author
 * cannot see where the group ends, and an empty Wrapper would be invisible altogether.
 *
 * TONE (`data-tone`) IS THE LOOK FOR THE READER TOO, the SAME in the Editor and in
 * `RichTextView`: a soft tone backing and a 3 px stripe on the left in the strong step, as in
 * the GitHub and Notion callouts and `soft` in `Alert`. The text is the Document's ordinary
 * text. A toned Wrapper has no dashed line even in the Editor: the boundary is already visible
 * from the backing and the stripe, and a dashed line over the backing would draw a second frame
 * that the reader does not have, so the author would see something other than what they
 * publish. The colors are the `--rte-tone-*` roles (`tokens.ts`); on the `paper` sheet they have
 * values of their own. Only the five names of the vocabulary get a look: a foreign name in
 * unsanitized HTML stays without one, like an unknown `data-color`.
 */
const WRAPPER_CLASS =
  "[&_[data-block=wrapper]>*:not(:last-child)]:mb-3 " +
  "[&_[data-block=wrapper]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:rounded-(--rte-radius) " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border-dashed " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:border-(--rte-muted-foreground) " +
  "[&.ProseMirror_[data-block=wrapper]:not([data-tone])]:p-2 " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:rounded-(--rte-radius) " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:border-l-[3px] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:px-3 " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:py-2.5 " +
  // Secondary text on a tone backing uses the more contrasting roles (`tokens.ts`, ⁴).
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-link:var(--rte-tone-link)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-secondary:var(--rte-tone-secondary)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-muted:var(--rte-tone-muted)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-text-muted:var(--rte-tone-muted)] " +
  "[&_[data-block=wrapper]:is([data-tone=neutral],[data-tone=accent],[data-tone=success],[data-tone=warning],[data-tone=danger])]:[--rte-muted-foreground:var(--rte-tone-muted-foreground)] " +
  "[&_[data-block=wrapper][data-tone=neutral]]:bg-(--rte-tone-neutral-background) " +
  "[&_[data-block=wrapper][data-tone=neutral]]:border-(--rte-tone-neutral-border) " +
  "[&_[data-block=wrapper][data-tone=accent]]:bg-(--rte-tone-accent-background) " +
  "[&_[data-block=wrapper][data-tone=accent]]:border-(--rte-tone-accent-border) " +
  "[&_[data-block=wrapper][data-tone=success]]:bg-(--rte-tone-success-background) " +
  "[&_[data-block=wrapper][data-tone=success]]:border-(--rte-tone-success-border) " +
  "[&_[data-block=wrapper][data-tone=warning]]:bg-(--rte-tone-warning-background) " +
  "[&_[data-block=wrapper][data-tone=warning]]:border-(--rte-tone-warning-border) " +
  "[&_[data-block=wrapper][data-tone=danger]]:bg-(--rte-tone-danger-background) " +
  "[&_[data-block=wrapper][data-tone=danger]]:border-(--rte-tone-danger-border)";

/**
 * Collapsible Block (Details): in the View, the native `details > summary` with a
 * `div[data-type=detailsContent]`; in the Editor, `div[data-type=details]` with an expand
 * button, the `summary` heading and the content in a wrapper (the Tiptap node view). The
 * frame, the padding and the rhythm of the Blocks inside are the same in both views, so the
 * reader sees what the author typed.
 *
 * VIEW — WITHOUT JAVASCRIPT. The browser expands and collapses it by itself, and the
 * `summary` marker is its own native one: it is available to screen readers and from the
 * keyboard (Tab, Enter, Space) without a single line of kit code. The collapsed content is
 * hidden by `details`, not by our rule.
 *
 * EDITOR. The `summary` marker is removed (`list-none`): a button on the left replaces it. Its
 * chevron is drawn by CSS (`border-r` + `border-b`, rotated 45°), and the open state is the
 * `is-open` class on the `div`. The button is a real `button` with a name from the message catalog and
 * `aria-expanded`. The hidden content is hidden by the `hidden` attribute, which the Tiptap node
 * view sets itself.
 */
const DETAILS_BOX =
  "[&_:is(details,div[data-type=details])]:rounded-(--rte-radius) " +
  "[&_:is(details,div[data-type=details])]:border [&_:is(details,div[data-type=details])]:border-(--rte-hr) " +
  "[&_:is(details,div[data-type=details])]:px-3 [&_:is(details,div[data-type=details])]:py-2 " +
  "[&_summary]:font-medium [&_details>summary]:cursor-pointer " +
  "[&_div[data-type=detailsContent]>*:not(:last-child)]:mb-3 " +
  "[&_div[data-type=detailsContent]>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&_details[open]>summary]:mb-2 ";

const DETAILS_EDITOR =
  "[&_div[data-type=details]]:flex [&_div[data-type=details]]:items-start " +
  "[&_div[data-type=details]]:gap-1.5 " +
  "[&_div[data-type=details]>div]:min-w-0 [&_div[data-type=details]>div]:flex-1 " +
  "[&_div[data-type=details]_summary]:list-none " +
  "[&_div[data-type=details].is-open>div>summary]:mb-2 " +
  "[&_div[data-type=details]>button]:relative [&_div[data-type=details]>button]:mt-px " +
  "[&_div[data-type=details]>button]:size-6 [&_div[data-type=details]>button]:shrink-0 " +
  "[&_div[data-type=details]>button]:cursor-pointer [&_div[data-type=details]>button]:rounded-(--rte-radius) " +
  "[&_div[data-type=details]>button]:text-(--rte-secondary) " +
  "[&_div[data-type=details]>button]:before:absolute [&_div[data-type=details]>button]:before:left-1/2 " +
  "[&_div[data-type=details]>button]:before:top-1/2 [&_div[data-type=details]>button]:before:size-1.5 " +
  "[&_div[data-type=details]>button]:before:-translate-x-1/2 [&_div[data-type=details]>button]:before:-translate-y-1/2 " +
  "[&_div[data-type=details]>button]:before:-rotate-45 [&_div[data-type=details]>button]:before:border-r-2 " +
  "[&_div[data-type=details]>button]:before:border-b-2 [&_div[data-type=details]>button]:before:border-current " +
  "[&_div[data-type=details]>button]:before:content-[''] " +
  "[&_div[data-type=details].is-open>button]:before:rotate-45";

const DETAILS_CLASS = DETAILS_BOX + DETAILS_EDITOR;

/**
 * Formulas (the `mathematics` Tool, ADR-0070): `span[data-type=inline-math]` inline and
 * `div[data-type=block-math]` as a Block. The look is the same in the Editor and in the View.
 *
 * SOURCE AND RENDERING. Before rendering (the Editor's Skeleton, `RichTextView` without JS and
 * before the Island) the element holds the LaTeX source as text. Such an element, without a
 * `.katex` inside, is painted in monospace: the author sees where the formula is, and the reader
 * reads the source. A rendered formula is KaTeX markup and needs no font of its own, because the
 * KaTeX CSS brings it. A formula with an error (`inline-math-error`, `block-math-error` on the
 * node view, `data-math-error` on the Island) stays as source, which is monospace by the same
 * rule, and is underlined with a wavy line in the error color.
 *
 * BLOCK. It is centered and scrolls horizontally if it is wider than the Document. The
 * `.katex-display` margins are removed, and the Document sets the rhythm of the Blocks. The
 * block's source is left-aligned and keeps the line breaks the author typed. It is at least 4 rem
 * (`min-h-16`) tall: a rendered fraction or integral is many times taller than a line of source,
 * and without the reserve the field would jump in height when the chunk arrives (Skeleton,
 * ADR-0070, item 5). A formula without a fraction is a bit under the reserve, and one with a
 * matrix is above it; nobody knows the exact height before rendering.
 *
 * EDITOR. The node view (`tiptap-mathematics-render--editable`) is clickable: a click opens the
 * popover, and hovering highlights it. A formula selected with the arrow keys is outlined: Enter
 * acts on it.
 */
const MATH_CLASS =
  "[&_:is(span[data-type=inline-math],div[data-type=block-math]):not(:has(.katex))]:font-mono " +
  "[&_:is(span[data-type=inline-math],div[data-type=block-math]):not(:has(.katex))]:text-[0.9em] " +
  "[&_div[data-type=block-math]]:overflow-x-auto [&_div[data-type=block-math]]:py-1 " +
  "[&_div[data-type=block-math]]:text-center " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:flex " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:min-h-16 " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:items-center " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:text-left " +
  "[&_div[data-type=block-math]:not(:has(.katex))]:whitespace-pre-wrap " +
  "[&_.katex-display]:my-0 " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:text-(--rte-text-danger) " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:underline " +
  "[&_:is(.inline-math-error,.block-math-error,[data-math-error])]:decoration-wavy " +
  "[&_.tiptap-mathematics-render--editable]:cursor-pointer " +
  "[&_.tiptap-mathematics-render--editable]:rounded-(--rte-radius) " +
  "[&_.tiptap-mathematics-render--editable:hover]:bg-(--rte-control-hover) " +
  "[&_.tiptap-mathematics-render.ProseMirror-selectednode]:outline-2 " +
  "[&_.tiptap-mathematics-render.ProseMirror-selectednode]:outline-(--rte-ring) ";

/**
 * Invisible characters (the `invisibleCharacters` Tool): the Tiptap extension puts
 * `span.tiptap-invisible-character` widgets into the markup, with a `--space`, `--break` or
 * `--paragraph` modifier; the empty `span` carries the mark in `::before`. The kit does not
 * load the extension's own CSS (`injectCSS: false`) and draws the marks itself, with tokens.
 *
 * THEY DO NOT MOVE THE TEXT. A mark is an `inline-block` of zero width, and the line height is
 * `1em`, so line breaks and paragraph heights are the same as with hidden marks. Selection and
 * the mouse do not see the marks (`select-none`, `pointer-events-none`), and copying does not
 * take them: they are not in the Document. The color is muted (`--rte-muted-foreground`), and on
 * a toned Wrapper it is already recalculated for that backing (`WRAPPER_CLASS`).
 *
 * In an empty first paragraph the paragraph mark is hidden: the field's placeholder takes its
 * place (`is-editor-empty`, `RichTextEditor.tsx`), and "¶" would lie on top of its text. The
 * marks do not appear in the View: nothing there has the class.
 */
const INVISIBLE_CHARACTERS_CLASS =
  "[&_.tiptap-invisible-character]:pointer-events-none [&_.tiptap-invisible-character]:select-none " +
  "[&_.tiptap-invisible-character]:before:inline-block [&_.tiptap-invisible-character]:before:w-0 " +
  "[&_.tiptap-invisible-character]:before:font-normal [&_.tiptap-invisible-character]:before:not-italic " +
  "[&_.tiptap-invisible-character]:before:leading-none " +
  "[&_.tiptap-invisible-character]:before:text-(--rte-muted-foreground) " +
  "[&_.tiptap-invisible-character--space]:before:content-['·'] " +
  "[&_.tiptap-invisible-character--break]:before:content-['↵'] " +
  "[&_.tiptap-invisible-character--paragraph]:before:content-['¶'] " +
  "[&_p.is-editor-empty:first-child>.tiptap-invisible-character--paragraph]:hidden ";

/**
 * Footnotes (the `footnotes` Tool, ADR-0076): the reference `sup[data-footnote-ref]` in the text and
 * the list `section[data-block=footnotes]` at the end of the Document. The look is the same in the
 * Editor and in the View, apart from the number: the View shows the list's own decimal markers and the
 * "↩" link, the Editor shows the number as a button (`[data-footnote-back]`) that returns the caret to
 * the text.
 *
 * THE LIST: a short rule on top, small secondary text, no visible heading (its name is in the HTML for
 * screen readers, `aria-label`). The roles are the Document's own (`--rte-hr`, `--rte-secondary`), so
 * the contrast of the quote's text holds here too, on the theme and on the Paper alike.
 *
 * THE TEXT STANDS NEXT TO ITS BACKLINK. In the saved HTML a footnote is `li > p` plus the "↩" link;
 * the paragraph is inline so the link follows the last word. In the Editor the item is a flex row of
 * the number button and the paragraph, and a flex item is a block whatever its `display`.
 *
 * JUMPS WITHOUT JS. The anchors are plain `#fn-…` and `#fnref-…` links. The item that was jumped to
 * (`:target`) is highlighted with the selection color, so the reader sees where they landed.
 */
const FOOTNOTE_CLASS =
  "[&_sup[data-footnote-ref]]:ml-px [&_sup[data-footnote-ref]>a]:font-medium " +
  "[&_section[data-block=footnotes]]:mt-6 [&_section[data-block=footnotes]]:border-t " +
  "[&_section[data-block=footnotes]]:border-(--rte-hr) [&_section[data-block=footnotes]]:pt-3 " +
  "[&_section[data-block=footnotes]]:text-sm [&_section[data-block=footnotes]]:text-(--rte-secondary) " +
  "[&_section[data-block=footnotes]_li>p]:inline " +
  "[&_section[data-block=footnotes]_li>a[role=doc-backlink]]:ml-1 " +
  "[&_section[data-block=footnotes]_li:target]:rounded-(--rte-radius) " +
  "[&_section[data-block=footnotes]_li:target]:bg-(--rte-selection) " +
  // In the Editor the number is a button, so the list needs no room for its own markers.
  "[&_section[data-block=footnotes]_ol:has(>li>[data-footnote-back])]:pl-0 " +
  "[&_section[data-block=footnotes]_li:has(>[data-footnote-back])]:flex " +
  "[&_section[data-block=footnotes]_li:has(>[data-footnote-back])]:list-none " +
  "[&_section[data-block=footnotes]_li:has(>[data-footnote-back])]:items-baseline " +
  "[&_section[data-block=footnotes]_li:has(>[data-footnote-back])]:gap-1.5 " +
  "[&_section[data-block=footnotes]_li>p]:min-w-0 [&_section[data-block=footnotes]_li>p]:flex-1 " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:min-w-5 " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:cursor-pointer " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:text-right " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:text-(--rte-link) " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:underline " +
  "[&_section[data-block=footnotes]_[data-footnote-back]]:underline-offset-2 " +
  // The number is followed by a dot, like the decimal marker the View's list draws itself.
  "[&_section[data-block=footnotes]_[data-footnote-back]]:after:content-['.'] ";

/**
 * Text part language (the `language` Tool, ADR-0078): `span[lang]` is a Mark with no look of its own
 * for the reader: a screen reader, spell checking and hyphenation read it, and nothing is drawn.
 *
 * THE UNDERLINE IS IN THE EDITOR ONLY (`.ProseMirror`), as the frame of a column: a thin dotted line
 * in the color of secondary text (`--rte-secondary`) shows the author where a mark begins and ends,
 * so a phrase in another language is not lost in the text. `RichTextView` has no `.ProseMirror`, so
 * the reader of a Document sees no line. The role is recalculated for the `paper` sheet and inside a
 * toned Wrapper, so the line follows the theme and the backing.
 */
const LANGUAGE_CLASS =
  "[&.ProseMirror_span[lang]]:underline [&.ProseMirror_span[lang]]:decoration-dotted " +
  // The thickness is an arbitrary property: `tailwind-merge` in `cn` takes `decoration-1` for a
  // conflict of `decoration-(color:…)` and drops it from the View's class list.
  "[&.ProseMirror_span[lang]]:[text-decoration-thickness:1px] " +
  "[&.ProseMirror_span[lang]]:underline-offset-[3px] " +
  "[&.ProseMirror_span[lang]]:decoration-(color:--rte-secondary) ";

/**
 * Video (the `youtube` and `twitch` Tools, ADR-0071): a server-rendered `div[data-block=video]`
 * block with a link inside, a 16:9 frame with the same classes as the player placeholder
 * (`PLAYER_FRAME`, `VideoPlayer.tsx`; a test compares the two lists). So the Editor's Skeleton
 * and the server HTML of `RichTextView` take the same height as the placeholder from the first
 * frame, and the arrival of a chunk or an island does not change it. The link is centered, and
 * it is readable and clickable without JS. The island puts the player into this same frame.
 *
 * The classes are written out as literals: Tailwind does not see classes assembled from a string.
 */
const VIDEO_CLASS =
  "[&_div[data-block=video]]:relative [&_div[data-block=video]]:aspect-video " +
  "[&_div[data-block=video]]:w-full [&_div[data-block=video]]:overflow-hidden " +
  "[&_div[data-block=video]]:rounded-(--rte-radius) [&_div[data-block=video]]:border " +
  "[&_div[data-block=video]]:border-(--rte-code-border) " +
  "[&_div[data-block=video]]:bg-(--rte-code-background) " +
  "[&_div[data-block=video]]:flex [&_div[data-block=video]]:items-center " +
  "[&_div[data-block=video]]:justify-center [&_div[data-block=video]]:p-4 " +
  "[&_div[data-block=video]>a]:max-w-full [&_div[data-block=video]>a]:truncate " +
  // On the gray frame background the link takes the main text color, as in a toned Wrapper: the
  // sheet's accent is calibrated for a white sheet, and on `code-background` it gave less than
  // 4.5:1 (axe, dark theme).
  "[&_div[data-block=video]]:[--rte-link:var(--rte-tone-link)] ";

/**
 * The consumer's own Block (ADR-0058, item 3.2): a `div[data-block]` with a name the kit does
 * not have. The kit gives it the paragraph rhythm and nothing more: the look is set by the
 * consumer's CSS, through `data-block` and the kit's tokens. The Block itself already gets
 * spacing like any Block in its place (`[&>*:not(:last-child)]:mb-3` and its neighbors). Here
 * it is about the Blocks INSIDE a container Block, with the same rhythm as in the Document and
 * in the Wrapper. Otherwise the paragraphs of the container would stick together.
 *
 * ONLY BLOCKS, NOT ANY CHILD. In a consumer's Block with inline content the children are text,
 * Marks and Atoms, and the `>*` rule would give spacing to an Atom that the consumer's CSS has
 * set to `inline-block`. The Document's Blocks are the kit Schema's tags and `div`s (the kit's
 * own Blocks and containers).
 *
 * WHY A LIST OF THE KIT'S NAMES AND NOT "A NAME WITH AN UNDERSCORE". A consumer's name is told
 * apart by an underscore (the Consumer prefix), but in an arbitrary Tailwind variant `_` reads
 * as a space, and escaping breaks the class (`tests/rich-text-view.test.tsx`). The Column layout
 * is excluded: its children are the columns of the grid, and the Wrapper and the column have
 * their own rule for the same case.
 */
const CUSTOM_BLOCK_CLASS =
  "[&_div[data-block]:not([data-block=layout],[data-block=column],[data-block=wrapper])>:is(p,h1,h2,h3,h4,ul,ol,blockquote,hr,pre,table,figure,div):not(:last-child)]:mb-3 " +
  "[&_div[data-block]:not([data-block=layout],[data-block=column],[data-block=wrapper])>:is(h1,h2,h3,h4):not(:first-child)]:mt-6";

/**
 * Block selection (ADR-0077): the selected Blocks are painted whole on `--rte-selection`, the same
 * role as the selected cells of a table and the selected text, with the Document's radius. The Blocks
 * carry the class from a decoration (`blockSelectionExtension.ts`), so it exists only in the Editor.
 * A 2px spread of the same color shows the selection around a Block that has a background of its own
 * (a code Block, a toned Wrapper). While the selection lasts, the root has `data-block-selection`:
 * the engine's own selection (which spans the Blocks) is not painted, and neither is the caret,
 * so the Document shows no cursor and no text selection.
 */
const BLOCK_SELECTION_CLASS =
  "[&_.rte-block-selected]:rounded-(--rte-radius) [&_.rte-block-selected]:bg-(--rte-selection) " +
  "[&_.rte-block-selected]:shadow-[0_0_0_2px_var(--rte-selection)] " +
  "[&[data-block-selection]]:caret-transparent [&[data-block-selection]]:selection:bg-transparent ";

/**
 * Document typography, shared by the Editor and the future `RichTextView`.
 *
 * ONE MODULE FOR BOTH, because the spec promises that the text looks the same in the Editor and
 * on the page. Two copies of the classes would drift apart at the first edit of a margin, and
 * only an author who opened the document after saving would notice.
 *
 * THE CLASSES ARE PUT ON THE CONTAINER and find tags by name (`[&_h2]:…`), not on the Document's
 * nodes. The original marked the nodes with classes (`heading-node`, `list-node`), and those
 * classes ended up in the saved HTML, in the consumer's database and in the allowlist of its
 * sanitizer. Here the HTML stays clean, and the styling lives outside it.
 *
 * Spacing between Blocks applies only to the direct children of the container and inside a quote:
 * an "all but the last" rule at any depth would push apart the paragraphs inside a list item.
 *
 * The module is server-safe: class strings, with no React and no engine.
 */
const PROSE_RULES =
  "text-(--rte-foreground) text-md leading-6 break-words " +
  // Text selection and focus of controls inside the Document use the `--rte-*` roles, not the
  // global rules of `styles.css` (`::selection` paints text in `--text-primary`, `:focus-visible`
  // paints the outline in `--accent-strong`). On a light sheet in a dark app, those global rules
  // would give light text on a light selection and a pale outline on white.
  "selection:bg-(--rte-selection) selection:text-(--rte-foreground) " +
  "[&_:focus-visible]:outline-(--rte-ring) " +
  COLOR_CLASS +
  CODE_THEME_CLASS +
  // Top-level Blocks, and Blocks inside a quote.
  "[&>*:not(:last-child)]:mb-3 [&_blockquote>*:not(:last-child)]:mb-2 " +
  // Headings. H1 is only for a Document with the `heading1` Tool. One typography serves both the
  // Editor and `RichTextView`, one step above H2.
  "[&_:is(h1,h2,h3,h4)]:font-semibold [&>:is(h1,h2,h3,h4):not(:first-child)]:mt-6 " +
  "[&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h4]:text-md " +
  // Lists: Tailwind's preflight removes the bullets, and they are restored here.
  "[&_:is(ul,ol)]:pl-6 [&_ul]:list-disc [&_ol]:list-decimal " +
  "[&_ul_ul]:list-[circle] [&_ol_ol]:list-[lower-alpha] [&_li+li]:mt-1 " +
  // Quote: a bar on the left instead of the original's pseudo-element. It looks the same, without
  // `position: relative` on each Block.
  "[&_blockquote]:border-l-4 [&_blockquote]:border-(--rte-quote) [&_blockquote]:pl-3.5 " +
  "[&_blockquote]:text-(--rte-secondary) " +
  "[&_hr]:my-4 [&_hr]:h-0.5 [&_hr]:border-0 [&_hr]:bg-(--rte-hr) " +
  // Link: as `Link variant="inline"` of the kit, in the accent color and ALWAYS underlined. A link
  // inside a paragraph that differs from the text only by color is not distinguished at all by a
  // colorblind reader (WCAG 1.4.1).
  "[&_a]:text-(--rte-link) [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_code]:rounded-(--rte-radius) [&_code]:border [&_code]:border-(--rte-code-border) " +
  "[&_code]:bg-(--rte-code-background) [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono " +
  "[&_code]:text-[0.9em] " +
  // Code Block: a block that scrolls horizontally, so a long line of code does not wrap. The
  // background and the base color come from the highlight theme, not the kit's tokens
  // (`codeTheme.ts`, ADR-0051): the GitHub token colors keep their contrast only on their own
  // background. The inner `code` resets the inline style, otherwise the frame would be drawn twice
  // and the font would shrink a second time.
  "[&_pre]:rounded-(--rte-radius) [&_pre]:border [&_pre]:border-(--rte-code-border) " +
  "[&_pre]:bg-(--rte-code-block-background) [&_pre]:text-(--rte-code-block-foreground) " +
  "[&_pre]:overflow-x-auto [&_pre]:px-3 [&_pre]:py-2 " +
  "[&_pre]:font-mono [&_pre]:text-[0.9em] [&_pre]:leading-5 " +
  "[&_pre_code]:rounded-none [&_pre_code]:border-0 [&_pre_code]:bg-transparent " +
  "[&_pre_code]:p-0 [&_pre_code]:text-[length:inherit] " +
  // The buttons and the caption in the code Block header are painted with `--rte-*` roles in the
  // header itself (`CODE_HEADER_CLASS`, `codeHeader.ts`).
  // Task list: a checkbox next to the item's text instead of a bullet. The checkbox is the
  // engine's native `input`, and its color is the accent, through `accent-color`. A completed item
  // is struck through and muted to `fg-2`, not `fg-3`: on `bg-2` the third step does not hold 4.5,
  // and the item's text is still text that people read.
  //
  // The item is found as a child of `ul[data-type=taskList]`, not by its own `data-type`: the
  // attribute is on the item in the saved HTML, but in the Editor the engine's node view draws the
  // item, and does not set `data-type` on the `li`. `relative` is the anchor for the checkbox's
  // hidden label, which the engine positions absolutely.
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-1 " +
  "[&_ul[data-type=taskList]>li]:relative [&_ul[data-type=taskList]>li]:flex " +
  "[&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2 " +
  "[&_ul[data-type=taskList]>li>label]:mt-[5px] [&_ul[data-type=taskList]>li>label]:flex " +
  "[&_ul[data-type=taskList]>li>label]:shrink-0 " +
  "[&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li>div]:flex-1 " +
  "[&_li[data-checked=true]>div]:text-(--rte-muted) [&_li[data-checked=true]>div]:line-through " +
  "[&_input[type=checkbox]]:size-3.5 [&_input[type=checkbox]]:cursor-pointer " +
  "[&_input[type=checkbox]]:accent-(--rte-primary) " +
  // Image: centered, no wider than the Document, at its own size without `data-width`. The width
  // from a preset is set on the `figure` (the caption follows it too), and the `img` fills it. The
  // selector uses `:has`, because the attribute sits on the `img` (Schema: `img[data-width]`), while
  // in the Editor there is still a frame with handles between the `figure` and the `img`.
  //
  // The attribute value is IN QUOTES. Without them `[data-width=50]` is an invalid selector: an
  // unquoted value must be an identifier, and this one starts with a digit. The browser drops the
  // rule, and the Tailwind optimizer silently builds `figure:has()` from it. The width presets then
  // did not work in either the Editor or the View, and the image kept its own width.
  "[&_figure]:mx-auto [&_figure]:w-fit [&_figure]:max-w-full " +
  "[&_figure_img]:block [&_figure_img]:h-auto [&_figure_img]:max-w-full " +
  "[&_figure_img]:rounded-(--rte-radius) [&_figure_img[data-width]]:w-full " +
  "[&_figure:has(img[data-width='50'])]:w-1/2 [&_figure:has(img[data-width='75'])]:w-3/4 " +
  "[&_figure:has(img[data-width='100'])]:w-full " +
  // Caption: `fg-2`, like a completed checklist item. On `bg-2` it holds 4.5.
  "[&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-sm " +
  "[&_figcaption]:text-(--rte-muted) " +
  TABLE_CLASS +
  " " +
  LAYOUT_CLASS +
  " " +
  WRAPPER_CLASS +
  " " +
  DETAILS_CLASS +
  " " +
  MATH_CLASS +
  INVISIBLE_CHARACTERS_CLASS +
  FOOTNOTE_CLASS +
  LANGUAGE_CLASS +
  VIDEO_CLASS +
  BLOCK_SELECTION_CLASS +
  CUSTOM_BLOCK_CLASS;

/**
 * Document typography, shared by the Editor and `RichTextView`, on the app theme's tokens
 * (`surface="theme"`, the default).
 */
export const PROSE_CLASS = EDITOR_TOKENS_CLASS + " " + PROSE_RULES;

/**
 * Edge of the `surface="paper"` sheet: a light background, a border and a shadow. The border
 * and the shadow are tokens of the APP THEME, not of the sheet: they separate the sheet from
 * what surrounds it, and they are visible on a dark backing just as on a light one.
 * `scheme-light` makes the native checkbox and scrollbar draw in light colors.
 */
export const PAPER_SHEET_CLASS =
  "rounded-(--r-sm) border border-(--line) bg-(--rte-background) px-4 py-3 " +
  "shadow-[var(--shadow-1)] scheme-light";

/** The same typography on the light sheet (`surface="paper"`). */
export const PAPER_PROSE_CLASS =
  EDITOR_PAPER_TOKENS_CLASS + " " + PAPER_SHEET_CLASS + " " + PROSE_RULES;

/** Document container classes for the given surface. */
export function proseClass(surface: RichTextSurface): string {
  return surface === "paper" ? PAPER_PROSE_CLASS : PROSE_CLASS;
}

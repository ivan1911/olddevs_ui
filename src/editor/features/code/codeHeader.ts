import { codeLanguage, normalizeCodeLanguage } from "./codeLanguages.js";

/*
  THE CODE BLOCK HEADER: one bar above the code, shared by the Editor and `RichTextView`. The
  language is on the left and "Copy" on the right; the code starts right under the bar, and the
  buttons do not cover it. The bar is block chrome: `select-none`, so it does not get into the
  selection or the copy.

  ONE CARD FROM TWO PARTS: the header has rounded top corners and its own border, and the `pre`
  under it loses the top border and the top rounding (`prose.ts` draws it whole). The wrapper
  class and the `prose.ts` rules live in one variant, `[&_pre]`, so Tailwind sets
  `border-top-width` and the top radii AFTER `border-width` and `border-radius`: the order is
  decided by the property, not by the order in the string. The header's bottom is a line from the
  divider token `--rte-hr`; it is quieter than a border.

  The strings are literal and whole: Tailwind reads the sources as text.
*/

/** Wrapper of the block: the `pre` inside it loses its top border. */
export const CODE_BLOCK_CLASS = "[&_pre]:rounded-t-none [&_pre]:border-t-0";

export const CODE_HEADER_CLASS =
  "flex h-7 items-center justify-between gap-2 rounded-t-(--rte-radius) border " +
  "border-(--rte-code-border) border-b-(--rte-hr) bg-(--rte-code-block-background) " +
  "px-1 font-sans text-xs text-(--rte-code-block-foreground) select-none " +
  // The header buttons (language, "Copy") are chrome inside the Document: the kit's `ghost` button
  // paints its text and hover with the APP's theme tokens, and those are not recomputed under a
  // nested `data-theme`. On a `surface="paper"` sheet in a dark app, a light icon would land on the
  // white header. The sheet reassigns the `--rte-*` roles (`EDITOR_PAPER_TOKENS_CLASS`), so the text
  // and hover use them. The `button` selector under this class is more specific than the button's
  // own classes, so its tone vocabulary is left untouched.
  "[&_button]:text-(--rte-secondary) " +
  "[&_button:is([data-hovered],:hover)]:bg-(--rte-control-hover)";

/** Mount point for the right-hand button: an inline box would otherwise lift the icon to the baseline. */
export const CODE_SLOT_CLASS = "inline-flex items-center";

/**
 * The label on the left. Its indent is the same as that of the language button in the Editor, and
 * its color is the same `--rte-secondary` role as the header buttons.
 */
export const CODE_LABEL_CLASS = "px-1.5 leading-6 font-semibold text-(--rte-secondary)";

/**
 * A code Block in the Document's form: `<pre><code …>…</code></pre>`, with a language class or
 * without one. Inside `code` there are both highlight tokens and bare text. A closing `</pre>`
 * never occurs inside the code, because the text is escaped.
 */
const BLOCK = /<pre>(<code(?: class="language-([\w+#-]+)")?>[\s\S]*?)<\/pre>/g;

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * Whether the Document has at least one code Block, the kind that gets the `withCodeHeaders`
 * header. `RichTextView` uses it to decide whether to render the "Copy" Island: a text-only
 * Document does not need it. The expression is the same as the header's, but a fresh one rather
 * than a shared one, because a global regex's `test` advances `lastIndex`.
 */
export function hasCodeBlocks(html: string): boolean {
  return new RegExp(BLOCK.source).test(html);
}

/**
 * The header of each code Block in a saved Document, built as a string on the server at display time.
 *
 * WHY MARKUP AND NOT THE CLIENT. The language label and the bar itself come in the page's HTML:
 * without JS the document reads the same, and the space for the button does not appear after
 * hydration and does not shift the text. The client Island (`CodeCopyIsland`) only puts the button
 * into the empty `data-code-copy` Mount point; the attribute's value is this view's identifier, so
 * two views on one page do not share mount points.
 *
 * The language name comes from the data in `codeLanguages.ts`, looked up by the NORMALIZED name,
 * not inserted from the Document's string, so a foreign class never gets into the markup. A Block
 * with no language, or with an unknown one, stays without a label: the message catalog is not
 * available to the server component, and "Plain text" without a translation would show in English
 * to a Russian-speaking consumer.
 *
 * The string arrives here already sanitized (it goes into `innerHTML` the same way). The helper
 * opens no new source of markup: only module constants, the label from the language list and the
 * escaped view identifier get into it.
 */
export function withCodeHeaders(html: string, hostId: string): string {
  return html.replace(BLOCK, (_block, inner: string, name: string | undefined) => {
    const label = name ? (codeLanguage(normalizeCodeLanguage(name))?.label ?? "") : "";
    return (
      `<div class="${CODE_BLOCK_CLASS}" data-code-block>` +
      `<div class="${CODE_HEADER_CLASS}" data-code-header>` +
      `<span class="${CODE_LABEL_CLASS}">${label}</span>` +
      `<span class="${CODE_SLOT_CLASS}" data-code-copy="${escapeAttribute(hostId)}"></span>` +
      `</div><pre>${inner}</pre></div>`
    );
  });
}

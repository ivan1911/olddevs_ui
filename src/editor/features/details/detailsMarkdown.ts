"use client";

import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from "@tiptap/core";

/**
 * The Details Block in Markdown is raw HTML, as on GitHub:
 *
 * ```
 * <details>
 * <summary>Title</summary>
 *
 * Content in Markdown.
 *
 * </details>
 * ```
 *
 * WHY IT HAS ITS OWN PARSER. The Tiptap extension writes a Block with the `:::details` syntax
 * (Pandoc), which neither GitHub nor any other Markdown knows. The general parser for raw HTML in
 * `@tiptap/markdown` cuts the Block into pieces at blank lines: a CommonMark HTML block ends at the
 * first blank line, so the opening tag, the Markdown inside and the closing tag arrive as three
 * tokens that cannot be glued back together. So a separate tokenizer parses the Block: from
 * `<details>` to the matching `</details>`, counting nested Blocks, and the content between them is
 * Markdown again. The title (`summary`) is one line of inline Markdown. GitHub does not read it as
 * Markdown (asterisks stay asterisks), but the round trip through `setMarkdown` and `getMarkdown`
 * loses nothing because of that.
 *
 * The module has no Tiptap runtime values: only types and pure functions over a string.
 */

/** Opening tag of a Block, with any attributes. */
const OPEN_TAG = /^<details(?:\s[^<>]*)?>/i;
/** Any Block tag, for counting nesting. */
const ANY_TAG = /<(\/?)details(?:\s[^<>]*)?>/gi;
/** `summary` right after the opening tag; whitespace and line breaks before it are ignored. */
const SUMMARY = /^\s*<summary(?:\s[^<>]*)?>([\s\S]*?)<\/summary>[ \t]*/i;

/**
 * A copy of the string in which everything that cannot be a Block tag is replaced with spaces:
 * code fences and inline code. The length and positions stay the same, so the tags found in the
 * copy point into the original string. Otherwise a `<details>` in a code example inside a Block
 * would shift the nesting, and the Block would close in the wrong place.
 */
function maskCode(src: string): string {
  let fence: string | null = null;
  const lines = src.split("\n").map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker[0]!.repeat(3);
      return " ".repeat(line.length);
    }
    if (fence !== null) {
      if (marker && marker.startsWith(fence)) fence = null;
      return " ".repeat(line.length);
    }
    return line.replace(/(`+)[^`\n]*?\1/g, (span) => " ".repeat(span.length));
  });
  return lines.join("\n");
}

/**
 * Position of the end of the matching `</details>` (after the tag) for the Block that is opened
 * at the start of `src`.
 */
function closingEnd(src: string, afterOpen: number): number {
  const masked = maskCode(src);
  let level = 1;
  ANY_TAG.lastIndex = afterOpen;
  for (let match = ANY_TAG.exec(masked); match; match = ANY_TAG.exec(masked)) {
    level += match[1] ? -1 : 1;
    if (level === 0) return match.index + match[0].length;
  }
  return -1;
}

/** Title on one line: line breaks and runs of spaces become a single space. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Tokenizer for the `details` Block, for `marked` (the extension's `markdownTokenizer`). */
export const detailsTokenizer: MarkdownTokenizer = {
  name: "details",
  level: "block",
  start: (src) => src.search(/^<details[\s>]/im),
  tokenize(src, _tokens, lexer: MarkdownLexerConfiguration) {
    const open = OPEN_TAG.exec(src);
    if (!open) return undefined;
    const end = closingEnd(src, open[0].length);
    if (end < 0) return undefined;
    // The Block's raw text ends with `</details>` on this line: anything after it is not ours.
    const raw = src.slice(0, end);
    const closeTag = /<\/details(?:\s[^<>]*)?>$/i.exec(raw)?.[0] ?? "";
    const inner = raw.slice(open[0].length, raw.length - closeTag.length);
    const summary = SUMMARY.exec(inner);
    const body = summary ? inner.slice(summary[0].length) : inner;
    const tokens: MarkdownToken[] = body.trim() ? lexer.blockTokens(body) : [];
    // Blocks without their own `tokens` (a paragraph, a heading) get their inline tokens from
    // `marked` itself inside `blockTokens`; here we only fill in what it left as plain text, as
    // `createBlockMarkdownSpec` in Tiptap does.
    for (const token of tokens) {
      if (token.text && (!token.tokens || token.tokens.length === 0)) {
        token.tokens = lexer.inlineTokens(token.text);
      }
    }
    return {
      type: "details",
      raw,
      // `open` is set when the opening tag has it: `<details open>`.
      open: /^<details(?:\s[^<>]*)?\sopen(?:[\s=>/]|$)/i.test(open[0]),
      summary: summary ? lexer.inlineTokens(oneLine(summary[1] ?? "")) : [],
      tokens,
    } as MarkdownToken;
  },
};

/**
 * Token → Details node: the title from text with Marks, the content as Blocks (empty content
 * becomes one empty paragraph). The `open` attribute is kept only when it is in the Schema
 * (`persist`).
 */
export function parseDetails(
  token: MarkdownToken,
  helpers: MarkdownParseHelpers,
  persist: boolean
): JSONContent {
  const title = helpers
    .parseInline((token.summary as MarkdownToken[] | undefined) ?? [])
    // The title is text with Marks only: a line break and an image cannot live in it.
    .filter((node) => node.type === "text");
  const blocks = helpers.parseChildren(token.tokens ?? []);
  return helpers.createNode("details", persist && token.open === true ? { open: true } : {}, [
    helpers.createNode("detailsSummary", {}, title),
    helpers.createNode("detailsContent", {}, blocks.length > 0 ? blocks : [{ type: "paragraph" }]),
  ]);
}

/**
 * Node → Markdown: an opening tag with the `summary` on its own line, a blank line, the Blocks
 * separated by blank lines, a blank line, the closing tag. The blank line after `summary` is what
 * makes GitHub read the content as Markdown. A `<` in the title is written as `&lt;`: otherwise
 * the text "a </summary> b" would close the title too early.
 */
export function renderDetails(
  node: JSONContent,
  helpers: MarkdownRendererHelpers,
  persist: boolean
): string {
  const [summary, content] = node.content ?? [];
  const title = summary?.content ? helpers.renderChildren(summary.content) : "";
  const body = content?.content ? helpers.renderChildren(content.content, "\n\n") : "";
  const open = persist && node.attrs?.open ? " open" : "";
  return `<details${open}>\n<summary>${title.replace(/</g, "&lt;")}</summary>\n\n${body}\n\n</details>`;
}

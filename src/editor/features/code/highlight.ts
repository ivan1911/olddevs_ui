import { normalizeCodeLanguage } from "./codeLanguages.js";
import { highlightCode, type HighlightTree } from "./lowlight.js";

/**
 * A code Block in the Editor's form: `<pre><code class="language-…">` with only escaped text
 * inside. The Schema does not let marks or `<br>` line breaks into a code Block, and `getHTML()`
 * writes it exactly like that; DOMPurify does not change the form when it sanitizes.
 *
 * `[^<]*` IS NOT A SIMPLIFICATION BUT A GUARD. A Block that already contains markup inside it
 * (highlighted earlier, or written by hand) does not match the expression and stays as it was.
 * That is what makes it idempotent: a second pass finds no block with bare text.
 */
const CODE_BLOCK = /<pre><code class="language-([\w+#-]+)">([^<]*)<\/code><\/pre>/g;

/**
 * Entities that DOM serializers write in text (`innerHTML` in the browser, jsdom in DOMPurify,
 * Tiptap's `getHTML()`): `&amp;`, `&lt;`, `&gt;`, `&nbsp;`, plus quotes and numeric references,
 * which other sanitizers write.
 */
const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * The text of a block from HTML. `null` means an entity outside this list was met (`&copy;`):
 * without the full HTML table it cannot be decoded the way a browser decodes it, so it is better
 * to leave the block unhighlighted than to show different text.
 */
function decode(html: string): string | null {
  let unknown = false;
  const text = html.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]*);/gi, (entity, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }
    const named = NAMED[body];
    if (named === undefined) unknown = true;
    return named ?? entity;
  });
  return unknown ? null : text;
}

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

type HighlightNode = HighlightTree["children"][number];

/**
 * The lowlight tree as HTML.
 *
 * WHY A CUSTOM SERIALIZER AND NOT `hast-util-to-html`. The lowlight tree is narrow: text, and a
 * `span` with a `className`, and nothing else ever appears in it. Ten lines are enough for that,
 * while `hast-util-to-html` is one more optional dependency for the consumer, with half a dozen
 * packages of its own, for markup that does not occur here. The text is always escaped (`&`, `<`,
 * `>`), and the class value is quoted and escaped. `style` and the node's other properties are not
 * written at all.
 */
function serialize(nodes: readonly HighlightNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return escapeText(node.value);
      if (node.type !== "element") return "";
      const className = node.properties.className;
      const classes = Array.isArray(className) ? className.join(" ") : "";
      return `<span class="${escapeAttribute(classes)}">${serialize(node.children)}</span>`;
    })
    .join("");
}

/**
 * Highlight the code Blocks in a saved Document, for `RichTextView` and any other display page
 * (ADR-0051).
 *
 * In each `<pre><code class="language-…">` with an Editor language, the text is replaced by
 * `<span class="hljs-…">` tokens; the theme on the `RichTextView` container gives them colors
 * (`codeTheme.ts`). The rest of the HTML is not touched by a single byte. A Block without a
 * language, with an unknown language, or with markup already inside stays as it was, which is why
 * a repeated call changes nothing.
 *
 * ORDER: SANITIZE FIRST, THEN HIGHLIGHT. The helper finds blocks with an expression, not by
 * parsing the HTML, and it expects the Schema's markup that the sanitizer returns. There are no
 * `hljs-*` tokens in the Schema, and `sanitizeRichText` strips them: sanitizing after highlighting
 * would turn the block back into bare text.
 *
 * The module is safe for the server: string in, string out, with no DOM, React or Tiptap. It is
 * called on the server, when the page is served or when the Document is saved, next to sanitizing.
 */
export function highlightCodeBlocks(html: string): string {
  return html.replace(CODE_BLOCK, (block, name: string, escaped: string) => {
    const language = normalizeCodeLanguage(name);
    const code = language ? decode(escaped) : null;
    if (!language || code === null || code === "") return block;
    const tokens = serialize(highlightCode(language, code).children);
    // The class is the Schema's canonical name, not the string from the Document: `language-PY`
    // is highlighted as Python and must be named the same way. Otherwise sanitizing with
    // `sanitizeRichText` would strip the class, and the header and the theme would read the block
    // differently from how it was highlighted.
    return `<pre><code class="language-${language}">${tokens}</code></pre>`;
  });
}

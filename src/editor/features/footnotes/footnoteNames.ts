/**
 * Footnote names and the anchor scheme: THE LIGHTWEIGHT PART OF THE DATA (ADR-0076).
 * The server-side cleanup (`schema.ts`), `RichTextView` and the Tool's descriptor read it
 * without pulling in the engine.
 *
 * Two kinds of names, as with formulas (`mathNames.ts`): the Tiptap node names (what the
 * engine's Schema, the JSON envelope and the Markdown rules call things) and the HTML names
 * (`data-footnote-ref`, `data-block="footnotes"`, `fn-<key>` and `fnref-<key>`).
 *
 * The module is safe for the server: strings and pure functions, no React or Tiptap.
 */

/** The node name of the footnote reference: the inline atom with a number in the text. */
export const FOOTNOTE_REF_NODE = "footnoteRef";
/** The node name of one footnote: a single paragraph of inline content. */
export const FOOTNOTE_NODE = "footnote";
/** The node name of the footnote list: the last Block of the Document. */
export const FOOTNOTE_LIST_NODE = "footnoteList";

/** The `data-block` value of the list: `section[data-block="footnotes"]`. */
export const FOOTNOTE_LIST_BLOCK = "footnotes";
/** The reference's attribute: `sup[data-footnote-ref="<key>"]`. */
export const FOOTNOTE_REF_ATTRIBUTE = "data-footnote-ref";

/** Length of a footnote key. */
const KEY_LENGTH = 8;
const KEY_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const KEY_PATTERN = /^[a-z0-9]{8}$/;

/** Whether the string is a footnote key: eight lowercase letters and digits. */
export function isFootnoteKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

/** The `id` of a footnote (the list item) and the `href` target of its reference. */
export const footnoteId = (key: string): string => `fn-${key}`;
/** The `id` of a reference and the `href` target of the footnote's "↩". */
export const referenceId = (key: string): string => `fnref-${key}`;

/** The key of a `fn-<key>` or `fnref-<key>` value with the given prefix; `null` if it has another shape. */
export function keyOfAnchor(value: string | null, prefix: "fn-" | "fnref-"): string | null {
  if (value === null || !value.startsWith(prefix)) return null;
  const key = value.slice(prefix.length);
  return isFootnoteKey(key) ? key : null;
}

/**
 * A fresh random key that is not in `taken`. The key does not change when the footnotes are
 * renumbered: the number is computed at display time, the key is the link (ADR-0076, item 4).
 */
export function newFootnoteKey(taken: ReadonlySet<string> = new Set()): string {
  for (;;) {
    const bytes = new Uint8Array(KEY_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    const key = Array.from(bytes, (byte) => KEY_ALPHABET[byte % KEY_ALPHABET.length]).join("");
    if (!taken.has(key)) return key;
  }
}

/** The Atom text of a reference: the number in square brackets, as `getText()` and the counter see it. */
export const referenceText = (number: number): string => `[${number}]`;

/** The backlink's text in the HTML: "↩". */
export const BACKLINK_TEXT = "↩";

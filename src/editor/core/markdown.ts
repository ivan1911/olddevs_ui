"use client";

import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { Marked, type marked } from "marked";
import { Fragment, Slice, type ResolvedPos, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorProps } from "@tiptap/pm/view";
import { inContainerFreeNode } from "./containers.js";
import { COLUMN_NODE, LAYOUT_NODE } from "../features/layout/layout.js";
import { replaceDocument } from "./maxLength.js";
import { WRAPPER_NODE } from "../features/wrapper/wrapper.js";
import { WRAPPER_TONE_ALERTS } from "../features/wrapper/wrapperTones.js";
import { VIDEO_BLOCK } from "../features/video/videoSrc.js";
import { conformToSchema, headingLevels } from "./schemaConform.js";
import { FOOTNOTE_REF_NODE } from "../features/footnotes/footnoteNames.js";
import { footnotesChunk } from "../features/footnotes/footnotesLoader.js";

/**
 * Markdown goes into the Document through the Schema, not around it. `@tiptap/markdown` parses the
 * text into JSON with the engine's set of extensions, and it already loses the tokens it does not
 * know (a table, a link without the link extension). The rest of the tree is conformed to the
 * Schema by `conformToSchema` (`schemaConform.ts`).
 */

/**
 * Nodes that are not in Markdown and are not created from it, even when the Schema has them: the
 * Column layout and its column, and the Wrapper. A `<div data-block="layout">` written as raw HTML
 * inside Markdown is parsed by the Schema's rules. But Markdown has no columns, by the owner's
 * decision, so their Blocks follow one another. A Wrapper without a tone has nothing to be in
 * Markdown either, so its Blocks follow one another too. A Wrapper with a tone comes only from a
 * GitHub alert (`alertOf` below), not from raw HTML.
 */
const NOT_FROM_MARKDOWN: ReadonlySet<string> = new Set([LAYOUT_NODE, COLUMN_NODE, WRAPPER_NODE]);

/**
 * GitHub alert: a blockquote whose first line is a tone label, one of `[!NOTE]`, `[!TIP]`,
 * `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]`, on a line of its own. The case does not matter, as on
 * GitHub. A label with text on the same line (`> [!NOTE] text`) and an unknown label (`[!INFO]`)
 * are an ordinary blockquote: GitHub does not show them as alerts either.
 */
const ALERT_LABEL = /^\[!(\w+)\][ \t]*(?:\n|$)/;
const TONE_OF_ALERT: ReadonlyMap<string, string> = new Map(
  Object.entries(WRAPPER_TONE_ALERTS).map(([tone, label]) => [label, tone])
);

/** Line breaks at the start of a run of inline nodes. */
function dropLeadingBreaks(inline: JSONContent[]): JSONContent[] {
  let start = 0;
  while (inline[start]?.type === "hardBreak") start += 1;
  return inline.slice(start);
}

/**
 * The alert's tone and its Blocks without the label, or `null` if the node is not an alert. The
 * label is at the start of the first text of the first paragraph: the parser puts the lines of a
 * quote's paragraph into one text, joined by `\n`. A paragraph that held nothing but the label is
 * dropped.
 */
function alertOf(node: JSONContent): { tone: string; content: JSONContent[] } | null {
  if (node.type !== "blockquote") return null;
  const [first, ...rest] = node.content ?? [];
  const [text, ...inline] = first?.type === "paragraph" ? (first.content ?? []) : [];
  const match = text?.type === "text" ? ALERT_LABEL.exec(text.text ?? "") : null;
  const tone = match ? TONE_OF_ALERT.get(match[1]!.toUpperCase()) : undefined;
  if (!match || !tone) return null;
  const remainder = text!.text!.slice(match[0].length);
  // A hard break at the end of the label's line (two spaces or a backslash) belongs to the label,
  // not to the first paragraph. Otherwise the paragraph would start with an empty line.
  const restInline = remainder ? inline : dropLeadingBreaks(inline);
  const lead = [...(remainder ? [{ ...text, text: remainder }] : []), ...restInline];
  return { tone, content: lead.length > 0 ? [{ ...first, content: lead }, ...rest] : rest };
}

/**
 * A video Block outside the top level of the Document (in a list, in a quote) becomes a paragraph
 * with its link. Markdown does not know the player: a line that is only a link becomes a Block by
 * itself, while a link in a list item stays a link. A Block at the start of a list item does
 * not fit the Schema either, since there a paragraph is expected.
 */
function demoteNestedVideo(node: JSONContent, schema: Schema): JSONContent {
  if (node.type === VIDEO_BLOCK) {
    const href = String(node.attrs?.link ?? "");
    const marks = schema.marks.link ? [{ type: "link", attrs: { href } }] : undefined;
    return { type: "paragraph", content: [{ type: "text", text: href, marks }] };
  }
  return node.content
    ? { ...node, content: node.content.map((child) => demoteNestedVideo(child, schema)) }
    : node;
}

/**
 * Markdown as a fragment of the editor's Schema. The remaining mismatches with the Schema (block
 * nesting that it does not allow) are fitted by the insertion itself. The fragment goes into the
 * document through `replace` and ProseMirror's clipboard, and they complete the missing wrappers.
 *
 * A top-level GitHub alert becomes a Wrapper with a tone, if the Wrapper is in the Schema and
 * `wrapper` allows it at the insertion point. Otherwise it is like a Wrapper from HTML at the same
 * place: Blocks in a row, without the label. An alert inside a list or a quote stays a quote, as it
 * does on GitHub.
 */
function markdownToFragment(editor: Editor, markdown: string, wrapper = true): Fragment {
  const { schema } = editor;
  const options = { levels: headingLevels(editor), excluded: NOT_FROM_MARKDOWN };
  const toned = wrapper && WRAPPER_NODE in schema.nodes;
  const tree = editor.markdown?.parse(markdown).content ?? [];
  // Footnote labels are paired with their definitions over the whole parse (ADR-0076). The Schema has the
  // reference only in an engine created after the footnotes chunk, so the pairing is there when it is needed.
  const paired =
    FOOTNOTE_REF_NODE in schema.nodes
      ? (footnotesChunk()?.resolveMarkdownFootnotes(tree) ?? tree)
      : tree;
  const parsed = paired.map((child) =>
    child.type === VIDEO_BLOCK ? child : demoteNestedVideo(child, schema)
  );
  const blocks = parsed.flatMap((child) => {
    const alert = alertOf(child);
    if (!alert) return conformToSchema(child, schema, options);
    const content = alert.content.flatMap((block) => conformToSchema(block, schema, options));
    if (!toned) return content;
    return [
      {
        type: WRAPPER_NODE,
        attrs: { tone: alert.tone },
        // An empty alert becomes an empty Wrapper: a Wrapper always holds at least one Block.
        content: content.length > 0 ? content : [{ type: "paragraph" }],
      },
    ];
  });
  return Fragment.fromArray(blocks.map((block) => schema.nodeFromJSON(block)));
}

/**
 * The whole Document from Markdown. This is a Programmatic replacement (`EXTERNAL_CHANGE`), so the
 * character limit does not truncate it, the same as a new `value`. Without the Markdown extension,
 * nothing happens.
 */
export function replaceWithMarkdown(editor: Editor, markdown: string): void {
  replaceDocument(editor, markdownToFragment(editor, markdown));
}

/*
  Signs of Markdown in plain text from the clipboard. A line of text with no sign stays plain text:
  pasting "2 * 3 * 4" or "foo_bar_baz" must not suddenly change the markup, so italics are looked
  for only at word boundaries. An inline sign, however, must always come in a pair.
*/
const BLOCK_SIGNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}[ \t]+\S/m, // heading
  /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\S/m, // list item, including a checklist item
  /^ {0,3}>[ \t]?\S/m, // quote
  /^ {0,3}(?:`{3,}|~{3,})/m, // code block
  /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*\|[ \t:|-]*$/m, // table delimiter row
  // Reference link definition `[1]: https://…`. Only with an address that the link policy will
  // accept: "[Note]: call me" is plain text.
  /^ {0,3}\[[^\]\n]+\]:[ \t]*<?(?:https?|mailto):[^\s>]+>?(?:[ \t]+["'(].*)?$/im,
  // Footnote definition `[^1]: text` (GFM, ADR-0076).
  /^ {0,3}\[\^[^\]\s]+\]:[ \t]*\S/m,
];
const INLINE_SIGNS: readonly RegExp[] = [
  /(\*\*|__)(?=\S)[^\n]*?\S\1/, // bold
  /~~(?=\S)[^\n]*?\S~~/, // strikethrough
  /(?<!`)`[^`\n]+`(?!`)/, // inline code
  // Link and image. An image's `alt` may be empty. After the address, a title in quotes or
  // parentheses may follow.
  /!?\[[^\]\n]*\]\([^)\s]+(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*\)/,
  // An autolink in angle brackets, and only with a scheme: `<b>` and "a <b> c" are not autolinks.
  /<(?:https?|mailto):[^\s<>]+>/i,
  /(?<![\w*])\*(?=[^\s*])[^*\n]*[^\s*]\*(?![\w*])/, // italics with asterisks
  /(?<![\w_])_(?=[^\s_])[^_\n]*[^\s_]_(?![\w_])/, // italics with underscores
];

/** Whether plain text from the clipboard looks like Markdown. */
export function looksLikeMarkdown(text: string): boolean {
  return [...BLOCK_SIGNS, ...INLINE_SIGNS].some((sign) => sign.test(text));
}

/*
  Highlighted source in `text/html`. A code editor (VS Code, JetBrains, Sublime Text) puts the same
  text next to `text/plain`, colored by syntax highlighting: one monospace block, a `div` or a `pre`,
  with lines inside and a `span` with a `color`. These are not the author's styling but the colors
  of their theme. The HTML path would carry them into the Document as "their own color", while the
  Markdown markup would be left as raw text. There are three signs, and all three are needed. The
  only root is a block, itself monospace or a wrapper of such a block. Inside there is nothing but
  lines and coloring. The text matches `text/plain` up to whitespace (VS Code's lines are `div`s with
  no line breaks). A browser, Word and Google Docs put paragraphs, lists, links or a
  `<b id="docs-internal-guid-…">` at the root, and the first sign already rules them out.
*/
/** Nodes the parse skips: a `<head>` sometimes ends up inside `<body>`. */
const SOURCE_SKIPPED = new Set(["META", "STYLE", "LINK", "TITLE", "SCRIPT"]);
/** Blocks that code editors wrap the source and its lines in. */
const SOURCE_BLOCKS = new Set(["DIV", "PRE", "CODE"]);
/** Everything that can appear inside highlighted source: lines and coloring. */
const SOURCE_TAGS = new Set([
  ...SOURCE_BLOCKS,
  "SPAN",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "FONT",
]);
/**
 * A monospace font by name. VS Code writes the `font-family` from the settings as is, and a
 * generic `monospace` may be missing at the end: `'Fira Code'`.
 */
const MONOSPACE_FONT =
  /monospace|\bmono\b|menlo|monaco|consolas|courier|\bcode\b|inconsolata|iosevka|\bhack\b/i;

function isMonospaceBlock(element: Element): boolean {
  if (element.tagName === "PRE" || element.tagName === "CODE") return true;
  const style = element.getAttribute("style") ?? "";
  const font = /font-family\s*:([^;]*)/i.exec(style)?.[1] ?? "";
  return MONOSPACE_FONT.test(font) || /white-space\s*:\s*pre/i.test(style);
}

/** Monospace: the root itself, or a block under wrappers with no siblings, as in `div > pre`. */
function hasMonospaceBlock(root: Element): boolean {
  let block: Element | null = root;
  while (block && SOURCE_BLOCKS.has(block.tagName)) {
    if (isMonospaceBlock(block)) return true;
    block = block.childElementCount === 1 ? block.firstElementChild : null;
  }
  return false;
}

/** Whether the clipboard's `text/html` looks like highlighted source of its `text/plain`. */
function isHighlightedSource(html: string, text: string): boolean {
  // `DOMParser` is an inert document: images do not load, and scripts do not run.
  const { body } = new DOMParser().parseFromString(html, "text/html");
  const roots = Array.from(body.childNodes).filter((node) =>
    node.nodeType === Node.ELEMENT_NODE
      ? !SOURCE_SKIPPED.has(node.nodeName)
      : node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()
  );
  const root =
    roots.length === 1 && roots[0]!.nodeType === Node.ELEMENT_NODE ? (roots[0] as Element) : null;
  if (!root || !Array.from(root.querySelectorAll("*")).every((el) => SOURCE_TAGS.has(el.tagName)))
    return false;
  const squeeze = (value: string) => value.replace(/\s+/g, "");
  return hasMonospaceBlock(root) && squeeze(root.textContent ?? "") === squeeze(text);
}

/**
 * Markdown paste. It fires on plain text from the clipboard, and on highlighted source from a code
 * editor (`isHighlightedSource`), in which case the source's `text/plain` is parsed. Other
 * `text/html` (a browser, Word, Google Docs) goes through the usual HTML parse by the Schema, and
 * this path is not touched. "Paste as plain text" (Shift) and a paste inside code also stay plain
 * text: this way a person gets the original characters in exactly the case where Markdown is not
 * what they want.
 *
 * WHY `clipboardTextParser` AND NOT `handlePaste`. It is the standard place where ProseMirror turns
 * the clipboard's text into a Slice. From there the paste goes the ordinary way, with the `paste`
 * meta that the character limit reads, and with the structure fitted to the Schema.
 *
 * HIGHLIGHTED SOURCE GOES THROUGH `transformPasted`. ProseMirror makes the choice between text and
 * HTML itself, so the HTML in the clipboard never reaches `clipboardTextParser`. `transformPasted`
 * is the last step of the same parse, and it knows which path the parse took: `plain` there means
 * "as text" (Shift, a paste into code, or no HTML). So the Slice can be replaced only on the HTML
 * path, and the paste then goes the same ordinary way. The clipboard data itself is not in it. It
 * is remembered by the `paste` event, which reaches the plugin before the parse does.
 */
export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    const { editor } = this;
    // The clipboard of the current paste: from the `paste` event to the end of its parse.
    let clipboard: { text: string; html: string } | null = null;
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          // ProseMirror's types promise a Slice, but it treats `null` as "not mine" and hands the
          // text to the standard parse. The whole plain-text path rests on this.
          clipboardTextParser: ((text: string, $context: ResolvedPos, plain: boolean) => {
            if (plain || $context.parent.type.spec.code || !looksLikeMarkdown(text)) return null;
            const fragment = markdownToFragment(editor, text, !inContainerFreeNode($context));
            if (fragment.childCount === 0) return null;
            // A single line of text is not a block but a continuation of a paragraph. Pasting
            // `**bold**` into the middle of a sentence must not split it into three paragraphs.
            const open = fragment.childCount === 1 && fragment.firstChild?.isTextblock ? 1 : 0;
            return new Slice(fragment, open, open);
          }) as EditorProps["clipboardTextParser"],
          handleDOMEvents: {
            paste: (_view, event) => {
              const data = event.clipboardData;
              clipboard = data
                ? { text: data.getData("text/plain"), html: data.getData("text/html") }
                : null;
              // The clipboard lives for exactly one paste: the parse runs synchronously in this
              // same event. If another handler took the paste and it never reached
              // `transformPasted`, the next operation must not replace its own fragment with the
              // old clipboard. A mouse drag also goes through `transformPasted`.
              queueMicrotask(() => {
                clipboard = null;
              });
              return false;
            },
          },
          transformPasted: (slice, view, plain) => {
            const pasted = clipboard;
            clipboard = null;
            if (plain || !pasted?.html || !looksLikeMarkdown(pasted.text)) return slice;
            if (!isHighlightedSource(pasted.html, pasted.text)) return slice;
            const fragment = markdownToFragment(
              editor,
              pasted.text,
              !inContainerFreeNode(view.state.selection.$from)
            );
            // Open as far as possible, the way ProseMirror opens a Slice from
            // `clipboardTextParser`: a phrase continues the paragraph.
            return fragment.childCount > 0 ? Slice.maxOpen(fragment) : slice;
          },
        },
      }),
    ];
  },
});

/**
 * The Markdown extension with its OWN `marked` instance.
 *
 * WHY NOT A SHARED ONE. By default `@tiptap/markdown` registers the parse rules in the global
 * `marked`. An Editor with a checklist therefore left its tokenizer to every Editor created after
 * it on the same page, and Editors with different `tools` stopped being independent. The `marked`
 * option is the standard way to give an extension its own instance. `new Marked()` is created for
 * each extension, and an extension is created for each Editor's set of tools.
 *
 * The type cast is needed because Tiptap declares the option as `typeof marked` (a function with
 * methods), while `Marked` is a class with the same `use`, `lexer`, `Lexer` and `defaults` that the
 * Markdown manager relies on. Tiptap's own test injects `new Marked()` the same way.
 */
export function createMarkdown() {
  return Markdown.configure({ marked: new Marked() as unknown as typeof marked });
}

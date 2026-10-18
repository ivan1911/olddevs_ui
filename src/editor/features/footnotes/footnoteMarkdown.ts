"use client";

import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  MarkdownTokenizer,
} from "@tiptap/core";
import {
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_NODE,
  FOOTNOTE_REF_NODE,
  newFootnoteKey,
} from "./footnoteNames.js";

/**
 * Footnotes in Markdown: GFM's `[^1]` in the text and `[^1]: text` definitions (ADR-0076, item 7).
 *
 * WRITING. `getMarkdown()` numbers the footnotes `[^1]` … `[^n]` in the order of the references and
 * writes the definitions at the end, one per line. A footnote's hard break (`Shift+Enter`) is the
 * two spaces and a line break of an ordinary paragraph, and the next line is indented, so it stays
 * inside the definition.
 *
 * READING loses nothing. A label (`[^note]`) is only a pairing: it becomes a number. A reference with
 * no definition stays the text `[^note]`. A definition with no reference becomes a paragraph at the
 * end, with its label. A label used twice gives two footnotes with the same text, because the kit
 * has one footnote per reference. The second and later paragraphs of a definition (indented by four
 * spaces, as GFM writes them) are joined to the first with a hard break, because a footnote is one
 * paragraph.
 *
 * HOW. The tokenizers below cut the references and the definitions out for `marked`. The extension's
 * `parseMarkdown` keeps them as plain JSON (`label` instead of a key); `resolveMarkdownFootnotes`
 * then pairs labels with definitions over the whole parse, because a label's definition may stand
 * anywhere in the text (`markdown.ts` calls it before the tree is conformed to the Schema).
 *
 * The module has no Tiptap runtime values: only types and pure functions over strings and JSON.
 */

/** The pseudo-node a definition becomes between the tokenizer and the pairing. It never reaches the Schema. */
const DEFINITION = "footnoteDefinition";

const REFERENCE = /^\[\^([^\]\s]+)\]/;
const DEFINITION_START = /^ {0,3}\[\^([^\]\s]+)\]:[ \t]*/;
const DEFINITION_LINE = /^ {0,3}\[\^[^\]\s]+\]:/;
/** A line that cannot continue a paragraph: it starts another Block. */
const BLOCK_START = /^ {0,3}(?:#{1,6}(?:\s|$)|>|`{3,}|~{3,}|[-*_]{3,}\s*$|(?:[-*+]|\d{1,9}[.)])\s)/;
const CONTINUATION_INDENT = /^(?: {4}|\t)/;

/** The reference `[^label]` inside a line. */
export const referenceTokenizer: MarkdownTokenizer = {
  name: FOOTNOTE_REF_NODE,
  level: "inline",
  start: (src) => src.indexOf("[^"),
  tokenize(src) {
    const match = REFERENCE.exec(src);
    return match
      ? ({ type: FOOTNOTE_REF_NODE, raw: match[0], label: match[1] } as MarkdownToken)
      : undefined;
  },
};

/**
 * The definition `[^label]: text` and the lines that continue it: lazy continuation lines (until a
 * blank line or another Block), and paragraphs after a blank line that are indented by four spaces.
 */
export const definitionTokenizer: MarkdownTokenizer = {
  name: DEFINITION,
  level: "block",
  start: (src) => src.search(/^ {0,3}\[\^[^\]\s]+\]:/m),
  tokenize(src, _tokens, lexer: MarkdownLexerConfiguration) {
    const open = DEFINITION_START.exec(src);
    if (!open) return undefined;
    const lines = src.split("\n");
    const paragraphs: string[][] = [[lines[0]!.slice(open[0].length)]];
    let last = 0;
    let blank = false;
    for (let index = 1; index < lines.length; index++) {
      const line = lines[index]!;
      if (line.trim() === "") {
        blank = true;
        continue;
      }
      const indented = CONTINUATION_INDENT.test(line);
      if (blank) {
        // After a blank line only an indented line continues the definition, as a new paragraph.
        if (!indented) break;
        paragraphs.push([line.replace(CONTINUATION_INDENT, "")]);
        blank = false;
      } else {
        if (DEFINITION_LINE.test(line) || (!indented && BLOCK_START.test(line))) break;
        // Leading space only: the two trailing spaces of a hard break are the author's.
        paragraphs.at(-1)!.push(line.replace(/^[ \t]+/, ""));
      }
      last = index;
    }
    const raw = lines.slice(0, last + 1).join("\n") + (last + 1 < lines.length ? "\n" : "");
    return {
      type: DEFINITION,
      raw,
      label: open[1],
      paragraphs: paragraphs.map((paragraph) =>
        lexer.inlineTokens(paragraph.join("\n").replace(/\s+$/, ""))
      ),
    } as MarkdownToken;
  },
};

/** Token → reference. The label is carried until `resolveMarkdownFootnotes` pairs it with a definition. */
export function parseReference(token: MarkdownToken): JSONContent {
  return { type: FOOTNOTE_REF_NODE, attrs: { key: "", number: 0, label: String(token.label) } };
}

/** A line break inside a paragraph of the source is a space in a footnote, which is one paragraph of running text. */
function softBreaksToSpaces(nodes: JSONContent[]): JSONContent[] {
  return nodes.map((node) =>
    node.type === "text" && typeof node.text === "string"
      ? { ...node, text: node.text.replace(/\s*\n\s*/g, " ") }
      : node
  );
}

/** Token → the definition's pseudo-node: paragraphs joined by hard breaks. */
export function parseDefinition(token: MarkdownToken, helpers: MarkdownParseHelpers): JSONContent {
  const paragraphs = (token.paragraphs as MarkdownToken[][] | undefined) ?? [];
  const content = paragraphs.flatMap((tokens, index) => [
    ...(index > 0 ? [{ type: "hardBreak" } as JSONContent] : []),
    ...softBreaksToSpaces(helpers.parseInline(tokens)),
  ]);
  return {
    type: DEFINITION,
    attrs: { label: String(token.label) },
    ...(content.length > 0 && { content }),
  };
}

/** Reference → `[^n]`. */
export function renderReference(node: JSONContent): string {
  return `[^${Number(node.attrs?.number) || 1}]`;
}

/** Footnote → `[^n]: text`; the lines after a hard break are indented to stay in the definition. */
export function renderDefinition(node: JSONContent, helpers: MarkdownRendererHelpers): string {
  const text = node.content ? helpers.renderChildren(node.content) : "";
  return `[^${Number(node.attrs?.number) || 1}]: ${text.replace(/\n/g, "\n    ")}`.trimEnd();
}

/** The label of a pseudo-node or a reference. */
const labelOf = (node: JSONContent): string => String(node.attrs?.label ?? "");

/** References inside a footnote's own text: the Schema has none there, so they stay as text. */
function referencesAsText(nodes: JSONContent[]): JSONContent[] {
  return nodes.map((node) =>
    node.type === FOOTNOTE_REF_NODE ? { type: "text", text: `[^${labelOf(node)}]` } : node
  );
}

/**
 * Pairs references with definitions over a whole parse (an array of top-level JSON nodes) and puts
 * the footnote list at the end. See the module comment for the rules.
 */
export function resolveMarkdownFootnotes(blocks: JSONContent[]): JSONContent[] {
  // 1. The definitions come out of the text, wherever they stood (a quote, a list item).
  const definitions: JSONContent[] = [];
  const strip = (nodes: JSONContent[]): JSONContent[] =>
    nodes.flatMap((node) => {
      if (node.type === DEFINITION) {
        definitions.push(node);
        return [];
      }
      return node.content ? [{ ...node, content: strip(node.content) }] : [node];
    });
  const body = strip(blocks);
  const byLabel = new Map<string, JSONContent>();
  for (const definition of definitions) {
    if (!byLabel.has(labelOf(definition))) byLabel.set(labelOf(definition), definition);
  }

  // 2. Each reference with a definition becomes a reference and a footnote, in the order of the text.
  const notes: JSONContent[] = [];
  const used = new Set<JSONContent>();
  const taken = new Set<string>();
  const pair = (nodes: JSONContent[]): JSONContent[] =>
    nodes.flatMap((node) => {
      if (node.type === FOOTNOTE_REF_NODE) {
        const definition = byLabel.get(labelOf(node));
        // No definition: the source text stays as it was written.
        if (!definition) return [{ type: "text", text: `[^${labelOf(node)}]` }];
        const key = newFootnoteKey(taken);
        taken.add(key);
        used.add(definition);
        const content = referencesAsText(definition.content ?? []);
        notes.push({
          type: FOOTNOTE_NODE,
          attrs: { key, number: notes.length + 1 },
          ...(content.length > 0 && { content }),
        });
        return [{ type: FOOTNOTE_REF_NODE, attrs: { key, number: notes.length } }];
      }
      return node.content ? [{ ...node, content: pair(node.content) }] : [node];
    });
  const paired = pair(body);

  // 3. A definition nobody points to is kept as a paragraph, with its label.
  const orphans = definitions
    .filter((definition) => !used.has(definition))
    .map((definition): JSONContent => ({
      type: "paragraph",
      content: [
        { type: "text", text: `[^${labelOf(definition)}]: ` },
        ...referencesAsText(definition.content ?? []),
      ],
    }));

  return [
    ...paired,
    ...orphans,
    ...(notes.length > 0 ? [{ type: FOOTNOTE_LIST_NODE, content: notes }] : []),
  ];
}

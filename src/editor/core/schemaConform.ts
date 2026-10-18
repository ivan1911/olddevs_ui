"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { dateJsonAsText } from "../features/date/dateAsText.js";
import { formulaJsonAsText } from "../features/mathematics/mathAsText.js";
import { videoJsonAsLink } from "../features/video/videoAsLink.js";

/**
 * Brings a JSON tree to the Editor's Schema, before `Schema.nodeFromJSON`.
 *
 * WHY WE CLEAN THE JSON OURSELVES. `nodeFromJSON` checks neither the validity of a heading level
 * nor the nesting order, and it throws on an unknown node type, and then Tiptap silently replaces
 * the whole document with an empty one. So before loading, the JSON is checked against the
 * Schema: foreign nodes are unwrapped into their content, foreign marks are removed, and the
 * heading level is clamped to the allowed ones. The list of nodes is not hard-coded here:
 * whatever is in the Schema now passes through. A disabled Tool removes its node from the Schema,
 * and this code will not need to change.
 *
 * Markdown import (`markdown.ts`) calls it: `@tiptap/markdown` parses text into JSON using the
 * engine's extension set.
 */

/** Allowed heading levels: taken from the extension, not from a kit constant. */
export function headingLevels(editor: Editor): number[] {
  const heading = editor.extensionManager.extensions.find(({ name }) => name === "heading");
  const levels: unknown = heading?.options?.levels;
  return Array.isArray(levels) && levels.length > 0 ? levels.map(Number) : [];
}

/** The nearest allowed level: with H2–H4 allowed, `#` becomes H2 and `#####` becomes H4. */
function clampLevel(level: number, allowed: readonly number[]): number {
  return allowed.reduce((best, candidate) =>
    Math.abs(candidate - level) < Math.abs(best - level) ? candidate : best
  );
}

const isInline = (node: JSONContent, schema: Schema) =>
  node.type === "text" || (!!node.type && !!schema.nodes[node.type]?.isInline);

/**
 * Bare text in a block that holds only blocks is wrapped in a paragraph. This is what a list item
 * looks like when the engine has no extension for its markup: `- [ ] todo` without a task list
 * arrives as a list item with text and no paragraph, and without the wrapper the paste would lose
 * it entirely.
 */
function wrapInlineRuns(children: JSONContent[], schema: Schema): JSONContent[] {
  if (!schema.nodes.paragraph) return children;
  const blocks: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length > 0) blocks.push({ type: "paragraph", content: run });
    run = [];
  };
  for (const child of children) {
    if (isInline(child, schema)) {
      run.push(child);
    } else {
      flush();
      blocks.push(child);
    }
  }
  flush();
  return blocks;
}

export interface ConformOptions {
  /** Allowed heading levels (`headingLevels`); empty means the level is kept as is. */
  levels: readonly number[];
  /**
   * Nodes that are unwrapped into their content even when they are in the Schema: this way the
   * input says which of them it does not produce (Markdown: Column layouts and Wrappers).
   */
  excluded?: ReadonlySet<string>;
}

/** Brings a JSON node to the Schema: a foreign node is unwrapped or removed. */
export function conformToSchema(
  node: JSONContent,
  schema: Schema,
  options: ConformOptions
): JSONContent[] {
  if (node.type === "text") {
    const marks = node.marks?.filter((mark) => mark.type in schema.marks);
    return [{ ...node, marks: marks?.length ? marks : undefined }];
  }
  const children = (node.content ?? []).flatMap((child) => conformToSchema(child, schema, options));
  const type = node.type && !options.excluded?.has(node.type) ? schema.nodes[node.type] : undefined;
  // A formula without the `mathematics` Tool becomes text, and a video without `youtube` and
  // `twitch` becomes a link, not a loss (`mathAsText.ts`, `videoAsLink.ts`).
  // A date mention without the `date` Tool becomes its words (`dateAsText.ts`).
  const dateText = type ? null : dateJsonAsText(node);
  if (dateText) return dateText;
  if (!type) return formulaJsonAsText(node) ?? videoJsonAsLink(node, schema) ?? children;

  const content = type.inlineContent || type.isLeaf ? children : wrapInlineRuns(children, schema);
  const result: JSONContent = { ...node, content: content.length ? content : undefined };
  const { levels } = options;
  if (type.name === "heading" && levels.length > 0) {
    result.attrs = { ...node.attrs, level: clampLevel(Number(node.attrs?.level), levels) };
  }
  return type.inlineContent ? liftBlocks(result, schema) : [result];
}

/**
 * A block inside a Block with inline content is lifted out, and the text around it stays as
 * paragraphs on both sides. This is how an image in the middle of a line arrives: in Markdown,
 * `![…](…)` is an inline element, while in the Schema an image is a Block (`figure`).
 * `nodeFromJSON` does not check nesting, and without the lift the Block would end up inside a
 * paragraph.
 */
function liftBlocks(node: JSONContent, schema: Schema): JSONContent[] {
  const children = node.content ?? [];
  if (children.every((child) => isInline(child, schema))) return [node];
  const parts: JSONContent[] = [];
  let run: JSONContent[] = [];
  const flush = () => {
    if (run.length > 0) parts.push({ ...node, content: run });
    run = [];
  };
  for (const child of children) {
    if (isInline(child, schema)) run.push(child);
    else {
      flush();
      parts.push(child);
    }
  }
  flush();
  return parts;
}

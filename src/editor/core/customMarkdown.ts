"use client";

import {
  getExtensionField,
  type AnyExtension,
  type Editor,
  type JSONContent,
  type MarkdownRendererHelpers,
} from "@tiptap/core";
import { devWarn } from "../../lib/dev-warn.js";

/*
  The default Markdown of a custom Tool (ADR-0058, item 3.1).

  The Tool's own Markdown rules live in the Extensions: `renderMarkdown` and the Tiptap
  tokenizer; the descriptor has no separate field for them. Without them `@tiptap/markdown`
  would silently export the node as an empty string, along with all the text inside it. So a
  Node and a Mark without `renderMarkdown` get a fallback from the kit: a Block is exported
  with its content (the way `conform` unwraps a foreign node when parsing Markdown), an atom
  with its atom text (`renderText`, ADR-0058, item 4), and a Mark with its own text. Only an
  atom with no text is lost. Such a Block is not created back from Markdown: it has no parsing
  rules, so its text becomes paragraphs.

  One warning per Tool, and only when the default has kicked in: a consumer who does not
  export Markdown has no use for it.
*/

/** Field on the config of an atom of a custom Tool without Markdown rules: the Tool's name. */
export const MARKDOWN_FALLBACK = "kitMarkdownFallback";

/** Warning about the default Markdown — one per Tool (`devWarn` remembers the text). */
export function warnNoMarkdown(tool: string): void {
  devWarn(
    `custom tool "${tool}" has no Markdown rules (renderMarkdown in its Extensions): ` +
      "getMarkdown() writes its blocks as their content and its atoms as their text"
  );
}

/** Fields of a Node or a Mark that supply the default Markdown; `{}` if it has its own rules. */
export function markdownFallback(extension: AnyExtension, tool: string): object {
  if (getExtensionField(extension, "renderMarkdown") !== undefined) return {};
  // An atom (a leaf or `atom: true`) is exported by `markdownOf` (`atomText.ts`) — with the same
  // atom text as the built-in ones, and without an empty Block in place of an atom with no text.
  // Here only the marker field is set, so that `markdownOf` warns about it itself.
  if (
    extension.type === "node" &&
    (getExtensionField(extension, "atom") === true ||
      getExtensionField(extension, "content") === undefined)
  ) {
    return { [MARKDOWN_FALLBACK]: tool };
  }
  // The Editor whose Schema holds the node: Markdown gets JSON, and `renderText` computes the atom
  // text from the ProseMirror node. A custom Tool's descriptor is expanded for each Editor
  // (`expandTools`), so there is exactly one Editor here.
  let editor: Editor | null = null;
  return {
    onBeforeCreate(
      this: { editor: Editor; parent?: ((...args: unknown[]) => void) | null },
      ...args: unknown[]
    ) {
      editor = this.editor;
      this.parent?.(...args);
    },
    renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers): string {
      warnNoMarkdown(tool);
      // A Mark: Tiptap calls this for the opening and closing markup around the stub. There is
      // none, so only the text remains.
      if (extension.type === "mark") return helpers.renderChildren(node);
      const type = editor?.schema.nodes[node.type ?? ""];
      if (!node.content) return "";
      return helpers.renderChildren(node.content, type && !type.inlineContent ? "\n\n" : "");
    },
  };
}

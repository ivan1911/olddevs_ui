"use client";

import type { Extensions } from "@tiptap/core";
import { FootnoteBehavior } from "./footnoteBehavior.js";
import { Footnote, FootnoteList, FootnoteReference } from "./footnoteNodes.js";
import type { FootnoteLabels } from "./footnoteShape.js";

/*
  Lazy chunk of the footnotes (ADR-0058, item 11.1): the nodes with their node view and Markdown, the
  keys and the upkeep of the list (`FootnoteBehavior`), the Commands' jumps and the pairing of Markdown
  labels. The Loader of the `footnotes` Tool (`footnotesLoader.ts`) loads it. Nothing imports this
  module statically, or `basic` would pay for the footnotes.

  What stays static: the Schema half (`footnoteNames.ts`, `footnoteHtml.ts`, `footnoteShape.ts`), the
  description, and `footnotesAsText.ts`, which an Editor WITHOUT the Tool needs.
*/

/**
 * The nodes, the keys and the list's upkeep (ADR-0076). The Slash menu is the only `run` that matters
 * to the engine: `insertFootnote` is a command, so `chain.insertFootnote()` is one transaction.
 */
export function footnoteExtensions(labels: FootnoteLabels, idPrefix: string): Extensions {
  return [
    FootnoteReference.configure({ idPrefix }),
    Footnote.configure({ labels, idPrefix }),
    FootnoteList.configure({ labels }),
    FootnoteBehavior,
  ];
}

export { currentFootnoteNumber, jump } from "./footnoteCommands.js";
export { resolveMarkdownFootnotes } from "./footnoteMarkdown.js";
export { scanFootnotes } from "./footnoteSync.js";

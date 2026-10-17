"use client";

// Origin: Tiptap, `@tiptap/extensions/character-count` (MIT, © Tiptap GmbH,
// https://github.com/ueberdosis/tiptap). The `filterTransaction` logic and the character count are
// taken from it. The limit is read by a function, and a replacement of the document from outside is
// let through by a meta flag. License: NOTICE in the package root.

import { Extension, type Editor } from "@tiptap/core";
import { Slice, type Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { textBetween } from "./atomText.js";
import { trimPaste } from "./pasteTrim.js";

/**
 * Meta flag of a transaction that replaces the document from outside, with a new `value` or with
 * `clear()`.
 *
 * Such a replacement is not subject to the limit: it is the consumer's data, not the author's
 * input. A limit that silently rejected a long `value` would leave the old text on screen while
 * a new value in the consumer's state.
 */
export const EXTERNAL_CHANGE = "olddevsExternalChange";

/**
 * The whole Document as new content, a Programmatic replacement: one transaction with the
 * `EXTERNAL_CHANGE` meta, which the limit does not truncate. This is how `setMarkdown()` and
 * `setJSON()` replace the Document.
 */
export function replaceDocument(editor: Editor, content: Fragment): void {
  const { tr, doc } = editor.state;
  const slice = new Slice(content, 0, 0);
  editor.view.dispatch(tr.replace(0, doc.content.size, slice).setMeta(EXTERNAL_CHANGE, true));
}

/**
 * Characters in the Document: `getText` without the Block separators. An Atom weighs the length
 * of its Atom text (`atomText.ts`): a separator counts 0, a hard break 1, an image the length of
 * its caption, a Merge Tag the length of `{{key}}`.
 */
export function countCharacters(doc: ProseMirrorNode): number {
  return textBetween(doc, 0, doc.content.size, "").length;
}

export interface MaxLengthOptions {
  limit: () => number | undefined;
}

/**
 * Character limit: an edit that takes the Document past `limit` is not applied.
 *
 * WHY NOT `CharacterCount` AS IS. Its limit is set once, when the engine is created, while
 * `maxLength` is a prop and may change. Recreating the engine for a new number would lose the
 * edit history and the caret. It also rejects any transaction past the limit, including a
 * replacement of the Document with a new `value`. And with `autoTrim` on by default, it cuts the
 * start of an over-long initial value, silently corrupting the consumer's data.
 *
 * A Document that is already past the limit (it came in that way, in `value`) may be shortened,
 * but not lengthened. A paste is trimmed to the limit rather than rejected whole. This is the
 * original's behavior: a person who pastes a paragraph into an almost full field gets everything
 * that fits. `pasteTrim.ts` does the trimming: the tail by characters, an atom whole.
 */
export const MaxLength = Extension.create<MaxLengthOptions>({
  name: "maxLength",

  addOptions() {
    return { limit: () => undefined };
  },

  addProseMirrorPlugins() {
    const { limit } = this.options;

    return [
      new Plugin({
        key: new PluginKey("maxLength"),
        filterTransaction: (transaction, state) => {
          const max = limit();
          if (
            !transaction.docChanged ||
            max === undefined ||
            transaction.getMeta(EXTERNAL_CHANGE)
          ) {
            return true;
          }

          const before = countCharacters(state.doc);
          const after = countCharacters(transaction.doc);
          if (after <= max || after <= before) return true;
          if (before >= max || !transaction.getMeta("paste")) return false;

          // Paste: the tail of the pasted text is cut. Editing the transaction inside the filter
          // is the original's approach. If there is nothing to cut, or the limit is still exceeded
          // after cutting, the edit is rejected whole.
          return trimPaste(transaction, after - max) && countCharacters(transaction.doc) <= max;
        },
      }),
    ];
  },
});

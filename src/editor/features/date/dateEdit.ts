"use client";

import type { Editor } from "@tiptap/core";
import { isDateNode, textWriter } from "./dateCommands.js";
import { isDatetime } from "./dateValue.js";

/*
  EDITING A DATE MENTION IN PLACE (ADR-0079): what only the popover form needs, kept out of
  `dateCommands.ts` so that the start bundle does not carry it.
*/

/**
 * Changes the mention at `pos` in one edit: the value and, with it, the text, re-written in the
 * current locale of the author. Nothing changes if both are the same.
 */
export function updateDate(editor: Editor, pos: number, value: string): boolean {
  const node = editor.state.doc.nodeAt(pos);
  const text = textWriter(editor)?.(value);
  if (!node || !isDateNode(node) || !text || !isDatetime(value)) return false;
  if (node.attrs.datetime === value && node.attrs.text === text) return true;
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, datetime: value, text });
      return true;
    })
    .run();
}

/** Removes the mention at `pos` in one edit. */
export function removeDate(editor: Editor, pos: number): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || !isDateNode(node)) return false;
  return editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(pos, pos + node.nodeSize);
      return true;
    })
    .run();
}

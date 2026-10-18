"use client";

import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";
import { DATE_NODE, isDatetime } from "./dateValue.js";

/** What the Tool's node keeps in the Editor's storage: the text of a value in the author's locale. */
export interface DateStorage {
  text: (datetime: string) => string;
}

/** The mention's text writer of this Editor: the locale and the `format` option are read from it. */
function writer(editor: Editor): DateStorage["text"] | null {
  const storage = editor.storage as unknown as Record<string, DateStorage | undefined>;
  return storage[DATE_NODE]?.text ?? null;
}

/** The node is a date mention. */
export function isDateNode(node: ProseMirrorNode): boolean {
  return node.type.name === DATE_NODE;
}

/**
 * The selected date mention: a node with its position. It is selected when the whole node is
 * selected (a click), or when the selection is exactly its range, as with `Shift+→` from the caret
 * in front of it (see the formula's `selectedFormula`: Chromium resets a node selection made by the
 * program, and a text range is not reset). `null` means something else is selected.
 */
export function selectedDate(state: EditorState): { node: ProseMirrorNode; pos: number } | null {
  const { selection } = state;
  if (selection instanceof NodeSelection) {
    return isDateNode(selection.node) ? { node: selection.node, pos: selection.from } : null;
  }
  const node = selection.empty ? null : state.doc.nodeAt(selection.from);
  return node && isDateNode(node) && selection.to === selection.from + node.nodeSize
    ? { node, pos: selection.from }
    : null;
}

/**
 * Inserts a mention at the caret, over the selection, in one transaction. `false` for a value that
 * is not a date in our two forms, for a field that cannot be edited, and for an Editor without the
 * Tool. The text is written now, in the current locale.
 */
export function insertDate(editor: Editor, value: string): boolean {
  const text = writer(editor)?.(value);
  if (!text || !editor.isEditable || !isDatetime(value)) return false;
  return editor
    .chain()
    .focus()
    .insertContent({ type: DATE_NODE, attrs: { datetime: value, text } })
    .run();
}

/**
 * Changes the mention at `pos` in one edit: the value and, with it, the text, re-written in the
 * current locale of the author. Nothing changes if both are the same.
 */
export function updateDate(editor: Editor, pos: number, value: string): boolean {
  const node = editor.state.doc.nodeAt(pos);
  const text = writer(editor)?.(value);
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

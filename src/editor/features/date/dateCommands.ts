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
export function textWriter(editor: Editor): DateStorage["text"] | null {
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
  const text = textWriter(editor)?.(value);
  if (!text || !editor.isEditable || !isDatetime(value)) return false;
  return editor
    .chain()
    .focus()
    .insertContent({ type: DATE_NODE, attrs: { datetime: value, text } })
    .run();
}

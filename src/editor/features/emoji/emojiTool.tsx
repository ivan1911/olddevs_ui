"use client";

import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { EmojiIcon } from "../../../icons.js";
import { EmojiGrid } from "./EmojiGrid.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Inserts an emoji as plain text: at the end of the selection, without replacing it, with the
 * caret right after the emoji.
 *
 * WHY AFTER THE SELECTION, NOT INSTEAD OF IT. An emoji does not replace a word; it is added to it.
 * Deleting the selected paragraph for a smiley at its edge would be a loss the person notices last.
 * The project owner decided this.
 *
 * ONE TRANSACTION — one undo step. It also goes through `maxLength`: the transaction filter rejects
 * an insert that would take the document past the limit, as a whole. An emoji is never inserted
 * "halfway", and the selection stays where it was.
 *
 * Marks are taken from the caret (`insertText` without explicit Marks): an emoji in bold text is
 * bold, like a letter typed there. Insertion is possible only when the end of the selection lies in
 * text: a selected image or a table row has no text, and `false` tells the caller so.
 */
export function insertEmoji(editor: Editor, char: string): boolean {
  if (!editor.isEditable) return false;
  const { state, view } = editor;
  const { $to } = state.selection;
  if (!$to.parent.inlineContent) return false;
  const tr = state.tr.insertText(char, $to.pos);
  tr.setSelection(TextSelection.create(tr.doc, $to.pos + char.length));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Emoji on the Tool description (ADR-0058, item 10.4): a check that a button with a popover fits
 * the same shape as a Tool of its own. It has no Schema and no Extensions: an emoji is plain text.
 *
 * The popover is the `EmojiGrid` in the kit's frame, attached to the button. Selecting an emoji
 * inserts it and closes the popover. Focus goes back to the Document, not to the button: the person
 * came to put a smiley into the text and keeps writing. The button is disabled when there is nowhere
 * to insert: a selected image or table cells.
 */
export const EMOJI_TOOL: ToolDescriptor = {
  name: "emoji",
  buttons: [
    {
      id: "emoji",
      label: ({ messages }) => messages.emoji,
      icon: EmojiIcon,
      can: (editor) => editor.state.selection.$to.parent.inlineContent,
      selectionMenu: true,
      popover: ({ editor, close }) => (
        <EmojiGrid
          onPick={(emoji) => {
            insertEmoji(editor, emoji.char);
            close();
          }}
          autoFocus={false}
        />
      ),
    },
  ],
};

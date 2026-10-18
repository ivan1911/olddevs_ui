"use client";

import type { Extensions } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { FootnoteIcon } from "../../../icons.js";
import type { FootnotesToolCommands } from "../../core/toolCommands.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { FootnoteBehavior } from "./footnoteBehavior.js";
import { jump } from "./footnoteCommands.js";
import { Footnote, FootnoteList, FootnoteReference, type FootnoteLabels } from "./footnoteNodes.js";
import { FOOTNOTE_LIST_NODE, FOOTNOTE_REF_NODE } from "./footnoteNames.js";

/**
 * The nodes, the keys and the list's upkeep (ADR-0076). The Slash menu is the only `run` that matters
 * to the engine: `insertFootnote` is a command, so `chain.insertFootnote()` is one transaction.
 */
export function footnoteExtensions(labels: FootnoteLabels): Extensions {
  return [
    FootnoteReference,
    Footnote.configure({ labels }),
    FootnoteList.configure({ labels }),
    FootnoteBehavior,
  ];
}

/**
 * Footnotes on the Tool's description (ADR-0076): the reference in the text, the list at the end of
 * the Document (a top-level node the Document names itself, like a Column layout), the "Footnote"
 * Slash menu item and the same item in the "…" menu, and the Commands.
 *
 * The reference is a `plainAtom`: Marks do not apply to it, so the Bubble menu does not surround it.
 * The list has no handle and no Slash menu or "+" inside it (`isFootnoteBlock`, `handleBlock`).
 *
 * There is no shortcut: `Ctrl/⌘+Alt+F` is Find and replace here, though it is the footnote's key in
 * Word and Google Docs, and the kit does not invent a second one (decision 10).
 *
 * The Commands are for screen code and tests. `insert` is a User edit (a separate undo step); the two
 * jumps move the caret and scroll, and so they work in `readOnly` (the Document does not change) but
 * not in a disabled field, and not in Source mode, where the Document is not on screen.
 */
export const FOOTNOTES_TOOL: ToolDescriptor = {
  name: "footnotes",
  engine: (context) =>
    footnoteExtensions({ listName: context.footnoteListName, back: context.footnoteBack }),
  blocks: { [FOOTNOTE_REF_NODE]: { plainAtom: true } },
  documentContent: [FOOTNOTE_LIST_NODE],
  // The kit's Schema tags the Tool writes: the reference, the list and the footnote's paragraph.
  kitTags: ["sup", "a", "section", "ol", "li", "p"],
  insertItems: [
    {
      id: "footnote",
      section: "insert",
      label: (m) => m.footnote,
      icon: FootnoteIcon,
      aliases: ["footnote", "endnote", "note", "сноска"],
      // Inline: it goes at the caret, in the text, and the menu makes no room for a Block.
      inline: true,
      run: (chain) => chain.insertFootnote(),
    },
  ],
  commands: ({ editor, bridge }): FootnotesToolCommands => {
    const ready = () => !editor.isDestroyed && !bridge.sourceOpen() && !bridge.disabled();
    return {
      insert: () => {
        if (!ready() || !editor.isEditable) return false;
        const before = editor.state.doc;
        editor
          .chain()
          .command(({ tr }) => {
            closeHistory(tr);
            return true;
          })
          .focus()
          .insertFootnote()
          .run();
        // The engine silently rejects an edit the character limit did not let through: the Document
        // is then the same one (`handle.ts`, `authorEdit`).
        return editor.state.doc !== before;
      },
      goToFootnote: (number) => ready() && jump(editor, "goToFootnote", number),
      goToReference: (number) => ready() && jump(editor, "goToFootnoteReference", number),
    };
  },
};

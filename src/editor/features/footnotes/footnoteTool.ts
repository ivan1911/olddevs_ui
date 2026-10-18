"use client";

import { closeHistory } from "@tiptap/pm/history";
import { FootnoteIcon } from "../../../icons.js";
import type { FootnotesToolCommands } from "../../core/toolCommands.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { FOOTNOTE_LIST_NODE, FOOTNOTE_REF_NODE } from "./footnoteNames.js";
import { FootnoteListShape, FootnoteReferenceShape, FootnoteShape } from "./footnoteShape.js";
import { footnotesChunk, loadFootnotes } from "./footnotesLoader.js";

/**
 * Footnotes on the Tool's description (ADR-0076): the reference in the text, the list at the end of
 * the Document (a top-level node the Document names itself, like a Column layout), the "Footnote"
 * Slash menu item and the same item in the "…" menu, and the Commands.
 *
 * LAZY (ADR-0058, item 11.1). `full` has the Tool, `basic` does not, and the nodes with their node view,
 * the keys, the list's upkeep and the Markdown rules weigh more than the start bundle should carry, so
 * they arrive through the Loader as `footnotesChunk.ts`. What stays here is static: the description, the
 * Slash menu item, the Schema half (`footnoteShape.ts`, which the Skeleton draws the reference and the
 * list from before the chunk arrives) and the server-safe cleanup (`footnoteHtml.ts`).
 *
 * The reference is a `plainAtom`: Marks do not apply to it, so the Bubble menu does not surround it.
 * The list has no handle (`handleBlock`), and the Slash menu and "+" do not work inside a footnote.
 *
 * There is no shortcut: `Ctrl/⌘+Alt+F` is Find and replace here, though it is the footnote's key in
 * Word and Google Docs, and the kit does not invent a second one (OLDSUI-306, interview decision 10:
 * the ADR does not repeat it).
 *
 * The Commands are for screen code and tests. `insert` is a User edit (a separate undo step); the two
 * jumps move the caret and scroll, and so they work in `readOnly` (the Document does not change) but
 * not in a disabled field, and not in Source mode, where the Document is not on screen.
 */
export const FOOTNOTES_TOOL: ToolDescriptor = {
  name: "footnotes",
  load: loadFootnotes,
  engine: (context) =>
    footnotesChunk()!.footnoteExtensions(
      { listName: context.footnoteListName, back: context.footnoteBack },
      context.footnoteIdPrefix ?? ""
    ),
  // The same nodes without the node view, the keys and Markdown: the Skeleton draws the saved markup.
  skeleton: (context) => {
    const labels = { listName: context.footnoteListName, back: context.footnoteBack };
    return [
      FootnoteReferenceShape,
      FootnoteShape.configure({ labels }),
      FootnoteListShape.configure({ labels }),
    ];
  },
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
      // The Russian word is an escape sequence: the i18n gate rejects Cyrillic letters in code. It is input
      // data for the filter, so a Russian word finds the item in an English interface too.
      aliases: ["footnote", "endnote", "note", "\u0441\u043d\u043e\u0441\u043a\u0430"],
      // Inline: it goes at the caret, in the text, and the menu makes no room for a Block.
      inline: true,
      run: (chain) => chain.insertFootnote(),
    },
  ],
  commands: ({ editor, bridge }): FootnotesToolCommands => {
    // Before the chunk has loaded there is no engine with footnotes, and no jump to make.
    const ready = () =>
      !!footnotesChunk() && !editor.isDestroyed && !bridge.sourceOpen() && !bridge.disabled();
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
      goToFootnote: (number) => ready() && footnotesChunk()!.jump(editor, "goToFootnote", number),
      goToReference: (number) =>
        ready() && footnotesChunk()!.jump(editor, "goToFootnoteReference", number),
    };
  },
};

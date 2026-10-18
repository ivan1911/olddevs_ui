"use client";

import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import {
  FOOTNOTE_NODE,
  FOOTNOTE_REF_NODE,
  isFootnoteKey,
  newFootnoteKey,
} from "./footnoteNames.js";
import { findNote, scanFootnotes, syncTransaction, type Placed } from "./footnoteSync.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    footnotes: {
      /**
       * Put a footnote reference at the end of the selection and a new, empty footnote in its place
       * in the list; the caret goes into the footnote's text. One transaction is one undo step.
       * `false` where a reference cannot stand: in code, in a formula, in a footnote.
       */
      insertFootnote: () => ReturnType;
      /** The caret goes to the end of footnote `number` (from 1) and the footnote is scrolled into view. */
      goToFootnote: (number: number) => ReturnType;
      /** The caret goes right after the reference of footnote `number` and the reference is scrolled into view. */
      goToFootnoteReference: (number: number) => ReturnType;
    };
  }
}

/** The selection's text Block is a footnote's text. */
export function inFootnote(state: Pick<EditorState, "selection">): boolean {
  return state.selection.$from.parent.type.name === FOOTNOTE_NODE;
}

/**
 * The reference that is selected: a node selection, or a selection that is exactly its range, which is
 * what `Shift+←/→` makes from the caret beside it (ProseMirror moves a caret across an inline atom
 * without selecting it, so a node selection comes only from a click). `null` means something else.
 */
export function selectedReference(state: Pick<EditorState, "selection" | "doc">): Placed | null {
  const { selection } = state;
  const node =
    selection instanceof NodeSelection ? selection.node : state.doc.nodeAt(selection.from);
  if (!node || node.type.name !== FOOTNOTE_REF_NODE) return null;
  const pos = selection.from;
  return selection instanceof NodeSelection || selection.to === pos + node.nodeSize
    ? { node, pos }
    : null;
}

/** The number of the footnote the caret is in, or of the reference that is selected; `null` otherwise. */
export function currentFootnoteNumber(state: EditorState): number | null {
  const reference = selectedReference(state);
  if (reference) return Number(reference.node.attrs.number) || null;
  const { $from } = state.selection;
  return $from.parent.type.name === FOOTNOTE_NODE
    ? Number($from.parent.attrs.number) || null
    : null;
}

/**
 * Whether a reference can be inserted where the selection ends: in a text Block that accepts one, and
 * not in code (a code Block, inline code), in a footnote (there are no nested footnotes), or on a
 * non-text selection.
 */
export function canInsertFootnote(state: EditorState): boolean {
  const reference = state.schema.nodes[FOOTNOTE_REF_NODE];
  if (!reference || !state.schema.nodes[FOOTNOTE_NODE]) return false;
  const { $to } = state.selection;
  const parent = $to.parent;
  if (!parent.inlineContent || parent.type.spec.code || parent.type.name === FOOTNOTE_NODE) {
    return false;
  }
  if ($to.marks().some((mark) => mark.type.spec.code)) return false;
  return parent.canReplaceWith($to.index(), $to.index(), reference);
}

/**
 * Inserts the reference at the end of the selection, makes its footnote, and puts the caret in the
 * footnote. All in the given transaction: the list is brought to the whole state before the
 * transaction leaves, so the author sees one edit.
 */
export function insertFootnoteInto(tr: Transaction, state: EditorState): boolean {
  if (!canInsertFootnote(state)) return false;
  const reference = state.schema.nodes[FOOTNOTE_REF_NODE]!;
  const taken = new Set<string>();
  for (const note of scanFootnotes(tr.doc).notes) {
    if (isFootnoteKey(note.node.attrs.key)) taken.add(note.node.attrs.key);
  }
  const key = newFootnoteKey(taken);
  tr.insert(tr.selection.to, reference.create({ key, number: 0 }));
  syncTransaction(tr, "edit");
  const note = findNote(tr.doc, key);
  if (!note) return false;
  tr.setSelection(TextSelection.create(tr.doc, note.pos + note.node.nodeSize - 1)).scrollIntoView();
  return true;
}

/** Footnote `number` (from 1), with its position. */
function noteAt(doc: PmNode, number: number): Placed | null {
  return Number.isInteger(number) ? (scanFootnotes(doc).notes[number - 1] ?? null) : null;
}

/** The reference `number` (from 1), with its position. */
function referenceAt(doc: PmNode, number: number): Placed | null {
  return Number.isInteger(number) ? (scanFootnotes(doc).references[number - 1] ?? null) : null;
}

/** Selects the end of footnote `number` in the transaction. */
export function selectNote(tr: Transaction, number: number): boolean {
  const note = noteAt(tr.doc, number);
  if (!note) return false;
  tr.setSelection(TextSelection.create(tr.doc, note.pos + note.node.nodeSize - 1)).scrollIntoView();
  return true;
}

/** Selects the place right after reference `number` in the transaction. */
export function selectReference(tr: Transaction, number: number): boolean {
  const reference = referenceAt(tr.doc, number);
  if (!reference) return false;
  tr.setSelection(
    TextSelection.create(tr.doc, reference.pos + reference.node.nodeSize)
  ).scrollIntoView();
  return true;
}

/**
 * A jump from the screen's code or a click: runs the command, and gives the focus to the Document when
 * it can take it. In a read-only field the caret is still moved and scrolled to (the Document does
 * not change), and the field is left unfocused.
 */
export function jump(
  editor: Editor,
  command: "goToFootnote" | "goToFootnoteReference",
  number: number
): boolean {
  if (editor.isDestroyed) return false;
  const done = editor.commands[command](number);
  if (done && editor.isEditable) editor.view.focus();
  return done;
}

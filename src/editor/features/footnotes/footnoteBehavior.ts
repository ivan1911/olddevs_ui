"use client";

import { Extension } from "@tiptap/core";
import {
  DOMParser as ProseMirrorParser,
  Fragment,
  Slice,
  type Node as PmNode,
  type Schema,
} from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EXTERNAL_CHANGE } from "../../core/maxLength.js";
import {
  canInsertFootnote,
  inFootnote,
  insertFootnoteInto,
  jump,
  selectNote,
  selectedReference,
  selectReference,
} from "./footnoteCommands.js";
import {
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_NODE,
  FOOTNOTE_REF_ATTRIBUTE,
  FOOTNOTE_REF_NODE,
  isFootnoteKey,
  newFootnoteKey,
} from "./footnoteNames.js";
import {
  carriedContent,
  carryContent,
  mayChangeFootnotes,
  normalizedFootnotes,
  scanFootnotes,
  syncTransaction,
} from "./footnoteSync.js";

/**
 * Everything the footnote nodes need to live in the Document (ADR-0076): the commands, the keys, the
 * click on a reference, keeping the list whole after every edit, the clipboard, and the parse.
 */

/**
 * The Document parse hands over a Document with its footnotes whole.
 *
 * Parsing HTML into a Document goes through one ProseMirror `DOMParser`, cached on the Schema, and
 * every full-document path uses it: `value`, `defaultValue`, Source mode, the JSON envelope. Repairing
 * the result here means the first paint is already right: a reference without a footnote has one, a
 * footnote without a reference is a paragraph, and nothing is dropped. The same trick as
 * `mathAsText.ts`; the method is wrapped rather than the parser replaced, so it composes with it.
 * A paste is a slice, not a Document: `syncTransaction` repairs it after the paste instead.
 */
const patched = new WeakSet<object>();

function repairParsedDocument(schema: Schema): void {
  const parser = ProseMirrorParser.fromSchema(schema);
  if (patched.has(parser)) return;
  patched.add(parser);
  const parse = parser.parse.bind(parser);
  parser.parse = (dom, options) => {
    const parsed = parse(dom, options);
    return parsed.type === schema.topNodeType ? normalizedFootnotes(parsed) : parsed;
  };
}

/** Applies `change` to every reference of a fragment, at any depth; the rest of the tree is shared. */
function mapReferences(
  fragment: Fragment,
  type: PmNode["type"],
  change: (reference: PmNode) => PmNode
): Fragment {
  const nodes: PmNode[] = [];
  fragment.forEach((child) => {
    if (child.type === type) nodes.push(change(child));
    else if (child.isLeaf) nodes.push(child);
    else nodes.push(child.copy(mapReferences(child.content, type, change)));
  });
  return Fragment.fromArray(nodes);
}

/** The footnotes of the Document by key. */
function notesByKey(view: EditorView): Map<string, PmNode> {
  return new Map(
    scanFootnotes(view.state.doc).notes.flatMap(({ node }) =>
      isFootnoteKey(node.attrs.key) ? [[node.attrs.key as string, node] as const] : []
    )
  );
}

/**
 * COPY: every reference carries the text of its footnote (`note`), so a paste into another Editor, or
 * after the original has been cut, has it. Cut is a copy followed by a deletion, and the deletion takes
 * the footnote out of the list with its reference. The saved HTML never has `note`.
 */
function carryNotes(slice: Slice, view: EditorView): Slice {
  const reference = view.state.schema.nodes[FOOTNOTE_REF_NODE];
  if (!reference) return slice;
  const notes = notesByKey(view);
  const content = mapReferences(slice.content, reference, (node) => {
    if (node.attrs.note) return node;
    const text = notes.get(node.attrs.key as string)?.content;
    return text ? reference.create({ ...node.attrs, note: carryContent(text) }) : node;
  });
  return new Slice(content, slice.openStart, slice.openEnd);
}

/**
 * PASTE: a reference from the clipboard is a NEW footnote with a new key and the text the reference
 * carried (or, within one Editor, the text of the footnote it was copied from, which also covers a
 * drag that moves it). A list in the clipboard is not pasted: its footnotes already travel with
 * their references, and the ones without a reference become paragraphs (decision 15).
 */
function newNotes(slice: Slice, view: EditorView): Slice {
  const { schema } = view.state;
  const reference = schema.nodes[FOOTNOTE_REF_NODE];
  const note = schema.nodes[FOOTNOTE_NODE];
  const list = schema.nodes[FOOTNOTE_LIST_NODE];
  if (!reference || !note || !list) return slice;
  let relevant = false;
  slice.content.descendants((node) => {
    if (node.type === reference || node.type === note || node.type === list) relevant = true;
    return !relevant;
  });
  if (!relevant) return slice;

  const here = notesByKey(view);
  const sliceKeys = new Set<string>();
  const sliceNotes = new Map<string, Fragment>();
  slice.content.descendants((node) => {
    if (node.type === reference && isFootnoteKey(node.attrs.key)) sliceKeys.add(node.attrs.key);
    if (node.type === note && isFootnoteKey(node.attrs.key)) {
      sliceNotes.set(node.attrs.key, node.content);
    }
    return true;
  });
  const taken = new Set<string>([...here.keys(), ...sliceKeys]);
  for (const { node } of scanFootnotes(view.state.doc).references) {
    if (isFootnoteKey(node.attrs.key)) taken.add(node.attrs.key);
  }

  const paragraph = schema.nodes.paragraph!;
  const rewrite = (fragment: Fragment): Fragment => {
    const nodes: PmNode[] = [];
    fragment.forEach((child) => {
      if (child.type === list) {
        child.forEach((inner) => {
          if (!sliceKeys.has(inner.attrs.key as string)) {
            nodes.push(paragraph.create(null, inner.content));
          }
        });
      } else if (child.type === note) {
        nodes.push(paragraph.create(null, child.content));
      } else if (child.type === reference) {
        const old = child.attrs.key as string;
        const text = carriedContent(child, schema) ?? sliceNotes.get(old) ?? here.get(old)?.content;
        const key = newFootnoteKey(taken);
        taken.add(key);
        nodes.push(reference.create({ key, number: 0, note: text ? carryContent(text) : null }));
      } else if (child.isLeaf) {
        nodes.push(child);
      } else {
        nodes.push(child.copy(rewrite(child.content)));
      }
    });
    return Fragment.fromArray(nodes);
  };
  const content = rewrite(slice.content);
  const whole = content.childCount === slice.content.childCount;
  return new Slice(content, whole ? slice.openStart : 0, whole ? slice.openEnd : 0);
}

/** A transaction that comes from outside the author's typing: the Document, a paste, a drop. */
function isRepair(meta: (key: string) => unknown): boolean {
  return Boolean(
    meta(EXTERNAL_CHANGE) ||
    meta("paste") ||
    meta("uiEvent") === "paste" ||
    meta("uiEvent") === "drop"
  );
}

const SYNC_KEY = new PluginKey("footnoteSync");

/** The behavior of the footnote nodes, as one extension. */
export const FootnoteBehavior = Extension.create({
  name: "footnotes",

  onBeforeCreate() {
    repairParsedDocument(this.editor.schema);
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return canInsertFootnote(state);
          return insertFootnoteInto(tr, state);
        },
      goToFootnote:
        (number) =>
        ({ tr, dispatch }) =>
          dispatch ? selectNote(tr, number) : Number.isInteger(number),
      goToFootnoteReference:
        (number) =>
        ({ tr, dispatch }) =>
          dispatch ? selectReference(tr, number) : Number.isInteger(number),
    };
  },

  /*
    KEYS. They are asked before the core's (the Tool stands after the containers in `ENGINE_ORDER`).
    Enter on a selected reference goes to its footnote; Enter in a footnote goes back to the text, just
    after the reference, and never splits the footnote. Backspace at the start and Delete at the end of
    a footnote do nothing: footnotes do not merge.
  */
  addKeyboardShortcuts() {
    const atStart = () => {
      const { selection } = this.editor.state;
      return selection.empty && selection.$from.parentOffset === 0;
    };
    const atEnd = () => {
      const { selection } = this.editor.state;
      return (
        selection.empty && selection.$from.parentOffset === selection.$from.parent.content.size
      );
    };
    return {
      Enter: () => {
        const { state } = this.editor;
        const reference = selectedReference(state);
        if (reference) {
          jump(this.editor, "goToFootnote", Number(reference.node.attrs.number));
          return true;
        }
        if (!inFootnote(state)) return false;
        jump(
          this.editor,
          "goToFootnoteReference",
          Number(state.selection.$from.parent.attrs.number)
        );
        return true;
      },
      Backspace: () => this.editor.isEditable && inFootnote(this.editor.state) && atStart(),
      Delete: () => this.editor.isEditable && inFootnote(this.editor.state) && atEnd(),
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    return [
      new Plugin({
        key: SYNC_KEY,
        /*
          After every edit that can touch a footnote: the list follows the references. The edit is not
          the author's own typing, so the character limit lets it through (`EXTERNAL_CHANGE`): a number
          that grows from 9 to 10 must not be refused by `maxLength`.
        */
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (!mayChangeFootnotes(transactions, oldState.doc)) return null;
          const repair = transactions.some((tr) => isRepair((key) => tr.getMeta(key)));
          const tr = newState.tr;
          if (!syncTransaction(tr, repair ? "repair" : "edit")) return null;
          return tr.setMeta(EXTERNAL_CHANGE, true);
        },
        props: {
          transformCopied: (slice, view) => carryNotes(slice, view),
          transformPasted: (slice, view) => newNotes(slice, view),
          /*
            A click on a reference follows it, in the Editor and in a read-only field alike; a
            disabled field follows nothing, and the browser's own jump to `#fn-…` is cancelled in both.
          */
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target;
              const reference =
                target instanceof Element ? target.closest(`sup[${FOOTNOTE_REF_ATTRIBUTE}]`) : null;
              if (!reference || !view.dom.contains(reference)) return false;
              event.preventDefault();
              if (view.dom.getAttribute("aria-disabled") === "true") return true;
              const node = view.state.doc.nodeAt(view.posAtDOM(reference, 0));
              if (node?.type.name === FOOTNOTE_REF_NODE) {
                jump(editor, "goToFootnote", Number(node.attrs.number));
              }
              return true;
            },
          },
        },
      }),
    ];
  },
});

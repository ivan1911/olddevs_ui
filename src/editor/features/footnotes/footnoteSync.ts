"use client";

import { Fragment, type Node as PmNode, type Schema } from "@tiptap/pm/model";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { ReplaceAroundStep, ReplaceStep, Transform, type Step } from "@tiptap/pm/transform";
import {
  FOOTNOTE_LIST_NODE,
  FOOTNOTE_NODE,
  FOOTNOTE_REF_NODE,
  isFootnoteKey,
  newFootnoteKey,
} from "./footnoteNames.js";

/*
  KEEPING THE FOOTNOTE LIST WHOLE (ADR-0076, items 3 and 6). The Document holds two halves of every
  footnote: the reference in the text and the footnote in the list at the end. The author edits only
  the first half and the footnote's text; the kit keeps the rest true. This module is the one place
  that does it, and it works on a `Transform`, so the same code serves three entrances:

  - after every edit, as an appended transaction (`mode: "edit"`): a footnote exists while its
    reference does, so a deleted reference takes its footnote with it in the same undo step;
  - on the Document built from outside (`value`, Source mode, a paste, Markdown, JSON): the same,
    but a footnote without a reference is not dropped, it becomes an ordinary paragraph before the
    list, so no text is lost (`mode: "repair"`);
  - on the parsed Document before the first paint (`normalizedFootnotes`, `footnoteParser.ts`).

  WHAT "WHOLE" MEANS. The list is the Document's last Block and there is one of it; its footnotes
  come in the order of the references in the text; each carries its key and its number, and so does
  each reference; no list means no footnotes. A key is never shared: a second reference with the
  same key (a duplicated paragraph, a Markdown `[^x]` used twice) becomes its own footnote with a
  copy of the text, because one reference is one footnote (decision 5).

  THE SMALLEST EDIT THAT GETS THERE. A caret inside a footnote must survive the author typing in
  it, and an insertion or a deletion of one reference must not rebuild the list. So when the list is
  already single and last, and the surviving footnotes keep their relative order, only the missing
  footnotes are inserted and the extra ones are removed. Everything else (a reorder, a stray list,
  a list in the middle) rebuilds the list at the end, and the caret in a footnote is put back.
*/

/** A node with its position in the Document. */
export interface Placed {
  node: PmNode;
  pos: number;
}

/** Everything the Document holds of footnotes, in Document order. */
export interface FootnoteScan {
  /** References in the text, outside the list. */
  references: Placed[];
  /** Lists at the top level. */
  lists: Placed[];
  /** Footnotes of all lists, in order. */
  notes: Placed[];
  /** References inside footnotes: the Schema does not nest them. */
  strays: Placed[];
}

/** The footnote types of a Schema; `null` if the Tool is not in it. */
function typesOf(schema: Schema) {
  const reference = schema.nodes[FOOTNOTE_REF_NODE];
  const note = schema.nodes[FOOTNOTE_NODE];
  const list = schema.nodes[FOOTNOTE_LIST_NODE];
  return reference && note && list ? { reference, note, list } : null;
}

/** Collects the references, the lists and the footnotes of a Document. */
export function scanFootnotes(doc: PmNode): FootnoteScan {
  const scan: FootnoteScan = { references: [], lists: [], notes: [], strays: [] };
  const types = typesOf(doc.type.schema);
  if (!types) return scan;
  doc.forEach((child, offset) => {
    if (child.type === types.list) {
      scan.lists.push({ node: child, pos: offset });
      child.forEach((note, noteOffset) => {
        const pos = offset + 1 + noteOffset;
        scan.notes.push({ node: note, pos });
        note.descendants((inner, innerOffset) => {
          if (inner.type === types.reference) {
            scan.strays.push({ node: inner, pos: pos + 1 + innerOffset });
          }
          return true;
        });
      });
      return;
    }
    if (child.type === types.reference) {
      scan.references.push({ node: child, pos: offset });
      return;
    }
    child.descendants((inner, innerOffset) => {
      if (inner.type === types.reference) {
        scan.references.push({ node: inner, pos: offset + 1 + innerOffset });
      }
      return true;
    });
  });
  return scan;
}

/** The footnote with this key, with its position, or `null`. */
export function findNote(doc: PmNode, key: string): Placed | null {
  return scanFootnotes(doc).notes.find((note) => note.node.attrs.key === key) ?? null;
}

/** The text the reference carries from a copy: the footnote's content as a JSON string, or `null`. */
export function carriedContent(reference: PmNode, schema: Schema): Fragment | null {
  const raw: unknown = reference.attrs.note;
  const note = schema.nodes[FOOTNOTE_NODE];
  if (typeof raw !== "string" || raw === "" || !note) return null;
  try {
    const fragment = Fragment.fromJSON(schema, JSON.parse(raw));
    return note.validContent(fragment) ? fragment : null;
  } catch {
    return null;
  }
}

/** The footnote's content as the string a reference carries across the clipboard. */
export function carryContent(content: Fragment): string | null {
  return content.size > 0 ? JSON.stringify(content.toJSON()) : null;
}

/** How a reference ends up: its final key, and the footnote it points to (an existing one or a new one). */
interface Wanted {
  key: string;
  existing: Placed | null;
  content: Fragment;
}

/** Where the Document stands before the edit: the list is single, last, and nothing is stray. */
function listIsLast(doc: PmNode, list: Placed): boolean {
  return list.pos + list.node.nodeSize === doc.content.size;
}

/** Positions after a step map: maps `pos` through the steps added since `start`. */
function mapper(tr: Transform, start: number) {
  return (pos: number, assoc = 1) => tr.mapping.slice(start).map(pos, assoc);
}

/**
 * Brings the Document's footnotes to the whole state. Returns whether it changed anything.
 *
 * `edit`: a footnote whose reference is gone is dropped, and a reference with no footnote gets an
 * empty one (or the text it carries). `repair`: the same, except that a footnote without a
 * reference becomes a paragraph before the list.
 */
export function syncFootnotes(tr: Transform, mode: "edit" | "repair"): boolean {
  const schema = tr.doc.type.schema;
  const types = typesOf(schema);
  if (!types) return false;
  const scan = scanFootnotes(tr.doc);
  const { references, lists, notes, strays } = scan;
  if (references.length === 0 && lists.length === 0) return false;

  // 1. What each reference wants.
  const byKey = new Map<string, Placed>();
  const loose: Placed[] = [];
  for (const note of notes) {
    const key: unknown = note.node.attrs.key;
    if (isFootnoteKey(key) && !byKey.has(key)) byKey.set(key, note);
    else loose.push(note);
  }
  const taken = new Set<string>([...byKey.keys()]);
  for (const { node } of references) {
    if (isFootnoteKey(node.attrs.key)) taken.add(node.attrs.key);
  }
  const seen = new Set<string>();
  const wanted: Wanted[] = references.map(({ node }) => {
    const key: unknown = node.attrs.key;
    const carried = carriedContent(node, schema);
    if (isFootnoteKey(key) && !seen.has(key)) {
      seen.add(key);
      const existing = byKey.get(key) ?? null;
      return { key, existing, content: existing?.node.content ?? carried ?? Fragment.empty };
    }
    // A second reference with this key, or a key that is not one: its own footnote with a copy.
    const source = isFootnoteKey(key) ? byKey.get(key) : undefined;
    const fresh = newFootnoteKey(taken);
    taken.add(fresh);
    seen.add(fresh);
    return {
      key: fresh,
      existing: null,
      content: carried ?? source?.node.content ?? Fragment.empty,
    };
  });
  const used = new Set(wanted.flatMap((entry) => (entry.existing ? [entry.existing.pos] : [])));
  const orphans = [...byKey.values(), ...loose].filter((note) => !used.has(note.pos));

  // 2. Is there anything to do?
  const sameReferences = references.every(
    ({ node }, index) =>
      node.attrs.key === wanted[index]!.key && node.attrs.number === index + 1 && !node.attrs.note
  );
  const list = lists.length === 1 ? lists[0]! : null;
  const listIsWhole =
    list !== null &&
    wanted.length > 0 &&
    listIsLast(tr.doc, list) &&
    strays.length === 0 &&
    orphans.length === 0 &&
    list.node.childCount === wanted.length &&
    wanted.every(
      (entry, index) =>
        entry.existing?.node.attrs.key === entry.key &&
        entry.existing.pos === list.pos + 1 + offsetOf(list.node, index) &&
        entry.existing.node.attrs.number === index + 1
    );
  const noList = lists.length === 0 && wanted.length === 0;
  if (sameReferences && (listIsWhole || noList)) return false;

  const start = tr.mapping.maps.length;
  const map = mapper(tr, start);

  // 3. The references: key, number, and the carried text is consumed. The size does not change.
  references.forEach(({ node, pos }, index) => {
    const attrs = { ...node.attrs, key: wanted[index]!.key, number: index + 1, note: null };
    if (attrs.key !== node.attrs.key || attrs.number !== node.attrs.number || node.attrs.note) {
      tr.setNodeMarkup(pos, undefined, attrs);
    }
  });

  const noteNode = (entry: Wanted, index: number): PmNode =>
    types.note.create({ key: entry.key, number: index + 1 }, entry.content);

  // 4. The list.
  const survivors = wanted.flatMap((entry) => (entry.existing ? [entry.existing] : []));
  const inOrder =
    list !== null &&
    survivors.every((entry, index) => index === 0 || entry.pos > survivors[index - 1]!.pos);
  const patch =
    list !== null &&
    listIsLast(tr.doc, list) &&
    wanted.length > 0 &&
    inOrder &&
    (mode === "edit" || orphans.length === 0);

  if (patch) {
    // Numbers of the surviving footnotes first: the size does not change.
    wanted.forEach((entry, index) => {
      const { existing } = entry;
      if (existing && existing.node.attrs.number !== index + 1) {
        tr.setNodeMarkup(existing.pos, undefined, { ...existing.node.attrs, number: index + 1 });
      }
    });
    // New footnotes go in before the next surviving one, or at the end of the list.
    const end = list.pos + list.node.nodeSize - 1;
    const inserts: { at: number; nodes: PmNode[] }[] = [];
    wanted.forEach((entry, index) => {
      if (entry.existing) return;
      const next = wanted.slice(index + 1).find((later) => later.existing)?.existing ?? null;
      const at = next ? next.pos : end;
      const last = inserts.at(-1);
      if (last && last.at === at) last.nodes.push(noteNode(entry, index));
      else inserts.push({ at, nodes: [noteNode(entry, index)] });
    });
    for (const { at, nodes } of inserts.reverse()) tr.insert(map(at, -1), nodes);
    // Then the footnotes that no reference points to, and the references stranded inside them.
    const gone = (mode === "edit" ? orphans : []).map((note) => ({
      from: note.pos,
      to: note.pos + note.node.nodeSize,
    }));
    for (const stray of strays) {
      if (!gone.some((range) => stray.pos >= range.from && stray.pos < range.to)) {
        gone.push({ from: stray.pos, to: stray.pos + stray.node.nodeSize });
      }
    }
    gone.sort((a, b) => b.from - a.from);
    for (const range of gone) tr.delete(map(range.from, 1), map(range.to, -1));
    return tr.steps.length > 0;
  }

  // Everything else rebuilds the list at the end of the Document.
  const rebuilt = wanted.map((entry, index) => {
    const { existing } = entry;
    return existing
      ? types.note.create(
          { ...existing.node.attrs, key: entry.key, number: index + 1 },
          existing.node.content
        )
      : noteNode(entry, index);
  });
  const paragraphs =
    mode === "repair"
      ? orphans
          .sort((a, b) => a.pos - b.pos)
          .map((note) => schema.nodes.paragraph!.create(null, note.node.content))
      : [];
  for (const old of [...lists].reverse())
    tr.delete(map(old.pos, 1), map(old.pos + old.node.nodeSize, -1));
  const tail = [...paragraphs, ...(rebuilt.length > 0 ? [types.list.create(null, rebuilt)] : [])];
  if (tail.length > 0) tr.insert(tr.doc.content.size, tail);
  return tr.steps.length > 0;
}

/** The offset of the child at `index` inside `parent`. */
function offsetOf(parent: PmNode, index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += parent.child(i).nodeSize;
  return offset;
}

/**
 * The same, on a transaction: the caret inside a footnote is put back where it was in the footnote's
 * text, whatever the edit did to the list around it.
 */
export function syncTransaction(tr: Transaction, mode: "edit" | "repair"): boolean {
  const types = typesOf(tr.doc.type.schema);
  const { $from, empty } = tr.selection;
  const inside = types && empty && $from.parent.type === types.note;
  const where = inside
    ? { key: $from.parent.attrs.key as unknown, offset: $from.parentOffset }
    : null;
  if (!syncFootnotes(tr, mode)) return false;
  if (where && isFootnoteKey(where.key)) {
    const note = findNote(tr.doc, where.key);
    if (note) {
      const at = note.pos + 1 + Math.min(where.offset, note.node.content.size);
      tr.setSelection(TextSelection.create(tr.doc, at));
    }
  }
  return true;
}

/** The Document with its footnotes made whole, as a parse result: no transaction, no history. */
export function normalizedFootnotes(doc: PmNode): PmNode {
  const tr = new Transform(doc);
  return syncFootnotes(tr, "repair") ? tr.doc : doc;
}

/** Whether the step puts a footnote, a list or a reference into the Document. */
function addsFootnote(step: Step, schema: Schema): boolean {
  if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) return false;
  let found = false;
  step.slice.content.descendants((node) => {
    const name = node.type.name;
    if (name === FOOTNOTE_REF_NODE || name === FOOTNOTE_NODE || name === FOOTNOTE_LIST_NODE) {
      found = true;
    }
    return !found;
  });
  return found && typesOf(schema) !== null;
}

/**
 * Whether an edit needs the footnotes looked at. A Document with no list and an edit that brings
 * none in cannot have a footnote to repair, which is every edit of a Document without footnotes.
 */
export function mayChangeFootnotes(transactions: readonly Transaction[], before: PmNode): boolean {
  const types = typesOf(before.type.schema);
  if (!types) return false;
  if (before.lastChild?.type === types.list) return true;
  return transactions.some((tr) => tr.steps.some((step) => addsFootnote(step, before.type.schema)));
}

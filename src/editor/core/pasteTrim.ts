"use client";

import type { Transaction } from "@tiptap/pm/state";
import { textSerializers } from "./atomText.js";

/*
  Trimming a paste that goes past `maxLength` (ADR-0058, section 4, item 5).

  The paste is cut by CHARACTERS, not by positions: a position can be a character, a Block
  boundary, or a whole atom (one position for `{{key}}`, which is five characters). Counting by
  positions would cut either an extra tail or half a substitution. An atom is not cut: one that
  does not fit goes whole, along with everything after it. It is called from `maxLength.ts` on a
  transaction with the `paste` meta, and it touches nothing else in the order of paste handlers.
*/

/** A piece of the pasted content: characters of a text node, or an indivisible atom. */
interface Piece {
  from: number;
  to: number;
  weight: number;
  atom: boolean;
}

/** What the transaction inserted: from the earliest start to the latest end in the resulting document. */
function insertedRange(tr: Transaction): { from: number; to: number } | null {
  let from = Infinity;
  let to = -Infinity;
  tr.mapping.maps.forEach((map, index) => {
    const later = tr.mapping.slice(index + 1);
    map.forEach((_oldFrom, _oldTo, start, end) => {
      if (end <= start) return;
      from = Math.min(from, later.map(start, -1));
      to = Math.max(to, later.map(end, 1));
    });
  });
  return from < to ? { from, to: Math.min(to, tr.doc.content.size) } : null;
}

/** The pieces of the pasted content in document order. Zero weight means not a piece (a separator, a video). */
function piecesOf(tr: Transaction, from: number, to: number): Piece[] {
  const serializers = textSerializers(tr.doc.type.schema);
  const pieces: Piece[] = [];
  tr.doc.nodesBetween(from, to, (node, pos, parent, index) => {
    if (node.isText) {
      const start = Math.max(pos, from);
      const end = Math.min(pos + node.nodeSize, to);
      if (end > start) pieces.push({ from: start, to: end, weight: end - start, atom: false });
      return false;
    }
    const serialize = serializers[node.type.name];
    // A node that started before the paste belongs to someone else (a container around it).
    // Only our own content is cut.
    if (!serialize || !parent || pos < from) return true;
    const weight = serialize({ node, pos, parent, index, range: { from, to } }).length;
    if (weight > 0) pieces.push({ from: pos, to: pos + node.nodeSize, weight, atom: true });
    return false;
  });
  return pieces;
}

/**
 * Cuts `excess` characters from the end of the paste: text by characters, an atom whole.
 * Edits the transaction inside the filter, the same approach as the original (`CharacterCount`).
 * `false` means there is nothing to cut, and the paste is rejected whole.
 */
export function trimPaste(tr: Transaction, excess: number): boolean {
  const range = insertedRange(tr);
  if (!range) return false;
  let rest = excess;
  let cut = range.to;
  const pieces = piecesOf(tr, range.from, range.to);
  for (let i = pieces.length - 1; i >= 0 && rest > 0; i -= 1) {
    const piece = pieces[i]!;
    if (!piece.atom && piece.weight > rest) {
      cut = piece.to - rest;
      rest = 0;
    } else {
      cut = piece.from;
      rest -= piece.weight;
    }
  }
  if (rest > 0) return false;
  tr.deleteRange(cut, range.to);
  return true;
}

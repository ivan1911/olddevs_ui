"use client";

import type { Transaction } from "@tiptap/pm/state";
import { textSerializers } from "./atomText.js";

/*
  Срез вставки за пределом `maxLength` (ADR-0058, раздел 4, п. 5).

  Вставка режется по СИМВОЛАМ, а не по позициям: позиция — это и символ, и
  граница Блока, и целый атом (одна позиция на `{{key}}` из пяти символов), и
  счёт по позициям оставлял бы то лишний хвост, то половину подстановки.
  Атом не режется: не поместившийся уходит целиком вместе со всем, что после
  него. Подключается из `maxLength.ts` — вызывается на транзакции с меткой
  `paste` — и больше ничего в порядке обработчиков вставки не трогает.
*/

/** Кусок вставленного текста: символы текстового узла или неделимый атом. */
interface Piece {
  from: number;
  to: number;
  weight: number;
  atom: boolean;
}

/** Что вставила транзакция: от самого раннего начала до самого позднего конца в итоговом документе. */
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

/** Куски вставленного, в порядке документа; нулевой вес — не кусок (разделитель, видео). */
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
    // Узел, начатый до вставки, — чужой (контейнер вокруг): режут только своё.
    if (!serialize || !parent || pos < from) return true;
    const weight = serialize({ node, pos, parent, index, range: { from, to } }).length;
    if (weight > 0) pieces.push({ from: pos, to: pos + node.nodeSize, weight, atom: true });
    return false;
  });
  return pieces;
}

/**
 * Срезает с конца вставки `excess` символов: текст — по символам, атом — целиком.
 * Правит транзакцию внутри фильтра — приём оригинала (`CharacterCount`).
 * `false` — срезать нечем: вставка отвергается целиком.
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

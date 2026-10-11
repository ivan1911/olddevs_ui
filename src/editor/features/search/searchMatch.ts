"use client";

import type { Node as PmNode } from "@tiptap/pm/model";

/** Опции поиска — флажки панели «Поиск и замена». */
export interface SearchOptions {
  /** Учитывать регистр: без флажка «Cat» и «cat» — одно и то же. */
  matchCase: boolean;
  /** Слово целиком: «cat» не находится внутри «category». */
  wholeWord: boolean;
  /** Запрос — регулярное выражение JavaScript, а не текст. */
  regex: boolean;
}

/** Совпадение — отрезок Документа в позициях ProseMirror. */
export interface SearchMatch {
  from: number;
  to: number;
  /**
   * Найденный текст и группы регулярного выражения (`[0]` — совпадение
   * целиком) — из той строки Блока, где его нашли. Замена раскрывает `$1…$9`
   * по ним, а не прогоняет выражение по одному найденному куску: просмотр
   * назад и вперёд (`(?<=a)b`) без соседнего текста не сработал бы.
   */
  captures: readonly string[];
}

export interface SearchResult {
  matches: SearchMatch[];
  /** Регулярное выражение не разобралось: текст ошибки движка JS, совпадений нет. */
  error?: string;
}

/**
 * Заместитель строчного не-текста (атома, мягкого переноса) в строке Блока.
 * Совпадение через него не проходит: символ вне языков, и ни текст, ни
 * разумное регулярное выражение его не содержат.
 */
const ATOM = "￼";

/** Буква, цифра или подчёркивание любого алфавита — граница слова для кириллицы тоже. */
const WORD = "[\\p{L}\\p{N}_]";

/**
 * Регулярное выражение запроса или ошибка. Без `regex` запрос — текст:
 * спецсимволы экранируются. «Слово целиком» — просмотр назад и вперёд по
 * классу букв Юникода, а не `\b`: `\b` в JS знает только латиницу, и «кот»
 * в «котик» для него — целое слово.
 */
export function searchPattern(
  query: string,
  options: SearchOptions
): { pattern: RegExp } | { error: string } | null {
  if (query === "") return null;
  const source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wrapped = options.wholeWord ? `(?<!${WORD})(?:${source})(?!${WORD})` : source;
  const flags = options.matchCase ? "g" : "gi";
  try {
    return { pattern: new RegExp(wrapped, `${flags}u`) };
  } catch (cause) {
    /*
      Флаг `u` строже: `a\-b` и `\_` без него — обычные экранирования, с
      ним — ошибка. Привычное по JS выражение не должно падать, поэтому без
      «Слова целиком» (ему `u` нужен для `\p{L}`) пробуем и без флага.
    */
    if (!options.wholeWord) {
      try {
        return { pattern: new RegExp(wrapped, flags) };
      } catch {
        // Ошибка — та, что дал строгий разбор: она понятнее.
      }
    }
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
}

/**
 * Все совпадения запроса в Документе, по порядку.
 *
 * ОБЛАСТЬ — ТЕКСТ ВНУТРИ ТЕКСТОВЫХ БЛОКОВ: абзацы, заголовки, ячейки таблиц,
 * блоки кода. Каждый текстовый Блок — своя строка, поэтому совпадение не
 * пересекает его границу. Метки внутри Блока не мешают: текст их узлов
 * склеивается, и «bo**ld**» находится как «bold». Строчные атомы (картинка,
 * упоминание, мягкий перенос) встают в строку заместителем `ATOM`, и через них
 * совпадение не идёт.
 *
 * Пустые совпадения регулярного выражения (`x*`) пропускаются: подсвечивать и
 * заменять там нечего.
 */
export function findMatches(doc: PmNode, query: string, options: SearchOptions): SearchResult {
  const compiled = searchPattern(query, options);
  if (!compiled) return { matches: [] };
  if ("error" in compiled) return { matches: [], error: compiled.error };
  const { pattern } = compiled;

  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Строка Блока и позиция Документа для каждого её символа (+1 — конец).
    let text = "";
    const positions: number[] = [];
    node.forEach((child, offset) => {
      const start = pos + 1 + offset;
      if (child.isText) {
        const value = child.text ?? "";
        for (let i = 0; i < value.length; i++) positions.push(start + i);
        text += value;
      } else {
        positions.push(start);
        text += ATOM;
      }
    });
    positions.push(pos + 1 + node.content.size);

    pattern.lastIndex = 0;
    for (const found of text.matchAll(pattern)) {
      const length = found[0].length;
      if (length === 0) continue;
      const index = found.index;
      matches.push({
        from: positions[index]!,
        to: positions[index + length]!,
        captures: [...found],
      });
    }
    return false;
  });
  return { matches };
}

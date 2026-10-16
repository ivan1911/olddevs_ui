"use client";

import type { Node as PmNode } from "@tiptap/pm/model";
import { isFormulaNodeName } from "../mathematics/mathNames.js";

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
  /**
   * Совпадение внутри исходного LaTeX формулы: `from`–`to` — вся формула как узел,
   * а не отрезок текста. Подсвечивается и выделяется узлом, а «Заменить» и
   * «Заменить все» его пропускают: формула правится только Поповером.
   */
  formula: boolean;
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

/** Исходный LaTeX формулы — строка, в которой её ищут (ADR-0070, п. 8). */
const sourceOf = (node: PmNode): string => String(node.attrs.latex ?? "");

/**
 * Совпадение запроса внутри формулы: одно на формулу, сколько бы раз запрос в ней
 * ни повторялся, — подсвечивается и считается формула целиком. `null` — запрос в
 * её исходнике не найден.
 */
function formulaMatch(node: PmNode, pos: number, pattern: RegExp): SearchMatch | null {
  pattern.lastIndex = 0;
  for (const found of sourceOf(node).matchAll(pattern)) {
    if (found[0].length === 0) continue;
    return { from: pos, to: pos + node.nodeSize, captures: [...found], formula: true };
  }
  return null;
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
 * ФОРМУЛЫ — ЕДИНСТВЕННЫЕ АТОМЫ С ТЕКСТОМ: их исходник LaTeX ищется отдельной
 * строкой, как отдельный Блок, и совпадение внутри — вся формула целиком
 * (`SearchMatch.formula`). Через границу формулы совпадение с текстом рядом тоже
 * не идёт, как и через любой другой атом.
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
    // Блочная формула — атом без детей: ищется по своему исходнику.
    if (isFormulaNodeName(node.type.name)) {
      const inFormula = formulaMatch(node, pos, pattern);
      if (inFormula) matches.push(inFormula);
      return false;
    }
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
        if (isFormulaNodeName(child.type.name)) {
          const inFormula = formulaMatch(child, start, pattern);
          if (inFormula) matches.push(inFormula);
        }
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
        formula: false,
      });
    }
    return false;
  });
  // Формулы внутри строки встали в конец своего Блока: порядок Документа — по позиции.
  matches.sort((a, b) => a.from - b.from);
  return { matches };
}

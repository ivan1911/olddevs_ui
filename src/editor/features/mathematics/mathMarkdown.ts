"use client";

import type { MarkdownTokenizer } from "@tiptap/core";
import { BLOCK_FORMULA_NODE, INLINE_FORMULA_NODE } from "./mathNames.js";

/**
 * Формулы в Markdown: `$…$` в строке и `$$…$$` Блоком (ADR-0070).
 *
 * ПОЧЕМУ СВОИ ТОКЕНИЗАТОРЫ, А НЕ ТЕ, ЧТО В РАСШИРЕНИИ TIPTAP. Строчный токенизатор
 * расширения (`/^\$([^$]+)\$(?!\$)/`) принимал за формулу любую пару долларов:
 * «стоит $5 или $6» превращалось в формулу «5 или », а деньги в тексте — обычное
 * дело. Здесь правила Pandoc: после открывающего `$` нет пробела, перед закрывающим
 * нет пробела, и за закрывающим не идёт цифра. «$5 или $6» остаётся текстом,
 * `$x^2$` и `$\alpha + \beta$` — формулами. Экранированный знак (`\$`, `\\`) в
 * формуле — пара, а не конец: `$\text{\$5}$` читается целиком. Блочный
 * токенизатор расширения тоже обходил `\$` и не требовал конца строки — `$$a$$ и текст`
 * резал абзац надвое; здесь формула-Блок занимает свои строки целиком.
 *
 * Выгрузка — как у расширения: `$latex$` и `$$` / latex / `$$` на своих строках. LaTeX
 * хранится без пробелов по краям (Поповер его обрезает), поэтому круг без потерь.
 * Регулярные выражения без lookbehind: старый WebKit его не разбирает (так же написано
 * в самом расширении).
 */

/** Символ формулы: не пробел и не знак `$`, либо экранированная пара. */
const SOLID = String.raw`(?:[^\s$\\]|\\[\s\S])`;
/** Любой символ формулы в середине, без перевода строки. */
const ANY = String.raw`(?:[^$\\\n]|\\[\s\S])`;

const INLINE = new RegExp(String.raw`^\$(${SOLID}(?:${ANY}*?${SOLID})?)\$(?!\d)`);
const BLOCK = /^\$\$((?:[^$\\]|\\[\s\S])+?)\$\$[ \t]*(?:\n|$)/;

/** Строчная формула: `$…$`. */
export const inlineMathTokenizer: MarkdownTokenizer = {
  name: INLINE_FORMULA_NODE,
  level: "inline",
  start: (src) => src.indexOf("$"),
  tokenize(src) {
    const match = INLINE.exec(src);
    if (!match) return undefined;
    return { type: INLINE_FORMULA_NODE, raw: match[0], latex: match[1] };
  },
};

/** Блочная формула: `$$…$$` на своих строках. */
export const blockMathTokenizer: MarkdownTokenizer = {
  name: BLOCK_FORMULA_NODE,
  level: "block",
  start: (src) => src.search(/^\$\$/m),
  tokenize(src) {
    const match = BLOCK.exec(src);
    const latex = match?.[1]?.trim();
    if (!match || !latex) return undefined;
    return { type: BLOCK_FORMULA_NODE, raw: match[0], latex };
  },
};

/** Markdown строчной формулы. */
export const renderInlineMath = (latex: string): string => `$${latex}$`;

/** Markdown блочной формулы. */
export const renderBlockMath = (latex: string): string => `$$\n${latex}\n$$`;

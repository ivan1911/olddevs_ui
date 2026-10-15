"use client";

import { Extension, InputRule } from "@tiptap/core";
import type { EditorQuoteSet } from "../../../i18n/messages.js";

/*
  Двойная кавычка `"` — единственное правило Typography, которое кит пишет сам.
  Расширение Tiptap ставит кавычки фиксированной парой, а кит выбирает их по
  языку каталога сообщений, и каталог может смениться при смонтированном
  Редакторе: набор читается в момент ввода, а не при сборке правил. Во вложенных
  русских кавычках («Он сказал: „привет“») пара зависит ещё и от того, что открыто
  в Блоке до каретки.
*/

/** Пары кавычек наборов: открывающая и закрывающая первого уровня. */
const PAIRS: Record<EditorQuoteSet, readonly [string, string]> = {
  en: ["“", "”"],
  ru: ["«", "»"],
};

/*
  Что перед кавычкой делает её открывающей. Список — у Tiptap (начало Блока,
  пробел, скобка, другая открывающая кавычка); в русском наборе добавлены «ёлочка»
  и нижняя лапка, а верхняя лапка ушла: она закрывает, а не открывает.
*/
const OPENING_BEFORE: Record<EditorQuoteSet, RegExp> = {
  en: /[\s{[(<'"‘“]/,
  ru: /[\s{[(<'"‘«„]/,
};

/**
 * Русские кавычки, открытые и не закрытые в тексте до каретки, снаружи внутрь.
 * Закрывающая считается, только если закрывает свою пару: чужая «»“» без
 * открывающей не сбивает счёт.
 */
export function openRussianQuotes(before: string): string[] {
  const open: string[] = [];
  for (const char of before) {
    if (char === "«" || char === "„") open.push(char);
    else if (char === "»" && open.at(-1) === "«") open.pop();
    else if (char === "“" && open.at(-1) === "„") open.pop();
  }
  return open;
}

/** Явные значения Опций `openDoubleQuote` и `closeDoubleQuote`: `undefined` — не заданы. */
export interface DoubleQuoteOverrides {
  open?: false | string;
  close?: false | string;
}

/**
 * Кавычка, в которую превращается `"`: `before` — текст Блока до каретки.
 *
 * Открывающая или закрывающая — по символу перед кавычкой, как у Tiptap. В
 * русском наборе без явных строк пара зависит от открытого: вне кавычек — «»,
 * внутри «…» открывающая даёт „ („вложенная“), а закрывающая закрывает «»;
 * внутри „…“ закрывающая даёт “. Вложенность третьего уровня русская
 * типографика не знает: открывающая внутри „…“ снова даёт «. Явная строка Опции
 * выключает вложенность — кавычки идут парой. `false` — кавычки нет.
 */
export function doubleQuoteFor(
  set: EditorQuoteSet,
  before: string,
  overrides: DoubleQuoteOverrides = {}
): false | string {
  const opening = before === "" || OPENING_BEFORE[set].test(before.at(-1) ?? "");
  const explicit = overrides.open !== undefined || overrides.close !== undefined;
  if (set === "ru" && !explicit) {
    const inner = openRussianQuotes(before).at(-1);
    if (opening) return inner === "«" ? "„" : "«";
    return inner === "„" ? "“" : "»";
  }
  const [open, close] = PAIRS[set];
  return opening ? (overrides.open ?? open) : (overrides.close ?? close);
}

interface QuotesOptions extends DoubleQuoteOverrides {
  /** Набор кавычек на момент ввода: Опция `quotes` или каталог сообщений Редактора. */
  set: () => EditorQuoteSet;
}

/**
 * Правило ввода двойной кавычки. Внутри `code` и блока кода оно не срабатывает
 * само: ядро Tiptap пропускает правила ввода там (`inputRulesPlugin`), как и для
 * правил Typography. Отмена — `Backspace` сразу после замены (`undoInputRule`).
 */
export const TypographyQuotes = Extension.create<QuotesOptions>({
  name: "typographyQuotes",
  addOptions: () => ({ set: () => "en" }),
  addInputRules() {
    const { set, open, close } = this.options;
    // Обе кавычки выключены — правила нет, `"` остаётся прямой.
    if (open === false && close === false) return [];
    return [
      new InputRule({
        find: /"$/,
        handler: ({ state, range }) => {
          // Документ состояния уже с набранной кавычкой: текст до неё кончается на `range.from`.
          const $from = state.doc.resolve(range.from);
          const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
          const quote = doubleQuoteFor(set(), before, { open, close });
          if (quote === false) return null;
          state.tr.insertText(quote, range.from, range.to);
        },
      }),
    ];
  },
});

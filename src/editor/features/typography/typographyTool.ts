"use client";

import { Typography } from "@tiptap/extension-typography";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { TypographyToolOptions } from "../../core/toolOptions.js";
import { TypographyQuotes } from "./typography.js";

/**
 * Умолчания Опций: набор кавычек берётся у каталога, одиночные кавычки и
 * остальные правила — символы Tiptap (все правила включены). Двойных кавычек
 * в умолчаниях нет сознательно: явная строка перекрывает набор `quotes`, и
 * «не задана» отличается от «равна умолчанию Tiptap».
 */
export const TYPOGRAPHY_DEFAULTS: TypographyToolOptions = {
  quotes: "auto",
  openSingleQuote: "‘",
  closeSingleQuote: "’",
  emDash: "—",
  ellipsis: "…",
  leftArrow: "←",
  rightArrow: "→",
  copyright: "©",
  trademark: "™",
  servicemark: "℠",
  registeredTrademark: "®",
  oneHalf: "½",
  oneQuarter: "¼",
  threeQuarters: "¾",
  plusMinus: "±",
  notEqual: "≠",
  laquo: "«",
  raquo: "»",
  multiplication: "×",
  superscriptTwo: "²",
  superscriptThree: "³",
};

/** Правило: `false` выключает, непустая строка — символ замены (пустая стёрла бы набранное). */
const isRule = (value: unknown) => value === false || (typeof value === "string" && value !== "");

/**
 * Автозамены при наборе на описании Инструмента (ADR-0048): расширение
 * Typography из Tiptap и правило двойной кавычки кита (`typography.ts`). Только
 * правила ввода: Схемы, кнопки, пункта вставки, Состояния и Команд нет, а в
 * `value` уходят обычные символы. Вне пресетов — включается явной записью в `tools`.
 */
export const TYPOGRAPHY_TOOL: ToolDescriptor = {
  name: "typography",
  defaults: TYPOGRAPHY_DEFAULTS,
  checks: {
    // Остальные поля умолчаний — правила; двойные кавычки в умолчаниях нет, проверка у них своя.
    ...Object.fromEntries(Object.keys(TYPOGRAPHY_DEFAULTS).map((key) => [key, isRule])),
    openDoubleQuote: isRule,
    closeDoubleQuote: isRule,
    quotes: (value) => value === "auto" || value === "ru" || value === "en",
  },
  engine: (context, options) => {
    const { quotes, openDoubleQuote, closeDoubleQuote, ...rules } =
      options as TypographyToolOptions;
    return [
      // Двойные кавычки у Typography выключены: их ставит `TypographyQuotes`.
      Typography.configure({ ...rules, openDoubleQuote: false, closeDoubleQuote: false }),
      TypographyQuotes.configure({
        set: quotes === "auto" ? context.quoteSet : () => quotes,
        open: openDoubleQuote,
        close: closeDoubleQuote,
      }),
    ];
  },
};

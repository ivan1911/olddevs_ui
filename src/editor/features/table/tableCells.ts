"use client";

import {
  alignmentFromElement,
  DEFAULT_ALIGNMENT,
  EDITOR_ALIGNMENTS,
  type EditorAlignment,
} from "../../styles/palette.js";
import { RICH_TEXT_SCHEMA } from "../../core/schema.js";

/*
  Атрибуты ячейки таблицы — слияние и выравнивание столбца (`tables.ts` —
  почему такие). Отдельно от расширений таблицы: ими же разбирает ячейку форма
  таблицы в Скелете (`tableTool.ts`), а чанк таблицы с `prosemirror-tables`
  до Готовности не загружен. Одно определение на оба разбора —
  иначе Скелет и движок разошлись бы в том, какое слияние допустимо.
*/

/**
 * Слияние из атрибута: целое от 1 до `max`, иначе 1. Только цифры — `"2px"`,
 * `"1.5"` и `"-3"` браузер разбирает по-своему, а Схема их не пишет. Пробелы по
 * краям снимаются, как это делают браузер и DOMPurify: санитайзер на сервере
 * отдаёт `colspan=" 2"` уже как `"2"`, и Редактор обязан прочитать то же.
 */
export function parseSpan(raw: string | null, max: number): number {
  const trimmed = raw?.trim() ?? "";
  if (!/^\d{1,6}$/.test(trimmed)) return 1;
  const value = Number(trimmed);
  return value >= 1 && value <= max ? value : 1;
}

const knownAlignments: ReadonlySet<string> = new Set(EDITOR_ALIGNMENTS);

/** Выравнивание ячейки, которое пишется: `center` или `right`; `left` и чужое — `null`. */
export function cellAlignment(value: unknown): Exclude<EditorAlignment, "left"> | null {
  return typeof value === "string" && knownAlignments.has(value) && value !== DEFAULT_ALIGNMENT
    ? (value as Exclude<EditorAlignment, "left">)
    : null;
}

const spanAttribute = (name: "colspan" | "rowspan") => ({
  default: 1,
  parseHTML: (element: HTMLElement) =>
    parseSpan(element.getAttribute(name), RICH_TEXT_SCHEMA.tableSpans[name]),
  renderHTML: (attributes: Record<string, unknown>) => {
    const value = attributes[name];
    return typeof value === "number" && value > 1 ? { [name]: String(value) } : {};
  },
});

export const cellAttributes = () => ({
  colspan: spanAttribute("colspan"),
  rowspan: spanAttribute("rowspan"),
  colwidth: { default: null, rendered: false, parseHTML: () => null },
  align: {
    default: null,
    parseHTML: (element: HTMLElement) => alignmentFromElement(element),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = cellAlignment(attributes.align);
      return value ? { "data-align": value } : {};
    },
  },
});

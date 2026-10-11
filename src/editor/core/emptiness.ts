"use client";

import { isNodeEmpty } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";

/**
 * Правило пустоты Документа кита: пустой абзац, заголовок,
 * список или цитата — пусто; текст, атом и таблица — содержимое.
 *
 * ПОЧЕМУ НЕ `editor.isEmpty`. Он и `isNodeEmpty` Tiptap считают содержимым
 * только текст и листья, а таблица с пустыми ячейками для них пуста. Автор
 * вставил таблицу, ещё ничего не написал — и значение уходило пустой строкой:
 * таблица пропадала при сохранении, а `required` её не засчитывал. Таблица —
 * структура, которую автор построил сам, и выбрасывать её нельзя.
 *
 * Таблица узнаётся по `tableRole` Схемы, как в `blockCommands.ts`, а не по
 * имени узла. На этом правиле держатся значение (`onChange`, `getHTML()`,
 * поле формы, Markdown), `required` и `isEmpty()` Хэндла после монтажа; до
 * монтажа то же правило повторяет `isBlankHtml` по строке (`handle.ts`).
 */
export function isDocumentEmpty(doc: PmNode): boolean {
  // Сначала дешёвая проверка: она останавливается на первом тексте, а обход в
  // поисках таблицы нужен, только когда текста нет. Зовётся на каждую правку.
  if (!isNodeEmpty(doc)) return false;
  let table = false;
  doc.descendants((node) => {
    if (node.type.spec.tableRole === "table") table = true;
    return !table;
  });
  return !table;
}

import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { WRAPPER_NODE } from "../../core/nodeNames.js";
import type { TocLevel, TocToolOptions } from "../../core/toolOptions.js";

/*
  Модуль без Tiptap в рантайме (только типы): его читает ядро Оглавления
  (`TocCore`, `RichTextToc.tsx`), которому движок в бандл не нужен.
*/

/** Заголовок Документа с позицией: по ней команда `jumpTo` находит DOM-узел. */
export interface TocDocumentHeading {
  level: TocLevel;
  text: string;
  /** Позиция узла заголовка в Документе (для `editor.view.nodeDOM`). */
  pos: number;
}

/**
 * Заголовки Оглавления по Документу движка, а не по DOM: ядро Оглавления
 * (`TocCore`) — ленивый чанк, и пока он не пришёл (или нарисован HTML-режим),
 * узлов для обхода нет, а данные экран просит с первого кадра. Это единственный
 * обход, по которому считаются индексы: и снимок Состояния `toc`, и команда
 * `jumpTo` берут заголовок отсюда, поэтому индекс из снимка ведёт к тому же
 * заголовку сразу после правки, не дожидаясь, пока ядро пересоберёт свой список
 * из DOM (`REBUILD_DELAY`).
 *
 * ТЕ ЖЕ ПРАВИЛА, ЧТО У `collectHeadings` (`headings.ts`), иначе индексы разойдутся
 * с пунктами списка: заголовок на верхнем уровне или внутри Обёрток (колонки
 * Раскладки, свои Блоки, цитаты и списки — нет), уровень из `levels`, текст без
 * крайних пробелов не пуст. Текст — тот же, что у `textContent` DOM: мягкий
 * перенос в него не входит, а Текст атома — входит.
 *
 * Обход по верхнему уровню и Обёрткам, а не по всему Документу: стоимость — число
 * Блоков верхнего уровня, она не растёт от вложенности и заметна не будет даже
 * на каждой транзакции.
 */
export function tocDocumentHeadings(
  editor: Editor,
  { levels }: Pick<TocToolOptions, "levels">
): TocDocumentHeading[] {
  const headings: TocDocumentHeading[] = [];
  // `start` — позиция, с которой начинается содержимое `parent`.
  const visit = (parent: PmNode, start: number) =>
    parent.forEach((node, offset) => {
      const pos = start + offset;
      if (node.type.name === WRAPPER_NODE) return visit(node, pos + 1);
      if (node.type.name !== "heading") return;
      const level = node.attrs.level as TocLevel;
      const text = node
        .textBetween(0, node.content.size, "", (leaf) =>
          leaf.type.name === "hardBreak" ? "" : leaf.textContent
        )
        .trim();
      if (text && levels.includes(level)) headings.push({ level, text, pos });
    });
  visit(editor.state.doc, 0);
  return headings;
}

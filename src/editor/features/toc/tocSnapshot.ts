"use client";

import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { TocLevel, TocToolOptions } from "../../core/toolOptions.js";
import type { TocToolHeading, TocToolState } from "../../core/toolState.js";
import { WRAPPER_NODE } from "../../core/containers.js";

/**
 * Снимок Состояния `toc` для `useRichTextToolState`. Заголовки берутся из
 * Документа движка, а не из DOM: ядро Оглавления (`TocCore`) — ленивый чанк, и
 * пока он не пришёл (или нарисован HTML-режим), узлов для обхода нет, а данные
 * экран просит с первого кадра.
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
export function tocSnapshot(
  editor: Editor,
  { levels }: Pick<TocToolOptions, "levels">,
  at: number | undefined
): TocToolState {
  const headings: TocToolHeading[] = [];
  const visit = (parent: PmNode) =>
    parent.forEach((node) => {
      if (node.type.name === WRAPPER_NODE) return visit(node);
      if (node.type.name !== "heading") return;
      const level = node.attrs.level as TocLevel;
      const text = node
        .textBetween(0, node.content.size, "", (leaf) =>
          leaf.type.name === "hardBreak" ? "" : leaf.textContent
        )
        .trim();
      if (text && levels.includes(level)) headings.push({ level, text, index: headings.length });
    });
  visit(editor.state.doc);
  // Прокрутка сообщает индекс по прежнему списку: после правки он мог выйти за край.
  const current = headings.length ? Math.min(Math.max(at ?? 0, 0), headings.length - 1) : -1;
  return { headings, current };
}

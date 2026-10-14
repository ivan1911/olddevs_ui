"use client";

import type { Editor } from "@tiptap/core";
import type { TocToolOptions } from "../../core/toolOptions.js";
import type { TocToolHeading, TocToolState } from "../../core/toolState.js";
import { tocDocumentHeadings } from "./documentHeadings.js";

/**
 * Снимок Состояния `toc` для `useRichTextToolState`: заголовки из
 * `tocDocumentHeadings` без позиций (они в контракт не входят) и текущий раздел.
 * `at` — индекс текущего раздела, который сообщило ядро Оглавления.
 */
export function tocSnapshot(
  editor: Editor,
  options: Pick<TocToolOptions, "levels">,
  at: number | undefined
): TocToolState {
  const headings: TocToolHeading[] = tocDocumentHeadings(editor, options).map(
    ({ level, text }, index) => ({ level, text, index })
  );
  // Прокрутка сообщает индекс по прежнему списку: после правки он мог выйти за край.
  const current = headings.length ? Math.min(Math.max(at ?? 0, 0), headings.length - 1) : -1;
  return { headings, current };
}

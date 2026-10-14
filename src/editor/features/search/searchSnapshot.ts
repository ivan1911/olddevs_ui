"use client";

import type { Editor } from "@tiptap/core";
import type { SearchToolState } from "../../core/toolState.js";
import { searchState } from "./searchPlugin.js";

/**
 * Снимок Состояния `search` для `useRichTextToolState`: открытые поля
 * `searchState` плагина плюс открытость панели, без позиций совпадений. Лежит
 * отдельно от `searchPlugin.ts`: вычисление нужно только хуку и не должно
 * попадать в статический граф Редактора.
 *
 * Флажки — из плагина и при закрытой панели: их держит движок, а не панель.
 * Закрытие возвращает их к стартовым из Опций, а `setQuery` без панели ставит
 * свои. `null` — плагина нет (Инструмент `search` не вошёл в движок).
 */
export function searchSnapshot(editor: Editor, open: boolean): SearchToolState | null {
  const state = searchState(editor.state);
  if (!state) return null;
  const { matchCase, wholeWord, regex } = state.options;
  return {
    open,
    query: state.query,
    flags: { matchCase, wholeWord, regex },
    total: state.total,
    current: state.current,
    error: state.error ?? null,
  };
}

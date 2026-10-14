"use client";

import type { Editor } from "@tiptap/core";
import type { SearchToolOptions } from "../../core/toolOptions.js";
import type { SearchToolState } from "../../core/toolState.js";
import { searchState } from "./searchPlugin.js";

/**
 * Снимок Состояния `search` для `useRichTextToolState`: открытые поля
 * `searchState` плагина плюс открытость панели, без позиций совпадений. Лежит
 * отдельно от `searchPlugin.ts`: вычисление нужно только хуку и не должно
 * попадать в статический граф Редактора.
 *
 * Флажки открытой панели — из плагина: панель шлёт их с каждым запросом. Закрытая
 * панель при открытии начинает со стартовых флажков Опций (`start`), а плагин
 * помнит последние, поэтому закрытой отдаются стартовые. `null` — плагина нет
 * (Инструмент `search` не вошёл в движок).
 */
export function searchSnapshot(
  editor: Editor,
  open: boolean,
  start: SearchToolOptions
): SearchToolState | null {
  const state = searchState(editor.state);
  if (!state) return null;
  const { matchCase, wholeWord, regex } = open ? state.options : start;
  return {
    open,
    query: state.query,
    flags: { matchCase, wholeWord, regex },
    total: state.total,
    current: state.current,
    error: state.error ?? null,
  };
}

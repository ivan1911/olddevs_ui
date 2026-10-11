"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { SearchExtension } from "./searchPlugin.js";

/**
 * Поиск и замена на описании Инструмента. Часть для движка —
 * плагин состояния и подсветки с сочетаниями `Mod+F` и `Mod+Alt+F`; панель
 * держит `RichTextEditor` и открывает её мостом `openSearch`. Кнопка «Поиск» —
 * виджет фиксированной Панели у правого края (`EditorToolbar.tsx`), как
 * справочник сочетаний, а не запись `buttons`: панель встаёт в угол поля, а не
 * у кнопки или выделения.
 */
/** Сочетание кнопки «Поиск»: строка справочника и подсказка кнопки — из одной записи. */
export const SEARCH_KEYS = ["mod", "F"] as const;

export const SEARCH_TOOL: ToolDescriptor = {
  name: "search",
  engine: (context) => [SearchExtension.configure({ open: context.openSearch ?? (() => false) })],
  shortcuts: [
    { id: "search", group: "search", tool: "search", keys: SEARCH_KEYS, label: (m) => m.search },
    {
      id: "searchReplace",
      group: "search",
      tool: "search",
      keys: ["mod", "alt", "F"],
      label: (m) => m.searchReplace,
    },
  ],
};

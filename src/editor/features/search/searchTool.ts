"use client";

import type { Editor } from "@tiptap/core";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { SearchToolCommands } from "../../core/toolCommands.js";
import type { SearchToolOptions } from "../../core/toolOptions.js";
import { SearchExtension } from "./searchPlugin.js";

/**
 * Поиск и замена на описании Инструмента. Extensions —
 * плагин состояния и подсветки с сочетаниями `Mod+F` и `Mod+Alt+F`; панель
 * держит `RichTextEditor` и открывает её мостом `openSearch`. Кнопка «Поиск» —
 * виджет фиксированной Панели у правого края (`EditorToolbar.tsx`), как
 * справочник сочетаний, а не запись `buttons`: панель встаёт в угол поля, а не
 * у кнопки или выделения.
 */
/** Сочетание кнопки «Поиск»: строка справочника и подсказка кнопки — из одной записи. */
export const SEARCH_KEYS = ["mod", "F"] as const;

/** Стартовые флажки панели: все выключены. */
export const SEARCH_DEFAULTS: SearchToolOptions = {
  matchCase: false,
  wholeWord: false,
  regex: false,
};

const isFlag = (value: unknown) => typeof value === "boolean";

/*
  Показать текущее совпадение после команды. ProseMirror прокручивает только
  при фокусе в Документе, а команды зовут и с кнопки экрана. Код прокрутки
  (`revealMatch.ts`) лежит в ленивом куске панели и в старт не входит:
  грузится при первом вызове, поэтому прокрутка приходит на микрозадачу и кадр
  позже. Открытая панель уже подгрузила его, и её переходы сливаются с этим
  вызовом в одну прокрутку.
*/
const reveal = (editor: Editor, done: boolean) => {
  if (done) void import("./revealMatch.js").then((module) => module.scheduleRevealMatch(editor));
  return done;
};

export const SEARCH_TOOL: ToolDescriptor = {
  name: "search",
  defaults: SEARCH_DEFAULTS,
  checks: { matchCase: isFlag, wholeWord: isFlag, regex: isFlag },
  /*
    Запрос, переходы и замена — команды движка, как у панели; панель и HTML-режим
    знает мост. `editor.commands` читается при каждом вызове, а не один раз:
    Tiptap собирает его вместе с транзакцией, и сохранённый набор отправил бы
    устаревшую.
  */
  commands: ({ editor, bridge }): SearchToolCommands => ({
    open: (options) => bridge.openSearch(options?.replace === true, options?.query),
    close: bridge.closeSearch,
    setQuery: (query, flags) =>
      !bridge.sourceOpen() &&
      editor.commands.setSearch(query, flags) &&
      (reveal(editor, query !== ""), true),
    next: () => reveal(editor, editor.commands.searchStep(1)),
    previous: () => reveal(editor, editor.commands.searchStep(-1)),
    replace: (text) => editor.commands.replaceMatch(text),
    replaceAll: (text) => editor.commands.replaceAllMatches(text),
  }),
  engine: (context, options) => [
    SearchExtension.configure({
      open: context.openSearch ?? (() => false),
      flags: options as SearchToolOptions,
    }),
  ],
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

"use client";

import { InvisibleCharacters } from "@tiptap/extension-invisible-characters";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { InvisibleCharactersToolCommands } from "../../core/toolCommands.js";
import type { InvisibleCharactersToolOptions } from "../../core/toolOptions.js";
import { toggleInvisibleCharacters } from "./invisibleCharactersVisible.js";

/**
 * Умолчание Опции: невидимые символы скрыты. У расширения Tiptap по умолчанию
 * `true`, но Инструмент входит в `full`, и обновление кита не должно менять вид
 * каждого такого Редактора: показ включает автор, кнопкой или Опцией.
 */
export const INVISIBLE_CHARACTERS_DEFAULTS: InvisibleCharactersToolOptions = { visible: false };

/**
 * Показ невидимых символов на описании Инструмента (ADR-0048). Это Decoration
 * поверх Документа: пробелы, мягкие переносы (`Shift+Enter`) и концы абзацев
 * рисуются нулевой ширины виджетами, которых нет в Документе. `value`, `onChange`,
 * `getHTML()`, Markdown и `RichTextView` их не видят, Схема, санитайзер и
 * Markdown не меняются.
 *
 * «Невидимые символы» — пункт-флажок меню «…» фиксированной Панели
 * (`FormatMenus.tsx`), а не кнопка ряда и не запись `buttons`: отдельная кнопка
 * переносила `full` во вторую строку в колонке 640 px (решение владельца), а
 * записи `buttons` общие у фиксированной и плавающей Панели, где переключатель
 * режима показа Документа над выделением ни к чему. Сочетания и пункта Меню
 * вставки у Инструмента нет.
 */
export const INVISIBLE_CHARACTERS_TOOL: ToolDescriptor = {
  name: "invisibleCharacters",
  defaults: INVISIBLE_CHARACTERS_DEFAULTS,
  checks: { visible: (value) => typeof value === "boolean" },
  /*
    Свой CSS расширения (`injectCSS`) не нужен: оно вешало бы `<style>` в `head`
    страницы со своим цветом `#aaa`, мимо токенов темы. Вид маркеров задаёт кит
    (`prose.ts`) по тем же классам.
  */
  engine: (_context, options) => [
    InvisibleCharacters.configure({
      visible: (options as InvisibleCharactersToolOptions | undefined)?.visible === true,
      injectCSS: false,
    }),
  ],
  /*
    `editor.commands` читается при каждом вызове, как у `search`. В HTML-режиме
    Документа на экране нет, и переключать нечего: `false` (меню «…» в этом режиме заперто).
  */
  commands: ({ editor, bridge }): InvisibleCharactersToolCommands => ({
    toggle: () => !bridge.sourceOpen() && toggleInvisibleCharacters(editor),
  }),
};

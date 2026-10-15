"use client";

import {
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  HeadingIcon,
} from "../../../icons.js";
import { turnIntoTypes } from "../../core/blockTypes.js";
import type { InsertItem } from "../../core/insertItems.js";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

const LEVELS = [1, 2, 3, 4] as const;

/** Иконки «¶»: в отличие от Меню вставки (одна `HeadingIcon`), там уровень виден на самой иконке. */
const BLOCK_TYPE_ICONS = [Heading1Icon, Heading2Icon, Heading3Icon, Heading4Icon] as const;

/**
 * Пункты заголовков: Меню вставки и «¶» — одни и те же пункты «Превратить в».
 * H1 стоит под `heading` и есть только вместе с `heading1`: у `heading1` своего
 * места в порядке поверхностей нет (`INSERT_ORDER`, `BLOCK_TYPE_ORDER`), поэтому
 * его пункт живёт здесь и скрывается по `requires`.
 */
const HEADING_ITEMS: readonly InsertItem[] = LEVELS.map((level): InsertItem => ({
  id: `heading${level}`,
  section: "turnInto",
  label: (m) => m.heading({ level }),
  icon: HeadingIcon,
  aliases: [`h${level}`],
  markdown: "#".repeat(level),
  keys: SHORTCUT_KEYS[`h${level}`],
  requires: level === 1 ? "heading1" : undefined,
  run: (chain) => chain.setHeading({ level }),
}));

/**
 * Заголовки на описании Инструмента (ADR-0058, п. 10).
 *
 * Узел и его клавиши даёт StarterKit, поэтому в описании — доля StarterKit, а
 * не `engine`. H1 — только с `heading1`; без него `#` и `<h1>` остаются
 * прежними: правило ввода и разбор HTML строятся по этим уровням. Меню «¶»
 * (`BlockTypeMenu`) — виджет кита и описания не касается.
 */
export const HEADING_TOOL: ToolDescriptor = {
  name: "heading",
  starterKit: (context) => ({
    heading: { levels: context.has("heading1") ? [1, 2, 3, 4] : [2, 3, 4] },
  }),
  insertItems: HEADING_ITEMS,
  blockTypes: turnIntoTypes("heading", HEADING_ITEMS).map((item, index) => ({
    ...item,
    icon: BLOCK_TYPE_ICONS[index]!,
    alsoTool: item.requires,
  })),
  // Клавиши вешает расширение Tiptap; строки справочника — подписи к ним.
  // Подпись — как у пункта «¶» («Текст»), а не «Абзац» Меню вставки: справочник
  // называет команду тем словом, которым её выбирают на Панели.
  shortcuts: [
    {
      id: "paragraph",
      group: "blockType",
      tool: "heading",
      keys: SHORTCUT_KEYS.paragraph,
      label: (m) => m.textBlock,
    },
    ...([2, 3, 4] as const).map((level): ShortcutCommand => ({
      id: `h${level}`,
      group: "blockType",
      tool: "heading",
      keys: SHORTCUT_KEYS[`h${level}`],
      label: (m) => m.heading({ level }),
    })),
  ],
};

/**
 * `heading1` — надстройка над `heading`: своего узла у неё нет, она добавляет
 * только H1 (уровни заголовка спрашивают `has("heading1")`, пункты H1 лежат в
 * описании `heading`). В описании — строка справочника `⌘⌥1`, которая есть
 * лишь вместе с `heading`.
 */
export const HEADING1_TOOL: ToolDescriptor = {
  name: "heading1",
  shortcuts: [
    {
      id: "h1",
      group: "blockType",
      tool: "heading1",
      requires: "heading",
      keys: SHORTCUT_KEYS.h1,
      label: (m) => m.heading({ level: 1 }),
    },
  ],
};

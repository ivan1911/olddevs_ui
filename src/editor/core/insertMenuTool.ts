"use client";

import { ParagraphIcon } from "../../icons.js";
import { shortcutKeys } from "./shortcuts.js";
import { SlashCommand } from "./slashCommand.js";
import type { ToolDescriptor } from "./toolDescriptor.js";

/**
 * Меню вставки (`/` в тексте; «+» на Панели и «Добавить ›» Ручки Блока — виджеты
 * кита, они читают `tools.has("insertMenu")`).
 *
 * Своего Блока у Инструмента нет: это способ добраться до чужих Блоков. Extensions
 * Инструмента — это `/`, и они есть, только когда `RichTextEditor` дал мост: пунктов
 * для меню нет — моста нет, и `/` остаётся обычным символом. Абзац записан здесь:
 * это не Инструмент, он есть в Схеме всегда, и «Превратить в абзац» нужен, пока
 * есть само меню.
 */
export const INSERT_MENU_TOOL: ToolDescriptor = {
  name: "insertMenu",
  engine: (context) => (context.slash ? [SlashCommand.configure({ bridge: context.slash })] : []),
  insertItems: [
    {
      id: "paragraph",
      section: "turnInto",
      label: (m) => m.paragraph,
      icon: ParagraphIcon,
      aliases: ["p", "text"],
      keys: shortcutKeys("paragraph"),
      run: (chain) => chain.setParagraph(),
    },
  ],
};

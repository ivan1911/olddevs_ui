"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { TocToolCommands } from "../../core/toolCommands.js";
import type { TocLevel, TocToolOptions } from "../../core/toolOptions.js";

/**
 * Оглавление на описании Инструмента (ADR-0068). Extensions и UI-записей
 * у него нет: полосу и список рисует `RichTextEditor` в левом поле рамки
 * (`TocCore`, ленивым чанком), а описание несёт Опции — умолчания и проверки,
 * из которых `expandTools` собирает Опции Редактора.
 *
 * Тяжёлых импортов нет: описание лежит в стартовом куске Редактора, а UI
 * Оглавления — нет.
 */
const TOC_LEVELS: readonly TocLevel[] = [1, 2, 3, 4];

/** Умолчания Опций: переменная `TopBar` (ADR-0016), все четыре уровня, список в 240 пикселей. */
export const TOC_DEFAULTS: TocToolOptions = {
  offsetVar: "--topbar-h",
  levels: TOC_LEVELS,
  listWidth: 240,
};

export const TOC_TOOL: ToolDescriptor = {
  name: "toc",
  defaults: TOC_DEFAULTS,
  checks: {
    // Имя вставляется в `var(…)` стиля поля, поэтому — только слово с дефисами.
    offsetVar: (value) => typeof value === "string" && /^--[\w-]+$/.test(value),
    levels: (value) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((level) => (TOC_LEVELS as readonly unknown[]).includes(level)),
    listWidth: (value) =>
      (typeof value === "number" && Number.isFinite(value) && value > 0) ||
      (typeof value === "string" && value.trim() !== ""),
  },
  // Переход живёт в ленивом ядре Оглавления: мост зовёт его, пока оно смонтировано.
  commands: ({ bridge }): TocToolCommands => ({ jumpTo: bridge.jumpToc }),
};

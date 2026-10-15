"use client";

import { ColumnLayoutIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { DEFAULT_LAYOUT } from "./columnLayouts.js";
import { LAYOUT_NODE, layoutExtensions } from "./layout.js";

/**
 * Раскладка на описании Инструмента: узлы колонок и их клавиатура
 * (`layout.ts`), пункт Меню вставки и место в модели содержимого Документа.
 *
 * Варианты раскладки («Добавить › Раскладка ›», «Формат ›», «Раскладка ›» колонки)
 * — меню-виджеты Ручки Блока: своего Инструмента у них нет, и они остаются в
 * `BlockHandle.tsx`, показ — по `has("layout")`.
 */
export const LAYOUT_TOOL: ToolDescriptor = {
  name: "layout",
  // Без инструмента `div[data-block]` из вставки и `value` не разбирается, и Блоки
  // колонок встают в Документ подряд. Обёртка в колонке — только при `wrapper`.
  engine: (context) => layoutExtensions({ wrapper: context.has("wrapper") }),
  // Раскладка не в группе `block`: принять её может только Документ, назвав поимённо.
  documentContent: [LAYOUT_NODE],
  /*
    Раскладка — пунктом без подменю: Меню вставки — плоский список
    с фильтром по `/`, и подменю в нём не живут. Вариант по умолчанию — две
    колонки, остальные — в «Добавить › Раскладка ›» и «Формат ›» ручки Блока.
    Встаёт она только на верхний уровень: из колонки — под своей Раскладкой
    (`insertLayout`).
  */
  insertItems: [
    {
      id: "layout",
      section: "insert",
      label: (m) => m.layout,
      icon: ColumnLayoutIcon,
      aliases: ["columns", "cols"],
      run: (chain) => chain.insertLayout(DEFAULT_LAYOUT),
    },
  ],
};

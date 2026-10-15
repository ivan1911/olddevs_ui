"use client";

import { UnwrapIcon, WrapperIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { unwrapWrapperAt, WRAPPER_EXTENSIONS, WRAPPER_NODE } from "./wrapper.js";

/**
 * Обёртка на описании Инструмента: узел и выход из неё по Enter (`wrapper.ts`),
 * пункт Меню вставки, Действие «Снять обёртку» и место в модели содержимого
 * Документа.
 *
 * «Тон ›» — меню-виджет Ручки Блока: своего Инструмента у него нет, и он
 * остаётся в `BlockHandle.tsx`, показ — по `has("wrapper")`.
 */
export const WRAPPER_TOOL: ToolDescriptor = {
  name: "wrapper",
  // Без инструмента `div[data-block="wrapper"]` из вставки и `value` не
  // разбирается, и её Блоки встают на её место подряд.
  engine: () => WRAPPER_EXTENSIONS,
  // Обёртка не в группе `block`: принять её может только Документ, назвав поимённо.
  documentContent: [WRAPPER_NODE],
  /*
    Обёртка — пустая, с одним абзацем, каретка внутри. Место —
    Документ или колонка: из Обёртки, списка, цитаты и ячейки она встаёт под
    их Блоком (`insertWrapper`).
  */
  insertItems: [
    {
      id: "wrapper",
      section: "insert",
      label: (m) => m.wrapper,
      icon: WrapperIcon,
      aliases: ["group", "container", "div"],
      run: (chain) => chain.insertWrapper(),
    },
  ],
  blockActions: [
    {
      id: "unwrap",
      label: (messages) => messages.unwrap,
      icon: UnwrapIcon,
      blocks: [WRAPPER_NODE],
      // Одна правка: Блоки встают на место Обёртки, отмена — одна.
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => unwrapWrapperAt(tr, pos))
          .run(),
    },
  ],
};

"use client";

import { DetailsIcon, UnwrapIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { DetailsToolOptions } from "../../core/toolOptions.js";
import {
  DETAILS_CONTENT_NODE,
  DETAILS_NODE,
  detailsExtensions,
  unwrapDetailsAt,
} from "./details.js";

/** Умолчания Опций: открытость в Документ не пишется (как `persist` у Tiptap). */
export const DETAILS_DEFAULTS: DetailsToolOptions = { persist: false };

/**
 * Сворачиваемый Блок на описании Инструмента (ADR-0048): узлы и их клавиатура
 * (`details.ts`), Markdown сырым HTML (`detailsMarkdown.ts`), пункт Меню вставки,
 * Действие «Снять сворачивание» и Признак «контейнер» для содержимого.
 *
 * Своей группы в модели Документа у Блока нет: он входит в `block`, как абзац.
 * Меню ручки — как у Обёртки: «Вверх», «Вниз», «Дублировать», «Удалить» общие, к
 * ним «Снять сворачивание» у самого Блока и у Блока в его содержимом. «Тон ›» у
 * Блока нет — тонов он не знает.
 */
export const DETAILS_TOOL: ToolDescriptor = {
  name: "details",
  defaults: DETAILS_DEFAULTS,
  checks: { persist: (value) => typeof value === "boolean" },
  /*
    Без Инструмента `details` из вставки и `value` не разбирается: заголовок
    становится абзацем, Блоки содержимого идут за ним (расширения в Схеме нет, и
    браузерный разбор берёт содержимое тегов, как у любого неизвестного).
  */
  engine: (context, options) =>
    detailsExtensions({
      persist: (options as DetailsToolOptions | undefined)?.persist === true,
      toggleLabel: context.detailsToggle,
    }),
  // Содержимое — контейнер Блоков: дети со своей Ручкой (`blockContainer`).
  blocks: { [DETAILS_CONTENT_NODE]: { container: true } },
  // Теги Схемы кита; обёртка содержимого — `div[data-type="detailsContent"]`.
  kitTags: ["details", "summary"],
  insertItems: [
    {
      id: "details",
      section: "insert",
      label: (m) => m.details,
      icon: DetailsIcon,
      aliases: ["details", "summary", "toggle", "accordion", "spoiler", "collapse"],
      run: (chain) => chain.insertDetails(),
    },
  ],
  blockActions: [
    {
      id: "unwrapDetails",
      label: (messages) => messages.unwrapDetails,
      icon: UnwrapIcon,
      blocks: [DETAILS_NODE, DETAILS_CONTENT_NODE],
      // Одна правка: заголовок — абзац, содержимое на месте Блока, отмена — одна.
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => unwrapDetailsAt(tr, pos))
          .run(),
    },
  ],
};

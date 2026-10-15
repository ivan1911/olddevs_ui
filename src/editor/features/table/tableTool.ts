"use client";

import { Node } from "@tiptap/core";
import { tableItem } from "../../core/insertItems.js";
import { cellAttributes } from "./tableCells.js";
// Только тип: статический импорт модуля втянул бы чанк в «старт».
import type * as TableChunkModule from "./tableChunk.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";

type TableChunk = typeof TableChunkModule;

const loadTable = () => import("./tableChunk.js");

/**
 * Чанк таблицы, если он уже загружен. Меню «Таблица» и окно вставки рисуются
 * только при живом движке, а движок с таблицей создаётся после загрузчика —
 * поэтому там, где они нужны, чанк уже есть.
 */
export const tableChunk = (): TableChunk | undefined => loaded(loadTable) as TableChunk | undefined;

/*
  Форма таблицы для Скелета: те же четыре узла с той же моделью содержимого,
  разметкой `table > tbody > tr > th|td` и атрибутами ячейки (`tableCells.ts`),
  но без `prosemirror-tables`, клавиатуры и правил Markdown (`tables.ts`).
*/
const cell = (name: "tableCell" | "tableHeader", tag: "td" | "th") =>
  Node.create({
    name,
    content: "block+",
    isolating: true,
    addAttributes: cellAttributes,
    parseHTML: () => [{ tag }],
    renderHTML: ({ HTMLAttributes }) => [tag, HTMLAttributes, 0],
  });

const TABLE_SHAPE = [
  Node.create({
    name: "table",
    group: "block",
    content: "tableRow+",
    isolating: true,
    parseHTML: () => [{ tag: "table" }],
    renderHTML: () => ["table", {}, ["tbody", 0]],
  }),
  Node.create({
    name: "tableRow",
    content: "(tableCell | tableHeader)*",
    parseHTML: () => [{ tag: "tr" }],
    renderHTML: () => ["tr", 0],
  }),
  cell("tableCell", "td"),
  cell("tableHeader", "th"),
];

/**
 * Таблица на описании Инструмента (ADR-0058, п. 11.1): её нет в
 * `basic`, а Extensions с `prosemirror-tables` тяжелее 10 кБ, поэтому они
 * грузятся тем же загрузчиком, что у своего Инструмента. В том же чанке — меню
 * «Таблица» и окно «Вставить таблицу»: код кита меряется и статическим графом.
 *
 * Переехали Extensions и пункт Меню вставки. Меню «Таблица» — виджет
 * Панели и остаётся её местом (`EditorToolbar.tsx`), только компонент берёт из
 * чанка.
 */
export const TABLE_TOOL: ToolDescriptor = {
  name: "table",
  load: loadTable,
  // Четыре узла разом (`tables.ts`): без любого из них Схема не соберётся.
  engine: () => [...tableChunk()!.TABLE_EXTENSIONS],
  skeleton: () => TABLE_SHAPE,
  kitTags: ["table", "tbody", "tr", "th", "td"],
  insertItems: [tableItem(3, 3)],
};

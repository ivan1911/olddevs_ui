"use client";

/*
  Ленивый чанк таблицы (ADR-0058, п. 11.1): расширения с
  `prosemirror-tables`, меню «Таблица» Панели и окно «Вставить таблицу».
  Грузит его загрузчик Инструмента `table` (`tableTool.ts`); статически этот
  модуль не импортирует никто — иначе `basic` платил бы за таблицу.
*/
export { TABLE_EXTENSIONS } from "./tables.js";
export { TableInsertDialog } from "./TableInsertDialog.js";
export { TableMenuButton } from "./TableMenuButton.js";

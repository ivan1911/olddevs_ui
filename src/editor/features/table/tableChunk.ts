"use client";

/*
  Lazy chunk of the table (ADR-0058, item 11.1): the extensions built on
  `prosemirror-tables`, the Table menu of the Toolbar and the Insert table dialog.
  The Loader of the `table` Tool (`tableTool.ts`) loads it. Nothing imports this
  module statically, or `basic` would pay for the table.
*/
export { TABLE_EXTENSIONS } from "./tables.js";
export { TableColumnHandles } from "./TableColumnHandles.js";
export { TableInsertDialog } from "./TableInsertDialog.js";
export { TableMenuButton } from "./TableMenuButton.js";

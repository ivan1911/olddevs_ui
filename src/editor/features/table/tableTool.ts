"use client";

import { Node } from "@tiptap/core";
import { tableItem } from "../../core/insertItems.js";
import { cellAttributes, tableShareAttributes, tableSpec } from "./tableCells.js";
// Type only: a static import of the module would pull the chunk into the start bundle.
import type * as TableChunkModule from "./tableChunk.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { loaded } from "../../core/toolLoader.js";

type TableChunk = typeof TableChunkModule;

const loadTable = () => import("./tableChunk.js");

/**
 * The table chunk, if it has already loaded. The Table menu and the insert dialog
 * render only while the engine is live, and the engine with a table is created
 * after its loader, so wherever they are needed the chunk is already there.
 */
export const tableChunk = (): TableChunk | undefined => loaded(loadTable) as TableChunk | undefined;

/*
  The table's shape for the Skeleton: the same four nodes with the same content model,
  the `table > tbody > tr > th|td` markup and the cell attributes (`tableCells.ts`),
  but without `prosemirror-tables`, keyboard handling or the Markdown rules (`tables.ts`).
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
    addAttributes: tableShareAttributes,
    parseHTML: () => [{ tag: "table" }],
    renderHTML: ({ node }) => tableSpec(node.attrs.shares),
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
 * The table as a Tool description (ADR-0058, item 11.1): it is not in `basic`,
 * and the Extensions with `prosemirror-tables` weigh over 10 kB, so they load
 * through the same loader as their Tool. The same chunk holds the Table menu and
 * the Insert table dialog, and the kit's code is measured through the static
 * graph as well.
 *
 * The Extensions and the Insert item moved here. The Table menu is a Toolbar
 * widget and stays in its place (`EditorToolbar.tsx`); only the component is
 * taken from the chunk.
 */
export const TABLE_TOOL: ToolDescriptor = {
  name: "table",
  load: loadTable,
  // All four nodes at once (`tables.ts`): the Schema does not assemble without any one of them.
  engine: () => [...tableChunk()!.TABLE_EXTENSIONS],
  skeleton: () => TABLE_SHAPE,
  kitTags: ["table", "tbody", "tr", "th", "td"],
  insertItems: [tableItem(3, 3)],
};

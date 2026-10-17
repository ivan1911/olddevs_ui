"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/** Placeholder (OLDSUI-274): Excel cells: resolve the class rules of the <style> block (bold, italic, underline, strikethrough, alignment, fill) onto the cells. Agent B. */
export const excelCellStyles: PasteCleanupStep = {
  name: "excelCellStyles",
  applies: () => false,
  run() {},
};

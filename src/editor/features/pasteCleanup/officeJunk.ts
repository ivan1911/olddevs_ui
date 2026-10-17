"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/** Placeholder (OLDSUI-274): Office junk: Word bookmarks, <o:p>, conditional comments, stray <br> between Blocks. Agent A. */
export const officeJunk: PasteCleanupStep = {
  name: "officeJunk",
  applies: () => false,
  run() {},
};

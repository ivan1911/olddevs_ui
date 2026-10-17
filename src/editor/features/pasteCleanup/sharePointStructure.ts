"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/** Placeholder (OLDSUI-274): SharePoint and Word Online: role=heading with aria-level to headings, flat lists to nested lists. Agent C. */
export const sharePointStructure: PasteCleanupStep = {
  name: "sharePointStructure",
  applies: () => false,
  run() {},
};

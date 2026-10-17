"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/** Placeholder (OLDSUI-274): A Word paragraph border and a Google Docs text line become <hr>. Agent A. */
export const horizontalRules: PasteCleanupStep = {
  name: "horizontalRules",
  applies: () => false,
  run() {},
};

"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/** Placeholder (OLDSUI-274): Text and cell backgrounds become the highlight Mark with the nearest palette marker. Agent B. */
export const backgroundMarkers: PasteCleanupStep = {
  name: "backgroundMarkers",
  applies: () => false,
  run() {},
};

"use client";

import type { PasteCleanupStep } from "./cleanPastedHtml.js";

/**
 * Safari's spaces. When Safari writes HTML to the clipboard, it turns a space next to an inline tag
 * into `<span class="Apple-converted-space">&nbsp;</span>`, so that the space survives its own
 * whitespace rules. In the Document that becomes a non-breaking space: "with&nbsp;<b>bold</b>"
 * does not wrap where the author's text did. The span goes back to the plain space it was.
 *
 * Only for office sources, like every step: a paste from a web page in Safari keeps its HTML as is.
 */
export const appleConvertedSpaces: PasteCleanupStep = {
  name: "appleConvertedSpaces",
  applies: (sources) => sources.word || sources.excel || sources.googleDocs || sources.googleSheets,
  run(document) {
    for (const span of document.querySelectorAll("span.Apple-converted-space")) {
      span.replaceWith(document.createTextNode((span.textContent ?? "").replace(/\u00a0/g, " ")));
    }
  },
};

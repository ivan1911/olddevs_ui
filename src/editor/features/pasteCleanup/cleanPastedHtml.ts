"use client";

import { devWarn } from "../../../lib/dev-warn.js";
import { appleConvertedSpaces } from "./appleConvertedSpaces.js";
import { backgroundMarkers } from "./backgroundMarkers.js";
import { excelCellStyles } from "./excelCellStyles.js";
import { horizontalRules } from "./horizontalRules.js";
import { officeJunk } from "./officeJunk.js";
import { detectPasteSources, type PasteSources } from "./pasteSources.js";
import { sharePointStructure } from "./sharePointStructure.js";
import { tableColumnWidths } from "./tableColumnWidths.js";
import { wordLists } from "./wordLists.js";

/** What every step gets besides the parsed clipboard. */
export interface PasteCleanupContext {
  /** The sources the clipboard HTML came from. */
  sources: PasteSources;
  /**
   * The text of the clipboard's `<style>` blocks. Word keeps its list rules there (`@list l0:level1`)
   * and Excel its cell classes (`.xl65`); the elements only point at them.
   */
  styles: string;
}

/**
 * One cleanup step: a change to the parsed clipboard that keeps the meaning of the source (a list, a
 * heading, a highlight) before the Schema cuts what it does not know. A step changes the document in
 * place; it never adds anything the Schema would not accept anyway.
 */
export interface PasteCleanupStep {
  /** For the development warning when the step throws. */
  name: string;
  /** Whether the step is for this clipboard. */
  applies: (sources: PasteSources) => boolean;
  run: (document: Document, context: PasteCleanupContext) => void;
}

/**
 * The steps, in order. The order matters where one step reads what another one removes: Excel's
 * class rules are resolved before backgrounds are read; backgrounds are marked before the Word lists
 * are rebuilt, so the marker step leaves the list markers (`mso-list:Ignore`, the `supportLists`
 * comments) outside its marks; and lists are rebuilt before the Office junk is cleared, because the
 * list markers sit inside that junk.
 */
export const PASTE_CLEANUP_STEPS: readonly PasteCleanupStep[] = [
  appleConvertedSpaces,
  excelCellStyles,
  backgroundMarkers,
  wordLists,
  sharePointStructure,
  horizontalRules,
  tableColumnWidths,
  officeJunk,
];

/**
 * Clean the clipboard HTML of a paste (the `transformPastedHTML` of the `pasteCleanup` Tool).
 *
 * HTML from no known source is returned as the same string, without a parse. Otherwise the HTML is
 * parsed once, every step that applies runs over it, and the `<body>` goes on to the Schema: the
 * `<head>` holds only styles and metadata, which the Schema drops anyway.
 *
 * ALL OR NOTHING. If any step throws, the original HTML is pasted as if there were no cleanup: the
 * author gets what the Editor gave before this Tool existed, not a half-cleaned paste. The developer
 * gets a warning in development builds.
 */
export function cleanPastedHtml(
  html: string,
  steps: readonly PasteCleanupStep[] = PASTE_CLEANUP_STEPS
): string {
  // The step that is running, for the warning; `null` while the pipeline itself works (detection,
  // parse, serialization), which can fail too and must not take the paste down with it.
  let current: string | null = null;
  try {
    const sources = detectPasteSources(html);
    const active = steps.filter((step) => step.applies(sources));
    if (active.length === 0) return html;
    const document = new DOMParser().parseFromString(html, "text/html");
    const context: PasteCleanupContext = {
      sources,
      styles: Array.from(
        document.querySelectorAll("style"),
        (style) => style.textContent ?? ""
      ).join("\n"),
    };
    for (const step of active) {
      current = step.name;
      step.run(document, context);
    }
    current = null;
    return document.body.innerHTML;
  } catch {
    devWarn(
      `RichTextEditor: ${current === null ? "the paste cleanup" : `the "${current}" paste cleanup step`} ` +
        "failed, so the paste goes in without cleanup. Please report it with the clipboard HTML."
    );
    return html;
  }
}

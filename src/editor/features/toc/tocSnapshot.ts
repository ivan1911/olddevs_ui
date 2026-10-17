"use client";

import type { Editor } from "@tiptap/core";
import type { TocToolOptions } from "../../core/toolOptions.js";
import type { TocToolHeading, TocToolState } from "../../core/toolState.js";
import { tocDocumentHeadings } from "./documentHeadings.js";

/**
 * Snapshot of the `toc` state for `useRichTextToolState`: the headings from
 * `tocDocumentHeadings`, without positions (positions are not part of the contract),
 * and the current section. `at` is the index of the current section, as reported by
 * the table-of-contents core.
 */
export function tocSnapshot(
  editor: Editor,
  options: Pick<TocToolOptions, "levels">,
  at: number | undefined
): TocToolState {
  const headings: TocToolHeading[] = tocDocumentHeadings(editor, options).map(
    ({ level, text }, index) => ({ level, text, index })
  );
  // The index was reported against the previous list: after an edit it may be past the end.
  const current = headings.length ? Math.min(Math.max(at ?? 0, 0), headings.length - 1) : -1;
  return { headings, current };
}

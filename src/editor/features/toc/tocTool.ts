"use client";

import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { TocToolCommands } from "../../core/toolCommands.js";
import type { TocLevel, TocToolOptions } from "../../core/toolOptions.js";

/**
 * The table of contents as a Tool descriptor (ADR-0068). It has no Extensions or UI
 * entries: `RichTextEditor` draws the strip and the list in the left column of the
 * field's frame (`TocCore`, as a lazy chunk), while the descriptor carries the Options,
 * the defaults and the checks, from which `expandTools` builds the Editor's Options.
 *
 * There are no heavy imports: the descriptor sits in the Editor's starter chunk, and the
 * table-of-contents UI does not.
 */
const TOC_LEVELS: readonly TocLevel[] = [1, 2, 3, 4];

/** Option defaults: the `TopBar` variable (ADR-0016), all four levels, a 240-pixel list. */
export const TOC_DEFAULTS: TocToolOptions = {
  offsetVar: "--topbar-h",
  levels: TOC_LEVELS,
  listWidth: 240,
};

export const TOC_TOOL: ToolDescriptor = {
  name: "toc",
  defaults: TOC_DEFAULTS,
  checks: {
    // The name is inserted into `var(…)` in the field's style, so it must be a plain word with hyphens.
    offsetVar: (value) => typeof value === "string" && /^--[\w-]+$/.test(value),
    levels: (value) =>
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((level) => (TOC_LEVELS as readonly unknown[]).includes(level)),
    listWidth: (value) =>
      (typeof value === "number" && Number.isFinite(value) && value > 0) ||
      (typeof value === "string" && value.trim() !== ""),
  },
  // The jump lives in the lazy table-of-contents core: the bridge calls it while the core is mounted.
  commands: ({ bridge }): TocToolCommands => ({ jumpTo: bridge.jumpToc }),
};

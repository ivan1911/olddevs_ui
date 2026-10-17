"use client";

import { DetailsIcon, UnwrapIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import type { DetailsToolOptions } from "../../core/toolOptions.js";
import {
  DETAILS_CONTENT_NODE,
  DETAILS_NODE,
  detailsExtensions,
  unwrapDetailsAt,
} from "./details.js";

/** Option defaults: the open state is not written to the Document (like `persist` in Tiptap). */
export const DETAILS_DEFAULTS: DetailsToolOptions = { persist: false };

/**
 * The Details Block on the Tool description (ADR-0048): the nodes and their keyboard handling
 * (`details.ts`), Markdown as raw HTML (`detailsMarkdown.ts`), the Slash menu item, the "Remove
 * collapsing" Block action and the `container` trait for the content.
 *
 * The Block has no group of its own in the Document model: it belongs to `block`, like a paragraph.
 * The Block handle menu is the same as for a Wrapper: "Move up", "Move down", "Duplicate" and
 * "Delete" are shared, and "Remove collapsing" is offered for the Block itself and for a Block in
 * its content. The Details Block has no "Tone ›": it does not know tones.
 */
export const DETAILS_TOOL: ToolDescriptor = {
  name: "details",
  defaults: DETAILS_DEFAULTS,
  checks: { persist: (value) => typeof value === "boolean" },
  /*
    Without the `details` Tool, `details` from paste and from `value` is not parsed: the title
    becomes a paragraph, and the content Blocks follow it. The Schema has no rule for it, so the
    browser's parser takes the contents of the tags, as it does for any unknown tag.
  */
  engine: (context, options) =>
    detailsExtensions({
      persist: (options as DetailsToolOptions | undefined)?.persist === true,
      toggleLabel: context.detailsToggle,
    }),
  // The content is a container of Blocks: its children get their own handle (`blockContainer`).
  blocks: { [DETAILS_CONTENT_NODE]: { container: true } },
  // The kit's Schema tags; the content wrapper is `div[data-type="detailsContent"]`.
  kitTags: ["details", "summary"],
  insertItems: [
    {
      id: "details",
      section: "insert",
      label: (m) => m.details,
      icon: DetailsIcon,
      aliases: ["details", "summary", "toggle", "accordion", "spoiler", "collapse"],
      run: (chain) => chain.insertDetails(),
    },
  ],
  blockActions: [
    {
      id: "unwrapDetails",
      label: (messages) => messages.unwrapDetails,
      icon: UnwrapIcon,
      blocks: [DETAILS_NODE, DETAILS_CONTENT_NODE],
      // One edit: the title becomes a paragraph, the content takes the Block's place, and undo
      // reverts it in one step.
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => unwrapDetailsAt(tr, pos))
          .run(),
    },
  ],
};

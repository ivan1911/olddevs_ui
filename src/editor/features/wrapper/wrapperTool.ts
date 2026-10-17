"use client";

import { UnwrapIcon, WrapperIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { unwrapWrapperAt, WRAPPER_EXTENSIONS, WRAPPER_NODE } from "./wrapper.js";

/**
 * The Wrapper in the Tool descriptor: the node and the exit from it on Enter
 * (`wrapper.ts`), the Insert item, the "Unwrap" Block action and the place in the
 * Document's content model.
 *
 * "Tone ›" is a menu widget of the Block handle: it has no Tool of its own, so it
 * stays in `BlockHandle.tsx`, shown when `has("wrapper")` holds.
 */
export const WRAPPER_TOOL: ToolDescriptor = {
  name: "wrapper",
  // Without the Tool, `div[data-block="wrapper"]` is not parsed from paste or `value`,
  // and its Blocks take its place in a row.
  engine: () => WRAPPER_EXTENSIONS,
  // A Wrapper is not in the `block` group: only the Document can accept it, by naming it.
  documentContent: [WRAPPER_NODE],
  /*
    The Wrapper is empty, with one paragraph and the caret inside. Its place is
    the Document or a column: from a Wrapper, list, quote or cell it goes below
    their Block (`insertWrapper`).
  */
  insertItems: [
    {
      id: "wrapper",
      section: "insert",
      label: (m) => m.wrapper,
      icon: WrapperIcon,
      aliases: ["group", "container", "div"],
      run: (chain) => chain.insertWrapper(),
    },
  ],
  blockActions: [
    {
      id: "unwrap",
      label: (messages) => messages.unwrap,
      icon: UnwrapIcon,
      blocks: [WRAPPER_NODE],
      // One transaction: the Blocks take the Wrapper's place, and undo is one step.
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => unwrapWrapperAt(tr, pos))
          .run(),
    },
  ],
};

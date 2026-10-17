"use client";

import { lazy, Suspense } from "react";
import type { BlockIslandSlotsProps } from "./BlockIslandSlots.js";

/*
  The Island of custom Blocks in `RichTextView` (ADR-0058, item 3.3) is the shell.

  WHY THE BODY LOADS SEPARATELY. Block search, content replacement and the portal
  are needed only by a Document with its own custom Block, while `RichTextView` is
  read without them. A separate chunk stays out of the first load of the View: a page
  with text and code pays for the Island only through the `lazy` here. While the chunk
  loads, the server-rendered HTML of the Block is visible. That is the "before the
  Island loads" state from the ADR.
*/
const Slots = lazy(() => import("./BlockIslandSlots.js"));

export function BlockIsland(props: BlockIslandSlotsProps) {
  return (
    <Suspense fallback={null}>
      <Slots {...props} />
    </Suspense>
  );
}

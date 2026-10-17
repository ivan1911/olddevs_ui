"use client";

import { lazy, Suspense } from "react";
import type { VideoIslandSlotsProps } from "./VideoIslandSlots.js";

/*
  The video Island of `RichTextView` (ADR-0071, item 3) is the shell.

  WHY THE BODY LOADS SEPARATELY. The player, block search and the portal are needed
  only by a Document with video, while `RichTextView` is read without them. A page
  with text and code pays for the Island only through the `lazy` here, and
  `RichTextView` mounts the Island only when the HTML contains video
  (`hasVideoBlocks`). While the chunk loads, the server-rendered HTML of the Block is
  visible: a link, which is also the "before the Island loads" state. The `autoload`
  option arrives as data from the server (`videoAutoloadOf(tools)`).
*/
const Slots = lazy(() => import("./VideoIslandSlots.js"));

export function VideoIsland(props: VideoIslandSlotsProps) {
  return (
    <Suspense fallback={null}>
      <Slots {...props} />
    </Suspense>
  );
}

"use client";

import type { JSONContent } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { isVideoProvider, isVideoSrc, VIDEO_BLOCK } from "./videoSrc.js";

/*
  A VIDEO BLOCK WITHOUT THE `youtube` AND `twitch` TOOLS IS A LINK (ADR-0071, "behavior
  without a Tool").

  HTML, Markdown and paste already read such a Block as its link: the `div` is removed by
  parsing and the `a` stays. The JSON envelope skips HTML parsing, and a `video` node that is not
  in the Schema was unwrapped by `conformToSchema` into its content. An Atom has no content, so
  the link disappeared silently. Here the node becomes a paragraph with the link (or with the
  address as plain text, if there is no `link` Tool), the same way a formula without
  `mathematics` becomes text (`mathAsText.ts`).
*/

/**
 * A `video` node from JSON becomes a paragraph with a link to the video. `null` means this is not
 * a video Block, or its service or address is not usable (`isVideoSrc`): an unknown address is not
 * turned into a link. Called by `conformToSchema` when there is no `video` node in the Schema.
 */
export function videoJsonAsLink(node: JSONContent, schema: Schema): JSONContent[] | null {
  if (node.type !== VIDEO_BLOCK) return null;
  const { provider, link } = (node.attrs ?? {}) as { provider?: unknown; link?: unknown };
  if (!isVideoProvider(provider) || typeof link !== "string" || !isVideoSrc(provider, link)) {
    return null;
  }
  const text: JSONContent = { type: "text", text: link };
  if (schema.marks.link) text.marks = [{ type: "link", attrs: { href: link } }];
  return [{ type: "paragraph", content: [text] }];
}

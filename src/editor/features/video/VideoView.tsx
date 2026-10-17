"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { cn } from "../../../lib/cn.js";
import type { VideoOptions } from "./video.js";
import { VideoPlayer } from "./VideoPlayer.js";
import { isVideoSrc, type VideoLink } from "./videoSrc.js";

/**
 * Video in the Editor: the service's player (`VideoPlayer`), rendered at once or, with
 * `autoload: false`, the kit's placeholder and the player after a click.
 *
 * The Block's chrome (`contentEditable={false}`): ProseMirror does not put the caret in it and
 * does not read it as content. The Block is an Atom: a click outside the player selects it, and
 * the Block handle moves and deletes it, as it does an image. The selection shows a ring in the
 * `--rte-primary` role. Clicks and keys INSIDE the `iframe` go to the player, not to the Editor:
 * the browser does not pass events of a foreign document to the page's document. So both
 * selecting the Block and the arrow keys around it work while focus is in the Editor. To leave
 * the player, Tab or Shift+Tab is enough, as with any `iframe`.
 * With `autoload: false` the placeholder does not reach the service until the author clicks
 * Play: editing the Document does not load the player.
 *
 * A node with a link the kit does not recognize (only the raw `ref.editor` could have set it)
 * does not render the player: an empty frame without a button stays.
 */
export function VideoView({ node, selected, extension }: NodeViewProps) {
  const { provider, link } = node.attrs as { provider: VideoLink["provider"]; link: string };
  const autoload = (extension.options as VideoOptions).autoload[provider] ?? true;
  const valid = isVideoSrc(provider, link);
  return (
    <NodeViewWrapper
      data-video-node=""
      contentEditable={false}
      className={cn(
        "rounded-(--rte-radius)",
        selected && "outline-2 outline-offset-2 outline-(--rte-primary)"
      )}
    >
      {valid ? <VideoPlayer link={{ provider, src: link }} autoload={autoload} /> : null}
    </NodeViewWrapper>
  );
}

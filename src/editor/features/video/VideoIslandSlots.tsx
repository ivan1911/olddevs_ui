"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { VideoPlayer } from "./VideoPlayer.js";
import { videoLinkOf } from "./videoLink.js";
import type { VideoAutoload } from "./videoOptions.js";
import { VIDEO_BLOCK, type VideoLink } from "./videoSrc.js";

export interface VideoIslandSlotsProps {
  /** Fingerprint of the View's HTML. When the Document changes, its Blocks are new, and the island looks for them again. */
  docKey: string;
  /** The `autoload` option of each service, from the screen's `tools` (`videoAutoloadOf`). Data only. */
  autoload: VideoAutoload;
}

interface Found {
  element: HTMLElement;
  link: VideoLink;
}

/**
 * The body of the video island (ADR-0071, item 3). The shell and the lazy loading live in
 * `VideoIsland.tsx`. It is built the same way as the island for Blocks (`BlockIslandSlots.tsx`).
 *
 * SERVER HTML COMES FIRST. The Block arrives in the markup whole, with its link inside, and it
 * can be read without JS, before hydration, and in Markdown. After mounting, its content is
 * replaced by `VideoPlayer`: the player at once or, with `autoload: false`, a Play placeholder
 * and the player after a click. The address is built right here. Unmounting the island brings
 * the link back.
 * A Block whose service or address is not usable (the HTML did not pass sanitizing, or the
 * service is unknown) stays a link: the player is built only from what `isVideoSrc` recognizes.
 *
 * THE SEARCH STARTS FROM ITS OWN PLACE IN THE TREE, as the Copy button does: an empty, inert
 * `<template>` sits right after the View's container (or after the markers of other islands),
 * so a View inside a shadow root or an `iframe` finds its own Blocks. The marker is present both
 * in the server markup and in the first client pass, so hydration matches. Portals appear only
 * after an effect runs.
 *
 * THE EFFECT DEPENDS ON THE DOCUMENT (`docKey`), not on the View's props: a new object literal
 * passed by the parent must not remount the players and cut off playback. The `autoload` option
 * is data in the props and is read when the player is rendered.
 */
export default function VideoIslandSlots({ docKey, autoload }: VideoIslandSlotsProps) {
  const [found, setFound] = useState<Found[]>([]);
  const marker = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    let view = marker.current?.previousElementSibling;
    while (view?.localName === "template") view = view.previousElementSibling;
    const list: Found[] = [];
    for (const element of view?.querySelectorAll<HTMLElement>(`div[data-block="${VIDEO_BLOCK}"]`) ??
      []) {
      const link = videoLinkOf(element.dataset.provider ?? null, element.dataset.src ?? "");
      // A Block nested inside a video Block is not a supported case: only the outer one comes alive.
      if (link && !element.parentElement?.closest(`div[data-block="${VIDEO_BLOCK}"]`)) {
        list.push({ element, link });
      }
    }
    setFound(list);
  }, [docKey]);

  return (
    <>
      <template ref={marker} data-video-island="" />
      {found.map((item, index) => (
        <Slot key={`${docKey}:${index}`} item={item} autoload={autoload[item.link.provider]} />
      ))}
    </>
  );
}

/**
 * The 16:9 frame is already held by the Block itself (`VIDEO_CLASS` in `prose.ts`): the player
 * fills it instead of drawing a second frame or adding height. The island does not change the
 * Block's height.
 */
const IN_FRAME = "absolute inset-0 aspect-auto size-full rounded-none border-0 bg-transparent";

/**
 * One occurrence of the Block. The server HTML's content is removed and replaced by an empty
 * island root. The root is inserted BEFORE the player renders (`ready`), so its effects can see
 * it in the document. Unmounting puts the content back.
 */
function Slot({ item, autoload }: { item: Found; autoload: boolean }) {
  const { element, link } = item;
  const [root] = useState(() => {
    const span = document.createElement("span");
    span.style.display = "contents";
    return span;
  });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const original = [...element.childNodes];
    element.replaceChildren(root);
    setReady(true);
    return () => element.replaceChildren(...original);
  }, [element, root]);

  return ready
    ? createPortal(<VideoPlayer link={link} autoload={autoload} className={IN_FRAME} />, root)
    : null;
}

"use client";

import { useLayoutEffect, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ViewIsland } from "../core/viewIsland.js";

export interface BlockIslandSlotsProps {
  /** Islands the Document needs (`islandsFor`): the component and its declared attributes, by Block name. */
  islands: readonly ViewIsland[];
  /** Fingerprint of the View's HTML: when the Document changes, its Blocks are new and the Island looks for them again. */
  docKey: string;
}

interface Found {
  element: HTMLElement;
  block: string;
  text: string;
  data: DOMStringMap;
  /** The nearest ancestor Block among those found: the outer Block's Island owns everything inside it. */
  parent: Found | undefined;
}

/**
 * The body of the Island for custom Blocks (ADR-0058, item 3.3). The wrapper and the lazy
 * loading live in `BlockIsland.tsx`. It brings to life every Block whose description has an
 * `island`. It is built like `CodeCopyIsland`, the "Copy" button on code Blocks.
 *
 * SERVER HTML COMES FIRST. A Block arrives in the markup as a whole and can be read without
 * JS and before hydration. Here, after mounting, the consumer's component replaces
 * its content. When the Island unmounts (a change of `tools`, or the Block
 * going away), the content comes back. The component receives the Block's name, the declared
 * attributes and the text, all taken from the server HTML before it is replaced.
 *
 * THE SEARCH STARTS FROM ITS OWN PLACE IN THE TREE, as with "Copy": an empty inert
 * `<template>` sits right after the View's container (or after the markers of other
 * Islands), so a View inside a shadow root or an `iframe` finds its own Blocks. The marker
 * is in the server markup and in the first client pass too, so hydration matches. The
 * Islands appear only after the effect.
 *
 * THE EFFECT DEPENDS ON THE DOCUMENT, not on `tools`: a new array literal from the parent
 * must not remount the Islands and reset their state. All Blocks with `data-block` are found;
 * which of them come alive is decided at render time, from the current `islands`.
 */
export default function BlockIslandSlots({ islands, docKey }: BlockIslandSlotsProps) {
  const [found, setFound] = useState<Found[]>([]);
  const marker = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    let view = marker.current?.previousElementSibling;
    while (view?.localName === "template") view = view.previousElementSibling;
    const list: Found[] = [];
    for (const element of view?.querySelectorAll<HTMLElement>("[data-block]") ?? []) {
      const parent = element.parentElement?.closest<HTMLElement>("[data-block]");
      list.push({
        element,
        block: element.dataset.block ?? "",
        text: element.textContent ?? "",
        data: { ...element.dataset },
        parent: list.find((item) => item.element === parent),
      });
    }
    setFound(list);
  }, [docKey]);

  const has = (item: Found) => islands.some((entry) => entry.block === item.block);
  const covered = (item: Found) => {
    for (let up = item.parent; up; up = up.parent) if (has(up)) return true;
    return false;
  };

  return (
    <>
      <template ref={marker} data-block-island="" />
      {found.map((item, index) => {
        const entry = islands.find((candidate) => candidate.block === item.block);
        return entry && !covered(item) ? (
          <Slot key={`${docKey}:${index}`} item={item} entry={entry} />
        ) : null;
      })}
    </>
  );
}

/**
 * One occurrence of a Block. The server HTML's content is taken out and replaced with the
 * Island's empty root. The root is placed BEFORE the component renders (`ready`), so that
 * its effects find it in the document. Unmounting restores the content.
 */
function Slot({ item, entry }: { item: Found; entry: ViewIsland }) {
  const { element, block, text, data } = item;
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

  const Component = entry.island;
  const attributes: Record<string, string> = {};
  for (const name of Object.keys(entry.attributes ?? {})) {
    if (data[name] !== undefined) attributes[name] = data[name];
  }
  return ready
    ? createPortal(<Component block={block} attributes={attributes} text={text} />, root)
    : null;
}

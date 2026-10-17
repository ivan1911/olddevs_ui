"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CodeCopyButton } from "./CodeCopyButton.js";

export interface CodeCopyIslandProps {
  /** Identifier of the view: its Block mount points are marked with the same id (`withCodeHeaders`). */
  hostId: string;
  /**
   * Fingerprint of the view's HTML: when the Document changes, the mount points are new, and the
   * Island looks for them again.
   */
  docKey: string;
}

interface Slot {
  element: HTMLElement;
  code: string;
}

/**
 * Client Island of `RichTextView`: puts a "Copy" button into the mount points of the code Block
 * headers.
 *
 * WHY IT EXISTS. `RichTextView` is a server component and cannot have a click handler. The header
 * with the language label and an empty mount point comes in the HTML from the server; here, after
 * mounting, a `CodeCopyButton` is inserted with a portal into each mount point of its own view.
 * Before hydration, and without JS, there is no button, and the document reads the same.
 *
 * WHAT IS COPIED is the `textContent` of the `code` element next to the mount point. For text
 * without markup, and for a Block already highlighted by `highlightCodeBlocks` (the tokens are
 * `span`s inside `code`), this is the same source code: the tokens add nothing (ADR-0039: the
 * text is copied, not the markup).
 *
 * MOUNT POINTS ARE FOUND FROM THEIR OWN PLACE IN THE TREE, not from the global `document`. A
 * server component has no reference it can pass to a client one, so the Island renders an empty
 * inert `<template>` right after the view's container (`RichTextView` places them as siblings)
 * and, after mounting, takes its left sibling. A view in a shadow root or in an `iframe`, which
 * the global `document` does not see, thus gets its own buttons, and the search covers only its
 * own container rather than the whole page. The mount point's identifier is still checked: a
 * mount point with someone else's identifier does not get a button.
 *
 * `<template>` is present both in the server markup and in the first client pass, while portals
 * appear only after the effect, so the server markup and the hydrated tree match. The browser does
 * not show `<template>` and does not put it in the accessibility tree; in a flex or grid parent it
 * takes no cell.
 */
export function CodeCopyIsland({ hostId, docKey }: CodeCopyIslandProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const markerRef = useRef<HTMLTemplateElement>(null);

  useEffect(() => {
    const view = markerRef.current?.previousElementSibling;
    const found = [...(view?.querySelectorAll<HTMLElement>("[data-code-copy]") ?? [])]
      .filter((element) => element.dataset.codeCopy === hostId)
      .map((element) => ({
        element,
        code: element.closest("[data-code-block]")?.querySelector("pre > code")?.textContent ?? "",
      }));
    setSlots(found);
  }, [hostId, docKey]);

  return (
    <>
      <template ref={markerRef} data-code-copy-island="" />
      {slots.map(({ element, code }, index) =>
        createPortal(<CodeCopyButton code={code} />, element, `${hostId}:${index}`)
      )}
    </>
  );
}

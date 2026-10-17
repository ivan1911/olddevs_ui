"use client";

import type { Editor } from "@tiptap/core";

interface Band {
  top: number;
  bottom: number;
}

/**
 * Show the current search match.
 *
 * WHY NOT `tr.scrollIntoView()`. ProseMirror scrolls to the selection only when the
 * browser selection is inside the Document. While the user moves between matches, focus
 * stays in the search field, so that scroll was silently skipped. The panel therefore
 * scrolls the highlight node itself.
 *
 * FREE AREA — the window narrowed by the scrollable ancestors of the match (a field with
 * `maxHeight` or `resizable`, the screen container) and by whatever lies on top of the
 * Document: the sticky Toolbar and the Find panel itself, if it overlaps the match
 * horizontally. If no room is left under them even for one line (a short field with
 * `maxHeight`), the panel is not counted: the match is at least inside the field.
 *
 * A match that is fully visible does not move, so stepping between neighboring lines
 * does not jerk the page. An invisible one is placed in the middle of the free area, as
 * Chrome's find does. Not `scrollIntoView({ block: "center" })`: that centers within the
 * whole scrollable ancestor and puts the match exactly under the Find panel. The shift is
 * distributed along the chain: the field first, the rest goes to the window.
 *
 * @param documentRoot root of the engine's Document (`editor.view.dom`)
 * @param overlays elements on top of the Document: the Find panel and its sticky parent
 */
export function revealCurrentMatch(
  documentRoot: HTMLElement,
  overlays: readonly (Element | null | undefined)[]
): void {
  const match = documentRoot.querySelector<HTMLElement>(".rte-search-current");
  if (!match) return;
  const rect = match.getBoundingClientRect();

  const scrollers: Element[] = [];
  const area: Band = { top: 0, bottom: window.innerHeight };
  for (let node = match.parentElement; node && node !== document.body; node = node.parentElement) {
    if (!/auto|scroll|hidden/.test(getComputedStyle(node).overflowY)) continue;
    if (node.scrollHeight <= node.clientHeight) continue;
    scrollers.push(node);
    const box = node.getBoundingClientRect();
    area.top = Math.max(area.top, box.top);
    area.bottom = Math.min(area.bottom, box.bottom);
  }
  scrollers.push(document.scrollingElement ?? document.documentElement);

  const free: Band = { ...area };
  for (const overlay of overlays) {
    if (!overlay) continue;
    const box = overlay.getBoundingClientRect();
    if (box.height > 0 && box.left < rect.right && rect.left < box.right) {
      free.top = Math.max(free.top, box.bottom);
    }
  }
  const band = free.bottom - free.top >= rect.height ? free : area;

  if (rect.top >= band.top && rect.bottom <= band.bottom) return;
  let delta = (rect.top + rect.bottom) / 2 - (band.top + band.bottom) / 2;
  for (const scroller of scrollers) {
    if (Math.abs(delta) < 1) break;
    const before = scroller.scrollTop;
    scroller.scrollTop = before + delta;
    delta -= scroller.scrollTop - before;
  }
}

/** What lies on top of each field's Document: the Find panel while it is open. */
const overlayProviders = new WeakMap<Editor, () => readonly (Element | null | undefined)[]>();
const frames = new WeakMap<Editor, number>();

/**
 * The Find panel reports what lies on top of the Document while it is open. The Tool
 * commands (`next`, `previous`, `setQuery`) live outside the panel but must skip those
 * elements the same way. Returns the unregister function.
 */
export function registerSearchOverlays(
  editor: Editor,
  overlays: () => readonly (Element | null | undefined)[]
): () => void {
  overlayProviders.set(editor, overlays);
  return () => {
    if (overlayProviders.get(editor) === overlays) overlayProviders.delete(editor);
  };
}

/**
 * Show the current match one frame later, once the panel has been laid out. Calls for
 * the same field within one frame are merged into a single scroll: the panel and a Tool
 * command that fire on the same move do not scroll twice. Focus is left alone.
 */
export function scheduleRevealMatch(editor: Editor): void {
  cancelAnimationFrame(frames.get(editor) ?? 0);
  frames.set(
    editor,
    requestAnimationFrame(() => {
      frames.delete(editor);
      if (editor.isDestroyed) return;
      revealCurrentMatch(editor.view.dom, overlayProviders.get(editor)?.() ?? []);
    })
  );
}

/** Cancel a pending scroll (the panel was closed or the field was torn down). */
export function cancelRevealMatch(editor: Editor): void {
  cancelAnimationFrame(frames.get(editor) ?? 0);
  frames.delete(editor);
}

import type { RefObject } from "react";
import type { ToolList } from "./toolDescriptor.js";

/*
  The selector hook cannot tell when the `ref` gets an engine: the Editor creates it after the
  screen's first render and re-renders itself, while the screen does not. So subscriptions live on
  the `ref` object itself, which exists from the first render, and the Editor reports an engine
  change through it.

  The module is split out of `handle.ts` and knows nothing about the engine: `RichTextToc` also
  needs to subscribe to an engine change, and it does not need Tiptap in its bundle.
*/

const watchers = new WeakMap<object, Set<() => void>>();

/** A hook's subscription to an engine change in the Editor bound to this `ref`. */
export function watchHandleEditor(ref: RefObject<unknown>, listener: () => void): () => void {
  let set = watchers.get(ref);
  if (!set) watchers.set(ref, (set = new Set()));
  set.add(listener);
  return () => void set.delete(listener);
}

/** The Editor reports: the engine on this `ref` appeared or changed. */
export function notifyHandleEditor(ref: unknown): void {
  if (typeof ref !== "object" || ref === null) return;
  watchers.get(ref)?.forEach((listener) => listener());
}

/**
 * The kit's signals for `useRichTextToolState`: what changes not through an engine transaction but
 * through a Tool's UI, so it cannot be read from the engine. The Editor puts them by `ref`, like the
 * engine message, and the hook is notified by the same subscription.
 */
export interface ToolSignals {
  /** The Tool set of this Editor: whether a Tool is present and with which options. */
  tools?: ToolList;
  /** The search panel is open (React state in `RichTextEditor`). */
  searchOpen?: boolean;
  /** The field fills the window (React state in `RichTextEditor`, ADR-0082). */
  fullscreenOpen?: boolean;
  /** Index of the current Table of contents section (computed by `TocCore` from the scroll position). */
  tocAt?: number;
}

const signals = new WeakMap<object, ToolSignals>();

/**
 * The Editor reports Tool signals: merged with the previous ones; subscribers get the same
 * notification as for an engine change.
 */
export function publishToolSignals(ref: unknown, next: ToolSignals): void {
  if (typeof ref !== "object" || ref === null) return;
  signals.set(ref, { ...signals.get(ref), ...next });
  notifyHandleEditor(ref);
}

/**
 * The Editor is unmounted: its signals go with it. Otherwise they would outlive it in the table keyed
 * by `ref`, and the hook would return a snapshot of an Editor that no longer exists (and a new Editor
 * under the same `ref` would start with someone else's signals). Subscribers get a notification: a
 * component that does not re-render by itself on unmount learns about it only this way.
 */
export function clearToolSignals(ref: unknown): void {
  if (typeof ref !== "object" || ref === null || !signals.delete(ref)) return;
  notifyHandleEditor(ref);
}

/** Tool signals of the Editor bound to `ref`. */
export function toolSignals(ref: object): ToolSignals {
  return signals.get(ref) ?? {};
}

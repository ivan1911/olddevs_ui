"use client";

import { devError } from "../../lib/dev-warn.js";

/*
  Loaders of Extensions (ADR-0058, items 1.3 and 11.3–11.6).

  The promise is cached on the loader function itself, not on the Editor: a second Editor on a
  page with the same Tool waits for nothing and does not call the loader. A load that failed stays
  failed in the cache, otherwise every re-render would call it again; only the "Retry" button
  (`retry`) calls it anew. The mechanism is shared: a built-in Tool with lazy Extensions puts its
  own loader into the same field of its description (`ToolDescriptor.load`).
*/

/** Loader of Extensions: a function with a dynamic import. */
export type ToolLoader = () => Promise<unknown>;

/** The state of one load: the promise never rejects; the outcome is in `done` or `failed`. */
export interface ToolLoad {
  promise: Promise<void>;
  value?: unknown;
  done?: true;
  failed?: true;
}

const LOADS = new WeakMap<ToolLoader, ToolLoad>();

/** Start the loader if it has not been called yet, or if it failed and this is a retry. */
export function startLoad(loader: ToolLoader, retry?: boolean): ToolLoad {
  let load = LOADS.get(loader);
  if (!load || (retry && load.failed)) {
    const next: ToolLoad = (load = {} as ToolLoad);
    next.promise = new Promise((resolve) => resolve(loader())).then(
      (value) => {
        next.value = value;
        next.done = true;
      },
      (error: unknown) => {
        next.failed = true;
        devError("RichTextEditor: a tool loader failed", error);
      }
    );
    LOADS.set(loader, next);
  }
  return load;
}

/** What the loader returned; `undefined` until the load finishes. */
export const loaded = (loader: ToolLoader): unknown => LOADS.get(loader)?.value;

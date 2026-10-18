"use client";

// Type only: a static import of the module would pull the chunk into the start bundle.
import type * as FootnotesChunkModule from "./footnotesChunk.js";
import { loaded } from "../../core/toolLoader.js";

/*
  The Loader of the footnotes chunk (ADR-0058, item 11.1) and the way to read what it returned. It
  is a module of its own, so that Markdown (`core/markdown.ts`) and the Tool state hook can ask for
  the chunk without importing the Tool's description, and the descriptor (`footnoteTool.ts`) does
  not import them.
*/

type FootnotesChunk = typeof FootnotesChunkModule;

/** One function per module: the Loader's promise is cached on the function itself (`toolLoader.ts`). */
export const loadFootnotes = () => import("./footnotesChunk.js");

/**
 * The footnotes chunk, if it has already loaded. An Editor whose Schema has footnotes is created after
 * the Loader, so wherever a live Document with footnotes asks for it, the chunk is there; `undefined`
 * only before that, which is when the Commands answer `false`.
 */
export const footnotesChunk = (): FootnotesChunk | undefined =>
  loaded(loadFootnotes) as FootnotesChunk | undefined;

"use client";

/*
  Lazy chunk of Block selection (ADR-0058, item 11.1; ADR-0077): the extension with its keys,
  decorations and announcements, and the moves it dispatches. The Loader of the `blockSelection`
  Tool (`blockSelectionTool.ts`) loads it. Nothing imports this module statically, or `basic`
  would pay for it. The `BlockSelection` class and the Block unit stay in the core: the Block
  handle reads them in every Editor.
*/
export { BlockSelectionExtension } from "./blockSelectionExtension.js";

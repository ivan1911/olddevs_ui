/**
 * Lightweight entry point `@olddevs/ui/editor/highlight`: code highlighting without
 * the Editor, and nothing else.
 *
 * - `highlightCodeBlocks` — server-side highlighting of the code Blocks in a saved
 *   Document for `RichTextView` (ADR-0051).
 * - `highlightCodeNodes` — tokens as React nodes for the `children` of `CodeView`
 *   (ADR-0052).
 *
 * WHY A SEPARATE ENTRY POINT, AND NOT A `highlight` PROP OF `RichTextView` OR A
 * `language` PROP OF `CodeView`. Highlighting pulls in lowlight, the highlight.js
 * core and eight grammars, 22.6 kB gzipped. An import cannot be conditional: a prop
 * flag would keep them in the component's module graph at all times, and displaying
 * a Document would grow from 2 kB to 23 kB even where highlighting is off. Here the
 * highlighter is pulled in only by whoever imports it, usually the server, and the
 * components stay tiny: they receive already highlighted HTML or nodes.
 * The module graph of the entry point is guarded by `tests/editor-highlight-entry.test.ts`.
 *
 * There is no `"use client"` directive: the module only re-exports server-safe
 * functions.
 */
export { highlightCodeBlocks } from "./features/code/highlight.js";
export { highlightCodeNodes } from "./features/code/highlightNodes.js";

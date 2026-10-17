/**
 * The lightweight entry point `@olddevs/ui/editor/schema`: the Editor's Schema as data,
 * sanitizing against it (`sanitizeRichText` with the consumer's DOMPurify), and the closed
 * config for DOMPurify, and nothing more.
 *
 * WHY SEPARATE FROM `@olddevs/ui/editor`. Sanitizing HTML is the consumer server's job
 * (ADR-0050), and a Node process that needs only one config needs neither React nor Tiptap.
 * The `./editor` entry re-exports the Editor together with the engine, and without a bundler
 * (plain Node, a worker, a migration script) nobody drops the excess. Here the module graph
 * contains only `schema.ts`: the data and the function over it. Guarded by
 * `tests/editor-schema-entry.test.ts`.
 *
 * Custom Tools (ADR-0058, item 2.3) come here as the `tools` array in `sanitizeRichText` and
 * `richTextSchema`: only the Schema rules are read from the description (`customTool.ts`, also
 * without the engine), and Extensions are not touched. A custom Tool's description with a Text
 * card is also assembled on the server, which is why its helper `markRange` (a function over the
 * state, with Tiptap only as a type) is exported here too.
 *
 * The same names are still exported by `@olddevs/ui/editor`: this is not a move but a second,
 * shorter path to the same values. The list of names here is explicit, so that a new export of
 * `schema.ts` reaches the public entry by decision, not by accident.
 *
 * There is no `"use client"` directive, as in the other re-export entries.
 */
export {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  richTextSchema,
  sanitizeRichText,
} from "./core/schema.js";
export { markRange } from "./core/customTool.js";
export type {
  RichTextAttributeHookEvent,
  RichTextCustomBlockRules,
  RichTextCustomMarkRules,
  RichTextPurifier,
  RichTextSanitizeConfig,
  RichTextSchema,
} from "./core/schema.js";

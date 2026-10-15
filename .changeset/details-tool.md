---
"@olddevs/ui": minor
---

`RichTextEditor` gets the `details` Tool: a collapsible Block made of a title and content, on the Details extension from Tiptap (there was no requesting screen at release, ADR-0048, so the API follows Tiptap).

- **`details` is now in the `full` Preset, so every screen on the default Preset gets a "Collapsible block" item in the Insert menu and the Block handle's "Add ›", and `<details>` in saved or pasted HTML is now read as a collapsible Block instead of being unwrapped into paragraphs.** The saved HTML of every existing Document does not change; `basic` is unchanged. To keep the old behavior pass `tools={RICH_TEXT_PRESETS.full.filter((name) => name !== "details")}`. Install `@tiptap/extension-details` next to the other Tiptap packages (the install command on the RichTextEditor page has it).
- The HTML is the kit's `details` and `summary` tags plus `div[data-type="detailsContent"]` around the content. `tool("details", { persist: true })` writes the Block's open state into the Document as `open`; by default it does not, as in Tiptap, so a Block opened while editing is not published open. In `RichTextView` the Block is a native `details`: it opens without JavaScript and the engine.
- `sanitizeRichText` lets `details`, `summary` and the content wrapper through only in that shape (`open` only empty and only on `details`). In Markdown the Block is raw HTML, `<details><summary>…</summary>` with Markdown inside, and `setMarkdown` reads it back. Without the Tool the Block unwraps: the title becomes a paragraph and the content Blocks follow.
- New public bits: the `DetailsToolOptions` type, the `DetailsIcon` icon, and the `editor.details`, `editor.unwrapDetails` and `editor.detailsToggle` messages.

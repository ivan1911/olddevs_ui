---
"@olddevs/ui": minor
---

`RichTextEditor` gets the `toc` Tool: the table of contents of `RichTextToc` in the Editor's left gutter.

- Switch it on by name, `tools={[...RICH_TEXT_PRESETS.full, "toc"]}`. It is in neither Preset, so no existing screen changes its layout; `RICH_TEXT_PRESETS.full` is now every built-in Tool except `toc`.
- The gutter appears with the second heading and goes away with it. The strip lines up with the first heading and sticks under the fixed Toolbar, or to the top of a field with `maxHeight`.
- A jump while editing puts the caret at the end of the heading; in `readOnly` it focuses the heading, as `RichTextToc` does.

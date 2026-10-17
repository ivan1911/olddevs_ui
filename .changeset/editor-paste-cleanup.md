---
"@olddevs/ui": minor
---

Add the `pasteCleanup` Editor Tool, in both Presets: a paste from Word, Excel, Google Docs, Google Sheets and SharePoint keeps its meaning before the Schema reads it. Word lists stay lists (with nesting and `start`) instead of paragraphs with typed numbers, a highlight becomes the palette marker of the nearest hue, bold, italic and alignment of Excel cells survive, Word bookmarks, `<o:p>` and stray breaks are removed, and a Word paragraph border becomes a divider. HTML from other sources is pasted exactly as before, and a text color is still not mapped to the palette. The visible change: a paste from these applications into an Editor with `full` or `basic` gives different, cleaner HTML; leave `pasteCleanup` out of an exact `tools` list to keep the old behavior.

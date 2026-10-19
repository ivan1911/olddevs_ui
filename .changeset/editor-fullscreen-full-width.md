---
"@olddevs/ui": patch
---

`RichTextEditor`: in fullscreen mode the Document is now a 60rem column instead of about 72 characters, which was narrower than the field on the page. The new "Full width" item of the "…" menu, shown only while the field is in fullscreen, spreads the Document across the whole window. The `fullscreen` Tool gets the `fullWidth` option, the `fullWidth` state field and the `toggleFullWidth()` command, and the message catalogs get `editor.fullWidth`.

---
"@olddevs/ui": patch
---

`RichTextEditor`: every built-in Tool is now defined the same way as a custom one, as a single internal descriptor, and the old per-name registries are gone. Nothing visible changes: the saved HTML, mark nesting, keyboard shortcuts, the shortcut reference, menu and toolbar order, and the bundle budgets stay the same. The descriptor modules add about 1.3 kB of raw code: the Editor's own start code grows by about 0.1 kB gzip, and the start with the Tiptap engine by about 1 kB gzip, well within the budgets; the import-cost table in the getting-started guide is updated.

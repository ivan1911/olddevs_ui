---
"@olddevs/ui": patch
---

`RichTextEditor`: every built-in Tool is now defined the same way as a custom one, as a single internal descriptor, and the old per-name registries are gone. Nothing visible changes: the saved HTML, mark nesting, keyboard shortcuts, the shortcut reference, menu and toolbar order, and the bundle budgets stay the same. The kit code that starts the Editor grows by about 0.1 kB gzip.

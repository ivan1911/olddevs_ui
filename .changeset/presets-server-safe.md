---
"@olddevs/ui": patch
---

`RICH_TEXT_PRESETS` from `@olddevs/ui/editor` can be spread in a server component: `tools={[...RICH_TEXT_PRESETS.full, tool("search")]}` built in a server module no longer fails `next build` with `RICH_TEXT_PRESETS.full is not iterable`.

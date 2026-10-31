---
"@olddevs/ui": patch
---

Add a resettable integrated chat recipe with one text/voice history, streaming Markdown, operations and sources. Preserve reading and draft state across resize, interruption and delayed acceptance; keep completed Markdown bodies stable while editing the next draft.

Keep transcript following through queued scroll events when Return or Markdown changes its bounds, while immediate manual scrolling still pauses following.

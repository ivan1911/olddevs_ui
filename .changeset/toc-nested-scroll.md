---
"@olddevs/ui": patch
---

`RichTextToc`: a jump no longer scrolls the whole page when the Document sits in its own scrollable area and the page has no sticky header (no `--topbar-h`, or whatever `offsetVar` names). Before, the page moved together with the area; now only the nearest scrollable area moves, and the heading stops at its top edge, below the heading's `scroll-margin-top`. The window is scrolled only when the Document has no scrollable area around it. A jump under a sticky header and the `toc` Tool of `RichTextEditor` behave as before.

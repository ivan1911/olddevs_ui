---
"@olddevs/ui": minor
---

`RichTextToc` in `@olddevs/ui/editor` is a table of contents for a long Document next to `RichTextView` or a `readOnly` `RichTextEditor`:

- Collapsed, it is a strip of strokes, one per heading, with the current section highlighted while the page scrolls. Hovering the strip opens the list of headings; a click scrolls to the heading and moves focus to it, and the list stays open until the pointer leaves.
- Headings come from the DOM of `target`, a ref to the View or the Editor's handle: `h1`–`h4` at the top level and inside Wrappers, not in Layout columns or custom Blocks. With fewer than two headings nothing renders.
- No anchors: the address does not change and the Document gets no `id`s. `offsetVar` (default `--topbar-h`) puts the heading under a sticky header, as in ADR-0016.
- `listWidth` sets the width of the list (default 240px); long titles end with an ellipsis. When there is no room to the left of the text, the strip hides itself.
- New message `editor.toc`: "Table of contents", «Оглавление» in `ru`.

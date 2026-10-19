---
"@olddevs/ui": patch
---

`RichTextEditor`: Block selection takes Blocks from different places. In the mode (`Esc` or "Select"), `Cmd+click` on a Mac and `Ctrl+click` elsewhere add a Block from anywhere in the Document to the set or take it out; `Shift+click` and `Shift+↑/↓` add a row to the set. `Backspace`, `Delete`, copy, cut and "Format ›" act on every Block of the set; moving, duplicating, "Wrap in ›" and paste are unavailable over a set with gaps, and the screen reader hears why a paste did nothing. New message catalog string `editor.blocksPasteScattered`. The `blockSelection` state `count` counts every Block of the set.

The "Select" item of the Block handle menu moves down, above "Move up": it leads the items that act on the Block as a whole.

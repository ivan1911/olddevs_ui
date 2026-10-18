---
"@olddevs/ui": minor
---

Editor, extension: Block selection. The new `blockSelection` Tool, in `full` (not in `basic`), selects several Blocks whole, as in Notion: `Esc` in the text selects the current Block, `Shift+↑/↓` and `Shift+click` grow the selection, and then `Backspace`, `Delete`, `⌘C`, `⌘X`, `⌘V` (replaces the Blocks), `⌘⇧D`, `⌥⇧↑/↓` and `⌘/` act on the Blocks. The Blocks are highlighted whole, the screen reader hears the count and the result of each action, and the state is `{ count }` with the commands `selectCurrent()` and `clear()`. The Block handle "⋮" now stays when a text selection touches several Blocks, in every Editor: its menu (Format, the new Wrap in › Wrapper, quote or collapsible block, Up, Down, Duplicate, Delete) acts on all of them in one edit.

The visible change in `full`: **in a field inside a `Dialog` or a `Drawer` the first `Escape` in the text now selects the Block, and the window closes on the second `Escape`**, like any nested layer. A screen where this gets in the way removes the Tool from `tools` (`RICH_TEXT_PRESETS.full` without `"blockSelection"`); `basic` and a field with an explicit `tools` list that does not name it keep one `Escape`. The Block handle menu also gains a "Select" item with the Tool, and the Keyboard shortcuts popover gains the rows "Select block" and "Extend selection".

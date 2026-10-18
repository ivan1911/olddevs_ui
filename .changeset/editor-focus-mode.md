---
"@olddevs/ui": minor
---

Editor, extension: focus mode. The new `focus` Tool, in `full` (not in `basic`), shows everything outside the Block with the caret faint, at 40% opacity, as in iA Writer and Ulysses. The Block is the unit of Block selection (in a list, the item; a table as a whole); list markers, images, videos, code Blocks, toned Wrappers, Details Blocks and tables go faint with it, and the dimmed text is below 4.5:1 on purpose, and there is no dimming without focus in the Document, over a Block selection and in a `readOnly` field. It is display only: `value`, `onChange`, the saved HTML and the edit history do not change. The mode is off until the author turns it on with the new "Focus mode" checkbox item in the "…" menu (the fixed Toolbar and the Bubble menu) or the `tool("focus", { enabled: true })` option. The state is `{ enabled }` and the command is `toggle()`.

The visible change in `full`: the "…" menu of the Toolbar gains the "Focus mode" item, and the new `FocusModeIcon` joins `@olddevs/ui/icons`. A screen that does not want the item removes the Tool from `tools`.

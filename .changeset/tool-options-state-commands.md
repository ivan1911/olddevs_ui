---
"@olddevs/ui": minor
---

Editor, extension: every Tool of `RichTextEditor` now has three typed parts, like `options`, `storage` and `commands` of a Tiptap extension: options, state and commands. They follow the kit's semver, not the Tiptap major.

- **Options.** `tool(name, options)` configures a built-in Tool right in `tools`, and the entry switches the Tool on without its name. `tool("toc", { offsetVar: "--header-h", levels: [2, 3], listWidth: 280 })` takes the sticky header height from your own variable, shows only H2–H3 and sets the list width; `tool("search", { matchCase: true })` opens Find with the "Match case" flag on. Only `search` and `toc` have options for now. Options are read once, when the engine is created, so remount the Editor with a `key` to change them.
- **State.** `useRichTextToolState(ref, "search")` returns a data snapshot (is the panel open, the query, the number of matches, the current match), and `useRichTextToolState(ref, "toc")` returns the headings and the current section, so a "3 of 12" counter in the Status line or a navigation next to the field no longer needs the raw Tiptap editor. The hook returns `null` before mount, on the server and without the Tool; the screen re-renders only when the snapshot changes.
- **Commands.** `handle.tool("search")?.open({ query })`, `close()`, `setQuery()`, `next()`, `previous()`, `replace()`, `replaceAll()` and `handle.tool("toc")?.jumpTo(index)` return a `boolean`; `handle.tool(name)` is `null` when the Tool is not in `tools`.
- **Custom Tools.** `defineTool({ name, defaults, create, state, commands })` describes a Tool with options, state and commands in the same shape as `CustomTool`, and `tool(definition, options)` configures it. The types of options, state and commands live in the `RichTextTools` interface, where your own Tool adds itself with `declare module "@olddevs/ui/editor"`; a Tool that is not added still works, with `unknown` types. A plain `CustomTool` object keeps working.
- `RichTextToc` takes `levels`, the same prop as the Tool option.
- **Deprecated:** `handle.openSearch()` is replaced by `handle.tool("search")?.open()`. It still works, warns once in development and is removed in 5.0. See `docs/api/migration-notes.md`.

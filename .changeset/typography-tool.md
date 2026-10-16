---
"@olddevs/ui": minor
---

`RichTextEditor` gets the `typography` Tool: replacements while typing, on the Typography extension from Tiptap (there was no requesting screen at release, ADR-0048, so the API follows Tiptap).

- **`typography` is in no Preset, neither `full` nor `basic`: nothing changes for existing screens, and a screen switches it on with `tools={[...RICH_TEXT_PRESETS.full, "typography"]}` or a `tool("typography", …)` entry.** Install `@tiptap/extension-typography` next to the other Tiptap packages (the install command on the RichTextEditor page has it).
- Every Tiptap rule is on: `--` becomes a dash, `...` an ellipsis, `->` and `<-` arrows, `(c)`, `(tm)`, `(sm)`, `(r)` signs, `1/2 `, `1/4 `, `3/4 ` fractions, `+/-`, `!=`, `<<`, `>>`, `2x3`, `^2`, `^3` and single quotes. A straight `"` becomes a quote of the message catalog language: guillemets with nested low-9 quotes under the Russian catalog (`"a "b" c"` → «a „b“ c»), curly quotes under the English one.
- Options are `tool("typography", { quotes, … })`: `quotes` is `"auto"` (by the catalog, default), `"ru"` or `"en"`, and every Tiptap rule name is an option that takes `false` (switch the rule off) or a replacement string. An explicit `openDoubleQuote` or `closeDoubleQuote` beats `quotes`.
- Only input rules: the Schema, the sanitizer and Markdown do not change, and `value` gets plain characters. Rules do not fire inside the `code` Mark or a code Block, and `Backspace` right after a replacement brings the typed characters back.
- New public bits: the `TypographyToolOptions` type and the `editor.typographyQuotes` message (`"ru"` or `"en"`: the quote set of the catalog; custom catalogs of other languages may leave it out or set `quotes` explicitly).

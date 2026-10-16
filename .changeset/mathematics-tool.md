---
"@olddevs/ui": minor
---

`RichTextEditor` gets the `mathematics` Tool: LaTeX formulas, inline and block, on the Mathematics extension from Tiptap and KaTeX (there was no requesting screen at release, ADR-0048, so the API follows Tiptap; the decision about KaTeX is ADR-0070).

- **`mathematics` is in no Preset, neither `full` nor `basic`: nothing changes for existing screens, and a screen switches it on with `tools={[...RICH_TEXT_PRESETS.full, "mathematics"]}` or a `tool("mathematics", …)` entry.** Install `@tiptap/extension-mathematics` and `katex` next to the other Tiptap packages (the install command on the RichTextEditor page has them; `katex` is pinned to `0.18.10` because the Tiptap 3.32 extension accepts only `^0.18` and 0.18.11 is withdrawn).
- Two Slash menu items, "Formula" and "Block formula", open a Popover with a LaTeX field and a live preview. A click or `Enter` on a formula (`Shift+→` selects an inline one from the keyboard) edits it in the same Popover. Invalid LaTeX shows the KaTeX error in the field and never changes the Document.
- The HTML holds only the source: `span[data-type="inline-math"]` and `div[data-type="block-math"]` with `data-latex`, as in Tiptap. `sanitizeRichText` lets exactly this pair through; `<` is allowed in `data-latex` and nowhere else. The atom text, the `maxLength` counter and copying see the LaTeX; Markdown is `$…$` and `$$…$$`.
- KaTeX and its stylesheet load lazily, in the Tool's chunk, only for an Editor that names `mathematics`; the Skeleton shows the LaTeX source in monospace until then. The bundler takes the CSS and the fonts from the consumer's `katex` package, so there is no extra step. Without the Tool a formula from `value` or a paste stays in the text as `$…$` instead of being lost.
- `RichTextView` draws formulas with a lazy Island that is mounted only for a Document that has them; without JS the source LaTeX is visible. There is no new prop and no server helper.
- Options are `tool("mathematics", { macros, strict })`; new public bits are the `MathematicsToolOptions` type, the `FormulaIcon` and `BlockFormulaIcon` icons and nine `editor.math*` messages.

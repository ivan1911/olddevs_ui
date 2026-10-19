# @olddevs/ui

## 4.12.1

### Patch Changes

- c18dd0e: `RichTextEditor`: Block selection takes Blocks from different places. In the mode (`Esc` or "Select"), `Cmd+click` on a Mac and `Ctrl+click` elsewhere add a Block from anywhere in the Document to the set or take it out; `Shift+click` and `Shift+↑/↓` add a row to the set. `Backspace`, `Delete`, copy, cut and "Format ›" act on every Block of the set; moving, duplicating, "Wrap in ›" and paste are unavailable over a set with gaps, and the screen reader hears why a paste did nothing. New message catalog string `editor.blocksPasteScattered`. The `blockSelection` state `count` counts every Block of the set.

  The "Select" item of the Block handle menu moves down, above "Move up": it leads the items that act on the Block as a whole.

  `RichTextEditor`: fullscreen mode and focus mode get shortcuts. `Ctrl/⌘+Shift+F` expands the field to the whole window and collapses it, `Ctrl/⌘+Shift+J` turns the focus mode on and off; both work with focus in the Document, show in the shortcut reference (a new "view" group) and as hints on the "…" menu items. `Esc` still collapses the fullscreen layer.

## 4.12.0

### Minor Changes

- 7c72c9e: Editor, extension: Block selection. The new `blockSelection` Tool, in `full` (not in `basic`), selects several Blocks whole, as in Notion: `Esc` in the text selects the current Block, `Shift+↑/↓` and `Shift+click` grow the selection, and then `Backspace`, `Delete`, `Ctrl/⌘+C`, `Ctrl/⌘+X`, `Ctrl/⌘+V` (replaces the Blocks), `Ctrl/⌘+Shift+D`, `Alt+Shift+↑/↓` and `Ctrl/⌘+/` act on the Blocks. The Blocks are highlighted whole, the screen reader hears the count and the result of each action, and the state is `{ count }` with the commands `selectCurrent()` and `clear()`. The Block handle "⋮" now stays when a text selection touches several Blocks, in every Editor: its menu (Format, the new Wrap in › Wrapper, quote or collapsible block, Up, Down, Duplicate, Delete) acts on all of them in one edit.

  The visible change in `full`: **in a field inside a `Dialog` or a `Drawer` the first `Escape` in the text now selects the Block, and the window closes on the second `Escape`**, like any nested layer. A screen where this gets in the way removes the Tool from `tools` (`RICH_TEXT_PRESETS.full` without `"blockSelection"`); `basic` and a field with an explicit `tools` list that does not name it keep one `Escape`. The Block handle menu also gains a "Select" item with the Tool, and the Keyboard shortcuts popover gains the rows "Select block" and "Extend selection".

  The Tool's keys, highlighting and announcements are a lazy chunk behind the Tool's Loader, like the code block and the table: an Editor that names `blockSelection` shows the Skeleton until it arrives (in `full` it loads together with their chunks), and `basic` never loads it.

- 848afbb: Editor, extension: Date mention. The new `date` Tool, in `full` (not in `basic`), puts a date inside a line of text as an inline Atom, `<time datetime="…">text</time>`. The Slash menu item "Date" opens a Popover with the kit's `Calendar` (focus on today, so `Enter` inserts today) and a "Time" switch with a time field; a click or `Enter` on a mention edits it ("Remove time", "Delete date"). The value is `YYYY-MM-DD` or, with a time, `YYYY-MM-DDTHH:MM±HH:MM` with the author's UTC offset; a date without a time has no zone. The text is written in the author's locale when the mention is inserted or edited, so `RichTextView` shows it as it is, with no JS and no hydration difference. The calendar and the Popover are a lazy chunk. The option is `tool("date", { format })` (an `Intl.DateTimeFormatOptions` object for the date), the command is `handle.tool("date")?.insert(value?)`, and the new types are `DateToolOptions` and `DateToolCommands`, the icon is `DateMentionIcon`, and seven `editor.date*` strings join the message catalog. The Schema and `sanitizeRichText` now allow `time[datetime]` with a strict, calendar-checked value; someone else's `<time>` in that form becomes a mention, and in any other form stays text. In Markdown a mention is its text and the machine value is lost.
- 968aaae: Editor, extension: focus mode. The new `focus` Tool, in `full` (not in `basic`), shows everything outside the Block with the caret faint, at 40% opacity, as in iA Writer and Ulysses. The Block is the unit of Block selection (in a list, the item; a table as a whole); list markers, images, videos, code Blocks, toned Wrappers, Details Blocks and tables go faint with it, and the dimmed text is below 4.5:1 on purpose, and there is no dimming without focus in the Document, over a Block selection and in a `readOnly` field. It is display only: `value`, `onChange`, the saved HTML and the edit history do not change. The mode is off until the author turns it on with the new "Focus mode" checkbox item in the "…" menu (the fixed Toolbar and the Bubble menu) or the `tool("focus", { enabled: true })` option. The state is `{ enabled }` and the command is `toggle()`.

  The visible change in `full`: the "…" menu of the Toolbar gains the "Focus mode" item, and the new `FocusModeIcon` joins `@olddevs/ui/icons`. A screen that does not want the item removes the Tool from `tools`.

- 1262baa: Editor, extension: footnotes. The new `footnotes` Tool, in `full` (not in `basic`), puts a reference with an automatic number into the text and collects the footnotes' texts in a list at the end of the Document. The "Footnote" item of the Slash menu and of the "…" menu inserts a reference at the caret, makes its footnote and moves the caret into it. The kit keeps the list: a footnote exists while its reference does, deleting the reference deletes the footnote in the same edit (`Ctrl/⌘+Z` brings back both), and moving text renumbers. A click or `Enter` on a reference goes to its footnote, the footnote's number button or `Enter` in it goes back, and in `RichTextView` the same jumps are plain anchors that need no JavaScript. An Editor and a `RichTextView` of the same Document on one page do not collide: the Editor's own DOM carries the ids with a prefix of its instance, and the saved HTML and the View keep `fn-<key>`. A footnote is one paragraph of text with Marks and links. Copying a reference carries its footnote's text, and a paste makes a new footnote. The Table of contents does not show a reference's number, and `getText()` and `maxLength` see `[1]`. Markdown is GFM (`[^1]` and `[^1]: text`), losing no text in either direction. The state is the footnotes in order with the current one, and the commands are `insert()`, `goToFootnote(n)` and `goToReference(n)`.

  The HTML is `sup[data-footnote-ref]` with an anchor and `section[data-block="footnotes"]` with an `ol`. These are the first `id` and the first `href="#…"` in the Schema: `sanitizeRichText` keeps them only as `fn-<key>` and `fnref-<key>`, in the footnote markup, and the `link` Tool still takes no `#`. A server that sanitizes with `sanitizeRichText` (or with `richTextSanitizeConfig()` and its hooks) needs no change. A server with its own allowlist built from `RICH_TEXT_SCHEMA` may take the new `section` tag, but must not copy `id`, `role`, `aria-label` or `data-footnote-ref` as plain allowed attributes: `RICH_TEXT_SCHEMA.attributes` lists them as data, while the narrow rule (one tag, one place, one shape of value) exists only in the hooks of `sanitizeRichText`, so a plain `id` on `li` and `a` would let any author's `id` through and open the page to DOM clobbering. Either sanitize with `sanitizeRichText`, or leave these four out: the footnotes then keep their text and lose the jumps. The other attributes added by this release's capabilities (`time[datetime]`, `col[data-width]`, `figure[data-align]`, `img[data-width]`) carry no script, address or style and are safe as plain data; `span[lang]` is inert too, but a plain copy lets any tag and any string through, so the hook is the better place for it. The visible change in `full`: the Slash menu and the "…" menu gain a "Footnote" item; a screen that does not want it removes the Tool from `tools` (`RICH_TEXT_PRESETS.full` without `"footnotes"`). The Tool is a lazy built-in: its nodes, keys and Markdown rules arrive as a chunk through the Tool's Loader, only to an Editor that has `footnotes` in `tools`, and the Skeleton draws the references and the list from `value` until it arrives.

- 968aaae: Editor, extension: fullscreen mode. The new `fullscreen` Tool, in `full` (not in `basic`), expands the field to the whole window for long work with text. It is a layer of the kit above the page, not the browser's Fullscreen API, so it works inside a `Dialog` or a `Drawer` and on iPhone. The Toolbar is across the top, the Status bar at the bottom, and the Document scrolls itself as a column of about 72 characters; `maxHeight` and `resizable` do not apply in it. It is the same engine, edit history, caret and selection, the page returns to where it was scrolled, and `onFocus` and `onBlur` do not fire. The way in is the new "Fullscreen" checkbox item in the "…" menu (the fixed Toolbar and the Bubble menu); the way out is a visible "Collapse" button at the right edge of the Toolbar (in the corner of the layer when there is no fixed Toolbar) and `Escape`, one level at a time: with `blockSelection` the first `Escape` selects the Block, the next collapses the field, and in a `Dialog` the one after that closes the window. The state is `{ open }`, the commands are `open()`, `close()` and `toggle()`; the screen reader hears "Fullscreen mode on" and "Fullscreen mode off".

  The visible change in `full`: the "…" menu of the Toolbar gains the "Fullscreen" item. A screen that does not want it removes the Tool from `tools` (`RICH_TEXT_PRESETS.full` without `"fullscreen"`).

- 5625c31: Editor, extension: image alignment and text wrapping. An image can now stand at the left or the right edge with the text of the next Blocks wrapping around it, as in Word; the centre stays the default. It is part of the `image` Tool, so there is no new Tool and no Option, and the selected image's panel and its "Edit image" popover gain three toggles (left, centre, right) before the widths. `Ctrl/⌘+Shift+L`, `+E` and `+R` align a selected image instead of the text; with the caret anywhere else they align text as before. The image width presets are now 25, 33, 50, 75 and 100%. Wrapping needs room, so an aligned image is always narrower than its container: choosing Left or Right on an image at its own size or at 100% sets 50% in the same edit, and 100% on an aligned image puts it back in the centre. A Document narrower than 30 rem keeps the image on a line of its own, and a table cell takes no alignment. An aligned image has one resize handle, on the side of the text, that follows the mouse one pixel for one and snaps to 25, 33, 50 or 75%. A heading, table, code block, divider, centred image, Column layout, Wrapper, Details Block, video and the footnote list start below the image. A paste from Word or from a web page keeps the side of a picture (`align`, `float`, Word's `mso-wrap-style`, the WordPress classes `alignleft` and `alignright`), and a width given as a percentage goes to the nearest preset, any other size to 50%. Markdown loses the position, as it loses the width and the caption, and the JSON envelope keeps it. New message catalog strings: `editor.imageAlign`, `editor.imageAlignLeft`, `editor.imageAlignCenter` and `editor.imageAlignRight`.

  The saved HTML can now carry `figure[data-align="left|right"]`, and `img[data-width]` can be `25` or `33`. `sanitizeRichText` allows both, so a server that already sanitizes with it needs no change; a server with its own allowlist built from `RICH_TEXT_SCHEMA` must add `figure[data-align]` and the two widths (`RICH_TEXT_SCHEMA.attributes.figure`, `imageAlignments` and `imageWidths`). The visible change for an existing Document: an image that already carries `data-width="25"` or `"33"` used to lose it and keep its own size, and now it is shown at that width.

- cc5ff0c: Editor, extension: a table's column widths can now be set and are kept in the Document. It is part of the `table` Tool, with no new Tool and no Option, and a saved Document without widths does not change.

  - **The width of a column is a share of the table's width, in steps of 5%.** The saved HTML carries `<colgroup><col data-width="35"><col data-width="35"><col data-width="30"></colgroup>` before the body: one `col` per column, each a multiple of 5 from 5 to 95, and the sum is 100. There is still no `style`. A table with widths fills the Document and follows its width in `RichTextView`, in an email and on a phone; a table without them is sized by its content, as before. A column is never narrower than 6 rem, and then the table scrolls inside itself, as before.
  - **Drag the bar between two columns** (a mouse or a finger) to move the boundary: the bar follows the pointer, and on release it snaps to the nearest 5%. Only the two neighboring columns trade width. A drag is one undo step; the first drag in a table without widths rounds the widths it has on screen first. The bars are for the pointer only and are not in the `Tab` order.
  - **From the keyboard**, "Table ▾ › Column › Wider / Narrower" takes a step of 5% from the neighbor (the "Column" group is named with the current width), and "Table ▾ › Equal columns" and "Fit columns to content" set or remove the widths of the whole table. The result is announced through the Field notice ("Column width: 35%"). New catalog strings: `editor.tableColumnWider`, `editor.tableColumnNarrower`, `editor.tableColumnWidth`, `editor.tableEqualColumns` and `editor.tableFitContent`; new icons `ColumnWiderIcon` and `ColumnNarrowerIcon`.
  - **Inserting and deleting a column keeps the widths**: a new column takes half of the share beside it (rounded to 5%), a deleted column gives its share to the neighbor on the left. Merging, splitting and sorting leave them alone. The engine commands `addColumnBefore`, `addColumnAfter` and `deleteColumn` do the same.
  - **A paste from Word, Excel, Google Docs and Google Sheets turns the widths of the source into shares** (points, pixels and percent are rounded to 5%), and so does any pasted HTML with a `colgroup`. A source without widths, a hidden column and a table of more than 20 columns stay sized by their content.
  - **The Schema and `sanitizeRichText` allow `colgroup` and `col[data-width]`**: `colgroup` only as the first one in a `table`, with 2 to 20 `col`, each a valid share, adding up to 100; otherwise the whole `colgroup` is removed and the table goes back to its content. A server that already sanitizes with `sanitizeRichText` needs no change; a server with its own allowlist must add `colgroup`, `col` and `col[data-width]` or the widths are lost on save. `RICH_TEXT_SCHEMA` gets `tableColumnShares`.
  - Markdown has no widths: `getMarkdown()` keeps the table and drops them. The JSON envelope keeps them (`getJSON()` and `setJSON()` without loss). The JSON `table` node now has the attribute `shares`, `null` or the list of shares.

- 84e094c: Editor, extension: `RichTextEditor` gets the `language` Tool (Text part language, WCAG 3.1.2 Language of Parts): the author marks a piece of text with its language, `<span lang="en">`, so a screen reader reads it by that language's rules and the browser spell-checks and hyphenates it correctly. It is a Mark only; a paragraph in another language is the same Mark over all its text.

  - **`language` is now in the `full` Preset, so the "…" menu of every screen on the default Preset (the fixed Toolbar, the floating Toolbar and the selection menu) gets a "Language ›" submenu.** It lists English and Russian, the page's own language marked "primary", and "Remove language mark". There is no new Toolbar button and no shortcut, so the Toolbar does not get longer. `basic` is unchanged. To drop the item pass `tools={RICH_TEXT_PRESETS.full.filter((name) => name !== "language")}`. The Editor draws a thin dotted underline under a marked fragment; `RichTextView` draws nothing.
  - **The saved HTML can now carry `span[lang]`**, and the Schema keeps it for any BCP 47 tag, not only the languages of the menu: `lang="de"` from another screen or from Word survives. A value that is not a tag loses the Mark and keeps the text. `sanitizeRichText` allows `span[lang]` too, so a server that already sanitizes with it needs no change; a server with its own allowlist must add `span[lang]`.
  - The page's primary language is the `lang` of the field's nearest ancestor (usually `<html lang>`), else the interface locale. A mark with that language is never set: choosing it removes the Mark, and a paste from Word or Google Docs drops every mark in the page's language, whatever its region (`EN-US` on `<html lang="en">`), while keeping every other `lang` (`DE` becomes `de`). Clear formatting and `Ctrl/⌘+\` do not remove a language.
  - With the `typography` Tool, a `"` typed inside an `en…` Mark gives curly quotes and inside a `ru…` Mark guillemets. Markdown has no language: `getMarkdown()` keeps the text and drops the Mark, as it does for a color.
  - `tool("language", { languages })` sets the languages of the submenu (default `["en", "ru"]`). `useRichTextToolState(ref, "language")` gives `{ current, primary }`, and `ref.current?.tool("language")` has `set(language)` and `unset()`. New message catalog strings: `editor.language`, `editor.languagePrimary` and `editor.languageRemove`.

## 4.11.0

### Minor Changes

- 649be59: Add the `pasteCleanup` Editor Tool, in both Presets: a paste from Word, Excel, Google Docs, Google Sheets and SharePoint keeps its meaning before the Schema reads it. Word lists stay lists (with nesting and `start`) instead of paragraphs with typed numbers, a highlight becomes the palette marker of the nearest hue, bold, italic and alignment of Excel cells survive, Word bookmarks, `<o:p>` and stray breaks are removed, and a Word paragraph border becomes a divider. HTML from other sources is pasted exactly as before, and a text color is still not mapped to the palette. The visible change: a paste from these applications into an Editor with `full` or `basic` gives different, cleaner HTML; leave `pasteCleanup` out of an exact `tools` list to keep the old behavior.

### Patch Changes

- 763fae5: Editor: a pasted link keeps its own address when its text looks like an address. A link such as `<a href="https://example.com/docs?page=1#top">example.com/docs</a>` copied from Word or a web page lost its query and anchor (or its whole address when the text named another page), because the paste rule relinked the text. A bare address in pasted text now gets `https://`, like one typed by hand, instead of `http://`.

## 4.10.0

### Minor Changes

- 398cd58: Add the `radius` axis: set `data-radius` to `none`, `small`, `medium` (the default) or `large` on `<html>` or on any element to change the corner shape of the whole kit, the Editor included. Without the attribute nothing changes. The theme registry gains `UI_RADII`, `normalizeRadius` and `UiRadius`; `applyTheme` and `themeInitScript` handle the axis, and the storage format gets a `radius` field. New utilities: `rounded-2xs` and `rounded-pill`. Pills (Badge, Chip, Tag, the Toggle track) follow the preset; circles do not. One visible change in the default look: `SelectionBar` and `ContextualSaveBar` had 14px corners outside the scale and now use the `lg` step, 16px.

## 4.9.1

### Patch Changes

- adffcdc: The English JSDoc of components, hooks, types and functions was reviewed against the Russian originals: kit terms follow the glossary (Source mode, Slash menu, message catalog), Russian-shaped phrasing is rewritten ("renders" instead of "draws", "applies" instead of "works"), and emphasis written in capitals is lowercased. Editor hovers and the `.d.ts` files read as plain English. Comments only: no runtime behavior and no public API changed.

## 4.9.0

### Minor Changes

- 16f94f6: English is now the source of the kit's text. The Reference in `docs/` is English only (the `*.en.md` pairs are gone; the Russian Translation lives on the documentation site), `README.ru.md` is a Translation of `README.md`, and the JSDoc shown in editor hovers and in the `.d.ts` files is English, so the hints are readable for every consumer. The glossary (`docs/glossary.md`) is the English source of the kit's terms. No runtime behavior and no public API changed; the Russian message catalog (`locales/ru`) is unchanged. The `docs:translations` script and `tests/docs-translations.test.ts` are removed, and `tests/i18n-gate.test.ts` now also forbids Cyrillic in `docs/` and `README.md` and counts Russian comments per file (`tests/comment-debt.json`, now empty).

## 4.8.3

### Patch Changes

- 55a1589: The README now states how many components the kit has: 122, counted by the package's exports without the parts of compound components.

## 4.8.2

### Patch Changes

- 18581e7: The link to "Viewing with a carousel in a `Dialog`" in the English Carousel page leads to the section again: in-page links in a Translation use the Original's anchors (ADR-0062). `docs/**/*.en.md` links are now checked against the Original's heading anchors by `tests/docs-translations.test.ts`, so a Latin anchor fails before the release.

## 4.8.1

### Patch Changes

- e32ee38: The "Troubleshooting" link in the English Getting started page leads to the section again: in-page links in a Translation use the Original's anchors (ADR-0062), and the site moves this section to a page of its own.

## 4.8.0

### Minor Changes

- a85c381: React is now the kit's only peer dependency (ADR-0072). The kit brings every other library itself, so the install command becomes `npm install @olddevs/ui react`.

  - **`@internationalized/date`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, `clsx`, `lucide-react`, `react-aria-components`, `sonner` and `tailwind-merge` move from `peerDependencies` to `dependencies`, with the same ranges.** Nothing breaks: an app that already lists them keeps working, and it can drop the lines it does not import itself.
  - `@olddevs/ui/icons` now exports `LucideProvider`. Import it from there rather than from `lucide-react`: lucide comes with the kit, and a provider from a second copy in your app never reaches the kit's icons. Likewise, import `toast` from `@olddevs/ui`, not from `sonner`.
  - An app that uses Radix, `react-aria-components` or `@internationalized/date` directly should keep its range compatible with the kit's. npm no longer stops the install over a mismatch; a mismatch gives the app a second copy, whose layers and contexts the kit's components do not see.

## 4.7.0

### Minor Changes

- 148b998: **The Editor engine moves to Tiptap 3.32.0.** All `@tiptap/*` packages of the install command now take the range `^3.32.0` (was `^3.31.4`); keep them at one version, as before. The command also gains `@tiptap/extension-mathematics` and `katex@0.18.10` for the `mathematics` Tool (ADR-0070): `katex` is pinned because 0.18.11 was published with breaking changes, and the Tiptap extension does not support 0.19 yet.
- f4a8385: `RichTextEditor` gets the `invisibleCharacters` Tool: a checkbox item in the "…" menu of the fixed Toolbar that shows spaces, hard breaks (`Shift+Enter`) and paragraph ends over the Document, on the Invisible Characters extension from Tiptap (there was no requesting screen at release, ADR-0048, so the API follows Tiptap).

  - **`invisibleCharacters` is now in the `full` Preset, so the fixed Toolbar of every screen on the default Preset gets an "Invisible characters" checkbox item in its "…" menu, as the last section.** There is no extra Toolbar button, so the Toolbar does not get longer. The characters are hidden until the author turns the display on, so nothing changes in how a Document looks, and the saved HTML does not change; `basic` is unchanged. To drop the item pass `tools={RICH_TEXT_PRESETS.full.filter((name) => name !== "invisibleCharacters")}`. Install `@tiptap/extension-invisible-characters` next to the other Tiptap packages (the install command on the RichTextEditor page has it).
  - It is display only: the marks are decorations, so `value`, `onChange`, `getHTML()`, Markdown and `RichTextView` never see them, and showing or hiding them is not an edit. Unlike Tiptap, where the extension starts shown, the kit starts hidden; `tool("invisibleCharacters", { visible: true })` shows them from the start.
  - State and command: `useRichTextToolState(ref, "invisibleCharacters")` returns `{ visible }`, and `ref.current?.tool("invisibleCharacters")?.toggle()` switches the display (it returns `false` in the HTML mode, where the "…" menu is locked like the rest of the Toolbar). The item is a `menuitemcheckbox` with `aria-checked`, only in the fixed Toolbar (not in the floating Toolbar or the Bubble menu), with no shortcut; when it is the only Tool that needs "…", the menu is shown for it alone.
  - New public bits: the `InvisibleCharactersToolOptions`, `InvisibleCharactersToolState` and `InvisibleCharactersToolCommands` types, the `InvisibleCharactersIcon` icon, and the `editor.invisibleCharacters` message.

- 7019c52: `RichTextEditor` gets the `mathematics` Tool: LaTeX formulas, inline and block, on the Mathematics extension from Tiptap and KaTeX (there was no requesting screen at release, ADR-0048, so the API follows Tiptap; the decision about KaTeX is ADR-0070).

  - **`mathematics` is in no Preset, neither `full` nor `basic`: nothing changes for existing screens, and a screen switches it on with `tools={[...RICH_TEXT_PRESETS.full, "mathematics"]}` or a `tool("mathematics", …)` entry.** Install `@tiptap/extension-mathematics` and `katex` next to the other Tiptap packages (the install command on the RichTextEditor page has them; `katex` is pinned to `0.18.10` because the Tiptap 3.32 extension accepts only `^0.18` and 0.18.11 is withdrawn).
  - Two Slash menu items, "Formula" and "Block formula", open a Popover with a LaTeX field and a live preview. A click or `Enter` on a formula (`Shift+→` selects an inline one from the keyboard) edits it in the same Popover. Invalid LaTeX shows the KaTeX error in the field and never changes the Document.
  - The HTML holds only the source: `span[data-type="inline-math"]` and `div[data-type="block-math"]` with `data-latex`, as in Tiptap. `sanitizeRichText` lets exactly this pair through; `<` is allowed in `data-latex` and nowhere else. The atom text, the `maxLength` counter and copying see the LaTeX; Markdown is `$…$` and `$$…$$`. `sanitizeRichText` puts a space into the pairs DOMPurify 3 would cut from an attribute (`]>` → `] >`, `-->` → `-- >`, `--!>` → `--! >`, `</` → `< /`), and the Editor writes `data-latex` that way; in math mode the space is not rendered (inside `\text{…}` it is visible).
  - Search finds formulas: the LaTeX source is searched, a match highlights the whole formula and counts in "N of M", and "Replace" and "Replace all" skip formulas (they are edited only through the Popover). A macro defined with `\gdef` stays inside its formula.
  - KaTeX and its stylesheet load lazily, in the Tool's chunk, only for an Editor that names `mathematics`; the Skeleton shows the LaTeX source in monospace until then. The bundler takes the CSS and the fonts from the consumer's `katex` package, so there is no extra step. Without the Tool a formula from `value` or a paste stays in the text as `$…$` instead of being lost.
  - `RichTextView` draws formulas with a lazy Island that is mounted only for a Document that has them; without JS the source LaTeX is visible. There is no new prop and no server helper.
  - Options are `tool("mathematics", { macros, strict })`; new public bits are the `MathematicsToolOptions` type, the `FormulaIcon` and `BlockFormulaIcon` icons and nine `editor.math*` messages.

- f4d7440: `RichTextEditor` gets the `typography` Tool: replacements while typing, on the Typography extension from Tiptap (there was no requesting screen at release, ADR-0048, so the API follows Tiptap).

  - **`typography` is in no Preset, neither `full` nor `basic`: nothing changes for existing screens, and a screen switches it on with `tools={[...RICH_TEXT_PRESETS.full, "typography"]}` or a `tool("typography", …)` entry.** Install `@tiptap/extension-typography` next to the other Tiptap packages (the install command on the RichTextEditor page has it).
  - Every Tiptap rule is on: `--` becomes a dash, `...` an ellipsis, `->` and `<-` arrows, `(c)`, `(tm)`, `(sm)`, `(r)` signs, `1/2 `, `1/4 `, `3/4 ` fractions, `+/-`, `!=`, `<<`, `>>`, `2x3`, `^2`, `^3` and single quotes. A straight `"` becomes a quote of the message catalog language: guillemets with nested low-9 quotes under the Russian catalog (`"a "b" c"` → «a „b“ c»), curly quotes under the English one.
  - Options are `tool("typography", { quotes, … })`: `quotes` is `"auto"` (by the catalog, default), `"ru"` or `"en"`, and every Tiptap rule name is an option that takes `false` (switch the rule off) or a replacement string. An explicit `openDoubleQuote` or `closeDoubleQuote` beats `quotes`.
  - Only input rules: the Schema, the sanitizer and Markdown do not change, and `value` gets plain characters. Rules do not fire inside the `code` Mark or a code Block, and `Backspace` right after a replacement brings the typed characters back.
  - New public bits: the `TypographyToolOptions` type and the `editor.typographyQuotes` message (`"ru"` or `"en"`: the quote set of the catalog; custom catalogs of other languages may leave it out or set `quotes` explicitly).

- def7332: `RichTextEditor` gets the `youtube` and `twitch` Tools: video in the Document as a link, with the player drawn by the kit (there was no requesting screen at release, ADR-0048, so the API follows the Youtube and Twitch extensions from Tiptap, which the kit does not install: link recognition and the player URL are its own code).

  - **`youtube` and `twitch` are in no Preset, neither `full` nor `basic`: nothing changes for existing screens, and a screen switches them on with `tools={[...RICH_TEXT_PRESETS.full, "youtube", "twitch"]}` (either one alone is fine).** Nothing new to install. The page that shows a player needs a `frame-src` line in its Content-Security-Policy: `https://www.youtube-nocookie.com https://player.twitch.tv https://clips.twitch.tv` (the hosts of the services in use; the RichTextEditor page has it).
  - The Document holds a link, not a player: one shared `video` Block, `div[data-block="video"]` with `data-provider` (`youtube` or `twitch`), `data-src` (the canonical `https` link to the video) and an ordinary link inside. The player URL is built at display time: YouTube always through `youtube-nocookie.com/embed/…`, Twitch with `parent` taken from the domain of the current page, so one saved Document works in an admin screen and on a public site.
  - **The player loads at once.** The Editor and `RichTextView` put the service's `iframe` in place of the video straight away, with a `title`, `loading="lazy"`, `allow` and `referrerpolicy`, in the same 16:9 frame (the height does not jump), and without autoplay. Without JavaScript the reader sees the link. In `RichTextView` the player is a lazy Island that is mounted only if the HTML has a video Block. **The reader's browser therefore contacts YouTube and Twitch when the page opens.** `tool("youtube", { autoload: false })` and `tool("twitch", { autoload: false })` (the `VideoToolOptions` type; `RichTextView` reads them from its `tools`) bring back click-to-play: a kit placeholder with the service name and a "Play" button, and not a single request to the service until the click. Use it on screens where privacy matters. The CSP `frame-src` line is needed either way.
  - One "Video" item in the Insert menu takes a link of any enabled service (an error in the field for a foreign or disabled one), and a bare video link pasted into an empty paragraph, or typed there and confirmed with `Enter`, becomes the Block. The HTML of the Tiptap extensions (`div[data-youtube-video] iframe`, `div[data-twitch-video] iframe`) is turned into the same Block, with the player URL translated back into the link.
  - The sanitizer is not loosened: `iframe` is still always stripped. `sanitizeRichText` lets through `div[data-block="video"]`, `data-provider` from the list and `data-src` only as the canonical `https` link to a video on the service's hosts (`www.youtube.com`, `www.twitch.tv`, `clips.twitch.tv`), and a Block with anything else loses its wrapper and stays its link. Without the Tool a video Block in `value` is shown as its link, never dropped. In Markdown a video is its link on a line of its own, and `setMarkdown` reads such a line back as a Block when the service is on.
  - New public bits: the `VideoIcon` icon, and the `editor.video`, `editor.videoLink`, `editor.videoInsert`, `editor.videoNotFound`, `editor.videoPlay`, `editor.videoPlayLabel` and `editor.videoPlayer` messages.

### Patch Changes

- 8827f87: English documentation uses the words of the industry again (documentation only, no code or API change).

  - The glossary names the collapsible Block **Details** (as Tiptap does), the Block line **Horizontal rule** and the checkbox list **Task list**; the menu labels stay "Collapsible block", "Divider" and "Checklist". The "drag handle" alias is off the Block handle, because in Tiptap and BlockNote a drag handle is a grip that moves a Block.
  - Reference pages say _tag_ for a removable filter item (not _token_), _highlight_ for the text background (not _marker_), _range_, _day period_ and _preset_ for the three meanings of _period_, _hard break_ for `Shift+Enter`, _unmasked value_, _increment/decrement buttons_, _visible label_, _disclosure button_, _entry chunk_, _overscan_, _sticky positioning_ and _batch action bar_, among others.

- bbc1b16: `RICH_TEXT_PRESETS` from `@olddevs/ui/editor` can be spread in a server component: `tools={[...RICH_TEXT_PRESETS.full, tool("search")]}` built in a server module no longer fails `next build` with `RICH_TEXT_PRESETS.full is not iterable`.
- 17c6919: The collapsed strip of `RichTextToc` and of the Editor's `toc` Tool is denser: every stroke, the current one included, is 2px thick in a 2px cell (was 3px), with 5px between the cells (was 6px). The current section stands out by the accent color and its length. A long Document still squeezes the gap so that the strip fits the window.

## 4.6.2

### Patch Changes

- The README shows the Olddevs UI logo next to the package name, and the Storybook showcase shows the Olddevs UI mark, name and version in its header instead of the Storybook logo. The package code does not change.

## 4.6.1

### Patch Changes

- f23fc5b: The English Reference now calls borrowed concepts by the words of their origin, so they can be found by search: the Bubble menu (was Selection menu) and the Slash menu (was Insert menu), as in Tiptap; the table toolbar, menu aim, color scale, filtered rows, menu button, keyboard shortcuts dialog, Keyboard shortcuts popover, Source mode, User edit, Programmatic replacement, Status bar, Column layout and Callout tone. Only the text changes: props, values and exports stay the same.

  The glossary gets two columns, "Source" (where the English word comes from) and "Also searched as" (synonyms used elsewhere), a `chip` row, and BubbleMenu, FloatingMenu and Suggestion rows in its Tiptap section: `toolbar="floating"` is the floating Toolbar above a selection, built on Tiptap's BubbleMenu, not Tiptap's FloatingMenu.

## 4.6.0

### Minor Changes

- c51ff0b: `RichTextEditor` gets the `details` Tool: a collapsible Block made of a title and content, on the Details extension from Tiptap (there was no requesting screen at release, ADR-0048, so the API follows Tiptap).

  - **`details` is now in the `full` Preset, so every screen on the default Preset gets a "Collapsible block" item in the Insert menu and the Block handle's "Add ›", and `<details>` in saved or pasted HTML is now read as a collapsible Block instead of being unwrapped into paragraphs.** The saved HTML of every existing Document does not change; `basic` is unchanged. To keep the old behavior pass `tools={RICH_TEXT_PRESETS.full.filter((name) => name !== "details")}`. Install `@tiptap/extension-details` next to the other Tiptap packages (the install command on the RichTextEditor page has it).
  - The HTML is the kit's `details` and `summary` tags plus `div[data-type="detailsContent"]` around the content. `tool("details", { persist: true })` writes the Block's open state into the Document as `open`; by default it does not, as in Tiptap, so a Block opened while editing is not published open. In `RichTextView` the Block is a native `details`: it opens without JavaScript and the engine.
  - `sanitizeRichText` lets `details`, `summary` and the content wrapper through only in that shape (`open` only empty and only on `details`). In Markdown the Block is raw HTML, `<details><summary>…</summary>` with Markdown inside, and `setMarkdown` reads it back. Without the Tool the Block unwraps: the title becomes a paragraph and the content Blocks follow.
  - New public bits: the `DetailsToolOptions` type, the `DetailsIcon` icon, and the `editor.details`, `editor.unwrapDetails` and `editor.detailsToggle` messages.

### Patch Changes

- 6b49543: `RichTextEditor`: every built-in Tool is now defined the same way as a custom one, as a single internal descriptor, and the old per-name registries are gone. Nothing visible changes: the saved HTML, mark nesting, keyboard shortcuts, the shortcut reference, menu and toolbar order, and the bundle budgets stay the same. The descriptor modules add about 1.3 kB of raw code: the Editor's own start code grows by about 0.1 kB gzip, and the start with the Tiptap engine by about 1 kB gzip, well within the budgets; the import-cost table in the getting-started guide is updated.
- 33c9e28: Glossary: a new "Tiptap" category maps the engine's words (Extension, Node, Mark, StarterKit, options, storage, commands, `extend`, `priority`, NodeView, Decoration, Schema, Transaction and others) to the Editor's Tools, Blocks and Marks, with a note on what not to confuse them with.

  Glossary: "engine part" is now **Extensions** (the Tiptap extensions of a Tool description, the `engine` field); the old name stays in the glossary as the former one. The API is unchanged.

## 4.5.1

### Patch Changes

- 8c1356b: `RichTextToc`: a jump no longer scrolls the whole page when the Document sits in its own scrollable area and the page has no sticky header (no `--topbar-h`, or whatever `offsetVar` names). Before, the page moved together with the area; now only the nearest scrollable area moves, and the heading stops at its top edge, below the heading's `scroll-margin-top`. The window is scrolled only when the Document has no scrollable area around it. A jump under a sticky header and the `toc` Tool of `RichTextEditor` behave as before.

## 4.5.0

### Minor Changes

- 018fff6: Editor, extension: every Tool of `RichTextEditor` now has three typed parts, mirroring the `options`, `storage` and `commands` of a Tiptap extension: options, state and commands. They follow the kit's semver, not the Tiptap major.

  - **Options.** `tool(name, options)` configures a built-in Tool right in `tools`, and the entry switches the Tool on even if its bare name is not in `tools`. `tool("toc", { offsetVar: "--header-h", levels: [2, 3], listWidth: 280 })` takes the sticky header height from your own variable, shows only H2–H3 and sets the list width; `tool("search", { matchCase: true })` opens Find with the "Match case" flag on. Only `search` and `toc` have options for now. Options are read once, when the engine is created, so remount the Editor with a `key` to change them.
  - **State.** `useRichTextToolState(ref, "search")` returns a data snapshot (is the panel open, the query, the number of matches, the current match), and `useRichTextToolState(ref, "toc")` returns the headings and the current section, so a "3 of 12" counter in the Status line or navigation next to the field no longer needs the raw Tiptap editor. The hook returns `null` before mount, on the server and without the Tool; the screen re-renders only when the snapshot changes.
  - **Commands.** `handle.tool("search")?.open({ query })`, `close()`, `setQuery()`, `next()`, `previous()`, `replace()`, `replaceAll()` and `handle.tool("toc")?.jumpTo(index)` return a `boolean`; `handle.tool(name)` is `null` when the Tool is not in `tools`.
  - **Custom Tools.** `defineTool({ name, defaults, create, state, commands })` describes a Tool with options, state and commands in the same shape as `CustomTool`, and `tool(definition, options)` configures it. The types of options, state and commands live in the `RichTextTools` interface, where your own Tool adds itself with `declare module "@olddevs/ui/editor"`; a Tool that is not added still works, with `unknown` types. A plain `CustomTool` object keeps working.
  - `RichTextToc` takes a `levels` prop, the same as the Tool option.
  - **Deprecated:** `handle.openSearch()` is replaced by `handle.tool("search")?.open()`. It still works, warns once in development and is removed in 5.0. See `docs/api/migration-notes.md`.

## 4.4.0

### Minor Changes

- b9fd75b: `RichTextToc` in `@olddevs/ui/editor` is a table of contents for a long Document next to `RichTextView` or a `readOnly` `RichTextEditor`:

  - Collapsed, it is a strip of strokes, one per heading, with the current section highlighted while the page scrolls. Hovering the strip opens the list of headings; a click scrolls to the heading and moves focus to it, and the list stays open until the pointer leaves.
  - Headings come from the DOM of `target`, a ref to the View or the Editor's handle: `h1`–`h4` at the top level and inside Wrappers, not in Layout columns or custom Blocks. With fewer than two headings nothing renders.
  - No anchors: the address does not change and the Document gets no `id`s. `offsetVar` (default `--topbar-h`) puts the heading under a sticky header, as in ADR-0016.
  - `listWidth` sets the width of the list (default 240px); long titles end with an ellipsis. When there is no room to the left of the text, the strip hides itself.
  - New message `editor.toc`: "Table of contents", «Оглавление» in `ru`.

- 08eb808: `RichTextEditor` gets the `toc` Tool: the table of contents of `RichTextToc` in the Editor's left gutter.

  - Switch it on by name, `tools={[...RICH_TEXT_PRESETS.full, "toc"]}`. It is in neither Preset, so no existing screen changes its layout; `RICH_TEXT_PRESETS.full` is now every built-in Tool except `toc`.
  - The gutter appears with the second heading and goes away with it. The strip lines up with the first heading and sticks under the fixed Toolbar, or to the top of a field with `maxHeight`.
  - A jump while editing puts the caret at the end of the heading; in `readOnly` it focuses the heading, as `RichTextToc` does.

### Patch Changes

- 31abbbe: `RichTextEditor` with `name` keeps the value of its hidden form field when the owner re-renders. Before, any re-render after the engine had written the field reset it to the incoming string, because React rewrites `defaultValue` of an `input type="hidden"` on every update, so a form could submit a stale Document.
- 51fcc79: The last four Reference pages now have English Translations: the Reference index, the shared conventions, the `UiMessages` catalog and the utilities API (`docs/index.en.md`, `docs/conventions.en.md`, `docs/api/messages.en.md`, `docs/api/utilities.en.md`). Every page in `docs/` now has an English version.

## 4.3.0

### Minor Changes

- 9e915a3: `MegaMenu` marks the current section and works better on phones and with server components:

  - `MegaMenuCategory` takes `active`: the row gets `aria-current="true"` and the accent color, and with no flyout open, Tab enters the column on that category.
  - `MegaMenuLink` takes `active` for the current page, as `NavItem` does. `current` still works and is deprecated until 5.0.
  - `MegaMenuGroup` takes `link`, a router link for the column title, like `link` on a category. Links passed in a fragment now each get their own list item.
  - Typing a letter in the category column moves focus to the next category that starts with it.
  - On screens under 640px the dropdown spans the window instead of shrinking to its longest label, so it no longer changes width when you drill down or gets pushed off screen by a long label.
  - Categories rendered from a Next.js server component or wrapped in your own components now work fully: the column has a Tab stop before hydration, and on a narrow screen a `value` that names a category without a flyout no longer blanks the catalog.
  - The reference calls the area next to the column the flyout ("Полка" in Russian); the width prop is still `showcaseWidth`.

  `Menu` accepts the logical `end top` and `start top` in `placement`, which swap sides in right-to-left writing.

## 4.2.2

### Patch Changes

- 13e5a7a: The "Where it comes from" section of the `MegaMenu` reference page shows the original animation of Amazon's triangle from Ben Kamens's post, served from the documentation site (ui.olddevs.ru) rather than a third-party host.

## 4.2.1

### Patch Changes

- 581ac6f: The `MegaMenu` reference page tells the fuller story of the technique in "Where it comes from": the trap that menus used to close with a delay, how Ben Kamens worked out Amazon's triangle in 2013, the math behind `jQuery-menu-aim`, and how the idea spread.

## 4.2.0

### Minor Changes

- cd17f45: New `MegaMenu` with `MegaMenuCategory`, `MegaMenuGroup` and `MegaMenuLink`: an Amazon-style store catalog. A column of categories sits on one side, and the hovered category's showcase of link columns opens next to it. It is navigation built on the WAI-ARIA disclosure pattern, not a command menu: the column is a single tab stop with arrow keys, and Enter or the arrow toward the showcase moves focus into it. The same markup also opens as a dropdown: wrap a `MegaMenuButton` and an unchanged `MegaMenu` in `MegaMenuTrigger`, and the catalog drops down under the button on click or keyboard (not on hover), with `open`, `defaultOpen` and `onOpenChange`.

  On touch screens a tap opens a category at once (pen counts as touch). On screens narrower than 640px the showcase replaces the column, headed by a "Back" row with the category name; the new `megaMenu.back` message catalog string supplies the label.

### Patch Changes

- 2f09223: A nested `Menu` inside `SubmenuTrigger` now opens beside its item, to the right and flipping to the left at the screen edge, instead of below it. On a phone-width screen (up to 639px) it still opens below the item, over the parent menu. An explicit `placement` on the nested `Menu` always wins, and the root `Menu` keeps `bottom start`. The pointer "aim" toward a submenu still comes from react-aria.

## 4.1.1

### Patch Changes

- ff0f1ec: Fix `TreeView` rows ignoring their state: a disabled node is now dimmed and a selected one is highlighted. `NavItem` with `aria-disabled` looks unavailable, and `Checkbox`, `Radio`, `Toggle` and `Slider` are dimmed inside a disabled `<fieldset>`, such as a pending `Form`.
- 1898d91: RichTextEditor: the HTML mode on `surface="paper"` keeps the light sheet under the dark field.
- 8722df5: RichTextEditor: in the wrapper tone menu the checked row keeps the swatch's own colours instead of the selected-row ones.
- e3277e4: `VirtualGrid` cells whose content is `h-full` now fill the whole row instead of collapsing to one line of text.

  `Accordion` sections no longer carry 12px of extra height when collapsed.

  `AvatarGroup` in size `md` overlaps its circles less, so initials and the "+N" remainder are no longer clipped.

  `Select` opens its panel 4px below the whole trigger pill instead of overlapping its bottom edge; the panel now lines up with the pill's left edge rather than the button inside it.

  `MobileTabBarItem` badges are pinned to the top-right corner of the icon and grow to the right, so wide badges such as "99+" no longer cover the icon.

- 5be80ed: Table: with `resizable`, a column header with `align: "end"` stays right-aligned next to the resize handle, and without `resizable` the selection and expand columns are narrow instead of stretched like data columns.
- 84cccb6: `Truncate` with `lines` greater than 1 clamps the text again. The text used to render in full: the `block` class overrode the `-webkit-box` display that line clamping needs, so there was no ellipsis, no tooltip and no keyboard focus.

## 4.1.0

### Minor Changes

- 942fcab: `SideNav` slots now know when the navigation is collapsed. The new `useNavCollapsed()` hook lets `header` and `footer` content switch to an icon-mode layout, such as an avatar without the name and role, and returns `false` outside `SideNav` and in the mobile drawer. The header and footer now clip anything wider than the column, so a slot that doesn't adapt no longer spills over the page content.

## 4.0.3

### Patch Changes

- 1d026de: Development tooling only; the published code is unchanged. Vitest 4, Changesets 3 and two dependency overrides bring `npm audit` for the repository to zero, and `allowScripts` in `package.json` records that the install scripts of esbuild, @parcel/watcher and fsevents are denied: their native binaries arrive prebuilt.

## 4.0.2

### Patch Changes

- a59ec03: The icons page no longer names a file in the maintainers' private decisions repository; it cites the decision as ADR-0049.
- 787065f: The README links the Storybook showcase on GitHub Pages: every component's stories in each theme, built from the latest release.

## 4.0.1

### Patch Changes

- The first release built in GitHub Actions, with npm provenance: the package page links the build to the commit and the workflow that produced it. Releases are staged by the workflow and approved by the maintainer on npmjs.com. No changes to the code or the API.

## 4.0.0

### Major Changes

- First public release: the package is published to npmjs.com under the MIT License, and the source is on GitHub.

  - **License:** MIT, previously `UNLICENSED`. Third-party notices stay in `NOTICE`.
  - **Registry:** install from npmjs.com with `npm i @olddevs/ui`. If your `.npmrc` binds the `@olddevs` scope to another registry, remove that line and regenerate the lock file.
  - **Versioning:** strict semver from this release on. Breaking changes ship only in a major version, and a public API rename keeps the old name as a deprecated alias for one major version.
  - **No API changes:** code that works with 3.49 works with 4.0.0 as is. See `docs/api/migration-notes.md`, entry 4.0.0.
  - This changelog starts with this release.

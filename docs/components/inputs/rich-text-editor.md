---
component: RichTextEditor
exports:
  [
    RichTextEditor,
    RichTextEditorProps,
    RichTextEditorHandle,
    RichTextDocument,
    useRichTextEditorState,
    useRichTextToolState,
    RichTextToolState,
    tool,
    defineTool,
    ConfiguredTool,
    ToolDefinition,
    ToolDefinitionInput,
    ToolDefinitionContext,
    CustomToolBody,
    RichTextTools,
    SearchToolOptions,
    TocToolOptions,
    DetailsToolOptions,
    MathematicsToolOptions,
    VideoToolOptions,
    TypographyToolOptions,
    InvisibleCharactersToolOptions,
    LanguageToolOptions,
    DateToolOptions,
    FocusToolOptions,
    TocLevel,
    SearchToolCommands,
    TocToolCommands,
    InvisibleCharactersToolCommands,
    LanguageToolCommands,
    FootnotesToolCommands,
    DateToolCommands,
    FocusToolCommands,
    FullscreenToolCommands,
    BlockSelectionToolCommands,
    SearchToolState,
    TocToolState,
    InvisibleCharactersToolState,
    LanguageToolState,
    FootnotesToolState,
    FootnotesToolNote,
    FocusToolState,
    FullscreenToolState,
    BlockSelectionToolState,
    TocToolHeading,
    Tool,
    ToolName,
    RichTextEditorPreset,
    RichTextSurface,
    RICH_TEXT_PRESETS,
    CustomTool,
    CustomToolButton,
    CustomToolLabel,
    CustomToolPopover,
    CustomInsertItem,
    CustomBlockAction,
    CustomTrigger,
    CustomIslandProps,
    TriggerItem,
    TriggerContext,
    CustomTextCard,
    CustomTextCardRender,
    TextCardRange,
    TextCardRangeAt,
    markRange,
    CustomBlock,
    CustomMark,
    CustomAttribute,
    PrefixedName,
    FieldNotice,
    FieldNoticeTone,
  ]
category: inputs
status: stable
source: src/editor/RichTextEditor.tsx
story: src/editor/RichTextEditor.stories.tsx
---

# RichTextEditor

## Summary for AI

`RichTextEditor` is a rich text field built on Tiptap v3 (ProseMirror).

- **Entry point and engine.** It lives in its own entry point, `@olddevs/ui/editor`, not in the barrel, and the consumer installs the engine: it is not in the kit's manifest.
- **Value and modes.** The value is an HTML string constrained by the Schema; an empty Document is `""`. The controlled (`value`/`onChange`) and uncontrolled (`defaultValue`) modes are supported; `name` is for a native form; the label and error come from `FormField`.
- **Height.** By default the field grows with the Document. `maxHeight` (pixels or a CSS length) limits the Document area: it scrolls inside the frame while the Toolbar and the Status bar stay in place. `resizable` adds a height handle (a grip strip plus a slider you can use from the keyboard).
- **Toolbar and Bubble menu.** The Toolbar (`toolbar`) is either sticky above the field, floating above the selection, or the compact Bubble menu on an inverse surface (`"bubble"`); on a touch screen it is always sticky. `Alt+F10` moves focus into it.
- **Block handle.** A Block with the caret gets a "⋮" handle on the left with a menu of Block actions (add below, format, move up, move down, duplicate, delete; `Ctrl/⌘+/`).
- **Link and image.** A link is edited in a popover on `Ctrl/⌘+K`. An image is a `<figure>` with a caption, a width of 25/33/50/75/100% and, if you want the text to wrap it, a side (left or right), inserted by URL; with `onUploadImage(file) → Promise<url>` it can also come from the clipboard, by drag and drop, and through a file picker (base64 is never written into the Document).
- **Code block.** It has a header (language on the left, "Copy" on the right), a language (Python, TypeScript, JavaScript, Go, HTML, JSON, YAML, Markdown or plain text) and lowlight highlighting. Only `class="language-…"` is written into the Document, and for `RichTextView` the server helper from `@olddevs/ui/editor/highlight` highlights the Blocks.
- **Source mode.** The "HTML" button of the fixed Toolbar (the `source` Tool) swaps the Document for a field with its source HTML; leaving the mode, `blur`, form submission and `getHTML()` apply the edit through the Schema, like an incoming `value`.
- **Feature set.** `preset="full" | "basic"` or an exact `tools` list; a disabled Tool removes both its button and its markup from the Schema.
- **Tool options, state and commands.** The built-in `search`, `toc`, `details`, `mathematics`, `youtube`, `twitch`, `typography`, `invisibleCharacters`, `focus`, `language` and `date` Tools have options: a `tool("toc", { offsetVar: "--header-h", levels: [2, 3] })` entry sits in `tools` next to the names, switches the Tool on and configures it (for Search, the starting flags `matchCase`, `wholeWord` and `regex`; for the Table of contents, `offsetVar`, `levels` and `listWidth`; for the Details Block, `persist`; for formulas, `macros` and `strict`; for video, `autoload`; for Typography, the `quotes` set and the replacement rules; for invisible characters, `visible`; for the focus mode, `enabled`). The `useRichTextToolState(ref, "search")` hook reads the state: for Search, whether the find panel is open, the query, the number of matches and the number of the current one; for the Table of contents, the headings and the current section; for invisible characters, `visible`. The hook returns `null` before mount, on the server, after the Editor unmounts and when the Tool is not in the set. Commands are called through the Handle: `ref.current?.tool("search")?.open()`, `ref.current?.tool("toc")?.jumpTo(2)`, `ref.current?.tool("invisibleCharacters")?.toggle()`; each returns a `boolean`. Options are read once, when the engine is created. A custom Tool with the same three parts is described with `defineTool` (["Options, state and commands"](../../api/editor-extension.md#options-state-and-commands)).
- **Handle (`ref`).** The screen drives the field through `ref`: `insertHTML`, `insertText`, `getText`, `getSelectedText`, `isEmpty`, `focus(position?)`, `blur`, `undo`, `redo`, `tool(name)`; `getJSON()`/`setJSON()` export and load the Document as a lossless JSON envelope (see the "JSON" section), and `defaultValue` accepts the envelope too. The screen builds its own toolbar with the `useRichTextEditorState(ref, selector)` hook. `openSearch` is deprecated (removed in 5.0): use `tool("search")?.open()` instead. Before Readiness (on the server, before mount, while Tool Loaders are running) the methods are silent: see the "Handle (`ref`) and a custom toolbar outside the field" section.
- **Events.** The screen learns about field events through the `onReady()`, `onFocus()` and `onBlur()` callbacks (see the "Events" section).
- **Details.** The `details` Tool (in `full`) is a Block made of a title and content: it is inserted with the "Collapsible block" item of the Slash menu, its HTML is the `details` and `summary` tags, and in the View it opens the browser's native way, without the engine. The `tool("details", { persist: true })` option writes the Block's open state into the Document (`open`); by default it does not. In Markdown the Block is raw HTML `<details><summary>`.
- **Footnotes.** The `footnotes` Tool (in `full`, not in `basic`) puts a reference with an automatic number into the text and collects the footnotes' texts in a list at the end of the Document: the "Footnote" item of the Slash menu and of the "…" menu inserts a reference at the caret, makes its footnote in the list and moves the caret into it. The kit keeps the list: a footnote exists while its reference does, deleting the reference deletes the footnote in the same edit (`Ctrl/⌘+Z` brings back both), moving text renumbers. A click or `Enter` on a reference goes to its footnote, and the number button of a footnote (or `Enter` in it) goes back; in `RichTextView` the same jumps are plain anchors and need no JS. A footnote is one paragraph of text with Marks and links. The HTML is `sup[data-footnote-ref]` and `section[data-block="footnotes"]`; Markdown is GFM (`[^1]`); the state and the commands are `useRichTextToolState(ref, "footnotes")` and `handle.tool("footnotes")`. See the "Footnotes" section.
- **Formulas.** The `mathematics` Tool (in neither `full` nor `basic`, switched on explicitly) is LaTeX formulas, inline and block, on the Mathematics extension from Tiptap and KaTeX: two Slash menu items ("Formula" and "Block formula"), editing in a kit Popover on a click or `Enter` on a selected formula (a LaTeX field, a live preview, the error in the field; invalid LaTeX never changes the Document). The HTML holds only the source: `span[data-type="inline-math"]` and `div[data-type="block-math"]` with `data-latex`. KaTeX and its CSS load lazily, in the Tool's chunk; `RichTextView` draws formulas with an Island and shows the source without JS. In Markdown they are `$…$` and `$$…$$`. The options are `tool("mathematics", { macros, strict })`.
- **Date mention.** The `date` Tool (in `full`, not in `basic`) is a date inside a line of text, an inline Atom `<time datetime="…">text</time>`: the **"Date"** Slash menu item opens a Popover with the kit's `Calendar` (focus on today; `Enter` inserts today), a "Time" switch with a time field, and a click or `Enter` on a mention edits it ("Remove time", "Delete"). The machine value is `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM±HH:MM` (the offset is the author's browser zone at insertion; a date without a time has no zone); the text is written in the author's locale when the mention is inserted or edited and shown by `RichTextView` as is, with no JS. The calendar and the Popover are a lazy chunk. The option is `tool("date", { format })`, the command is `handle.tool("date")?.insert(value?)`; Markdown keeps the text and loses the value.
- **Typography.** The `typography` Tool (not in `full` or `basic`, switched on explicitly) is replacements while typing, on the Typography extension from Tiptap: `"` becomes guillemets under the Russian catalog and curly quotes under the English one (nested low-9 quotes too), `--` becomes a dash, `...` an ellipsis, plus arrows, ©, ½, ± and the other Tiptap rules. Input rules only: the Schema, the sanitizer and Markdown do not change, and `value` gets plain characters. It does not fire in code, and `Backspace` right after a replacement undoes it. The options are `quotes` and one per rule (`false` or a string).
- **Video by link.** The `youtube` and `twitch` Tools (in neither `full` nor `basic`, switched on explicitly; each allows its own service) are one `video` Block: the Document holds a link to the video (`div[data-block="video"]` with `data-provider`, `data-src` and a link inside), and the kit draws the player: at once, an `iframe` on `youtube-nocookie.com` or on `player.twitch.tv` with `parent` taken from the page domain (`loading="lazy"`). The `tool("youtube", { autoload: false })` option brings back the placeholder with a "Play" button and not a single request to the service before a click, for screens where privacy matters. It is inserted with one "Video" item of the Slash menu (the service is detected from the link) or with a bare link in an empty paragraph; the sanitizer still strips `iframe`. The consumer needs a CSP `frame-src` (section "Video by link").
- **Invisible characters.** The `invisibleCharacters` Tool (in `full`) draws spaces, hard breaks and paragraph ends over the Document; the "Invisible characters" checkbox item is the last section of the "…" menu of the fixed Toolbar. It is display only: `value`, `onChange`, `getHTML()` and Markdown do not see it. The characters stay hidden until the author turns the display on, and the starting display is set by the `tool("invisibleCharacters", { visible: true })` option; the state is `{ visible }`, the command is `toggle()`.
- **Block selection.** Two layers (ADR-0077). In every Editor the Block handle "⋮" stays when a text selection touches several Blocks, and its menu (Format, Wrap in, Up, Down, Duplicate, Delete) acts on all of them in one edit. The `blockSelection` Tool (in `full`, not in `basic`) selects Blocks whole, as in Notion: `Esc` in the text selects the current Block, `Shift+↑/↓` and `Shift+click` grow the selection, then `Backspace`, `Ctrl/⌘+C`, `Ctrl/⌘+X`, `Ctrl/⌘+V`, `Ctrl/⌘+Shift+D`, `Alt+Shift+↑/↓` and `Ctrl/⌘+/` act on the Blocks, and the second `Esc` returns the caret. Because it takes the first `Esc`, a field with the Tool in a `Dialog` or `Drawer` closes the window on the second `Esc`; a comment field uses `basic`, or drops the Tool, and keeps one. The state is `{ count }`, the commands are `selectCurrent()` and `clear()`. The mode leaves no trace in the saved HTML, Markdown, JSON or `RichTextView`.
- **Fullscreen mode.** The `fullscreen` Tool (in `full`, not in `basic`) expands the field to the whole window (ADR-0082): a layer of the kit above the page, a `Dialog` or a `Drawer`, not the browser's Fullscreen API, so it works inside a window and on iPhone. The Toolbar is across the top, the Status bar at the bottom, the Document scrolls itself as a column of about 72 characters. The "Fullscreen" checkbox item is in the "…" menu, "Collapse" is a visible button at the right edge of the Toolbar, and `Esc` collapses it one level at a time. It is the same engine, history, caret and selection, and `onFocus` and `onBlur` do not fire. `maxHeight` and `resizable` do not apply in it. The state is `{ open }`, the commands are `open()`, `close()` and `toggle()`.
- **Focus mode.** The `focus` Tool (in `full`, not in `basic`) shows everything outside the Block with the caret faint, at 40% opacity (ADR-0082); the Block is the same unit as for Block selection (in a list, the item; a table as a whole). Images, videos, code Blocks, toned Wrappers and tables go faint whole. It is display only: `value`, `onChange` and the HTML do not see it. It is off until the author turns it on with the "Focus mode" item of the "…" menu or the `tool("focus", { enabled: true })` option; the state is `{ enabled }`, the command is `toggle()`.
- **Text part language.** The `language` Tool (in `full`, not in `basic`) marks a piece of text with its language, `<span lang="en">`, so that a screen reader reads it by that language's rules, the browser spell-checks it with the right dictionary and hyphenates it correctly (WCAG 3.1.2 Language of Parts). It is a Mark only: a paragraph in another language is the same Mark over all its text. The author picks it in the "Language ›" submenu of the "…" menu (no button and no shortcut); the menu lists the `tool("language", { languages })` option, `["en", "ru"]` by default, but the Schema accepts a `lang` of any language. The page's own language (the `lang` of the field's nearest ancestor, else the interface locale) is never a mark. In the Editor the mark is a thin dotted underline; the View draws nothing. Markdown loses it, JSON keeps it. The state is `{ current, primary }`, the commands are `set(language)` and `unset()`.
- **Skeleton and Loader.** Until Readiness the field shows a Skeleton: the frame and the Document as static HTML without input, with no height jump. The Skeleton's Document is `value` cleaned by the Schema, and only in the browser; on the server the Skeleton is a frame without a Document. The Extensions of a custom Tool can be passed as a Loader (`engine: () => import(…)`); if it fails, the result is a field error with "Retry".
- **Status bar and Field notice.** Below the field, inside the frame, are the Status bar (`status`: the screen's React node at the start, the kit's counter at the end, no `role`) and the Field notice: the engine command `showNotice({ tone: "status" | "error", text })` / `showNotice(null)`. `status` is only announced, `error` is shown as a `role="alert"` line until the next edit; image messages go through the same channel.
- **Buttons of a custom Tool.** A custom Tool (`CustomTool` in `tools`) can carry buttons in the `buttons` field: a label (a string or a function that receives `{ locale }`), an icon, `can`, `isActive`, `isVisible`, `selectionMenu`, `shortcut` and exactly one of `run` and `popover`. The kit renders the button in one group before "Undo" and "Redo", binds the shortcut and shows it in the tooltip, in `aria-keyshortcuts` and in the Keyboard shortcuts popover.
- **Text card.** Another kind of UI contribution is a Text card (`textCards`): a range `rangeAt(state, pos)` (for a Mark, the ready-made `markRange("acme_comment")`) and a body `render({ editor, range, close })`. The kit opens it when the caret is in the range or on click, manages the frame (layer, anchor under the range, flip at the edge, Escape), does not take focus out of the Document, and moves focus into it with `Alt+F10`.
- **Insert items and Block actions.** Two more kinds of UI contributions are Insert items (`insertItems`: "/", "+", and "Add ›" and "Format ›" of the Block handle) and Block actions (`blockActions`: a section of the Block handle menu before "Delete"), also with exactly one of `run` and `popover`. An item's popover opens at the caret, an action's at the Block.
- **Paste from Office.** The `pasteCleanup` Tool (in `full` and `basic`) keeps the meaning of a paste from Word, Excel, Google Docs, Google Sheets and SharePoint before the Schema reads it: Word lists stay lists, a highlight becomes the nearest palette marker, bold and alignment of Excel cells survive. HTML from other sources is not touched. It has no UI; see the "Paste from Office" section.
- **Paste and drop.** A custom Tool can affect paste and drop only through Extensions.
- **Names and HTML convention.** The names of everything custom (the Tool, its Blocks, Marks and attributes) start with a Consumer prefix (`acme_card`). The HTML of a custom Block is a `div` or `span` with `data-block`, a Mark is a `span` with `data-mark`, and attributes are `data-acme_*` with a value checked against a rule (list, pattern, URL).
- **Presets.** These are the arrays `RICH_TEXT_PRESETS.full` and `.basic`, so you can append custom Tools to them.
- **Server and View.** The same `tools` array is accepted by server-side sanitization (`sanitizeRichText(html, DOMPurify, tools)`, `richTextSchema(tools)`) and by `RichTextView` (the Island of a custom Block is the `island` field).
- **Atom count.** An Atom counts as its Atom text length (`renderText`) toward `maxLength`: a horizontal rule is 0, a hard break is 1, an image is the caption length.

The whole extension API is collected on the [Editor extension API](../../api/editor-extension.md) page, together with the semver boundary (the "Stability" section) and recipes.

```tsx
import { RichTextEditor } from "@olddevs/ui/editor";
```

## When to use

- Long formatted text: an article, a description, a policy, a proposal to a client. The author writes headings, lists, quotes and highlights words.
- The value is stored and served as HTML and is shown later by a page.
- A component "for the future" (ADR-0048): at release there was no requesting screen, so the API is modeled on comparable products — Imperavi Redactor 5, Tiptap Simple Editor, minimal-tiptap, Notion. Your screen is the first test of this API. The engine decision is in ADR-0050.
- The Details Block `details` is "for the future" too (ADR-0048): at release there was no requesting screen, and the API follows the Details extension from Tiptap; the first screen is entitled to ask for a different API.
- Formulas `mathematics` are "for the future" too (ADR-0048): at release there was no requesting screen, and the API follows the Mathematics extension from Tiptap; the first screen is entitled to ask for a different API.
- Typography `typography` is "for the future" too (ADR-0048): at release there was no requesting screen, and the API follows the Typography extension from Tiptap; the first screen is entitled to ask for a different API.
- The invisible characters Tool `invisibleCharacters` is "for the future" too (ADR-0048): at release there was no requesting screen, and the API follows the Invisible Characters extension from Tiptap; the first screen is entitled to ask for a different API.

## When not to use

- Plain multiline text without markup — `TextControl as="textarea"`. The Editor with its engine weighs 295–339 kB gzipped ([size table](../../getting-started.md#import-size)); a two-line comment is not worth it.
- Code or configuration is not rich text. To show code, use `CodeView`; the kit has no code editor (ADR-0039).
- Showing a saved Document without editing. `readOnly` keeps the engine alive; for a page that only displays the Document, use [`RichTextView`](../content/rich-text-view.md) — it has no engine and works in a server component.

## Installation

The engine is **not in the kit's manifest** — neither in `peerDependencies` nor in `dependencies`: if you do not import the `@olddevs/ui/editor` entry point, you install nothing, and a kit update does not drag Tiptap in. The engine used to be optional peer dependencies, but the kit's previous registry dropped the optional flag, and npm installed the engine for every consumer. The trade-off: npm does not warn about a version mismatch, so keep the range below yourself. If you do import it, install everything with one command:

```bash
npm install @tiptap/core @tiptap/pm @tiptap/react @tiptap/starter-kit @tiptap/extensions \
  @tiptap/extension-list @tiptap/extension-subscript @tiptap/extension-superscript \
  @tiptap/extension-text-style @tiptap/extension-highlight @tiptap/extension-text-align @tiptap/extension-link \
  @tiptap/extension-table @tiptap/extension-details @tiptap/extension-blockquote @tiptap/extension-horizontal-rule \
  @tiptap/extension-invisible-characters @tiptap/extension-typography \
  @tiptap/extension-mathematics katex@0.18.10 \
  @tiptap/markdown marked @tiptap/suggestion \
  @tiptap/extension-code-block-lowlight lowlight highlight.js
```

Install all the packages even if your set of Tools has no task list or no superscript and subscript: the entry point imports the extensions statically, and the `tools` choice happens only when the field is created. The code block and the table arrive in a separate chunk (see the "Skeleton" section), but the bundler still resolves their packages at build time — `@tiptap/extension-table`, `@tiptap/extension-code-block-lowlight`, `lowlight` and `highlight.js` are needed by a screen with `basic` too. npm and yarn install `@tiptap/extension-blockquote` and `@tiptap/extension-horizontal-rule` together with `@tiptap/starter-kit`, but in pnpm's strict `node_modules` you must name them explicitly — the command above already includes them. The floating Toolbar takes its positioning from `@tiptap/react/menus`: the `@tiptap/extension-bubble-menu` it needs (with `@floating-ui/dom`) is an optional dependency of `@tiptap/react` itself, and the package manager installs it along with it. If you install packages with `--omit=optional`, add it explicitly.

The command already contains `@tiptap/extension-mathematics` and `katex` for the `mathematics` Tool (the "Formulas" section; the decision is ADR-0070). `katex` is pinned to an exact version: the range `^0.18` would pull in the withdrawn 0.18.11, while the Tiptap 3.32 extension accepts only `^0.18`; the version is raised once the extension accepts 0.19. The KaTeX code and its CSS with fonts load lazily and only for an Editor with formulas; the weight of pages without formulas does not change. The consumer has no extra step — no style import, no font copying: the bundler takes them from the `katex` package.

The Editor has three entry points. `@olddevs/ui/editor` is the Editor itself, the View and sanitization; it needs the engine packages above. `@olddevs/ui/editor/schema` is the Schema as data only (`RICH_TEXT_SCHEMA`, `richTextSchema(tools)`), the `sanitizeRichText(html, DOMPurify)` sanitizer, the closed config `richTextSanitizeConfig()` for the server, and the Text card helper `markRange`. The graph of this entry point has neither React nor Tiptap, so there is nothing to install (the consumer brings DOMPurify). `@olddevs/ui/editor/highlight` is highlighting without the Editor: `highlightCodeBlocks(html)` for a saved Document (see the "Code block" section below) and `highlightCodeNodes(code, language)` — the same tokens as nodes, for [`CodeView`](../content/code-view.md#kit-highlighting); that entry point's graph contains `lowlight`, `highlight.js` and `react`. Sanitization with DOMPurify is on the [`RichTextView`](../content/rich-text-view.md#sanitization-on-the-consumers-server) page.

In Next.js, add the `@olddevs/ui/editor` entry point to `optimizePackageImports` as a separate line next to `@olddevs/ui` ([getting-started.md](../../getting-started.md#the-package-in-server-components)): without it, a page that imports just `RichTextView` from the entry point ships the whole Editor with the engine to the browser.

Keep the Tiptap package versions identical: they reference each other by exact version. The range is `^3.32.0`.

A separate Tailwind `@source` is not needed: the Editor's classes sit in the same `dist` as the rest of the kit, and the `@source "./node_modules/@olddevs/ui/dist"` line from [getting-started.md](../../getting-started.md) already covers them.

## Minimal example

```tsx
import { FormField } from "@olddevs/ui";
import { RichTextEditor } from "@olddevs/ui/editor";

<FormField label="Description" htmlFor="description" hint="Shown on the overview page">
  <RichTextEditor id="description" value={html} onChange={setHtml} maxLength={5000} />
</FormField>;
```

## Toolbar

The fixed Toolbar sits above the field and **sticks on scroll** below the app header: the offset is the CSS variable `--topbar-h`, published by the kit's `TopBar` (ADR-0016, ADR-0019). Without a header the variable does not exist, and the Toolbar sticks to the viewport edge. The sticky positioning works inside the field's frame: the Toolbar leaves together with the field when the field is scrolled out entirely. By default the Editor has no scroll of its own — it grows with the Document; a height limit and a height handle are enabled by `maxHeight` and `resizable` (see the "Field height" section).

- `toolbar="fixed"` (default) — the Toolbar above the field, and above a non-empty selection also the Bubble menu, the same pill as in `toolbar="bubble"` (turn it off with `selectionMenu={false}`; it does not exist on a touch screen); `toolbar="floating"` — the Toolbar above a non-empty selection (below); `toolbar="bubble"` — the Bubble menu instead of the Toolbar, a compact pill above the selection (below); `toolbar="none"` — no Toolbar, formatting is available only from the keyboard.
- In `readOnly` there is no Toolbar. In `disabled` the Toolbar is visible, but all buttons are disabled and do not take focus.
- **Keyboard shortcuts popover** is the last Toolbar button, with a keyboard icon, at the right edge; only the fixed Toolbar has it (there is none above the selection or in `readOnly`, and with `toolbar="none"` there is no Toolbar at all). Details are in the "Keyboard shortcuts popover" section.
- **Contents and order — one compact row; the kit sets the order, not `tools`**. Groups are separated by a divider:

  | Group       | Buttons and menus in order                                                         |
  | ----------- | ---------------------------------------------------------------------------------- |
  | Whole Block | "+" Slash menu · HTML · "¶" Block type · Alignment ▾                               |
  | Marks       | bold · italic · highlight · "…" (other Marks, code block, quote, clear formatting) |
  | Lists       | Lists ▾                                                                            |
  | Insert      | link · image · Table ▾ · emoji                                                     |
  | History     | undo · redo                                                                        |

  At the right edge are Find (the `search` Tool) and the Keyboard shortcuts popover. "Invisible characters" (the `invisibleCharacters` Tool) has no button of its own: it is the last checkbox section of the "…" menu of the fixed Toolbar, and "…" is rendered for it alone as well. A button or menu without its Tool enabled is not rendered, and a group without buttons disappears together with its divider: in `basic` the row is bold, italic, "…" | Lists ▾ | link | undo, redo | find and the Keyboard shortcuts popover at the right edge (a "¶" with only "Text" is not rendered). The floating Toolbar (`toolbar="floating"`) has the same contents and order, only without the "Invisible characters" item, Find and the Keyboard shortcuts popover; the Bubble menu (`toolbar="bubble"`) has its own short set — no alignment, with its own "Lists ▾" and "Color" (below).

- There are no separate buttons on the Toolbar for alignment, lists, quote, horizontal rule and code block: alignment and lists are menus, quote is a checkbox in "…", the rule is a Slash menu item ("+" and `/`), the code block is an item in "…" (they are used rarely). When the Toolbar is narrower than its content it wraps onto the next row instead of running past the edge — **by whole groups**: "Undo · Redo" never split across rows, the divider sits at the end of a group, and a wrapped row starts with a button. The full row in a 640px column takes two rows: "Invisible characters", search and the Keyboard shortcuts popover go to the second one, to the right edge.

### The "¶" menu — line type

The "¶" button opens the line type menu under the caret: **Text** (`Ctrl/⌘+Alt+0`), **Heading 1** (only with `heading1`, `Ctrl/⌘+Alt+1`), **Heading 2–4** (`Ctrl/⌘+Alt+2…4`). The shortcut is shown on every item: `⌘`, `⌥`, `⇧` joined with a plus on Mac and iOS (`⌘+⌥+2`), `Ctrl`, `Alt`, `Shift` elsewhere.

- **There are no lists or quote in "¶"** (the owner's decision): lists have the "Lists ▾" menu (on the Toolbar and in the Bubble menu), quote has the "Quote" checkbox in "…". They stay in the Block handle's "Format ›" and in the Slash menu ("/", "Turn into"): there a Block is turned into anything, rather than a line type being chosen.
- **The items come from the enabled Tools** (`heading`, `heading1`) plus the "¶" items of custom Tools; "Text" is always there as long as there is at least one other item. Without headings there is no "¶" button — that is the case in `basic`.
- **The line under the caret decides**: a paragraph in a list item or in a quote is "Text", a heading in a quote is its level. This type is checked, and it also appears in the button's accessible name ("Block type: Heading 2") and **on the icon**: the heading level (H1–H4), the icon of a custom Tool's item, and "¶" for text (before that the icon was always "¶", ADR-0054). In a code block the button says "Code block", the icon is "¶", and no item is checked: the code block is an item of "…".
- **A choice changes the line type in place** and keeps the text: a heading in a quote stays in the quote. Where the Schema does not allow this type for the line (a heading first in a list item), the Slash menu's "Turn into" takes over: the lists and quotes around the line are removed, the type is set. It is one edit, and `Ctrl/⌘+Z` undoes it whole. Choosing the current type changes nothing. Focus returns to the Document.

### The "…" menu — More formatting

The "…" button (tooltip and name — "More formatting", `editor.moreFormatting`) comes right after the "Highlight" button (in the Bubble menu, after "Color") and opens the menu of the remaining formatting: **Inline code** (`Ctrl/⌘+E`), **Underline** (`Ctrl/⌘+U`), **Strikethrough** (`Ctrl/⌘+Shift+S`), **Superscript** (`Ctrl/⌘+.`), **Subscript** (`Ctrl/⌘+,`), **Language ›** (a submenu), **Code block** (`Ctrl/⌘+Alt+C`), **Quote** (`Ctrl/⌘+Shift+B`), **Footnote** (no shortcut), **Clear formatting** (`Ctrl/⌘+\`). There are no colors in "…" — they have their own buttons (below). The shortcuts shown on the items come from the same table as the Toolbar tooltips and the Keyboard shortcuts popover. There are no shortcuts borrowed from familiar editors (`⌘H`, `⌘L`, `⌘⇧M`): macOS and the browser intercept them, and the label would promise something that does not fire.

- **The items come from the enabled Tools** (`code`, `underline`, `strike`, `superscript`, `subscript`, `language`, `codeBlock`, `blockquote`, `footnotes`, `clearFormatting`). Without any of them there is no "…" button; with one, the menu has a single item. In `basic`, "…" has inline code, strikethrough and quote. A Mark that has a button in the row of the Toolbar or the Bubble menu is not repeated in that menu's "…": the Bubble menu has no underline in "…" because it is in the row.
- **Marks are items with a check** (`menuitemcheckbox`, `aria-checked`): the Marks of the selection or caret are checked. A choice sets or removes the Mark in one edit (`Ctrl/⌘+Z` undoes it whole), closes the menu and returns focus to the Document. An item that does not apply here (a Mark inside a code block) is unavailable.
- **The code block is a separate section right after the Marks** (before that it was a Toolbar button between "HTML" and "¶"). It is a Block, not a Mark, so it comes after a divider, but it is the same checkbox item with a shortcut: all the toggles of "…" are listed one after another, and "Clear formatting" comes after them.
- The code block item is checked when the caret is in a code block; choosing it turns the selection's Blocks into a code block or back into text — in one edit, like `Ctrl/⌘+Alt+C`. It is unavailable where the engine does not allow a code block.
- The same item is in the "…" menu of the Bubble menu: the Bubble menu had no code block button, and that is where turning selected lines into code is convenient.
- **Quote is a checkbox next to the code block** (before that it was a "¶" item): checked when the caret is in a quote; choosing it wraps the selection's Blocks in a quote or removes it — in one edit, like `Ctrl/⌘+Shift+B`. Unavailable where the engine does not allow a quote. Present only if `blockquote` is enabled.
- **Footnote is an action, not a toggle**, in a section of its own between the quote and "Clear formatting", and without a shortcut (`Ctrl/⌘+Alt+F` is Find and replace here). Choosing it inserts a footnote reference at the end of the selection, makes its footnote and moves the caret into the footnote's text — in one edit, as the Slash menu item does. It is unavailable where a reference cannot stand: in a code block, in inline code and in a footnote. Present only if `footnotes` is enabled; with that Tool alone the "…" button still appears.
- **"Language ›" is a submenu** (the `language` Tool) in a section of its own after the Marks: radio items for the languages of the option, with "Remove language mark" below them. See the "Text part language" section.
- **On a narrow screen the submenu goes under the item** (narrower than 640px): there is no room at the side on a phone, so the submenu of the Block handle "⋮" and the "Table" menu (together with the size grid) open under their item on top of the parent menu. On a wide screen they open at the side, as before.
- There are no separate buttons on the Toolbar for inline code, underline, strikethrough, superscript, subscript, code block and clearing: "…" replaces them. The menu is built in the shared formatting menu module (`MoreFormatMenu` in `FormatMenus.tsx`) — the same "…" appears in the Bubble menu too.
- The row of frequently used Marks is shared by the Toolbar and the Bubble menu (`rowMarks.ts`): on the Toolbar it is bold and italic, in the Bubble menu also underline.
- **The "view" section at the end** holds the display modes of the Document, not formatting: **Invisible characters** (fixed Toolbar only), **Focus mode** and **Fullscreen**, each a checkbox item with no shortcut. "Focus mode" and "Fullscreen" are in the "…" menu of the Bubble menu too: with `toolbar="bubble"` it is the only menu there is. The floating Toolbar has no view section.

### The "Highlight" and "Color" buttons

Color is chosen by eye, from swatches, in one click — as in Tiptap's Notion-like template. Before that, text color and highlight were submenus of "…", and the "Highlight" button applied yellow in one click.

**Which button goes where** (the owner's decision — no duplicates): on the Toolbar (fixed and floating) there is only "Highlight", in the Bubble menu there is only "Color", which also has the highlight grid. Without the `color` Tool, the Bubble menu has "Highlight" — otherwise there would be no way to set a highlight there. **The trade-off of this decision:** text color is chosen only from the Bubble menu. Buttons cannot set it where there is no Bubble menu: with `selectionMenu={false}`, with `toolbar="floating"` and on a touch screen (there the fixed Toolbar replaces the Bubble menu). The Handle and engine commands remain.

- **"Highlight"** (the `highlight` Tool, tooltip — `editor.highlightToggle`): a click opens a row of nine highlights by hue — gray, brown, orange, yellow, green, blue, purple, pink, red — and "Remove highlight" (a crossed-out circle with a tooltip, `editor.highlightRemove`). The button's name states the current highlight ("Highlight: Pink", "Highlight: Custom #ffe066", "Highlight: None"), so it is audible without opening the popover; while the selection has a highlight, the button looks pressed. A click on the button itself no longer applies yellow: yellow is set by clicking its swatch.
- **"Color"** (the `color` Tool, `editor.color`): the letter "A" in the current text color and an arrow. The popover has two grids: **"Text color"** (`editor.textColorSection`: six tones, a swatch with the letter "A" in that color, and "Remove color" as the last cell, `editor.colorRemove`) and **"Highlight color"** (`editor.highlightSection`: the same nine highlights, and "Remove highlight" as the last cell). The highlight grid is there only if `highlight` is enabled too. Removal is a crossed-out circle with a tooltip at the end of the grid, as in "Highlight", not a white swatch at the start: that one looked like one more color and was checked when there is no color. With no color, nothing in the grid is checked, and focus on open is on the first swatch. Next to each grid's heading is **"Custom color…"**: it opens a `ColorPicker` popover (see the "Custom color" section below).
- **Roles — as in a WAI-ARIA Authoring Practices (APG) menu, not a radio group:** the popover is a `menu`, the grids are a `group` with a heading, the swatches and "Custom color…" are `menuitemradio` with `aria-checked` (the current one is marked with a ring around the swatch), "Remove color" and "Remove highlight" are `menuitem`. In a radio group an arrow key would choose right away and close the popover; here the arrow keys only move between swatches: `←` `→` — the neighboring swatch, `↑` `↓` — the same column in the row above or below (five per row), `Home` and `End` — the first and the last; Enter, Space and click apply.
- **Focus.** On open, it is on the checked color (or the first one). A choice applies the color in one edit (`Ctrl/⌘+Z` undoes it whole), closes the popover and returns focus to the Document, to the previous selection. Escape closes only the popover and returns focus to the button — in both `Dialog` and `Drawer` the dialog or drawer stays open (ADR-0041).
- **In the Bubble menu** the button itself holds the popover: while it is open, the button has `aria-expanded="true"` and the Bubble menu does not hide. In Source mode and on inline code the buttons are unavailable (`aria-disabled`) and do not open the popover. In `basic` neither button exists: neither `color` nor `highlight` is part of it.

### The "Alignment" and "Lists" menus

Both are menus from the same shared module as "¶" and "…" (`AlignMenu` and `ListMenu` in `FormatMenus.tsx`): radio items (`menuitemradio`) with the current value checked and shortcut labels from the shared table. The button's icon is the icon of the current value, its name is the value in words; a choice returns focus to the Document and is undone by a single `Ctrl/⌘+Z`.

- **Alignment ▾** (the `align` Tool): **Align left** (`Ctrl/⌘+Shift+L`), **Align center** (`Ctrl/⌘+Shift+E`), **Align right** (`Ctrl/⌘+Shift+R`). On an image selected as a whole the same three keys align the image instead of the text (see "Images"). The button's name is "Alignment: Align center"; for a Block without `data-align`, "Align left" is checked, and so it is for a selection with mixed alignment. Choosing the checked item changes nothing and puts no empty edit into history; choosing "Align left" restores the default. **There is no justify** — the decision is below, in "Color, highlight and alignment" (WCAG 1.4.8).
- **Lists ▾** (any of `bulletList`, `orderedList`, `taskList`): **Bulleted list** (`Ctrl/⌘+Shift+8`), **Numbered list** (`Ctrl/⌘+Shift+7`), **Checklist** (`Ctrl/⌘+Shift+9`) — the same kinds as in "Format ›" of the Block handle, only from the enabled Tools. The kind of the nearest list around the caret is checked (also in a quote inside an item), the button's name is "List: numbered", and outside a list it is "Lists" with the generic list icon. Choosing another kind works the same way as the Slash menu's "Turn into": the Block leaves the list and the quote and is wrapped again in one edit. **Choosing the checked kind again removes the list**, like the old toggle button. A menu with a single enabled kind stays a menu.
- Without the `align` Tool there is no alignment menu; without any list kind there is no "Lists" menu. In `basic` there is "Lists" with two items and no alignment.

### Floating Toolbar

`toolbar="floating"` shows the same Toolbar — the same buttons in the same order — above the selected text. The Toolbar hides on an empty selection (just a caret), and then it is gone from the screen, from the Tab order and from the screen reader. It shows with a short delay after the selection stops changing: while the mouse drags the selection, the Toolbar does not flicker. Tiptap's `BubbleMenu` (floating-ui) computes the position and the flip at the screen edge.

- **A touch screen gets the fixed Toolbar.** If the primary pointer is a finger (`pointer: coarse`: phone, tablet), the Editor renders the fixed Toolbar instead of the floating one: on iOS and Android the system "Copy / Paste" menu appears above the selection, and a floating Toolbar would compete with it for the same space. The media query is tracked live — a tablet with a mouse attached gets the floating one.
- **The Toolbar lives in the Editor's DOM**, not in a portal: it travels with the text in any scroll container (window, drawer, card). So an ancestor with `overflow: hidden` clips it at its edge — do not put the Editor in such a container right against the top, or use `toolbar="fixed"`.
- The layer is the `OVERLAY_LAYER.popover` step, like popovers. The Toolbar does not take part in the Escape stack: there is nothing to close in it, and Escape stays with the dialog or drawer around the Editor.

### Bubble menu: `selectionMenu` and `toolbar="bubble"`

By default the Bubble menu also appears on top of the fixed Toolbar (`toolbar="fixed"`, the `selectionMenu` prop, `true` by default): the Toolbar at the top is for everything; the Bubble menu keeps the mouse near the text. In that case `Alt+F10` moves focus to the Toolbar. `toolbar="bubble"` puts the **Bubble menu** in place of the Toolbar — a compact pill above the selected text, as in Notion and Medium. It sits on an **inverse surface**: dark in the light theme, light in `dark` and `dim` — so it blends neither with the text nor with the field under it.

- **The set is defined by the kit and is not configurable:** "¶" (line type, the same menu as on the Toolbar) · Lists ▾ (the same menu as on the Toolbar) · bold · italic · underline · Color ▾ (both grids — text and highlight; without `color`, "Highlight") · "…" (the other Marks and the code block — the same menu as on the Toolbar, but without underline: it is in the row here) · link (the same popover as `Ctrl/⌘+K`) · emoji (the same grid). A button of a disabled Tool is not rendered: `basic` has no emoji, and with `tools={["italic", "link"]}` two buttons remain. There is no undo, redo, Keyboard shortcuts popover or rare Marks in the Bubble menu — it is about the selected text.
- **Bold, italic and underline are toggles** with `aria-pressed`; the tooltip names the shortcut from the same table as the Toolbar's, and the button announces it with `aria-keyshortcuts`.
- **Display and position are as in the floating Toolbar:** the Bubble menu appears when the selection has settled, and hides on an empty selection, on a selected image (it has its own panel) and when focus has left the Editor. At the edge of the viewport or a scroll container it flips below the selection and shifts inward. In `readOnly` there is no Bubble menu.
- **A touch screen gets the fixed Toolbar**, for the same reason as with `floating`: the system selection menu of iOS and Android appears in the same place.
- **Menus and popovers opened from the Bubble menu use the regular popover surface**, not the inverse one: "¶", "…", the link field and the emoji grid look the same as when opened from the Toolbar. Escape in an open menu closes only the menu and returns focus to its button in the Bubble menu; inside `Dialog` and `Drawer` the dialog or drawer stays open.
- **The Bubble menu lives in the Editor's DOM**, like the floating Toolbar: it travels with the text in a scroll container, and an ancestor with `overflow: hidden` clips it at its edge. The layer is `OVERLAY_LAYER.popover`.
- The Bubble menu's name is `editor.selectionToolbar` ("Selection formatting" in English, "Форматирование выделения" in Russian): the screen reader tells it apart from the Toolbar.
- **The colors are inverse surface tokens** `--surface-inverse`, `--surface-inverse-hover`, `--surface-inverse-pressed`, `--text-on-inverse` and the focus outline `--accent-on-inverse` ([palette.md](../../palette.md#inverse-surface)). On the Paper (`surface="paper"`) the Bubble menu stays in the app theme, like the Toolbar.

### Glass on overlays

Everything the Editor shows above the Document sits on **Glass** — a semi-transparent background of its surface that blurs what is behind it: the floating Toolbar and the image panel, the Bubble menu, menu lists ("¶", "…", alignment, lists, table, Slash menu, Block handle, code block language), popovers (link, image, custom color, emoji, Keyboard shortcuts popover, popovers of the buttons, Insert items and Block actions of a custom Tool) and the Text card. The background is 82% of the surface token in `color-mix`; the blur is 14px, as in toasts (ADR-0010); tooltips keep their own 85% and 10px.

- **The color is the token of its own surface:** the Toolbar and popovers use `--bg-1`, menu lists use `--surface-elevated`, the Bubble menu uses `--surface-inverse`. The theme changes the token, and the Glass changes with it.
- **A solid background under `prefers-reduced-transparency: reduce` and `prefers-contrast: more`:** under a semi-transparent background, text contrast depends on what lies beneath the menu, and a user who asked the system to remove transparency or raise contrast gets the old solid surface without blur.
- **A solid background on iOS:** in Safari on iOS 27 the menu's Glass background was not rendered at all, and the items ended up on top of the Document text. So on iOS (the condition `@supports (-webkit-touch-callout: none)`, which only WebKit on iOS understands) the Glass is replaced with a solid surface without blur; desktop Safari, Chrome and Firefox keep the Glass.
- **The Editor only.** The kit's `Menu` and `Popover` outside the Editor stay solid: the Editor passes the Glass to them as a class, and the public API did not change.

### Keyboard: `Alt+F10`

`Alt+F10` (`⌥F10` on Mac) from the Document moves focus to the first button of the Toolbar — fixed, floating or the Bubble menu; the key shows the floating Toolbar and the Bubble menu at once, without waiting for the delay. The shortcut is the same as in CKEditor and TinyMCE: APG has none of its own, and one shortcut for all editors is easier to remember. Tab is not an option here — in the Document it indents a list item.

- Inside the Toolbar, the arrow keys, Home and End work as usual. A button that has fired returns focus to the Document, to the same selection; if nothing was pressed, `Shift+Tab` moves focus back: the floating Toolbar sits in the DOM right after the Document.
- The Toolbar does not intercept Escape: in a dialog or drawer it closes it (see "Accessibility and forms").
- On an empty selection of the floating Toolbar and the Bubble menu, and with `toolbar="none"`, the key does nothing and passes on.
- The Toolbar announces the shortcut with `aria-keyshortcuts="Alt+F10"` — the screen reader names it on the Toolbar itself.
- From the Source mode field, `Alt+F10` moves focus to the "HTML" button: the other Toolbar buttons are `aria-disabled` there, and it is the first one that works (Enter on it switches back to visual mode, and the arrow keys move on through the Toolbar). See the "Source mode" section.
- **An open Text card** takes priority over the Toolbar: `Alt+F10` moves focus into it, Escape returns the caret; while the Text card is hidden or closed, the key moves focus to the Toolbar (see the "Text card" section).
- With the caret in a code block, `Alt+F10` moves focus first to that Block's language button, then to "Copy", then to the Toolbar (see the "Code block" section). Likewise, on a selected image the key moves focus to its panel.

## Keyboard shortcuts popover

The button with a keyboard icon ("Keyboard shortcuts") is the last one on the fixed Toolbar, at the right edge. It opens the kit's `Popover` with a "command — shortcut" list that is **read-only**: the rows are not clickable, this is not a command palette.

- **There is no button on a phone.** On a touch screen without hover (`@media (hover: none) and (pointer: coarse)` — a phone, a tablet without a trackpad) there are no shortcuts, so the Keyboard shortcuts button is hidden, and menu items ("¶", "…", table, Slash menu, Block handle) do not show shortcut labels. A tablet with a trackpad and a laptop with a touch screen keep the tooltips.
- **The markup is a table** with the column headers "Command" and "Shortcut"; the shortcut is the kit's `Kbd` (`<kbd>`). A screen reader reads a row as a "command — shortcut" pair.
- **Custom buttons.** The shortcut of a custom Tool's button (the `shortcut` field) goes into the Keyboard shortcuts popover as a separate group without a heading after the kit's groups, in `tools` order; the label uses the `UiProvider` locale. Keyboard shortcuts bound by a custom Tool's Extensions do not appear here — see the "Custom Tool's button" section.
- **Group order:** selection (the first `⌘A` selects the Block's text, the second the whole Document; with the `blockSelection` Tool also `Esc` — select the Block — and `Shift+↑/↓` — extend the selection), undo and redo, Block commands (duplicate, up, down, handle menu), clear formatting, Marks (bold, italic, strikethrough, underline, inline code, superscript and subscript), Block type (text, headings, quote, code block), lists and item indent (`⌘]` and `⌘`), alignment, link, search (`Ctrl/⌘+F`, `Ctrl/⌘+Alt+F`), moving to the Toolbar (`Alt+F10`).
- **The set depends on `tools`.** A row exists only for the command of an enabled Tool: `basic` has no headings, underline, superscript and subscript, alignment, task list or code block, and the item indent is there with any of the three lists. Heading 1 only with `heading` and `heading1` together. Commands without a Tool of their own are always there: selection, duplicating and reordering a Block, the Block handle menu, `Alt+F10`.
- **Custom Tools.** The shortcuts of their Insert items and Block actions (the `shortcut` field) form a group without a heading after the kit's groups, one group per Tool, in `tools` order; a row's label is the UI contribution's label in the current locale.
- **Width follows the content:** the popover is as wide as the longest row, with no empty gap between the command and the shortcut; the screen edge limits it, and a long list scrolls.
- **Labels.** Keys are joined with a plus on all platforms: `⌘+⇧+Z` on Apple and `Ctrl+Shift+Z` elsewhere. The macOS run-together form (`⌘⌥⇧↑`) reads as one word in a long list. The Apple detection is the same as ProseMirror's, that is, the one the engine uses to decide which key is `mod`. `Kbd` renders the symbols `⌘ ⌥ ⇧ ⌃` in a proportional font: a monospace stack has no `⇧`, and the fallback glyph comes out thin.
- **One command table is the source of truth.** The tooltips and `aria-keyshortcuts` of Toolbar buttons, the labels in the Slash menu and the Keyboard shortcuts popover read shortcuts from one table (`src/editor/core/shortcuts.ts`: command id, Tool, keyboard shortcut, a label from the message catalog). The extensions bind the keyboard shortcuts, and the table labels them; so that a label never promises what is not there, `tests/rich-text-editor-shortcuts.test.tsx` presses every shortcut of the table in a live Editor and checks the result.
- **Closing.** Escape and a click outside close the popover and return focus to the button (if the click itself put focus on a field or button, it is not taken away). Inside `Dialog` and `Drawer`, Escape closes only the Keyboard shortcuts popover, not the dialog or drawer ([ADR-0041 (ADR-0041)).
- **Not shown:** in `readOnly`, with `toolbar="none"`, above the selection in `toolbar="floating"` and in the Bubble menu (`toolbar="bubble"`); on a touch screen they are replaced by the fixed Toolbar, but the Keyboard shortcuts button is hidden there by the rule at the start of the section: on a phone and on a tablet without a trackpad it is absent.

Message catalog strings: `editor.shortcuts` (the name of the button and popover), `shortcutsCommand` and `shortcutsKeys` (column headers), and the labels of commands without a button of their own — `selectBlock`, `selectDocument`, `duplicateBlock`, `moveBlockUp`, `moveBlockDown`, `blockActions`, `indentListItem`, `outdentListItem`, `focusToolbar`, and with the Block selection Tool `blockSelectionSelect` and `blockSelectionExtend`.

## Block handle "⋮"

A Block **with the caret in it** gets a "⋮" button to the left of its first line — the Block handle ("Block actions"). Hovering the mouse does not show the handle (the owner's decision): it does not flicker at every paragraph under the pointer. It is visible while focus is in the Document, on the handle itself or in its menu; in `readOnly` it does not exist, nor does it in a disabled field. A Document being edited has a left margin for the handle (it is wider by the same amount on the Paper), and the handle does not cover the text.

A click or `Ctrl/⌘+/` from the Document opens a menu — the kit's `Menu`:

| Item             | Action                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add ›**        | A submenu with the Insert items of the enabled Tools (paragraph, headings, lists, quote, code block, horizontal rule, table, image). A choice puts a **new Block under the current one** and the caret in it; without `insertMenu` the item is absent     |
| **Format ›**     | A submenu with the Block types (Text, Heading 1–4, Quote, three kinds of lists): turns the Block into the chosen type; the current type is checked. A table, an image and a rule cannot be turned — the item is visible but unavailable (`aria-disabled`) |
| **Up**, **Down** | Swap the Block with its neighbor; for the first and last Block the matching item is unavailable                                                                                                                                                           |
| **Duplicate**    | A copy under the Block, the caret goes into the copy                                                                                                                                                                                                      |
| **Delete**       | A red item (the `danger` tone of a `Menu` item). Deletes the Block, the caret goes into the Block above (below for the first one); if it is the only Block, it is replaced with an empty paragraph                                                        |
| **Select**       | With the `blockSelection` Tool: selects the Blocks whole (see the "Block selection" section). It is the way in on a touch screen; it is not shown when Blocks are already selected                                                                        |
| **Wrap in ›**    | Over a group or a selected Block: puts the Blocks into one Wrapper, one quote or one collapsible Block (see "A group of Blocks" below); only the containers whose Tools are enabled                                                                       |

- **The Block as a whole.** The handle sits at a Document Block: a paragraph, a heading, a whole list, a task list, a quote, a code block, a table, an image, a horizontal rule. With the caret in a list's second item, the handle is at the list's first line, and the menu actions apply to the whole list; "Format › Heading 2" turns all its items into headings. A selection across several Blocks keeps the handle at the first Block it touches, and the menu acts on all of them (see "A group of Blocks" below).
- **Shortcut labels only when the shortcut does the same thing.** For a top-level paragraph or heading the items are labeled: `⌥+⇧+↑/↓`, `⌘+⇧+D`, the "¶" shortcuts in "Format ›". In a list item `⌥⇧↑` moves the item, not the list, so there are no labels; in a table `⌥⇧↑/↓` belong to rows, so "Up" and "Down" have no label, while `⌘⇧D` copies the whole table, so "Duplicate" has one. "Add ›" has no labels: the shortcuts change the current Block, and the item puts a new one.
- **One edit to undo**, and focus after the action is in the Document. Escape closes the submenu, then the menu, and returns focus to the Document; inside `Dialog` and `Drawer` the dialog or drawer does not close (ADR-0041).
- **Keyboard.** The handle is outside the Tab order (in the Document Tab indents a list item); `Ctrl/⌘+/` moves focus to it — like "Block actions" in Notion, and browsers and systems leave this shortcut free in a field. The row is in the Keyboard shortcuts popover; the handle has `aria-keyshortcuts`.
- **Tool actions.** Custom Block actions (`blockActions` of a Tool description, like "Unwrap" of the Wrapper) appear as a separate section before "Delete": only for Blocks whose names are listed in `blocks`, and filtered by a visibility predicate; `run` receives the Block's position. Custom Insert items go into "Add ›" and "Format ›" (see the "Custom Tool" section).
- **There is no dragging by the handle** (the owner's decision).
- **Column layout** (see the "Column layout" section). A column is a container of Blocks, like the Document: a Block in a column has its own handle at the column's left edge, and its actions do not leave the column. In "Add ›" the Column layout is a submenu of six variants; a Block in a column has the "Layout ›" item (a variant of its Column layout), and for a Column layout selected as a whole, "Format ›" holds these six variants with the current one checked.
- **Wrapper** (see the "Wrapper" section). A Wrapper is also a container of Blocks: a Block in it has its own handle at the Wrapper's left edge, and its actions do not leave it. The items **"Tone ›"** and **"Unwrap"** are available for a Block directly in a Wrapper and for the Wrapper itself selected as a whole (Backspace on the Block under it); for the Wrapper, "Up", "Down", "Duplicate" and "Delete" apply to the Wrapper together with its content, and "Format ›" is unavailable — it has no Block type.
- **Placement.** The handle lives in the Editor's DOM and travels with the text in any scroll container, in `Dialog` and `Drawer`; the sticky Toolbar and popovers cover it. The position is recomputed on every edit and on resize.

### A group of Blocks

When a text selection touches several Blocks (or Block selection holds one or more), the handle stands at the first of them and its menu acts on the whole row (ADR-0077). This is in the core: every Editor has it, with or without the `blockSelection` Tool.

- **What a Block is.** With the text selection it is the same whole Block as for one: a list touched at one item is the whole list. With Block selection it is the **unit** (the Block of its container; in a list, the item), exactly what is highlighted.
- **Items.** **Format ›**, **Wrap in ›**, **Up**, **Down**, **Duplicate**, **Delete** (and **Select**, if the Tool is on). There is no "Add ›", no "Layout ›" or "Tone ›", and no Block actions of Tools: those are written for one Block. A selected single Block has the whole single-Block menu plus "Wrap in ›".
- **Delete** removes all the Blocks (the container is never left empty: the last Block yields to an empty paragraph), **Duplicate** copies the row under itself, **Up** and **Down** swap the row with the neighbour.
- **Format ›** turns every text Block of the row into the chosen type. A table, an image, a rule and the containers (Wrapper, Column layout, Details) stay as they are; the item is unavailable when nothing in the row can change. A list is **one** list: neighbouring Blocks turned into a list become one list of that many items, and a Block that stays ends the run, so a table in the middle makes two lists. "Text" breaks a list into paragraphs. A quote is **one** quote in the same way: neighbouring text Blocks become one quote of that many paragraphs. The current type is checked when all text Blocks share it.
- **Wrap in ›** puts **all** the Blocks into one container: a **Wrapper**, a **quote** or a **collapsible block** (the caret goes into its empty title, and it is open). The Schema decides where it is allowed: a Wrapper does not hold a Wrapper or a Column layout and stands only in the Document or a column, nothing goes into a list, so there the item is unavailable. Items of Tools that are off are absent.
- **One edit.** Every action of a group is one transaction: one `Ctrl/⌘+Z` undoes it. After it focus is in the Document, and the screen reader hears the result through the Field notice (`status`): "Blocks deleted: 3", "Blocks wrapped: 3".

Message catalog strings: `editor.blockActions` (the name of the handle, menu and Keyboard shortcuts popover row), `blockAdd`, `blockFormat`, `blockMoveUp`, `blockMoveDown`, `blockDuplicate`, `blockDelete`, and for a group `blockSelect`, `blockWrap` and the results `blocksDeleted`, `blocksDuplicated`, `blocksMoved`, `blocksChanged`, `blocksWrapped`. Icons — `MoreVerticalIcon`, `AddIcon`, `ParagraphIcon`, `ArrowUpIcon`, `ArrowDownIcon`, `DuplicateIcon`, `DeleteIcon`, `BlockSelectIcon`, `WrapperIcon`, `QuoteIcon`, `DetailsIcon` from `@olddevs/ui/icons`.

## Keyboard: Block commands

Block commands work as in Notion and Google Docs. They have no markup of their own, so they exist with any `tools` set (except clear formatting — it comes with the `clearFormatting` Tool). Every command is **one edit**: `Ctrl/⌘+Z` undoes it whole. In `readOnly` and `disabled`, editing commands do not change the Document and hand the shortcut back to the browser; `⌘A` works there too — it does not change the Document, only the selection.

| Shortcut (Mac / others)          | Action                                                                                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `⌘⇧D` / `Ctrl+Shift+D`           | Duplicate a Block: the copy lands right under it, and the caret goes into the copy at the same place                                                                                         |
| `⌥⇧↑` / `Alt+Shift+↑`            | Move the Block up                                                                                                                                                                            |
| `⌥⇧↓` / `Alt+Shift+↓`            | Move the Block down                                                                                                                                                                          |
| `⌘/` / `Ctrl+/`                  | Open the Block handle menu (see the "Block handle "⋮"" section)                                                                                                                              |
| `⌘A` / `Ctrl+A`                  | The first press selects the current Block's text, the second the whole Document. If the Block's text is already selected or the Block is empty, the first press selects the Document at once |
| `⌘]` and `⌘[` / `Ctrl+]` and `[` | Indent and outdent a list or task list item — the same as `Tab` and `Shift+Tab`                                                                                                              |
| `⌘\` / `Ctrl+\`                  | Clear the selection's formatting — the same as the "Clear formatting" item of the "…" menu (`clearFormatting`)                                                                               |

- **What a Block is.** A top-level Block of the Document — a paragraph, a heading, a quote, a code block, an image, a whole table, a horizontal rule, a whole list. In a list a Block is an item: the copy lands in the same list, and an item moves among its neighbors and never leaves the list. A selection across several Blocks is duplicated and moved whole.
- **A group of Blocks.** The same keys act on all the Blocks of a Block selection (see the "Block selection" section), and the handle's menu acts on all the Blocks a text selection touches.
- **At the edge** of the Document or a list, moving does nothing: there is no neighbor. The shortcut is still swallowed — otherwise on Mac it would extend the selection.
- **In a table** `⌥⇧↑/↓` does not work: a selection inside one table moves neither the table nor its rows, and `Alt+↓` still adds a row (see the "Tables" section). A table moves when the selection starts or ends outside it. Duplicating from a cell copies the whole table.
- **`⌘]` and `⌘` outside a list** do nothing and hand the shortcut back to the browser (in Chrome on Mac these are "Forward" and "Back"): the Schema has no paragraph indent. In a list item the shortcut is swallowed even when there is nowhere to indent.
- **Why not the shortcuts of familiar editors.** On Mac `⌘⇧↑/↓` means "select to the start or end of the document", and `⌘⇧A` in Chrome is tab search: you cannot take them from the system. Moving is `⌥⇧↑/↓`, as in VS Code.
- The "Clear formatting" item of the "…" menu is labeled `⌘\` (`Ctrl+\` elsewhere).

## Block selection

The `blockSelection` Tool (in `full`, not in `basic`) selects Blocks whole, as in Notion (ADR-0077): the Blocks are highlighted, there is no caret and no text selection, and the keys and the clipboard act on the Blocks. The term is Block selection; it is not a text selection and not the selection of an Atom (an image, a formula). The Tool has no Block and no markup: the Schema, the sanitizer, Markdown, JSON and `RichTextView` do not change, and the saved HTML shows no trace of the mode. The Block handle over a row of Blocks (the previous section) is in every Editor; the mode is this Tool.

```tsx
<RichTextEditor /> {/* Esc in the text selects the Block */}
<RichTextEditor preset="basic" /> {/* no Block selection: a comment field in a Dialog closes on one Esc */}
<RichTextEditor tools={RICH_TEXT_PRESETS.full.filter((name) => name !== "blockSelection")} />
```

- **The unit is the Block of its container**, the same rule as `Ctrl/⌘+Shift+D` and `Alt+Shift+↑/↓`: a child of the Document, of a column, of a Wrapper or of the content of a Details Block. In a list the unit is the **item**; a table is one Block as a whole, even when a cell holds a list. A selection is always neighbours of one container.
- **The way in.** `Esc` in the text selects the current Block (a text selection across Blocks gives all of them; `Esc` in a table cell gives the whole table). `Shift+↑/↓` grows the selection by a neighbour, and the same keys shrink it back; the anchor stays where the selection started. `Shift+click` on another Block draws the selection to it. The "Select" item of the Block handle's menu does the same as `Esc`; on a touch screen, after "Select" a tap on another Block draws the selection to it, as `Shift+click` does, while a tap in the text of a selected Block puts the caret there. There is no frame drawn by the mouse and no dragging of the selected Blocks (the owner's decision, as with the handle).
- **The borders go up a level.** `Shift+↑/↓` past the edge of a column, a Wrapper, the content of a Details Block or a list selects the container whole and goes on at its level; through two columns it is the whole Column layout, the row `Ctrl/⌘+Shift+D` takes. `Shift+click` in another container lifts the row the same way.
- **`↑/↓`** moves a single selection to the neighbour; a group collapses onto the Block just beyond its edge. At the edge of the container the selection stays.
- **`Esc` goes one level at a time.** The first `Esc` in the text selects the Block and is **taken**: it does not close a `Dialog` or a `Drawer` around the field. The second `Esc` ends the selection (the caret goes to the end of the first Block, as with `Enter`) and goes on, so it closes the layer (ADR-0041). In a `Dialog` this is two `Esc` instead of one, like any nested layer; a screen that does not want it removes the Tool from `tools`. A layer of the Editor that owns `Esc` (the Slash menu, a Text card, a popover, a menu) keeps it: `Esc` closes that layer, and nothing is selected.
- **Keys inside the selection.** `Backspace` and `Delete` remove the Blocks (one edit, the caret goes to the neighbour); `Ctrl/⌘+Shift+D` and `Alt+Shift+↑/↓` duplicate and move the group; `Ctrl/⌘+/` opens the handle's menu; `Enter` returns the caret to the end of the first Block; a printable character is **ignored** (one key must not erase a section); a click into the text is an ordinary caret.
- **The clipboard.** `Ctrl/⌘+C` and `Ctrl/⌘+X` put whole Blocks (HTML and text), `Ctrl/⌘+V` **replaces** the selected Blocks with the pasted content. `Ctrl/⌘+Z` brings the Blocks back selected; the selection also follows an edit made around it.
- **The look.** The Blocks are painted whole on `--rte-selection` with the Document's radius, the same role as selected table cells and selected text, in every theme and on the Paper. The root gets `data-block-selection` while it lasts, and the native selection paint and the caret are hidden. The "⋮" stands at the first Block of the group.
- **Announcements.** The Field notice (`status`) tells the screen reader "Blocks selected: 3" on every change of the count, "Block selection cleared", and the result of an action: "Blocks deleted: 3", "Blocks duplicated", "Blocks moved", "Blocks changed", "Blocks wrapped", "Blocks copied", "Blocks cut", "Blocks replaced". An identical text twice in a row is not announced again.
- **`readOnly` and `disabled`.** In `readOnly`, `Esc`, `Shift+↑/↓` and `Shift+click` work, and of the actions only `Ctrl/⌘+C` (there is no handle). A read-only Document has no `tabindex` of its own, so with the Tool on it gets `tabindex="0"`: it is in the Tab order and a click into it takes focus, which is what the keys need (this is the accessibility cost of the Tool in a read-only field; `RichTextView` is unaffected). A `disabled` field does nothing and stays out of the Tab order.
- **Bubble menu.** The text pill does not show over selected Blocks.
- **Lazy.** The keys, the highlighting and the announcements are a separate chunk that the Tool's Loader brings (ADR-0058, item 11.1), only to an Editor that names `blockSelection` in `tools`; `basic` does not load it. In `full` it arrives with the code block and the table chunks, and until then the field is a Skeleton: no `Esc` handling, no "⋮" menu, and the Tool's commands return `false`. The `BlockSelection` class and the Block handle over a row of Blocks are in the Editor's start chunk, because every Editor reads them.

### Block selection state and commands

`useRichTextToolState(ref, "blockSelection")` reads the state and `ref.current?.tool("blockSelection")` calls the commands. The general rules for both are in the "Handle (`ref`) and a custom toolbar outside the field" section.

| State field | Meaning                                                                                 |
| ----------- | --------------------------------------------------------------------------------------- |
| `count`     | How many Blocks are selected; `0` means a caret or a text selection, no Block selection |

| Command           | What it does                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectCurrent()` | Select the Blocks under the selection, the same as `Esc`, without moving focus. Works in `readOnly`. `false` in the Source mode, in a `disabled` field and where the selection is in no Block (a gap cursor between Blocks) |
| `clear()`         | End the selection and put the caret at the end of the first Block, like the second `Esc` (without letting the key through). `false` when no Blocks are selected                                                             |

There are no options. Message catalog strings: `editor.blockSelect`, `blockSelectionSelect`, `blockSelectionExtend` and the announcements `blocksSelected`, `blockSelectionCleared`, `blocksCopied`, `blocksCut`, `blocksReplaced` (and the results of the group actions listed in the previous section). Icon — `BlockSelectIcon` from `@olddevs/ui/icons`.

## Links

The `link` Tool: the "Link" button on the Toolbar and `Ctrl/⌘+K` open a popover with a URL field next to the selected text.

- **Enter** (or "Apply") turns the selection into a link and returns focus to the Document. Without a selection the URL is inserted as the link text. With the caret in an existing link, the field shows its URL, Enter changes it for the whole link text, and the **"Remove link"** button removes the link and leaves the text. An empty field plus Enter is the same removal.
- **Escape** cancels and returns focus to the Document, to the previous selection. Inside `Dialog` and `Drawer`, Escape closes only the popover: the kit's `Popover`, dialogs and drawers are one Radix layer stack ([ADR-0041 (ADR-0041)). A click elsewhere closes the popover, and focus stays where you clicked.
- The URL is entered as in a browser's address bar: `example.com` becomes `https://example.com`, and `team@example.com` becomes `mailto:team@example.com`.
- **Only absolute URLs with the `http`, `https` or `mailto` protocol are allowed.** The field does not accept `javascript:`, `data:`, `ftp:` or a relative URL (`/docs`, `#part`) — an error appears under the field, and the link is not set. Relative URLs are excluded on purpose: a Document leaves the page where it was written, whether into a `RichTextView` on another route, into an email or into Markdown. A relative URL there means something else or nothing, and anchors in a Document have nothing to point at. The rule can be loosened later without breaking saved data; tightening it cannot.
- **Autolink while typing:** a URL in the text (`example.com`, `https://…`, an email address) becomes a link when you type a space after the word. Pasting a URL over a selection turns the selection into a link. Both paths go through the same protocol check. A URL in pasted text becomes a link too, with `https://` when it has no scheme, as while typing. A pasted link keeps its own address even when its text looks like another address: `<a href="https://example.com/docs?page=1#top">example.com/docs</a>` from Word or a web page stays a link to the full address.
- **In the Editor a link does not open on click** — a click puts the caret, as in any text. `RichTextView` and a `readOnly` field open links like ordinary `<a>` elements.
- On output every link is `<a href="…" rel="noopener noreferrer">`. `target`, `class`, `title` and `rel` from incoming HTML are dropped: whether a link opens in a new tab is for the page that shows the Document to decide, not the data.

## Tools and Presets

`preset="full"` (default) is everything in the release except the Table of contents `toc`, Typography `typography`, formulas `mathematics` and video `youtube`, `twitch`: the Table of contents changes the layout of the field, Typography changes the text being typed, formulas pull in the lazy KaTeX chunk, and video calls a third-party service (CSP and privacy), so they are switched on only explicitly. `preset="basic"` is for comments and short descriptions. `tools` is an exact list and takes precedence over a Preset; descriptions of custom Tools can be mixed in with the kit's names (see the "Custom Tool" section). The type of a `tools` element is `Tool` (a kit name, a Configured Tool from `tool(…)`, a `defineTool(…)` definition or a `CustomTool`), the type of a kit name is `ToolName`; both are exported from `@olddevs/ui/editor`.

Presets are also exported as arrays of names — `RICH_TEXT_PRESETS.full` and `RICH_TEXT_PRESETS.basic` — so that you can assemble your own set from them: `tools={[...RICH_TEXT_PRESETS.full, mergeTagTool]}`. The arrays are frozen. A Preset's content is "what the kit considers the full set", not a frozen list: a new built-in Tool arrives in a Preset in a minor version. If you need a stable set, pass an exact list of names.

**A disabled Tool removes both the button and the Schema extension.** Its Block or Mark cannot be created with a keyboard shortcut, a Markdown shortcut or a paste, and from `value` they arrive without Block markup, and the text stays.

| `Tool`                | Button                                               | Markup                                                    | Shortcut                                                 | Markdown while typing  | `basic` |
| --------------------- | ---------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- | ---------------------- | ------- |
| `heading`             | "¶": Heading 2–4                                     | `h2`, `h3`, `h4`                                          | `Ctrl/⌘+Alt+2…4`                                         | `## `, `### `, `#### ` | —       |
| `heading1`            | "¶": adds Heading 1                                  | `h1`                                                      | `Ctrl/⌘+Alt+1`                                           | `# `                   | —       |
| `history`             | Undo, Redo                                           | —                                                         | `Ctrl/⌘+Z`, `+Shift+Z`                                   | —                      | yes     |
| `bold`                | Bold                                                 | `strong`                                                  | `Ctrl/⌘+B`                                               | `**text**`             | yes     |
| `italic`              | Italic                                               | `em`                                                      | `Ctrl/⌘+I`                                               | `*text*`               | yes     |
| `underline`           | "…": Underline                                       | `u`                                                       | `Ctrl/⌘+U`                                               | —                      | —       |
| `strike`              | Strikethrough                                        | `s`                                                       | `Ctrl/⌘+Shift+S`                                         | `~~text~~`             | yes     |
| `code`                | "…": Inline code                                     | `code`                                                    | `Ctrl/⌘+E`                                               | `` `text` ``           | yes     |
| `superscript`         | "…": Superscript                                     | `sup`                                                     | `Ctrl/⌘+.`                                               | —                      | —       |
| `subscript`           | "…": Subscript                                       | `sub`                                                     | `Ctrl/⌘+,`                                               | —                      | —       |
| `clearFormatting`     | "…": Clear formatting                                | — (removes Marks)                                         | `Ctrl/⌘+\`                                               | —                      | —       |
| `link`                | Link (URL popover)                                   | `a[href]`                                                 | `Ctrl/⌘+K`                                               | `[text](url)` on paste | yes     |
| `color`               | Color ▾ (Bubble menu): "Text color"                  | `span[data-color]`, `span[style]`                         | —                                                        | —                      | —       |
| `highlight`           | Highlight ▾ (Toolbar), "Color ▾"                     | `mark[data-color]`, `mark[style]`                         | —                                                        | —                      | —       |
| `align`               | Alignment ▾ (menu)                                   | `p`, `h2`–`h4` with `data-align`                          | `Ctrl/⌘+Shift+L`, `+E`, `+R`                             | —                      | —       |
| `language`            | "…": Language ›                                      | `span[lang]`                                              | —                                                        | —                      | —       |
| `bulletList`          | Lists ▾: Bulleted list                               | `ul`, `li`                                                | `Ctrl/⌘+Shift+8`                                         | `- ` or `* `           | yes     |
| `orderedList`         | Lists ▾: Numbered list                               | `ol`, `li`                                                | `Ctrl/⌘+Shift+7`                                         | `1. `                  | yes     |
| `taskList`            | Lists ▾: Checklist                                   | `ul[data-type=taskList]` and items                        | `Ctrl/⌘+Shift+9`                                         | `[ ] ` or `[x] `       | —       |
| `blockquote`          | "…": Quote                                           | `blockquote`                                              | `Ctrl/⌘+Shift+B`                                         | `> `                   | yes     |
| `codeBlock`           | "…": Code block                                      | `pre`, `code class="language-*"`                          | `Ctrl/⌘+Alt+C`                                           | ` ``` `                | —       |
| `horizontalRule`      | "+": Divider                                         | `hr`                                                      | —                                                        | `---`                  | —       |
| `table`               | Table ▾ (menu)                                       | `table`, `tbody`, `tr`, `th`, `td`, `colgroup`, `col`     | `Tab`, `Shift+Tab`, `Alt+↓` in a table                   | —                      | —       |
| `image`               | Image (URL popover)                                  | `figure`, `img`, `figcaption`                             | `Ctrl/⌘+Shift+L`, `+E`, `+R` on a selected image         | `![alt](url)` on paste | —       |
| `emoji`               | Emoji (popover with a grid)                          | — (plain text)                                            | —                                                        | —                      | —       |
| `source`              | HTML (mode toggle)                                   | — (edits the Document's HTML)                             | —                                                        | —                      | —       |
| `search`              | Find (find and replace panel)                        | — (searches the Document)                                 | `Ctrl/⌘+F`, `Ctrl/⌘+Alt+F`                               | —                      | yes     |
| `invisibleCharacters` | "…": Invisible characters                            | — (draws marks over the Document)                         | —                                                        | —                      | —       |
| `blockSelection`      | "⋮": Select                                          | — (selects whole Blocks)                                  | `Esc`, `Shift+↑/↓`, `Shift+click`                        | —                      | —       |
| `fullscreen`          | "…": Fullscreen; Collapse                            | — (a layer over the window)                               | `Esc` — collapse                                         | —                      | —       |
| `focus`               | "…": Focus mode                                      | — (dims Blocks around the Block)                          | —                                                        | —                      | —       |
| `layout`              | "+": Layout                                          | `div` with `data-block` and `data-layout`                 | `Tab`, `Shift+Tab`, arrow keys at the column edge        | —                      | —       |
| `wrapper`             | "+": Wrapper                                         | `div[data-block=wrapper]`                                 | `Enter` in an empty last paragraph — exit                | —                      | —       |
| `details`             | "+": Collapsible block                               | `details`, `summary`, `div[data-type=detailsContent]`     | `Enter` in the title and at the empty end of the content | —                      | —       |
| `mathematics`         | "+": Formula, Block formula                          | `span`, `div` with `data-type` and `data-latex`           | `Enter` on a selected formula                            | `$$x$$`, `$$$x$$$`     | —       |
| `date`                | "+": Date                                            | `time[datetime]`                                          | `Enter` on a selected mention                            | —                      | —       |
| `footnotes`           | "+", "…": Footnote                                   | `sup[data-footnote-ref]`, `section[data-block=footnotes]` | `Enter` on a reference and in a footnote — jump          | —                      | —       |
| `insertMenu`          | "+" Slash menu                                       | — (Blocks of other Tools)                                 | —                                                        | `/`                    | —       |
| `pasteCleanup`        | — (cleans a paste from Word, Excel, Google Docs)     | — (markup of other Tools)                                 | —                                                        | —                      | yes     |
| `toc`                 | Table of contents in the left gutter (not in `full`) | — (reads the headings)                                    | —                                                        | —                      | —       |
| `typography`          | — (replacements while typing; not in `full`)         | — (plain characters)                                      | `Backspace` right after a replacement — undo             | `--`, `...`, `"`, `->` | —       |
| `youtube`             | «+»: Video (not in `full`)                           | `div[data-block=video]` with a link                       | `Enter` after a link in a paragraph — a Block            | a bare link            | —       |
| `twitch`              | «+»: Video (not in `full`)                           | `div[data-block=video]` with a link                       | `Enter` after a link in a paragraph — a Block            | a bare link            | —       |

A paragraph is always there; a hard break is `Shift+Enter`. `insertMenu` and `emoji`, like `clearFormatting`, have no markup of their own: `insertMenu` provides access to other Tools' Blocks, and it is disabled where `/` is an ordinary character (paths, "and/or"); `basic` lacks it for the same reason. `emoji` inserts plain text — the Schema, the sanitizer and Markdown do not change because of it (see the "Emoji" section); `basic` lacks it: in a comment the OS's own palette is easier to reach, and a button would take up room in a short row. `source` is the Source mode (see the "Source mode" section): it has no markup of its own either, an HTML edit goes through the same Schema as `value`, and it cannot be used to get around the set of Tools; `basic` lacks it — in a comment an "HTML" button is superfluous unless the screen explicitly asks for it. `invisibleCharacters` (see the "Invisible characters" section) has no markup either: it draws marks as decorations over the Document, and the Schema, the sanitizer and Markdown do not change; `basic` lacks it — a comment does not need a proofreading mode. `blockSelection` (see the "Block selection" section) has no markup either; `basic` lacks it because it takes the first `Esc` in the text, and a comment field in a `Dialog` keeps "one `Esc` closes the window". `fullscreen` and `focus` (see the "Fullscreen mode" and "Focus mode" sections) have no markup either: the first moves the field into a layer over the window, the second draws decorations, and `basic` lacks both. `pasteCleanup` (see the "Paste from Office" section) has no markup or UI either: it only changes what the Schema reads from a paste out of an office application, so it is in both Presets; comments get pasted from Word too.

**The level-one heading is `heading1`** (an add-on to `heading`): `full` has it, `basic` does not. With it the Block levels are 1–4: `Ctrl/⌘+Alt+1` and `# ` with a space give H1, `<h1>` from `value`, `defaultValue` and paste stays H1, and the "¶" menu on the Toolbar offers "Heading 1". Without it the old behavior holds: `# ` while typing stays text, `Ctrl/⌘+Alt+1` does nothing, and `<h1>` in incoming HTML becomes a paragraph. Disable `heading1` on a screen where the page heading already sits above the Editor: a second H1 breaks the page structure. Without the `heading` Tool there is no H1, even if `heading1` is passed.

Earlier, "no H1 in the Document" was a kit decision (the page heading sits outside the Editor); now it is the screen's decision — ADR-0053 revises the earlier decision, and ADR-0050 links to ADR-0053.

A name enters the `Tool` type together with the Tool itself, not earlier: widening the input type does not break the consumer, whereas a name without an implementation would compile and do nothing. That is how `link` arrived — straight into the `basic` Preset too — and `color`, `highlight`, `align`, `table`, `image`, `emoji`, `layout`, `wrapper`, `details`, `mathematics`, `footnotes`, `invisibleCharacters`, `blockSelection`, `fullscreen`, `focus`, `language`, `source`, `toc`, `typography`, `youtube`, `twitch`, `pasteCleanup`; there are no reserved names now. Unknown names in `tools` (from JS without types) are dropped silently.

`preset` and `tools` are read **when the engine is created**: the Schema of a live ProseMirror cannot be changed. To change the set on a mounted field, remount it with a key (`key`) — the edit history is lost in the process.

### Options of a built-in Tool: `tool()`

Eleven built-in Tools have options: `search`, `toc`, `details`, `mathematics`, `youtube`, `twitch`, `typography`, `invisibleCharacters`, `focus`, `language` and `date`. You set them with the `tool(name, options)` helper, which returns a Configured Tool: an entry for `tools` that sits next to the names and the descriptions of custom Tools (ADR-0069).

```tsx
import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

// Build the set once per module, not in a render: `tools` is read when the engine is created.
const tools = [
  ...RICH_TEXT_PRESETS.full,
  tool("toc", { offsetVar: "--header-h", levels: [2, 3] }),
  tool("search", { matchCase: true }),
];

<RichTextEditor tools={tools} defaultValue={html} />;
```

- **An entry switches the Tool on.** `tool("toc", …)` enables `toc` without the `"toc"` string. If `tools` also holds the bare name (for example, `search` from `full`), the Configured Tool wins: there is still one Find button and one find panel.
- **Pass only what you change.** The remaining options come from the kit's defaults. Nested objects are merged and arrays are replaced whole: `levels: [2, 3]` means exactly these levels, not an addition to the default.
- **The position in the UI does not change.** A configured built-in Tool sits where it would sit by name; a custom Tool sits in `tools` order.
- **Types infer the options from the name.** `tool("toc", { matchCase: true })` and `tool("bold", {})` do not compile: `tool()` accepts only Tools that have options, which today means `search`, `toc`, `details`, `mathematics`, `youtube`, `twitch`, `typography`, `invisibleCharacters`, `focus`, `language` and `date`.
- **Two `tool()` entries with the same name** are a set error, like two custom Tools with the same name: a field error ("The editor couldn't start") and a `console.error` in development.
- **A wrong value** (from JS without types: `levels: [5]`, `offsetVar: "header"`) is replaced with the default, with a single `console.error` per Tool in development; the field keeps working.
- **Options are read once**, together with the `tools` set, when the engine is created. To change them on a mounted field, remount it with a key (`key`) — the edit history is lost in the process.
- **Server.** `tool()` and `RICH_TEXT_PRESETS` pull neither Tiptap nor React into the module, so a `tools` set such as `[...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true })]` can be built in a server module: the presets are plain arrays, not client references. A configured built-in Tool is made of data, and if its options are data, you can pass it to a client component as a prop.

The options of each Tool are described in its own section: "Find and replace", "Table of contents", "Details", "Formulas", "Video by link", "Typography", "Invisible characters", "Focus mode", "Text part language" and "Date mention". The options of a custom Tool are set by `defineTool` (["Options, state and commands"](../../api/editor-extension.md#options-state-and-commands)).

## Custom Tool

A custom Tool is the description of one Editor capability: its Blocks and Marks, Schema rules as data, and Extensions (Tiptap extensions). It is passed in `tools` mixed with the kit's names and follows the same rules: **a Tool that is not passed removes its Blocks and Marks from the Schema** — they do not pass through `value`, paste or commands; a Block unwraps into its content and an Atom disappears. The decision is ADR-0058, sections 1 and 2.

```tsx
import { Node } from "@tiptap/core";
import { RICH_TEXT_PRESETS, RichTextEditor, type CustomTool } from "@olddevs/ui/editor";

// The Extensions: behavior only. The kit sets the group, HTML parsing and attributes.
const MergeTag = Node.create({
  name: "acme_mergeTag",
  atom: true,
  addAttributes: () => ({ acme_key: { default: null } }),
  renderText: ({ node }) => `{{${node.attrs.acme_key ?? ""}}}`,
});

export const mergeTagTool: CustomTool = {
  name: "acme_mergeTag",
  engine: [MergeTag],
  blocks: {
    acme_mergeTag: {
      kind: "inline",
      attributes: { acme_key: { kind: "pattern", pattern: "[a-z_]+" } },
    },
  },
};

<RichTextEditor
  tools={[...RICH_TEXT_PRESETS.full, mergeTagTool]}
  value={html}
  onChange={setHtml}
/>;
```

**The description (`CustomTool`).** Required: a name, Extensions, and Schema rules for every Node and Mark they define. The rest has defaults: an ordinary Block with no Block traits, no buttons of its own and no menu items.

| Field          | What it is                                                                                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | The Tool's name with a Consumer prefix, unique within `tools`                                                                                                                 |
| `engine`       | Extensions — an array of Tiptap extensions (Node, Mark, Extension, plugins, a React node view; Node and Mark at the top level) or a Loader that returns such an array (below) |
| `blocks`       | Block Schema rules — by Node name (`CustomBlock`)                                                                                                                             |
| `marks`        | Mark Schema rules — by Mark name (`CustomMark`)                                                                                                                               |
| `buttons`      | Toolbar buttons — see the "Custom Tool's button" section (`CustomToolButton`)                                                                                                 |
| `insertItems`  | Slash menu items (`CustomInsertItem`) — see the "Insert items and Block actions" section                                                                                      |
| `blockActions` | Block actions in the Block handle menu (`CustomBlockAction`) — the same section                                                                                               |
| `textCards`    | Text cards (`CustomTextCard`) — see the "Text card" section                                                                                                                   |
| `trigger`      | A custom Trigger character (`CustomTrigger`) — see the "Custom Trigger character" section                                                                                     |

**Consumer prefix.** The names of the Tool, its Blocks, Marks and attributes start with a prefix followed by an underscore: `acme_mergeTag`, the attribute `acme_size`. The kit's names never contain an underscore, so custom and built-in names never collide, either in the set or in a saved Document. Attribute names are lowercase: HTML loses the case of an attribute name. A built-in Tool is not replaced: disable it in `tools` and put a custom one under its own name.

**HTML convention.** The kit writes and reads it; the Extensions set behavior only:

- a block-level Block is `<div data-block="acme_card">…</div>`, an inline Atom is `<span data-block="acme_mergeTag"></span>`;
- a custom Mark is `<span data-mark="acme_comment">…</span>`;
- a custom attribute `acme_size` is `data-acme_size`; a custom Block and Mark have no other attributes.

The kit completes the Node and Mark from the Extensions: it sets the group (`block`, `inline` or top level) and inline-ness from the Block's kind; it parses HTML strictly according to this convention (the kit's tags `p`, `table` and `img` cannot be taken by a custom Block); and for attributes from the rules it parses and outputs `data-*` with value validation. You may keep your own `renderHTML` (for example, to put text into an Atom), but it must produce the same tag and `data-block`. You do not have to declare custom attributes on the Node: the kit adds them from the rules.

**Schema rules are data, without functions.** The kit's code validates them, and Extensions cannot weaken the validation: a value outside the rules does not reach the Document's HTML from `value`, paste or a command. When parsing, the attribute gets its default value, and on output it is not written.

| `CustomBlock` field | Value                                                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kind`              | `"block"` — block-level (`div`) or `"inline"` — inline (`span`). Required                                                                             |
| `place`             | `"anywhere"` (default) — wherever a Block can appear; `"top"` — only the top level of the Document, like a Column layout                              |
| `attributes`        | Custom attributes: name → value kind (`CustomAttribute`)                                                                                              |
| `container`         | The "container" Block trait: Blocks inside get their own Block handle, as in the Wrapper                                                              |
| `turnInto`          | The "can be turned into" Block trait: the Block handle's "Format ›" is available for this Block too                                                   |
| `plainAtom`         | The "Atom without a formatting menu" Block trait: a selected Block has no Bubble menu and no floating Toolbar above it                                |
| `island`            | The Block's Island in `RichTextView` — a client component from a module with `"use client"` (`CustomIslandProps`); the Editor does not read the field |

`CustomMark` has only `attributes`. The kind of an attribute value (`CustomAttribute`):

- `{ kind: "list", values: ["s", "m", "l"] }` — one of the values of the list;
- `{ kind: "pattern", pattern: "[0-9]{3}" }` — a regular expression as a string for the whole value (the kit adds `^…$` itself);
- `{ kind: "url" }` — a URL under the kit's protocol policy, as for a link: an absolute URL with an `http`, `https` or `mailto` protocol.

An attribute cannot contain HTML: a value with `<` does not pass any rule, and the content of a non-editable Block is stored as the Document's markup inside the Block.

**Block traits** are off by default: an ordinary Block is not a container, has no "Turn into", and has the Bubble menu. It has a Block handle, like any Block: "Add ›", "Format ›" (unavailable), "Up", "Down", "Duplicate", "Delete". The kit copies the traits into the node spec itself; their vocabulary belongs to the kit, not to Tiptap.

**A failed validation when the set is assembled is a field error.** The set is validated once, when the engine is created; with Loaders, after they have run, based on what they returned. It is an error if:

- the name of a Tool, Block, Mark or attribute lacks a Consumer prefix;
- two Tools have the same name, or two have the same Block or Mark name;
- the Extensions disagree with the rules: a Node or Mark without a rule, a rule without a top-level Node or Mark in `engine`, a node attribute without a rule, a `renderHTML` that breaks the convention, a Schema the engine did not build;
- a button has no `id` or icon, two `id` values in one Tool coincide, or exactly one of `run` and `popover` is not set (the same for an Insert item and a Block action).

On an error the engine is not created: under the field's frame there is a `role="alert"` line "The editor couldn't start. The document is unchanged." (`editor.toolsFailed`), the hidden form field and `getHTML()` return the incoming value, `onChange` stays silent, and `ref.current.editor` is `null`. The cause is in `console.error` in development mode, with the Tool's name. This way data loss is visible before the first save, not on the server. **An unknown string in `tools` is still dropped silently**: the error applies only to descriptions of custom Tools.

Buttons, Slash menu items, Block actions and Text cards are described in the sections below; a Tool can report an error to the author with the `showNotice` command (see the "Status bar and Field notice" section). The whole extension API and the boundary of its stability (what falls under semver, what counts as breaking) are described on the [Editor extension API](../../api/editor-extension.md) page. If a Tool has settings and the screen needs its state and commands, describe it with `defineTool`: ["Options, state and commands"](../../api/editor-extension.md#options-state-and-commands).

### Extensions Loader

Instead of the `engine` array of a custom Tool you can pass a function with a dynamic import — it returns a promise of the same array (ADR-0058, items 1.3 and 11.3–11.6). That way the module with the description can also be imported on the server (Schema rules are data), while Tiptap and React of the Extensions go to a separate chunk:

```tsx
// acme-merge-tag.ts — no Tiptap in the graph: only the Extensions chunk pulls it in.
export const mergeTagTool: CustomTool = {
  name: "acme_mergeTag",
  engine: () => import("./acme-merge-tag-engine.js").then((module) => module.engine),
  blocks: {
    acme_mergeTag: {
      kind: "inline",
      attributes: { acme_key: { kind: "pattern", pattern: "[a-z_]+" } },
    },
  },
};
```

- **Readiness waits for the Loaders.** The engine is created when the Loaders of all the set's Tools have run: the Schema is fixed at creation, and Blocks from `value` without their Extensions would be lost on parsing. Until then the Handle's methods are silent, `ref.current.editor` is `null`, and `onReady` has not been called (see the "Events" section).
- **Loading starts from the first render in the browser**, before mount, not in an effect; on the server the Loader is not called. The promise is cached on the Loader function itself: a second Editor on the page with the same Tool does not wait for anything and does not call the Loader. So the Loader is one function per module, not a new arrow function on every render.
- **A load failure** (network, a stale chunk after a deploy) is a field error "The editor couldn't start. The document is unchanged." and a "Retry" button (`editor.retry`). It calls the Loaders that failed again; successful ones stay in the cache. The Document stays visible as a Skeleton the whole time. The Editor does not start without the Tool: its Blocks would vanish from the Document. `onReady` is not called on a failure, and the cause is in `console.error` in development mode.
- **The kit does not publish preloads.** For the chunk to arrive with the page rather than after its script, add `modulepreload` for it yourself. The chunk's hashed URL comes from the bundler manifest (in Vite, `build.manifest`):

  ```html
  <link rel="modulepreload" href="/assets/acme-merge-tag-engine-3f9a1c.js" />
  ```

  In React 19 the same tag is set by `preloadModule(url)` from `react-dom`. Without a preload the chunk starts loading from the Editor's first render — the Skeleton covers that time.

### Skeleton

Every Editor has a Skeleton (ADR-0058, item 11.4), with Loaders and without: until Readiness and after a Loader failure the field renders the frame, the space for the fixed Toolbar, and the Document as static HTML — with the same class and rhythm as the engine's Document, without input and without the `textbox` role. The engine takes its place without a height jump.

- **The Skeleton's Document is `value` cleaned by the Schema**, not the raw string: the kit parses it in an inert browser document (scripts and handlers do not run there) against the Schema of the set's built-in Tools and of custom Tools whose Extensions have already arrived, and serializes it back to HTML. Anything the Schema does not recognize (`<script>`, `on*`, `javascript:`, unknown tags and attributes) does not reach the page even before Readiness (see the "Schema and security" section). A Block of a custom Tool whose Loader has not run yet is visible as text: the Schema removes its markup, and once the Extensions have arrived, the engine parses `value` again.
- **The code block and the table in `full` are lazy too** (ADR-0058, item 11.1): they are not in `basic`, and their Extensions are larger than 10 kB gzipped, so they arrive as a separate chunk through the same Loader as in a custom Tool. The "Table" menu, the "Insert table" dialog and the code block header arrive with them. `basic` loads no chunks and is ready at once.
- **Footnotes in `full` are lazy as well** (ADR-0058, item 11.1): the `footnotes` Tool's nodes with their node view, the keys, the list's upkeep and the Markdown rules arrive as a chunk through the same Loader, and `onReady` waits for it too. The Skeleton draws the reference and the list from `value` in the saved markup (`sup[data-footnote-ref]` and `section[data-block="footnotes"]`, with the list's name in the interface language), so the field does not jump when the chunk arrives. An Editor without the Tool never requests the chunk. See the "Footnotes" section.
- **Block selection is lazy too:** the extension of the `blockSelection` Tool (`Esc`, the keys, the highlighting) is its own small chunk through the same Loader; the Block handle and the `BlockSelection` class stay in the start chunk. The chunk has no Blocks, so the Skeleton shows nothing for it.
- Until the chunks arrive, an Editor with them is a Skeleton, and `onReady` waits for all of them. Their Blocks are visible in the Skeleton by their shape (the code block with a header, the table with cells), so the field does not jump when the chunks arrive. For the chunks to arrive with the page, put `modulepreload` on them, as on a custom Tool's chunk. The size of "start" and "full" is in the "Import size" table in [getting-started](../../getting-started.md#import-size).
- **On the server and before hydration the Skeleton is only the frame and the space for the Toolbar**, without a Document: parsing against the Schema happens in the browser DOM. The Document appears after mount, so on an SSR page the field's height changes once, as before the Skeleton. In client rendering the Skeleton's Document exists from the first frame.

The look of the Skeleton is not part of the contract.

### Atom text

One rule for built-in and custom Atoms (ADR-0058, section 4): the Atom text is what `renderText` in the Extensions returns; an Atom with no content and no `renderText` yields an empty string, an Atom with content inside (an image with a caption) yields the text of its children. The kit builds from it everything that produces text:

- **The count toward `maxLength`** equals the Atom text length, so the counter matches `getText()` without Block separators. For built-ins: a horizontal rule counts as 0, a hard break as 1, an image as the caption length; the Merge Tag from the example above counts as the length of `{{key}}`. There is no separate count field: it would drift from the text. The kit has no server counter — the count depends on the Extensions.
- **`getText()`, `getSelectedText()`, text on copy and `getMarkdown()`** return the same Atom text; an Atom is included in the selected text only as a whole. An Atom without `renderMarkdown` is exported to Markdown as its Atom text; only an Atom without text disappears; the Extensions' own `renderMarkdown` wins.
- **Emptiness is a kit rule, with no description field.** Any Atom, custom or built-in, is content for `required`, `isEmpty()` and `getHTML()`: inserting a video without a caption passes the required check. An empty non-Atom Block (a paragraph without text) does not count as content.
- **Pasting from the clipboard beyond `maxLength`** cuts the tail by characters, not by positions. An Atom is not cut: one that does not fit is dropped whole, together with everything pasted after it; if the limit is still exceeded, the paste is rejected entirely.

### Outside the Editor: server, Markdown and View

The same `tools` array is understood by server sanitization and the View (ADR-0058, item 2.3 and section 3).

- **The server** passes the same `tools` array to sanitization: `sanitizeRichText(html, DOMPurify, tools)` lets custom Blocks, Atoms and Marks through by their rules and strips everything else, and `richTextSchema(tools)` returns these rules as data. Names of kit Tools do not narrow the allowlist; without the third argument sanitization is as before. Both names exist in `@olddevs/ui/editor` and in the lightweight `@olddevs/ui/editor/schema`; the lightweight entry point's graph still has neither Tiptap nor React, and the description of a custom Tool is data that the server reads without the Extensions. Details are in [RichTextView, "Custom Tools: the third argument"](../content/rich-text-view.md#custom-tools-the-third-argument).
- **Markdown.** Custom rules live in the Extensions, as in any Tiptap extension: `renderMarkdown`, and for parsing `markdownTokenizer` and `parseMarkdown`; with them a Block survives the `getMarkdown()` → `setMarkdown()` round trip. Without them `getMarkdown()` does not lose text: a Block is exported as its content (a container as its Blocks), an Atom as its Atom text from `renderText` (escaped, like any text), a Mark as its text; only an Atom without text disappears. Such a Block is not created back from Markdown — its text lands as paragraphs. In development mode there is one `console.warn` per Tool when this default first kicks in.
- **`RichTextView`** shows a custom Block as sanitized HTML with the paragraph's vertical rhythm — and nothing more; the look is set by your CSS: selectors on `data-block` and the kit's tokens ([RichTextView, "Custom Block"](../content/rich-text-view.md#custom-block)). You can bring a Block to life in the View with an Island — the Block's `island` field; `RichTextView` receives the same `tools` ([RichTextView, "Custom Block's Island"](../content/rich-text-view.md#custom-blocks-island)).

## Custom Tool's button

A custom Tool describes a button as data in the `buttons` field, and the kit renders it with roles, the Toolbar's single Tab stop and arrow-key navigation along it, `aria-pressed`, a tooltip with `Kbd`, and a popover with a frame, layer and focus return. Arbitrary React is allowed only inside the popover's content. The decision is ADR-0058, sections 5 and 6.

```tsx
import { RichTextEditor, type CustomTool } from "@olddevs/ui/editor";
import { SparkleIcon } from "@olddevs/ui/icons";

export const stampTool: CustomTool = {
  name: "acme_stamp",
  engine: [], // a button needs neither its own Schema nor Extensions
  buttons: [
    {
      id: "stamp",
      label: ({ locale }) => (locale.startsWith("ru") ? "Штамп" : "Stamp"),
      icon: SparkleIcon,
      can: (editor) => editor.state.selection.$to.parent.inlineContent,
      run: (editor) => void editor.chain().focus().insertContent("★").run(),
      shortcut: ["mod", "shift", "Y"],
    },
  ],
};
```

| Field           | What it is                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`            | The button's key, unique within its Tool. It does not collide with the `id` values of the kit and of other Tools: the kit prepends the Tool's name to it     |
| `label`         | Required. The label — a string or a function that receives `{ locale }`. The button's name for the screen reader, the tooltip text and the popover's name    |
| `icon`          | A component with the `IconProps` contract, either from the kit's icon set or your own. Required: icon names are not supported, and there is no fallback icon |
| `can`           | Required. Whether the button is available now. An unavailable one is `aria-disabled`, stays in the arrow-key order, and a click or shortcut does nothing     |
| `isActive`      | If present, the button is a toggle with `aria-pressed`; if absent, a one-off action without `aria-pressed`                                                   |
| `isVisible`     | A visibility predicate that depends on context: the button is hidden while it returns `false`. If absent, always visible                                     |
| `selectionMenu` | `true` — the button also appears in the Bubble menu (`toolbar="bubble"`)                                                                                     |
| `shortcut`      | A shortcut: `mod`, `alt`, `shift` and a key — `["mod", "shift", "Y"]`                                                                                        |
| `run`           | `(editor) => void` — runs on a click or the shortcut                                                                                                         |
| `popover`       | `({ editor, close }) => ReactNode` — a popover instead of an action. Exactly one of `run` and `popover`                                                      |

- **Placement.** Custom buttons appear on the Toolbar as one group before "Undo" and "Redo", after the kit's groups, in `tools` order and `buttons` array order. The fixed and the floating Toolbar show the same set. The kit sets the order of its own buttons; a built-in one can be hidden only by disabling its Tool, and to get a short Toolbar, narrow `tools`. A disabled Tool removes both its buttons and its shortcut.
- **State.** `can`, `isActive` and `isVisible` are read on every transaction, like the kit's buttons, so they can use the Document's state: `editor.isActive("acme_pin")`. In a non-editable field (`readOnly`, `disabled`) the kit disables the buttons itself.
- **Popover.** The kit manages the frame: the `Popover` layer, an anchor at the button, the Escape stack (inside a `Dialog`, Escape closes the popover, not the dialog), and the frame's name is the button's label. The content is mounted again each time the popover opens. `close` closes the popover the same way as Escape. Closing returns focus and selection to the Document, not to the button; a click elsewhere does not touch focus. A popover triggered by the shortcut opens at the caret, not at the button: the button may not be on screen at all (`toolbar="none"`).
- **The shortcut is the single source of truth.** The kit itself binds the shortcut to `run` (or opens the popover), writes it into the tooltip with `Kbd`, into the button's `aria-keyshortcuts` and into the Keyboard shortcuts popover: custom rows appear there as a separate group without a heading after the kit's groups, in `tools` order. An unavailable button does not take the key, and the key passes on into the Document. Keyboard shortcuts bound by the Extensions (`addKeyboardShortcuts`) do not appear in the Keyboard shortcuts popover: set the button's shortcut with the `shortcut` field, not with an extension.
- **Label.** The function receives `{ locale }` (the `UiProvider` locale), and the label re-renders when it changes; in a single-language app a string is enough. Label overrides go through the Tool factory's options (for example, a `labels` field; the recipe is [Extension API, "Labels through factory options"](../../api/editor-extension.md#labels-through-factory-options)); the `UiProvider` message catalog is not extended for the consumer's own Tools. If the label is empty, development mode logs a `console.error` with the Tool's and button's names, and the Tool's name is used in place of the label in the button's name, the tooltip and the popover's name.
- **Menu buttons** (with radio items or a submenu) are not available to custom Tools: a popover is enough for choosing from a list.

## Insert items and Block actions

A custom Tool adds an item to the Slash menu and an action to the Block handle menu **by description, without editing the menu**: the kit renders, the consumer describes (ADR-0058, sections 5 and 6). A disabled Tool removes its items and actions everywhere.

```tsx
import { ColumnLayoutIcon } from "@olddevs/ui/icons";

export const calloutTool: CustomTool = {
  name: "acme_callout",
  engine: [Callout],
  blocks: { acme_callout: { kind: "block", container: true } },
  insertItems: [
    {
      section: "insert",
      // A string is for a single language; a function receives { locale } from UiProvider.
      label: ({ locale }) => (locale.startsWith("ru") ? LABELS.ru : LABELS.en),
      icon: ColumnLayoutIcon,
      aliases: ["note", "tip"],
      shortcut: ["mod", "alt", "N"],
      run: (chain) =>
        chain.insertContent({ type: "acme_callout", content: [{ type: "paragraph" }] }),
    },
  ],
  blockActions: [
    {
      label: "Unwrap callout",
      icon: ColumnLayoutIcon,
      blocks: ["acme_callout"],
      isVisible: (editor, pos) => editor.state.doc.nodeAt(pos)?.type.name === "acme_callout",
      run: (editor, pos) => unwrapCallout(editor, pos),
    },
  ],
};
```

**Insert item (`CustomInsertItem`).**

| Field      | What it is                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `section`  | `"insert"` ("Insert" — a new Block after the current one) or `"turnInto"` ("Turn into" — change the current Block, keeping its text). Required                                       |
| `label`    | The label: a string or a function that receives `{ locale }` (the `UiProvider` locale), as for a button. Required                                                                    |
| `icon`     | A component with the `IconProps` contract from `@olddevs/ui/icons` or your own. Required: there is no fallback icon                                                                  |
| `aliases`  | An array of strings in any language — search words in addition to the label                                                                                                          |
| `shortcut` | A shortcut in the Toolbar's notation: `["mod", "alt", "N"]`. It is the only source of the key: the kit binds it and shows it in the item's row and in the Keyboard shortcuts popover |
| `run`      | `(chain, editor) => chain` — a chain command: return the chain with the Block's command; the kit calls `.run()`                                                                      |
| `popover`  | `({ editor, close }) => ReactNode` — a popover at the caret instead of a command. Exactly one of `run` and `popover` is required                                                     |

- **Where the item appears.** It shows up in "/", the Toolbar's "+", and the Block handle's "Add ›" and "Format ›" automatically: the `turnInto` section goes into both "Format ›" and "¶"; "Add ›" holds the items of both sections (a new empty Block below, as with built-ins). Custom items appear **at the end of their section**, in `tools` order; inside a Tool, the array order. Without an enabled `insertMenu` the item does not appear, as with built-ins.
- **One edit, one undo.** The section decides what happens to the Document, and `run` decides which Block: in `insert` the kit prepares an empty paragraph (the current one if empty, otherwise a new one after the Block), in `turnInto` it removes the list or quote around the Block. The preparation and `run` go in one transaction.
- **Search in "/"** matches the label in the current locale, the label when called with `en-US`, and `aliases`, as with built-ins. A function label is called at render time: a `UiProvider` locale change re-renders the item.
- **The shortcut hint** in the row is the shortcut's `Kbd`; keyboard support in the menu is the same as for built-ins (arrow keys, `Enter`, `Escape`, the first letter). The shortcut fires at the caret the same way as choosing the item in "/".
- **An empty label** logs a `console.error` in development that names the Tool and the UI contribution, and the menu shows the Tool's name instead.
- **A popover** (`popover`) is for when the Block needs a choice before insertion (a symbol, a template, a URL). The popover is the same as for a button: the kit's `Popover` in the Escape stack (inside a `Dialog`, Escape closes the popover, not the dialog), its accessible name is the item's label, and closing returns focus and selection to the Document. Choosing the item in "/", "+", "Add ›" or "Format ›" closes the menu and opens the popover **at the caret**. From "/", the popover appears where the "/" was typed, and the typed "/command" is removed, as with an ordinary item. The item's shortcut opens the same popover at the caret. The kit does not prepare the Document — no empty paragraph, no removed list or quote around the Block: the Block inserts its content through `editor` in a single transaction, so there is one undo.

**Block action (`CustomBlockAction`).**

| Field       | What it is                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`     | The label — a string or a function that receives `{ locale }`. Required                                                                                                           |
| `icon`      | A component with the `IconProps` contract. Required                                                                                                                               |
| `blocks`    | Names of Blocks for which the action is shown: the name of the Block the handle is open on, or of the container that directly holds this Block. Required, a non-empty array       |
| `run`       | `(editor, pos) => void` — `pos` is the position of the Block the handle is open on. The edit is one transaction: one undo                                                         |
| `popover`   | `({ editor, close, pos }) => ReactNode` — a popover at the Block instead of an action; `pos` is the position of that Block. Exactly one of `run` and `popover`                    |
| `isVisible` | `(editor, pos) => boolean` — a predicate that decides visibility from the context; if absent, the action is visible for all its `blocks`                                          |
| `shortcut`  | A shortcut in the Toolbar's notation: it acts on the Block under the caret and only where the action is visible in the handle menu; on another Block the key goes to the Document |

Custom actions appear in the Block handle menu **in their own section before "Delete"**, in `tools` order. An action with a `popover` opens the popover **at the Block** — the popover, Escape and focus return are the same as for a button, and the popover's accessible name is the action's label: a choice in the handle menu opens it at the handle's Block, a shortcut at the Block under the caret. `pos` follows Document edits while the popover is open. The shortcut is in the item's row (as with built-ins, and only when the shortcut does the same thing as the item) and in the Keyboard shortcuts popover: the Tool's rows are a separate group without a heading after the kit's groups.

**Tool set validation** adds field errors for UI contributions: `insertItems`/`blockActions` is not an array or an item is not an object; no label or icon; not exactly one of `run` and `popover`; the section is not `insert`/`turnInto`; `aliases` is not an array of strings; `blocks` is empty; `isVisible` is not a function; the shortcut is shorter than two keys (a modifier and a key).

## Custom Trigger character

A custom Tool opens the same list as "/" with **its own character**: `@` for mentions, `#` for tags. The decision is ADR-0064. The kit renders the list — the same component as the Slash menu: a popover at the caret, search by what is typed, arrow keys, `Enter`, `Escape`, the "Nothing found" row; focus stays in the Document. The consumer describes the character, the items on demand and what happens when an item is picked.

```tsx
import { RichTextEditor, type CustomTool } from "@olddevs/ui/editor";
import { MentionIcon } from "@olddevs/ui/icons";

const mentionTool: CustomTool = {
  name: "acme_mention",
  engine: [Mention], // the `acme_mention` Atom with an `acme_id` attribute
  blocks: {
    acme_mention: {
      kind: "inline",
      attributes: { acme_id: { kind: "pattern", pattern: "[a-z]+" } },
    },
  },
  trigger: {
    char: "@",
    // Items on demand: returned immediately or as a promise; the consumer filters.
    items: (query) =>
      PEOPLE.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())).map(
        (person) => ({ id: person.id, label: person.name, icon: MentionIcon })
      ),
    // Picking replaces the typed `@query` with a custom node.
    onSelect: (item, { editor, range }) =>
      void editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: "acme_mention", attrs: { acme_id: item.id } },
          { type: "text", text: " " },
        ])
        .run(),
  },
};
```

**Trigger (`CustomTrigger`).**

| Field      | What it is                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `char`     | The character: one printable character, not `/` and not a space (`@`, `#`, `:`). Unique in `tools`. Required                                                     |
| `items`    | `(query) => TriggerItem[] \| Promise<TriggerItem[]>` — items on demand. Called on every change of the query, including `""` right after the character. Required  |
| `onSelect` | `(item, { editor, range, query }) => void` — an item is picked: the handler replaces `range` with your own node. Required                                        |
| `label`    | The list's name for a screen reader: a string or a function that receives `{ locale }`. If absent, "Suggestions" from the message catalog (`editor.triggerList`) |

**Item (`TriggerItem`)**: `id` (unique within one `items` result) and `label` — the row text; `icon` — an icon with the `IconProps` contract (if absent, the row has no icon); `data` — any consumer data, the kit does not read it and hands it to `onSelect`. The label arrives already in the interface language: the consumer filters and translates it.

**Selection context (`TriggerContext`)**: `editor` — the raw Tiptap for inserting a custom node; `range` — `{ from, to }`, the typed text **together with the character** (`@gr`); `query` — the query without the character (`gr`). **The kit does not delete the typed text:** the handler does, replacing `range` with a node in one transaction — then there is one undo, and `Ctrl/⌘+Z` brings `@query` back. After `onSelect` is called the kit closes the list.

- **When it opens.** The same rules as "/": the character is at the start of a Block or after a space (a non-breaking one counts as a space), and the query ends at a space. Inside a word (`a@b.com`), in a code block and in inline code the list does not open. A space ends the query: the list closes and the text stays.
- **Keyboard.** As with "/": `↓`/`↑` move through the items, wrapping around, `Enter` picks, `Escape` closes and keeps what was typed (it does not reopen on the same character), `Enter` on an empty list is an ordinary line break. An `Enter` that confirms IME composition is handled by the IME, not by the list.
- **Asynchronous items.** While a promise is pending, the previous list (or nothing) stays, and the "Nothing found" row does not flicker. The result of a stale query is discarded. A rejected promise gives an empty list and, in development, a `console.error`.
- **Independence from "/".** The trigger works without `insertMenu` in `tools`; only one list is open at a time, because the query begins with exactly one trigger character. It opens only while editing: in `readOnly`, `disabled` and Source mode there is no list.
- **Accessibility.** The field stays `role="textbox"` and while the list is open gets `aria-controls` and `aria-activedescendant`, as with "/"; the list is `role="listbox"` named by `label`.
- **Tool set errors** (the field shows an error, and the cause is reported with `console.error` in development): two Tools with one `char`; a `char` that is a space, `/`, or not one printable character; `items` or `onSelect` that are not functions; a `label` that is neither a string nor a function. A custom Trigger character does not collide with built-in ones: `/` is taken by the Slash menu.
- **A mention is the consumer's node.** The kit does not know what is inserted: a mention Atom, a link, a tag — `onSelect` decides. The Atom is described like any custom Block (Extensions, Schema rules, `renderText` — Atom text), so a mention reaches `getText()`, Markdown and `maxLength`.

## Text card

The fourth kind of UI contribution (after a button, an Insert item and a Block action): a small card under the text range that contains the caret (for example, a comment card under a comment Mark). The kit renders the card, and the Tool describes the range and the body (ADR-0058, section 7, items 6–11).

```tsx
import { Mark } from "@tiptap/core";
import { markRange, type CustomTool } from "@olddevs/ui/editor";

const Comment = Mark.create({ name: "acme_comment" });

export const commentTool: CustomTool = {
  name: "acme_comment",
  engine: [Comment],
  marks: { acme_comment: {} },
  textCards: [
    {
      // A string or a function that receives { locale }: the card's name and part of the screen reader announcement.
      label: ({ locale }) => (locale.startsWith("ru") ? LABELS.ru : "Comment"),
      // The range under the caret; for a Mark, the kit's ready-made helper.
      rangeAt: markRange("acme_comment"),
      render: ({ editor, range, close }) => (
        <div>
          <p>{editor.state.doc.textBetween(range.from, range.to)}</p>
          <button type="button" onClick={close}>
            Resolve
          </button>
        </div>
      ),
    },
  ],
};
```

**UI contribution (`CustomTextCard`).**

| Field     | What it is                                                                                                                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `label`   | The label: a string or a function that receives `{ locale }`. The card's accessible name (`role="dialog"`) and part of the announcement the kit sends to the screen reader when a Text card appears. The entry has no icon. Required |
| `rangeAt` | `(state, pos) => { from, to } \| null` — the range the Text card is attached to, if position `pos` (of the caret or of a click) lies in it; otherwise `null`. Required                                                               |
| `render`  | `({ editor, range, close }) => ReactNode` — the Text card's body. `range` is the range from `rangeAt` on the current state (it follows edits), `close` hides the Text card the same way as Escape. Required                          |

**`markRange(markName)`** is a ready-made `rangeAt` for a Mark: the continuous stretch of text with this Mark and the same values of its attributes around `pos`. **The edges are included**: a caret right after a word or before it is still in the range (otherwise a click on the first letter would not open the Text card); between two stretches, the one that ends at `pos` wins, so text typed next continues that stretch. For a Block or any other range, write your own `rangeAt` — it reads only `state` and is called on every transaction, so it must be fast and free of side effects. The kit discards a range that lies outside the Document, has `from > to`, or consists of values that are not numbers; an exception in `rangeAt` does not crash the field, but writes `console.error` in development. `markRange` is also in the lightweight `@olddevs/ui/editor/schema` entry point: the description of a custom Tool with a Text card is data, and server sanitization reads it too, so the description module needs neither Tiptap nor React.

- **When it is open.** The caret (a collapsed selection) is inside the range, or a click on it. **A Text card does not open on hover.** An expanded selection closes the Text card: the Bubble menu works there. The range is recomputed on every transaction: the Text card follows the range when you edit, and closes when the range disappears. A field out of focus (except `readOnly`) does not show the Text card, and neither do `disabled` and Source mode.
- **One Text card.** No more than one is open: **the narrowest range** under the caret wins, and with equal width, the contribution that comes earlier, that is, the Tool earlier in `tools` (inside a Tool, earlier in the array).
- **The kit controls the card.** The layer and the Escape stack work as for the kit's `Popover` (ADR-0041: Escape closes the Text card, not the `Dialog` or `Drawer` around the field); the card is anchored under the range, **flips above the range at the bottom edge of the viewport**, shifts away from the side edges and looks like the kit's popover. There is no heading and no buttons defined by data: the body is your React node, mounted again each time the card opens.
- **Non-modal.** Focus stays in the Document, you can keep typing, and the Text card follows the range. **`Alt+F10` moves focus into an open Text card** (to the body's first focusable element, otherwise to the card itself), as it moves focus to the panel of a selected image. **Escape returns the caret to its place** and hides the Text card.
- **Hidden.** Escape and `close` hide the Text card **until the caret leaves the range**: an edit and caret movement inside it do not bring it back. A click on the range opens it again. While it is hidden, `Alt+F10` moves focus to the Toolbar, as without a Text card.
- **Screen reader.** The kit announces that a Text card has opened with the message catalog string `editor.textCardShown` ("Comment card opened. Press Alt+F10 to move into it." in the English locale; the Russian locale has a different string, "Открыта карточка «{label}». {shortcut} — перейти в неё."): the entry's label and the shortcut are substituted into it. A `role="status"` live region is present in every Editor with Text cards and is empty while none is open.
- **`readOnly`.** Text cards work — comments can be read without editing; the engine itself blocks edits made from `render`. Such a field has no caret, so a **click** opens the Text card (the click position moves with edits), and a click outside the field, Escape and a mouse selection close it. From the keyboard a Text card cannot be opened in `readOnly`: the Document does not accept a caret, and `Alt+F10` cannot be reached from it. With `disabled` there are no Text cards.
- **A disabled Tool** removes its Text cards as well. `RichTextView` has no Text cards: it shows sanitized HTML without an engine; to read text with Text cards, use an Editor with `readOnly`.
- **Tool set validation** adds field errors: `textCards` is not an array or an item is not an object, no label, `rangeAt` or `render`.

## Code block

The `codeBlock` Tool: the "Code block" checkbox item of the "…" menu and a Slash menu item, `Ctrl/⌘+Alt+C` and a ` ``` ` fence at the start of a line. A Block has a language and syntax highlighting — the decision of ADR-0051: lowlight with highlight.js grammars, only in the `@olddevs/ui/editor` entry point (the kit's `CodeView` still does not highlight code, ADR-0039).

**Languages.** Plain text (no language), Python, TypeScript, JavaScript, Go, HTML, JSON, YAML and Markdown — data in one module, `src/editor/features/code/codeLanguages.ts`, and the names used in the Document are `RICH_TEXT_SCHEMA.codeLanguages`. In HTML the language is a class on `<code>`: `<pre><code class="language-python">…</code></pre>`; a Block without a language has no class. Highlighting is **not written** into the Document: the `span class="hljs-…"` tokens are Editor decorations and are absent from `getHTML()`.

- **Aliases** are mapped to the name when `value` is loaded, when HTML is pasted, when Markdown is parsed, and in the fence: `py` → `python`, `ts` → `typescript`, `js` → `javascript`, `golang` → `go`, `htm` → `html`, `yml` → `yaml`, `md` → `markdown`; case does not matter. JSON has no aliases: ` ```jsonc ` and ` ```json5 ` allow comments and trailing commas, which the JSON grammar does not support, and open plain text. ` ```py ` followed by a space opens a Python Block.
- **An unknown language** (` ```rust `, `class="language-rust"`) becomes plain text: the Block stays, the class does not.
- **Plain text is not highlighted**, even if it looks like code: the language is not guessed either in the Editor or on the server, so the same Block looks the same when edited and when displayed.
- **Markdown**: a fence with a language ↔ a Block with a language; `getMarkdown()` writes the name (` ```python `), not the alias the Block arrived with.

**The Block header.** Above the code there is a thin strip (about 28 px) with a bottom line in the divider token: the language on the left, "Copy" on the right. Both parts are always visible — on desktop and on touch screens, without hover. The code starts right under the strip with the Block's usual padding, and the buttons do not cover it: a long first line can be scrolled through in full. The strip is a service element of the Block's interface, not content: it has `contenteditable="false"` and `select-none`, the caret does not enter it, it is not part of the selection or of a copy of the Document, and it is absent from `getHTML()`. The same strip appears on the Blocks in [`RichTextView`](../content/rich-text-view.md#the-copy-button-and-the-header).

**Choosing the language.** On the left of the header is a button with the current language and a chevron ("Python", "Plain text"). It opens the kit's `Menu` with a list of languages — a radio group with the current one checked; choosing a language changes it in **one undo step** (`Ctrl/⌘+Z` brings the previous one back, the code is untouched) and returns focus to the code at the previous caret position. The button's name is "Language: Python" (in the Russian locale, "Язык: Python"; `messages.editor.codeLanguage`), and the menu is named the same. The menu is a kit overlay built on `react-aria-components` and takes part in the layer stack (ADR-0041): inside a `Dialog`, Escape closes the menu, not the dialog. In `readOnly` and `disabled` a label with the language replaces the button: there is nothing to change, but knowing which language the code is in is still useful. A Block without a language has no label in these modes — the "Plain text" string comes from the message catalog and is used by the menu button; `RichTextView`, which has no message catalog, behaves the same way.

**Copying.** On the right of the header is the kit's `CopyButton` (an icon, no label) with the tooltip "Copy code" (in the Russian locale, "Копировать код"; `messages.editor.codeCopy`), which for two seconds after a press changes to "Copied" (in the Russian locale, "Скопировано"). The button's name and the announcement of the result in the live region are the standard `CopyButton` ones: "Copy" → "Copied" (in the Russian locale, "Копировать" → "Скопировано"; `messages.copyButton`); the code block has no name of its own. What goes to the clipboard is **the Block's text as a string** (`node.textContent`): as typed, without highlight tokens (they are decorations) and without markup. This is the rule of ADR-0039: a string is copied, not the DOM. The button is there **in any mode** — in `readOnly` and in `disabled` too: editing is not allowed, copying is. If the clipboard refuses (an insecure context, a denied permission), the button shows "Could not copy" (in the Russian locale, "Не удалось скопировать") and does not switch to the "copied" icon.

**Keyboard.** Both header buttons are **outside the Tab order** (`tabindex="-1"`): otherwise every code block would add two stops between the field and the next form element. You can get into the header with the same `Alt+F10`: with the caret in a code block it moves focus to the language button of that Block (as on a selected image it moves focus to the image's panel), not to the Toolbar. Navigating the header:

- `Alt+F10` from the language button goes to "Copy", once more to the Toolbar; so the shortcut cycles through language → copy → Toolbar;
- the Right Arrow key moves from the language button to "Copy", the Left Arrow key moves back;
- on the language button `Enter`, `Space` or the Down Arrow key open the menu; the arrow keys, `Home`, `End` and the first letter choose; `Enter` applies, `Escape` closes the menu;
- on "Copy", `Enter` or `Space` copies;
- `Escape` on either button returns focus to the code, with the caret where it was.

The language button has `aria-keyshortcuts="Alt+F10"`. **In `readOnly` and `disabled` there is no caret, and `Alt+F10` is unreachable from the Block, so there "Copy" is in the normal Tab order** (in an editable Editor its `tabindex` is `-1`, in the other modes the standard one). Tab in a code block still takes focus out of the field: indents in code are written with spaces.

**The highlight theme** is made up of ready-made highlight.js themes: GitHub Light in the `light` theme, GitHub Dark in `dark` and `dim`. It has two parts. The colors are the `--rte-hl-*` and `--rte-code-block-*` variables in `styles.css` on elements with `data-theme` (and on `:root` without the attribute), so the code block takes the theme of the **nearest ancestor with `data-theme`**: a Document in a nested `data-theme="light"` inside a dark app gets GitHub Light, a dark area on a light page gets GitHub Dark. The `.hljs-*` rules are Tailwind classes on the Document container (`src/editor/styles/codeTheme.ts`, part of `prose.ts`); they read only the variables, so neither `style` nor separate CSS is needed: the rules come with `@import "@olddevs/ui/styles.css"` and the `@source` line from [getting-started.md](../../getting-started.md). The variables are declared with zero specificity (`:where`), so the consumer overrides any of them with their own rule. The code block takes the highlight theme's background and main color (`#ffffff` / `#0d1117`), not the kit's background: GitHub's colors hold the 4.5:1 contrast only on their own background. There is one departure from GitHub Light — `built_in` and `symbol` are darker (`#953800` instead of `#e36209`: that one is 3.49:1 on white). This is a second color system in the kit, and it is used only in the Editor's code block; inline `code` still uses tokens.

**Display.** `RichTextView` does not highlight by itself — otherwise lowlight would ship with every display of a Document. Saved HTML is highlighted on the server by the `highlightCodeBlocks(html)` helper from `@olddevs/ui/editor/highlight` **after sanitization** — the order is on the [RichTextView](../content/rich-text-view.md#code-block-highlighting) page.

## Images

The `image` Tool (in `full`, not in `basic`): the "Image" button on the Toolbar, the "Image" item in the Slash menu (`/img`) and Markdown `![alt](url)` on paste. An image is written into the Document as a Block:

```html
<figure>
  <img src="https://cdn.example.com/a.png" alt="Lake" data-width="50" />
  <figcaption>Caption</figcaption>
</figure>
```

An image the text wraps around carries `data-align` on the `figure`:

```html
<figure data-align="left">
  <img src="https://cdn.example.com/a.png" alt="Lake" data-width="33" />
</figure>
```

- **The image popover** has a URL field and an alternative text field. The URL is entered as in a browser's address bar: `cdn.example.com/a.png` becomes `https://cdn.example.com/a.png`. **Only absolute `http` and `https` URLs are accepted**: the field does not accept `data:`, `blob:`, `mailto:`, `javascript:` or a relative URL — an error appears under it. Enter inserts the image in place of the empty paragraph under the caret (or next to the current Block), and the caret goes into the caption. Escape cancels. Inside a `Dialog`, Escape closes only the popover (ADR-0041).
- **Alternative text** is optional: an empty `alt=""` means "decorative image", and the screen reader skips it. The `alt` attribute is always written — without it the screen reader would read the file name from the URL.
- **The caption** is a `figcaption` under the image, with Marks and links. An empty caption is not written to HTML at all; in the field, an empty caption shows the placeholder "Caption (optional)". Enter on a selected image puts the caret into the caption, Enter in the caption starts a new paragraph under the image, and Backspace at the start of the caption selects the image. A heading, a list or a code block cannot be created in a caption: inside a `figure`, the Schema allows only the caption.
- **Width** is one of five values: 25%, 33%, 50%, 75% or 100% of the width of its container (`data-width`, `RICH_TEXT_SCHEMA.imageWidths`); without the attribute, the image's own size, but not wider than the Document. The image is centered unless it is aligned (below). With the mouse, there are handles on the sides of a selected image: the width changes smoothly, and on release it snaps to the nearest of the five values (one edit — one undo). From the keyboard, there are the toggle buttons "25%" to "100%" in the selected image's popover and on its panel; a pressed button is cleared by pressing it again. An image never has `style`.
- **Image alignment** (the term is in the [glossary](../../glossary.md)) puts the image at the left or right edge and lets the text of the next Blocks wrap around it, as in Word. There are three positions: **Left** and **Right** wrap the text, **Center** is the default, a line of its own. There is no alignment without wrapping: next to text there are Column layouts. It is part of the `image` Tool, with no Option and no Tool of its own; `data-align="left"` or `"right"` goes on the `figure`, and the centre is the absence of the attribute. It uses the same word as Block alignment, with one difference: for a paragraph `left` is the default and is never written, for an image `left` means wrapping and is written. The toggles are on the selected image's panel (before the widths) and in the "Edit image" popover, with `aria-pressed`; the keys are described below.
  - **Only narrower than the container.** Text cannot wrap an image that is as wide as the Document, so an aligned image is 25%, 33%, 50% or 75%. Choosing Left or Right for an image at its own size or at 100% sets 50% in the same edit (one undo brings back both), and 100% on an aligned image puts it back in the centre. A Document that arrives with a side and no width, or with 100%, opens with 50%.
  - **What wraps.** Paragraphs, lists and quotes flow around the image. A heading, a table, a code block, a divider, a centred image, a Column layout, a Wrapper, a Details Block, a video and the footnote list start below it, so a new section does not stick to the picture of the old one. An image on the left and an image on the right can stand side by side.
  - **A narrow Document does not wrap.** From 30 rem (480 px) of the Document's own width the image floats; narrower (a Drawer, a small Dialog) there is no room for a column of text beside it, and the image stays on a line of its own, in the centre, at its own width. The Document root becomes a container for this, as it does for a Column layout. The width is a share of the image's container, so in a column of a Column layout, in a Wrapper or in the content of a Details Block the image is a share of that column or Wrapper, and the container holds it (a tall image at the end of a Wrapper does not hang out of the frame).
  - **Not in a table cell.** The toggles are unavailable there and an aligned `figure` that arrives in a cell keeps its attribute in the Document, but the styles do not apply it: the image stays in the centre.
  - **Handles.** A centred image has two handles and grows to both sides (the edge follows the mouse at twice the shift). An aligned image has one handle, on the side of the text: it grows one pixel for one, and snaps to 25%, 33%, 50% or 75% (not to 100%).
  - **Keys.** `Ctrl/⌘+Shift+L`, `+E` and `+R`, the alignment keys of the `align` Tool, align the image when it is selected as a whole (left, centre, right). With the caret in the caption or anywhere else they align the text as before. The image has the keys even without the `align` Tool. In the Keyboard shortcuts popover the rows keep the names "Align left", "Align center" and "Align right".
  - **Appearance.** `RichTextView` and the Editor draw the same float and the same gap (`prose.ts`, no `style` in the Document). The theme, the Paper sheet and the tones of a Wrapper do not change the image or the wrapping.
  - **Email.** A mail client that does not know `float` (Outlook for Windows) shows the aligned image on a line of its own; the text is not lost.
- **A selected image** (selected by clicking it or with the arrow keys) shows its own panel above it: the alignment toggles, the width options, "Edit image" (a popover with the URL and the alternative text) and "Remove image". `Alt+F10` on a selected image moves focus to this panel, not to the formatting Toolbar; the floating Toolbar does not appear above an image. The Toolbar's "Image" button is pressed (`aria-pressed`) while an image is selected and opens this image's popover rather than inserting a new one.

### Uploading files: `onUploadImage`

```tsx
<RichTextEditor
  value={html}
  onChange={setHtml}
  onUploadImage={async (file) => {
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()).url; // an absolute https URL
  }}
/>
```

- **With an upload handler (`onUploadImage`)** an image can be pasted from the clipboard (a screenshot, "Copy image" in the browser), dropped into the field as a file, or chosen with the "Upload from device" button in the popover. Several files are uploaded one by one and land in file order.
- **While the promise is pending**, a placeholder "Uploading photo.png…" appears where the image will be (with a preview where the browser supports `blob:`), and the Document has **no** image: not in `getHTML()`, not in `onChange`, not in the form. The upload progress is announced by the Field notice's live region (`role="status"`, see "Status bar and Field notice").
- **On success** the image takes the placeholder's place in one edit: `Ctrl/⌘+Z` removes exactly that image. **On failure** (the promise is rejected or the URL is outside `http`/`https`, for example `data:` or a relative one), the placeholder disappears, the Document does not change, nothing is added to the edit history, and under the field there is a `role="alert"` line: "Couldn't upload photo.png. The document is unchanged." The next edit clears it. This is a Field notice: file messages go through the same channel as `showNotice`, and a new one replaces the previous one.
- **Without an upload handler**, files pasted from the clipboard or dropped into the field are not accepted: under the field there is a hint to insert the image by URL. "Copy image" from the browser still works — alongside the file the clipboard holds HTML with the image URL, and the image is inserted by URL if the protocol policy allows it (`http`/`https`).
- **What is not uploaded.** A non-image file (`notes.pdf`) is rejected with a message. A paste from Word and from pages where the clipboard holds HTML with text next to the file goes through ordinary HTML parsing: Word also puts a snapshot of the selection as a picture on the clipboard, and uploading it would be a mistake.
- The upload handler is read at the moment of insertion — it can be swapped on the fly. A form submitted during an upload goes out without the image not yet uploaded.
- **There is no "image removed from the Document" signal** (ADR-0058, section 13): editing, undo and cut-and-paste would give false positives, and Documents are also changed without going through the Editor. The server finds uploaded files that the Document no longer references — [the recipe for comparing `src` on the server](../../api/editor-extension.md#removed-images-comparing-src-on-the-server).

## Color, highlight and alignment

`color`, `highlight` and `align` are part of `preset="full"`, but not of `basic`. The palette is written into the Document **by names, not by CSS values**: `<span data-color="danger">`, `<mark data-color="danger">`, `<p data-align="center">`. There is no `style` attribute on load, on paste or in `getHTML()` — except for one narrow case, the author's color (see the "Custom color" section below). Alignment from an external `style` is not lost, though: it is converted to `data-align` (below). The theme (`dark`, `light`, `dim`) substitutes the concrete palette color, so saved text reads in any of them — in the Editor and in [`RichTextView`](../content/rich-text-view.md) alike: the classes are shared (`prose.ts`).

**There are two palettes, and they share no names.** Text color is six kit status tones; the highlight is nine colors: three bright ones (yellow, green, pink) and six muted Notion colors. Both are written into `data-color`, but on different tags: `span[data-color]` takes its name from the text palette, `mark[data-color]` from the highlight palette; a highlight name on a `span` is dropped (`<span data-color="yellow">` together with the element), while the six earlier text-color names on a `mark` are read as the nearest highlight color (below).

**Text color** (`span`, the "Text color" grid of the "Color" popover). The `strong` step of the tone:

| `data-color` name | Swatch (en / ru)   | Text color       |
| ----------------- | ------------------ | ---------------- |
| `accent`          | Accent / Акцентный | `accent-strong`  |
| `success`         | Green / Зелёный    | `success-strong` |
| `warning`         | Amber / Жёлтый     | `warning-strong` |
| `danger`          | Red / Красный      | `danger-strong`  |
| `lime`            | Lime / Лаймовый    | `draft-strong`   |
| `muted`           | Gray / Серый       | `fg-2`           |

**Highlight** (`mark`, the "Highlight" button and the "Highlight color" grid of the "Color" popover). Bright, like a real highlighter pen: the three bright colors are **the same in all themes** (`dark`, `light`, `dim`) and on the Paper (`surface="paper"`), and **the text on the three bright highlights is always dark** — the `--marker-text` token (`#1a1a1a`). The values are `--marker-<name>` tokens of the component layer ([theming.md](../../theming.md)), substituted per theme by `styles.css`.

**All nine are in the grid** (the owner's decision), by hue, as in Notion: gray, brown, orange, yellow, green, blue, purple, pink, red. Previously the menu offered only the three bright ones, while the six muted Notion colors remained available: the Schema, sanitization and `RichTextView` accepted and rendered them, but they could not be chosen in the menu. They differ in text color on the highlight, not in support: all nine are accepted the same way:

Bright:

| `data-color` name | Swatch (en / ru) | Token             | All themes | Dark text contrast (`--marker-text`) |
| ----------------- | ---------------- | ----------------- | ---------- | ------------------------------------ |
| `yellow`          | Yellow / Жёлтый  | `--marker-yellow` | `#ffea80`  | 14.4                                 |
| `green`           | Green / Зелёный  | `--marker-green`  | `#aaff80`  | 14.4                                 |
| `pink`            | Pink / Розовый   | `--marker-pink`   | `#ff80bf`  | 7.5                                  |

Muted Notion colors (each theme has its own values; the text on them is the theme's main text, not dark):

| `data-color` name | Name (en / ru)      | Token             | `light`   | `dark` and `dim` | Main text contrast, worst of the themes |
| ----------------- | ------------------- | ----------------- | --------- | ---------------- | --------------------------------------- |
| `blue`            | Blue / Синий        | `--marker-blue`   | `#d3e5ef` | `#28456c`        | 8.93                                    |
| `gray`            | Gray / Серый        | `--marker-gray`   | `#e3e2e0` | `#5a5a5a`        | 6.33                                    |
| `brown`           | Brown / Коричневый  | `--marker-brown`  | `#eee0da` | `#603b2c`        | 8.92                                    |
| `orange`          | Orange / Оранжевый  | `--marker-orange` | `#fadec9` | `#854c1d`        | 6.32                                    |
| `purple`          | Purple / Фиолетовый | `--marker-purple` | `#e8deee` | `#492f64`        | 10.28                                   |
| `red`             | Red / Красный       | `--marker-red`    | `#ffe2dd` | `#6e3630`        | 8.63                                    |

The names `yellow`, `green` and `pink` are the same as before: **saved Documents that use them become brighter on their own** — the value belongs to the theme, not to the Document. The accessible name of the "Highlight" button includes the current color ("Highlight: Blue").

The swatch uses the same token; the color name on the swatch is for screen reader users (`aria-label`), and sighted users recognize the color by the swatch.

- **Contrast is checked in all themes** (`npm run contrast`, the pairs are generated from `src/editor/styles/palette.ts`): text color holds 4.5:1 on all app backgrounds (the worst values are `accent` and `danger`, around 4.6); the dark `--marker-text` text on each of the three bright highlights is at least 4.5:1 (7.5:1 on pink, 14.4:1 on yellow and green) in `dark`, `light`, `dim` and the brand; the main text `fg-0` on the six muted ones also holds (the worst is `orange`, 6.32). The gate does not measure colored text over a highlight: the author chooses the combination.
- **The highlight follows the nearest theme.** The `--marker-*` tokens are declared on `[data-theme]` of any element, not just on the root, and the `prose.ts` classes read the variable itself (`bg-(--marker-yellow)`), without an `@theme` bridge and without per-theme rules on descendants. A Document area in a nested `data-theme="light"` container inside a dark app gets the light values of the muted colors; the app around it gets its own. The three bright colors and the dark text do not depend on the theme. The other kit tokens (`--fg-0`, surfaces) are declared on `:root[data-theme]` and do not support a nested theme — the Paper (`surface="paper"`) works around this with the `--rte-*` roles (see the "Surface" section).
- **Old highlight names are converted.** Before the Notion palette the highlight shared names with the text color. The `<mark data-color="accent">` and five other names saved back then are read on load (`value`, `defaultValue`) and on paste as the nearest new color, and `getHTML()` already returns the new name; `RichTextView` renders the old name in the same color. The conversion is based on the shade of the background, not on the meaning of the tone:

  | Was (`mark`) | Now      | Why                                                                                                       |
  | ------------ | -------- | --------------------------------------------------------------------------------------------------------- |
  | `accent`     | `blue`   | the kit's accent is blue by default                                                                       |
  | `success`    | `green`  | the color of the same name                                                                                |
  | `warning`    | `yellow` | the amber of `warning-soft` is closer to yellow than to orange                                            |
  | `danger`     | `red`    | the color of the same name                                                                                |
  | `lime`       | `green`  | the lime background reads as green; yellow is taken by `warning`, and a "draft" must not become a warning |
  | `muted`      | `gray`   | the color of the same name                                                                                |

  A saved Document changes its look: the shades are now Notion-like rather than the `soft` steps of the tones. You do not have to rewrite the names in the consumer's database — the Editor and `RichTextView` read both spellings; on the server `sanitizeRichText` converts them ([`RichTextView`](../content/rich-text-view.md#sanitization-on-the-consumers-server)).

- **Text `accent` is the app's accent color**, not a fixed blue: after the accent or brand changes, it changes together with the rest of the interface. The `blue` highlight does not depend on the accent or brand. The other text names do not depend on the accent.
- **Names outside their palette are dropped** together with the element, and the text stays: `data-color="hotpink"`, `data-color="#ff0000"`, a highlight name on a `span`, a name in a different case (`Yellow`), and a highlight without `data-color` or `style` (a bare `<mark>` is rendered yellow by the browser, and in a dark theme it glows over the Document). A color from `style="color: …"` in a paste (Word, Google Docs) is **not converted** to the nearest palette color, and `style` is kept only in the strict form of the author's color — otherwise it is dropped: a conversion would guess on the author's behalf. A **background** in a paste from an office application is different: with `pasteCleanup` it becomes the marker of the nearest hue (see the "Paste from Office" section). A highlight is a meaning the author set on purpose, and the marker palette has a named color for it, while a text color in Office is more often the document's style than a meaning (ADR-0075).
- **Code has no color.** Inline code does not combine with color and highlight: the `code` Mark excludes the others.
- **Alignment** is for a paragraph and H1–H4 headings (H1 with `heading1`; including a paragraph inside a list or a quote): `data-align="center"` or `"right"`. "Align left" is the default, the attribute is not written, and `data-align="left"` from external HTML is read as its absence. **Alignment from external HTML** (`value`, `defaultValue` and a paste from Word, Excel, Google Docs) is also read as `style="text-align: center|right"` (any case and spaces) and as the obsolete `align="center|right"` attribute on `p` and `h1`–`h4`: it becomes `data-align`, and `style` and `align` themselves do not end up in the Document. `left`, `start` and `justify` give "no attribute". Without the `align` Tool, such alignment is dropped together with `style`. "Justify" (`justify`) is deliberately absent in v1: without hyphenation, text gets torn into whitespace "rivers", and WCAG (1.4.8) advises against it. The alignment is physical (left and right), not logical: for Documents in right-to-left scripts the set would have to be extended.
- **An image** has its own alignment on the `figure`: `data-align="left"` or `"right"` (the text wraps around the image), the centre without an attribute. The words are the same, the meaning differs (see "Images"); `p` and `th`/`td` never get it from an image, and the paragraph keys act on a selected image only.
- **A disabled Tool** removes the attribute from the Schema: `data-color`, the author's color `style` and `data-align` from a paste and from `value` are dropped, and the text stays.
- **Markdown** does not express color, highlight and alignment: `getMarkdown()` keeps the text, and `==text==` does not become highlight markup (otherwise it would appear without a color).

### Custom color

Besides the palette colors, the author picks any other: "Custom color…" (`editor.colorCustom`) next to the heading of each grid of the "Color" popover opens a kit popover with a [`ColorPicker`](./color-picker.md): a button with a swatch and value expands a saturation area, a hue strip and a HEX field; below are a contrast warning, "Apply" and "Cancel". The popover opens at the selection, like the link popover. If the selection already has an author's color, the popover opens on it, and "Custom color…" is checked in the grid; the "Highlight" button's name includes the author's highlight value: "Highlight: Custom #ffe066". After "Apply", "Cancel" or Escape, focus is in the Document.

**How the color is stored.** Strictly `style` and nothing else, on a `span` for text and on a `mark` for highlight:

```html
<span style="color:#00aa55">text</span> <mark style="background-color:#ffe066">highlight</mark>
```

Lowercase letters, exactly six digits, no spaces and no `;`; no other properties in `style` and never together with `data-color` on one element — a Mark has one color, the palette's or the author's, and a new choice replaces the previous one. This is the **only exception** to the rule "no `style` in the Document": the author's color has no name, and in HTML, a value is carried by `style`. The owner accepted the exception; it is described in the Schema (`RICH_TEXT_SCHEMA.customColor`), and `sanitizeRichText` ([`RichTextView`](../content/rich-text-view.md#sanitization-on-the-consumers-server)) checks it with a hook.

**What is accepted from external HTML** (`value`, paste): only this declaration, one per element, `color` on a `span`, `background-color` on a `mark`; letter case and surrounding spaces are normalized to the Editor's form (`#00AA55` → `#00aa55`). Everything else — `#abc`, `rgb(0, 170, 85)`, `red`, `var(--x)`, `!important`, a second declaration alongside (`color:#00aa55;font-size:40px` from Google Docs), `style` on another tag — is dropped together with the element, and the text stays. Converting `rgb()` to `#rrggbb` is technically simple, but it would widen parsing with formats that the consumer's sanitizer must also support, and the kit rejects guessing on the author's behalf for the palette as well. A color copied from the Editor itself and pasted back is preserved without loss.

**How `style` is written into the DOM.** The Editor sets the attribute through `setAttribute`, not through `style.cssText`, as ProseMirror does for an array description. The difference is significant: the browser rebuilds `cssText` into its own notation (`color: rgb(0, 170, 85);`), and the Document would not pass strict parsing on its next load.

**Contrast is a warning, not a ban.** The popover measures the color against the current theme: the Editor's background and main text are `--rte-background` and `--rte-foreground` on the Document. For text it is the color itself against the background, for a highlight it is the **dark text on the highlight** (`--marker-text`), not the theme's main text: on a bright highlight and on the author's color the text is dark. The threshold is 4.5:1 (WCAG 1.4.3). Below the threshold a line with the number appears in the popover's live region (`role="status"`) ("Low contrast: 2.1:1 against the editor background (4.5:1 needed)"); the color is still applied when you press "Apply". If the theme could not be read (no styles), there is no warning: "not measured" does not mean "bad".

**The author's color does not follow the theme.** The palette consists of tokens, and one saved text reads in `dark`, `light` and `dim`. `#ffff00` is the same in all themes: yellow text that reads on a dark background blends into a light one. The Editor warns when the color is chosen and says so in the popover (`editor.customColorThemeNote`), but it does not recompute or replace the color. For Documents shown in different themes, use the palette.

**Size.** `ColorPicker` pulls in the `react-aria-components` color subsystem — 61 kB gzip (ADR-0038), as much as the whole kit, so the popover loads lazily (`React.lazy`) the first time "Custom color…" is opened. If you never open it, you do not pay for those kilobytes; they are not part of the `@olddevs/ui/editor` entry point, but the consumer's bundler moves them into a separate chunk.

## Text part language

The `language` Tool (present in `full`, not in `basic`) marks a piece of text with its language: an English term inside Russian text, or the other way round. Then a screen reader reads the piece by that language's rules, the browser spell-checks it with the right dictionary, and hyphenation breaks it correctly. This is the WCAG 2.2 criterion 3.1.2 Language of Parts (level AA). The name in editors is Text part language (CKEditor 5); Language of Parts is its WCAG synonym.

```tsx
<RichTextEditor /> // "Language ›" is in the "…" menu: English and Russian
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, tool("language", { languages: ["en", "de", "fr"] })]} />
```

- **A Mark, nothing else.** The Document holds `<span lang="en">…</span>`. There is no language of a Block: a paragraph in another language is the same Mark over all the text of the Block, and there is no second mechanism that could disagree with the first.
- **A standard attribute.** It is `lang`, not `data-lang`: a screen reader, spell checking and hyphenation read it with no code of the kit, in the Editor, in `RichTextView`, in an email and in a PDF. The Mark is the outermost one, so one language mark covers a phrase of mixed formatting as one element: `span[lang] › span[data-color] › mark › a › strong`.
- **The menu.** "Language ›" is a submenu of the "…" menu of the Toolbar and of the selection menu (the Bubble menu and the floating Toolbar). There is no Toolbar button and no shortcut: the `full` Toolbar in a 640 px column is already full. The submenu has the languages of the `languages` option as radio items (`menuitemradio`, the current one checked), and "Remove language mark" below them. Names are drawn by `Intl.DisplayNames` in the interface language ("English", "Russian"; a Russian interface says them in Russian). A language under the selection that the option does not list (it came from Word or from another screen) is added to the submenu, checked, so the author sees what the text carries. A selection that mixes two languages has none checked.
- **The primary language.** It is the `lang` of the field's nearest ancestor that has one (usually `<html lang>`), the language a screen reader already reads the field in. Without any, it is the interface locale (`UiProvider`). The submenu marks it "primary", and choosing it is the same as "Remove language mark": a mark with the primary language is never set. A mark that repeats the page's language, or the bare language of a regional one (`en` on a page in `en-US`), adds nothing for the reader. A more specific tag (`en-GB` on a page in `en`) is a real mark. There is no `documentLanguage` option: it would have to match the page's `lang`, or the screen reader and the Editor would disagree.
- **Any language is accepted.** The Schema and the sanitizer accept a `lang` of any language, not only the ones in the menu: only the shape of a BCP 47 tag is checked (`en`, `pt-BR`, `zh-Hant-TW`), because HTML with `lang="de"` arrives from other screens and from Word, and the server's sanitizer has no Options of the screen. A value that is not a tag (`x-none`, `english`, an empty string) loses the Mark, and the text stays. The tag is written in its canonical case, `EN-US` → `en-US`.
- **Look.** Only in the Editor: a thin dotted underline in the color of secondary text (`--rte-secondary`, the theme's and Paper's own value), so the author sees where a mark begins and ends. `RichTextView` draws nothing: a reader sees the text as it is, and the screen reader hears the language.
- **Clear formatting does not remove it.** The "Clear formatting" item and `Ctrl/⌘+\` clear the looks; a language is meaning, not looks. It is removed by "Remove language mark".
- **Paste.** A paste from Word, Google Docs and a browser keeps `lang`: Word's `<span lang=EN-US>` becomes `en-US`. A pasted mark in the page's language is dropped at once, whatever its region: Word writes `lang=EN-US` on every run, and on `<html lang="en">` it would otherwise cover the whole text with marks (`en-US`, `en-GB` and `en` on a page in `en`; `ru-RU` on `ru`). A regional mark on a page in another language (`en-GB` on `ru`) stays. Only a paste is this loose: `set("en-GB")` on an `en` page, and a `value`, keep the exact comparison. Without the Tool the words stay and the mark is lost, like any Mark of a disabled Tool.
- **Typography.** With the `typography` Tool, a `"` typed inside an `en…` mark gives curly quotes, and inside a `ru…` mark it gives guillemets, whatever the catalog or the `quotes` option say. Any other language, and text with no mark, use the usual set.
- **Markdown.** Markdown has no language. `getMarkdown()` keeps the text and drops the mark, and `setMarkdown(getMarkdown())` returns the Document without it, as with color. For lossless storage use HTML or the JSON envelope, which keeps the Mark. The row is in "What is lost on export" (the "Markdown" section).
- **Search and invisible characters** do not see the Mark.

The message catalog strings are `editor.language` ("Language", the submenu item and its name), `editor.languagePrimary` (the label of the page's own language in the list) and `editor.languageRemove` ("Remove language mark"); the icon is `LanguageIcon`. The decision is ADR-0078.

### Text part language options

| Option      | Meaning                                                                                                                                                                                                                                                               | Default        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `languages` | The languages of the "Language ›" submenu, as BCP 47 tags, in this order. An array is replaced whole. An invalid tag or an empty list is replaced with the default, with one `console.error` in development. It fills the menu only: the Schema accepts any language. | `["en", "ru"]` |

### Text part language state and commands

`useRichTextToolState(ref, "language")` reads the state and `ref.current?.tool("language")` calls the commands. The general rules for both are in the "Handle (`ref`) and a custom toolbar outside the field" section.

| State field | Meaning                                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `current`   | The language mark under the selection: the tag at the caret, or the one tag of the whole selection. `null` for no mark, and for a selection that mixes languages. |
| `primary`   | The page's primary language, in the canonical case (`en-US`): the one the reader hears where there is no mark.                                                    |

| Command         | What it does                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set(language)` | Marks the selection with a BCP 47 tag (any language, not only the `languages` option). A caret in a marked word changes the whole word; a caret elsewhere sets the language for the text typed next. The primary language removes the mark instead. `false` for a value that is not a tag, in `readOnly` and in the Source mode. |
| `unset()`       | Removes the mark from the selection, or from the whole marked word at the caret. `false` in `readOnly` and in the Source mode.                                                                                                                                                                                                   |

```tsx
function LanguageBadge({ html }: { html: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  const current = useRichTextToolState(ref, "language", (state) => state.current);

  return (
    <>
      <p>{current ?? "page language"}</p>
      <button type="button" onClick={() => ref.current?.tool("language")?.set("de")}>
        Mark as German
      </button>
      <RichTextEditor ref={ref} aria-label="Article text" defaultValue={html} />
    </>
  );
}
```

## Tables

The `table` Tool is part of `preset="full"`, not of `basic`. It needs the `@tiptap/extension-table` package (in the install command above).

**One "Table ▾" button on the Toolbar does both insertion and actions**, as in TinyMCE. A table icon with a chevron, `aria-haspopup="menu"`; the button is always there, and outside a table the items that do not apply there are unavailable (`aria-disabled`) but stay in the arrow-key order — the ARIA Authoring Practices Guide (APG) recommends this so that an arrow key does not silently skip an item. Whether an item is available is decided by a trial run of its engine command, not `editor.can()`: that one answers "yes" to deleting the only row, which then silently does not get deleted.

| Item          | Outside a table | What it does                                                                                                                                                                                                                                                                                                                                     |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Table ›       | available       | A submenu with a size grid (up to 10×10): choosing a size inserts an N×M table with a header row, the menu closes, and the caret goes into the new table's first cell. The selection in the grid sits at the **last size chosen in this Editor** (3×3 the first time); the grid itself shows at least 5×5 cells                                  |
| Insert table… | available       | A dialog (the kit's `Dialog`) with the "Columns" and "Rows" fields — up to 20×50, the initial values are the last size; `Enter` in either field inserts, "Cancel" and `Escape` close without a table. A size from the dialog is remembered the same way as from the grid                                                                         |
| Cell ›        | unavailable     | "Merge cells" — available when several cells are selected (by mouse across cells or `Shift` with the arrow keys); "Split cell" — on a merged cell                                                                                                                                                                                                |
| Row ›         | unavailable     | "Insert row above / below", "Delete row" (unavailable for a one-row table — there is "Delete table"), "Header row" — a toggle (`menuitemcheckbox`): the first row of `th` ↔ `td`                                                                                                                                                                 |
| Column ›      | unavailable     | "Insert column left / right", "Delete column"; then "Wider" / "Narrower" (a step of 5%) in a group named with the current width; then a radio group (`menuitemradio`) "Align column left / center / right" — the alignment of the column under the caret. The common alignment of the column is checked; with mixed alignment nothing is checked |
| Sort ›        | unavailable     | "Sort ascending", "Sort descending" — by the column under the caret (rules below). In a table with merged cells both items are unavailable, and the submenu's section label explains why                                                                                                                                                         |
| Equal columns | unavailable     | Makes all the columns of the table the same width (shares in steps of 5%, the spare steps to the leading columns); unavailable when they are already equal. The next item, "Fit columns to content", removes all the widths, and the table is sized by its content again; unavailable when there are none                                        |
| Delete table  | unavailable     | Removes the whole table; the item is red (`danger`) and separated by a divider                                                                                                                                                                                                                                                                   |

A table inserted from the menu or the dialog lands as a new Block after the current one; in an empty paragraph, it takes the paragraph's place; from inside a table, it goes **after** that table: the Editor does not create nested tables. The "Table" item of the Slash menu (`/table`, `/grid`, "+") still inserts 3×3 immediately, without a size choice and without remembering it.

**Keyboard.** To open the menu, press `Alt+F10` (it moves focus into the Toolbar), use the arrow keys to reach "Table ▾", then press `Enter` or `↓`.

| Key                           | Where         | Action                                                                                                                                                            |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `↓` / `↑`                     | menu, submenu | Next / previous item, unavailable ones too                                                                                                                        |
| `→`                           | item with `›` | Open the submenu; focus goes to the first item, and for "Table ›" into the grid once the submenu has been positioned                                              |
| `←`                           | submenu       | Close the submenu, focus goes back to its item. In the grid, `←` moves the selection and does not close the submenu: the horizontal arrow keys belong to the grid |
| `←` `→` `↑` `↓`, `Home` `End` | grid          | Choosing the size, the grid grows up to 10×10 (the grid keys are in "The size selection grid" below)                                                              |
| `Enter`                       | item, grid    | Run; the action returns focus to the Document, and the caret stays in the cell it came from                                                                       |
| `Escape`                      | any level     | Close **only the top** level: the grid or submenu → the menu → the button. In a `Dialog` only the next `Escape` closes the dialog (ADR-0041)                      |

Focus is put into the grid when the submenu's popover itself reports that it has been positioned: the position is computed and the enter animation has finished (the react-aria render props `placement` and `isEntering`). A grid that took focus right at mount broke the menu inside a dialog, and the earlier 50 ms timer was a race against the device; the popover's signal does not depend on device speed. A submenu opened with the mouse leaves focus on its item — hover moves the grid.

**Cell merging.** `colspan` and `rowspan` are written into HTML and survive saving and loading; a table from Word, Excel and Google Docs is pasted with its merges. The value is an integer from 2 to the Schema limit (`RICH_TEXT_SCHEMA.tableSpans`: 20 horizontally, 50 vertically — as many as the largest insertable table); zero, a non-integer number, `2px`, a negative number and a number over the limit are read as 1 (the cell stays, the merge falls apart): otherwise `colspan="10000"` from external HTML would become ten thousand empty cells. "Merge cells" does not perform a merge that would go past the limit. A row fully covered by a merge from above stays an empty `<tr></tr>`.

**Column alignment** is `data-align="center|right"` on **every** cell of the column (`th` and `td`), with the same values as Block alignment: `left` is the default, no attribute. The styling comes from shared `prose.ts` classes, so the column is aligned the same way in `RichTextView`. A paragraph in a cell with its own alignment (the `align` Tool) wins over the column. The alignment of an external table — `style="text-align: center|right"` or `align="center|right"` on `th` and `td` from Word, Excel, Google Docs or `value` — is converted to the cell's `data-align` (with the `table` Tool enabled, regardless of `align`); `style` and `align` themselves are not written. From Markdown, alignment arrives with the `:---:` delimiter.

**Column widths** (ADR-0080) are shares of the table's width, in steps of 5%. A table has widths only when the author set them or they came with a paste; a saved Document without them, and a table inserted from the menu, stay sized by their content, as before. The Document keeps them as `<colgroup><col data-width="35"><col data-width="35"><col data-width="30"></colgroup>` before the table body: one `col` per column of the grid, each a multiple of 5 from 5 to 95, and the sum is 100 (`RICH_TEXT_SCHEMA.tableColumnShares`). There is no `style`, and no width of the table itself: a table with widths fills the Document and follows its width in the View, in an email, in a PDF and on a phone. A list that breaks the rule (the sum is not 100, a value is not a step, the number of `col` is not the number of columns) is read as no widths: the table and its text stay, and the Sanitizer removes such a `colgroup` whole. There is no Option and no new Tool: this is part of `table`.

- **With the pointer** (a mouse or a finger): with the caret in a table, or the pointer over it, every boundary between two neighboring columns gets a handle. With a mouse it is invisible until the pointer is over the boundary, then a bar shows, as in Notion and Google Docs; on a touch screen the bars are always visible and wider. Drag it: the bar follows the pointer smoothly, and on release the boundary **snaps to the nearest 5%**. Only the two columns around the boundary trade width, the rest stay put; each keeps at least 5%. The last column has no bar. A drag is **one edit**: `Ctrl/⌘+Z` takes it back whole. **The first drag in a table without widths** first rounds the widths it has on screen, for all the columns, to 5%, then moves the boundary. A click without a drag changes nothing. The bars are not in a `readOnly` or `disabled` field.
- **From the keyboard**: "Column › Wider" and "Narrower" take a step of 5% at the expense of the neighbor on the right (on the left for the last column); a column or a neighbor at 5% stops the step, and the item is unavailable. The "Column" menu's group is named with the current width ("Column width: 35%", or "fits content"). **The bars are for the pointer only and are not in the `Tab` order** (`aria-hidden`): in a table `Tab` already walks the cells, and a stop per boundary would be dozens of stops in a big table. "Table › Equal columns" and "Fit columns to content" set or remove the widths of the whole table. Every action is one edit.
- **Announcement.** After a step, a drag, "Equal columns" and "Fit columns to content" the result is announced through the Field notice (`role="status"`): "Column width: 35%".
- **The minimum column width wins.** A column is never narrower than 6 rem: where a share is less than that on the current width of the Document, the column stays at 6 rem and the table scrolls inside itself, as a table without widths does. The shares in the Document do not change.
- **Insert and delete** carry the widths along (the menu and the `addColumnBefore`, `addColumnAfter` and `deleteColumn` engine commands alike). A new column takes half of the share of the column it was inserted beside, rounded down to 5% (beside a column at 5% the widest column gives a step instead); with no room (twenty columns, or every column at 5%) the widths are dropped. A deleted column gives its share to the neighbor on the left, and the first one to the new first column. The sum stays 100. **Merging and splitting cells** and sorting do not touch the widths. Anything else that changes the number of columns (a paste of cells that grows the table) drops the widths: shares for the wrong number of columns would size every column wrongly.
- **A paste** turns the widths of the source into shares: Excel and Google Sheets (the `col` widths, points and pixels), Google Docs (`col width`), Word (the `width` of the cells of a row, and `%`) — a step of the paste cleanup for the source (see "Paste from Office") — and for other HTML with a `colgroup` (`col width` or `style="width"` in px, pt, %), the table itself. The values are rounded to steps of 5% with a sum of 100; a column with no width, a hidden column, a single column and more than 20 columns leave the table sized by its content.
- **In Markdown** the widths are lost (a row in "What is lost on export"); **the JSON envelope** keeps them (`getJSON()` → `setJSON()` without loss).

**Sorting** reorders rows by the column under the caret:

- the header row stays first; a table without one is sorted whole;
- a column where **all** non-empty cells are numbers is compared as numbers: digit groups separated by a space (a non-breaking one too), an apostrophe, a comma or a dot, a decimal part separated by a comma or a dot, a minus sign, `%`. Where there is a single separator and it occurs once, the interface locale decides: `1,234` is one thousand two hundred thirty-four in `en` and a number with a fractional part in `ru`; `1.2.3` is not a number;
- a column where all non-empty cells are ISO dates (`2026-10-06`, with time after `T` or a space) or `DD.MM.YYYY` is compared as dates. `10/06/2026` is not read: the order of day and month differs between locales;
- otherwise, text is compared with `Intl.Collator` for the interface locale with `numeric`: "ё" in its proper place, "item 2" before "item 10";
- empty cells go to the end in either direction; the order is stable (equal rows are not shuffled); the whole reorder is **one edit**, `Ctrl/⌘+Z` undoes it whole; the caret travels with its row;
- with merged cells, sorting is unavailable: a row with a merge cannot be moved without cutting the merge.

**Other keys in the Document.**

- **`Tab` and `Shift+Tab`** — to the next and previous cell in reading order (the cell's content is selected). **`Tab` in the last cell adds a row** and moves into it, as in Word, Google Docs and Notion; this is standard Tiptap behavior, which the kit keeps. The trade-off: `Tab` does not leave the table the way it leaves the rest of the Document — you can leave with the arrow keys (`↓`/`→` from the last cell put the caret after the table, including when it is the last Block of the Document) or with `Alt+F10` into the Toolbar.
- **`Alt+↓`** (`⌥↓` on macOS) — inserts a row below the current one, and the caret lands in the same column of the new row; one edit, `Ctrl/⌘+Z` removes the whole row. It is the same as "Row › Insert row below", and the menu item shows this shortcut. It works only in a table: outside it the shortcut stays with the browser. **On macOS, inside a cell, `⌥↓` does not move the caret to the end of the paragraph**: the shortcut overrides this system action. There are no shortcuts for columns or for `Alt+↑` — the owner's decision.
- A mouse selection across several cells highlights them (`.selectedCell`, the `--selection` selection background); `Delete`/`Backspace` with **all** cells selected deletes the table, with part of them selected clears the cells.

**The size selection grid** (`src/editor/features/table/TableSizeGrid.tsx`, not exported) is in the "Table ›" submenu. The grid opens at 5×5 cells and grows by a column or row when the selection reaches its edge, up to 10×10; when the selection moves back, the grid shrinks. The top row is shaded and underlined as a header (insertion always makes the first row of `th`). Under the grid is the size in words ("3 columns, 4 rows", pluralized for the locale). There are no numeric fields in the menu — they are in the "Insert table…" dialog: an input inside a react-aria `Menu` would close the menu, and `Tab` does not move focus in a menu. The grid itself supports fields (`fields`); only its stories use this.

| Key             | Action                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| `←` `→` `↑` `↓` | Move the selection by one cell; the grid grows at the edge and stops at 10×10        |
| `Home` / `End`  | The first column / the last visible column of the row; with `Ctrl`, the grid corners |
| `Enter`         | Insert a table of the chosen size                                                    |
| `Escape`        | Close the grid, focus goes to the "Table ›" item                                     |

The grid follows the APG `grid` pattern: `role="grid"` → `row` → `gridcell`. Focus stays on the grid itself, and `aria-activedescendant` points to the current cell (a roving tabindex was rejected: up to a hundred Tab stops instead of one); `aria-selected` is on the cells of the chosen rectangle. A cell's name and the live region (`role="status"`, polite) read the same text — the chosen size in words; mouse hover moves the same selection as the arrow keys, but it is not the only way.

**The output.** `<table><tbody><tr><th>…</th></tr><tr><td>…</td></tr></tbody></table>`, a cell is `<th><p>…</p></th>`. A cell has only `colspan`, `rowspan` and `data-align`; no `style`, `colwidth`, `class` or `scope`; `thead` and `caption` are not written (the header row is an ordinary first row of `th`), and a `colgroup` of `col[data-width]` is written only for a table with column widths (see "Column widths" above). The standard Tiptap extension writes `style="min-width: …"` on the table, a `colgroup` with pixel widths, `colwidth` and `style="text-align"` on cells — the kit turns this off (`src/editor/features/table/tables.ts`), and such attributes are dropped on load and paste; the alignment in them is kept as `data-align`, and the widths in a `colgroup` as shares.

- **Column widths are shares, not pixels.** The engine's own resize handles stay off (the Tiptap option `resizable: false`): they write pixels into the cells, the table gets wider than the Document, and the proportions break on another width of the View. The kit's bars write shares on the table instead (see "Column widths"). A table without widths is sized by the browser from the content.
- **Rows with a different number of cells** (external HTML with an error or with a merge over the limit) are evened out with empty cells when the Editor starts — without `onChange`: this is not a User edit.
- **A cell holds any Schema Blocks** (paragraphs, lists, a quote, a code block), not only paragraphs: if a cell accepted only one paragraph, inserting a list would cut the table in two.
- **A disabled `table`** removes the button, the menu item and the extension: a table from a paste and from `value` arrives as the text of the cells, as paragraphs.
- **Scrolling on a narrow screen.** A table wider than its block scrolls horizontally inside itself (`display: block; overflow-x: auto` on `<table>`, `prose.ts`) and does not stretch the page; the minimum column width is 6 rem, and it wins over a share (see "Column widths"). There is no wrapping element: `RichTextView` renders the saved HTML as is, and scrolling must work on a bare `<table>`. Details and the trade-off are on the [RichTextView](../content/rich-text-view.md#tables) page.

Live examples are the stories `TableMenu`, `TableMerged`, `TableSortAndAlign`, `TableRussian`, `TableNarrow`, `TableInsertSlash`; for column widths `TableColumnWidthHandle`, `TableColumnWidthMenu`, `TableColumnWidthNarrow`, `TableColumnWidthExcelPaste` and `TableColumnWidthRussian`; and, for the grid alone, `TableSizeGrid`, `TableSizeGridFields`, `TableSizeGridRussian`.

## Slash menu

A list of Blocks that opens **on `/` in the text** and **on the "+" button**, the first button on the Toolbar (the `insertMenu` Tool, included in `full`). It has two sections of items:

- **"Insert"** — a new Block after the current one: code block, horizontal rule, table, image, Column layout (two columns; the other variants are in the Block handle), Wrapper. An image opens the URL popover and lands in place of a prepared empty paragraph. If the caret is in an empty paragraph, the Block takes its place; otherwise it goes as a new Block right after the current top-level Block, not inside a quote or a list; with an image selected, after it. The current Block's text is not touched. The Block handle's "Add ›" inserts a Block the same way, except that it always adds a new Block below, even from an empty paragraph.
- **"Footnote"** (`footnotes`, in the "Insert" section) is the one inline item: it does not make a Block but puts a reference at the caret, in the text, so the menu opens no paragraph below for it, and the Block handle's "Add ›" does not offer it. `/foot` and `/footnote` find it (and its Russian name, in any interface language). There is no Slash menu inside a footnote (a line of running text), and the "+" button is unavailable there; see the "Footnotes" section.
- **"Turn into"** — change the current Block's type, keeping the text: paragraph, H2–H4 (and H1 with `heading1`), bulleted list, numbered list, task list, quote, code block. The Block first leaves its list or quote, then becomes the chosen type: "Turn a list item into a heading" gives a heading outside the list.

An item has an icon, a label and a shortcut hint: a Markdown shortcut (`##`, `-`, `>`, `---`), and where there is none, a keyboard shortcut. Items exist only for enabled Tools: a disabled `codeBlock` disappears from both sections, and a section without items is not shown. A menu without items other than the paragraph does not appear at all.

**`/` opens the menu** at the start of a Block or after a space. Inside a word (`and/or`), in a code block and in inline code, `/` is an ordinary character. The menu appears at the caret; what is typed after "/" filters the items — by the label in the interface language, by the English label and by short names (`h2`, `ul`, `hr`, `todo`), ignoring case and the difference between `е` and `ё`. If nothing is found, the "Nothing found" row appears. A space ends the command: the menu closes, and what was typed stays as text.

| Key       | The list on `/` (focus in the field)                                             |
| --------- | -------------------------------------------------------------------------------- |
| Letters   | Filter: the query after `/`                                                      |
| `↓` / `↑` | Next / previous item, wrapping around                                            |
| `Enter`   | Apply the item; `/query` is removed in the same edit, undone with one `Ctrl/⌘+Z` |
| `Escape`  | Close, keeping what was typed; the menu does not reopen on the same `/`          |
| Space     | End the command: the menu closes, the text stays                                 |

A custom Trigger character (`@`) opens a similar list, independently of "/" — the "Custom Trigger character" section. Custom Tools add items to both sections by description, without editing the menu: they appear at the end of a section, in `tools` order, and are found by the label in the current locale, by the `en-US` label and by `aliases` (see the "Custom Tool" and "Insert items and Block actions" sections).

"+" on the Toolbar is an ordinary menu button (the kit's `Menu`): it supports the arrow keys, `Enter`, `Escape` and the first letter of the label; an item applies to the Block under the caret or to the selection, after which focus returns to the Document.

## Column layout

The `layout` Tool (present in `full`, not in `basic`) is a Block of columns. It is inserted with the **"Layout"** item of the Slash menu (`/layout` or "+"): two equal columns, the caret in the first. Six variants — **Single column, Two columns, Three columns, Four columns, 60/40, 40/60** — are chosen in the Block handle menu: "Add › Layout ›" inserts a Column layout under the Block (from a column, under the whole Column layout), and the variant is switched with "Layout ›" in the handle of a Block in a column and with "Format ›" in the handle of a Column layout selected as a whole (Backspace on the Block under it); in both, the current variant is checked. The Column layout has no button of its own on the Toolbar.

- **The Blocks of a column have their own handle**, at the left edge of the column at the level of the Block's first line (for the right column, in the gap between the columns). For them a column works like the Document: "Add ›" puts a new Block below in the same column, "Move up" and "Move down" do not leave it, "Delete" on the only Block leaves an empty column, "Format ›" changes the type of the Block itself. The Column layout's variant is a separate "Layout ›" item: the caret is almost always in a column, and the handle of the whole Column layout is rarely visible.

- **A column is a separate area.** It holds any Blocks except another Column layout: there is no nesting at the Schema level, so you cannot create a nested Column layout by pasting or from `value`. A Column layout is only a top-level Block: the "Layout" item from a column, list or quote puts a new Column layout under the current top-level Block (from a column, under the whole Column layout), and a Column layout from the clipboard pasted into a column, list, quote or cell unwraps into its Blocks. The other "Insert" items from a column land under the current Block **in the same column**; moving (`Alt+Shift+↑/↓`) and duplicating a Block do not leave the column either.
- **In the Editor the columns are outlined with a gray dashed line**; in `RichTextView` there is no outline — the border is for the author, not the reader. The variant sets the column widths, and dragging does not change them.
- **Changing the variant does not lose text.** If there are fewer columns, the Blocks of the extra columns move to the end of the last remaining one (empty extra columns simply go away); if there are more, empty ones are added. Insertion and a variant change are one edit, undone with one `Ctrl/⌘+Z`. "Single column" is a Column layout of one column; to remove the whole Column layout, use "Delete" on its handle or `Backspace` on the Block under it (the first press selects the Column layout, the second deletes it).
- **A narrow screen.** Columns sit side by side only when the Document itself is wide enough: two columns from 30 rem (480 px), three from 40 rem (640 px), four from 48 rem (768 px); at a smaller width they stack in reading order. The threshold is based on the Document's width (a container query), not the window's width, so in a narrow `Drawer` on a wide monitor the columns also stack. The root of a Document with a Column layout becomes a container (`container-type: inline-size`); in a shrink-to-fit context (a flex-row item without a width), give the field or `RichTextView` a width.

| Key in a column                      | What it does                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Tab` / `Shift+Tab`                  | To the start of the next / previous column. In a list, table and code block, Tab keeps its own behavior; from the outermost column it goes to the browser — focus leaves the Editor |
| `→` / `←` at the text edge           | To the start of the neighboring column on the right / to the end of the one on the left; from the outermost one, out of the Column layout                                           |
| `↓` / `↑` at the bottom / top line   | Out of the Column layout — to the Block under it / above it; at the Document edge, a gap cursor (a caret between two Blocks where an ordinary caret cannot go)                      |
| `Backspace` at the start of a column | Columns do not merge and text does not leave the Column layout; an empty heading, as everywhere, becomes text                                                                       |

**The markup** is a `div` with `data-block`; the widths are set by the variant in `data-layout`, with no `style` (the column shares in percent, joined by hyphens):

```html
<div data-block="layout" data-layout="60-40">
  <div data-block="column"><p>Wide column</p></div>
  <div data-block="column"><p>Narrow column</p></div>
</div>
```

The `data-layout` values are `100`, `50-50`, `33-33-33`, `25-25-25-25`, `60-40`, `40-60` (`RICH_TEXT_SCHEMA.layouts`). HTML from another editor with `div[data-block="column"]` columns and widths in `style="flex-basis: 40%"` is read as the Column layout of the nearest variant, and `style` is dropped. If the number of columns disagrees with the variant, the Editor adjusts the variant to the number of columns. Without the `layout` Tool, a Column layout from `value` and paste unwraps into Blocks one after another.

**Markdown does not support columns**: `getMarkdown()` exports the columns' Blocks one after another, left to right, and `setMarkdown()` does not create a Column layout, even from raw HTML. The strings are `editor.layout` and `editor.layoutVariant` in the English and Russian message catalogs; the item's icon is `ColumnLayoutIcon`. The decision is ADR-0056.

## Wrapper

The `wrapper` Tool (present in `full`, not in `basic`) is a Block that gathers a group of Blocks, like the Wrapper in Redactor. Without a tone the Wrapper has no look of its own: it keeps Blocks together — they can be moved, duplicated and deleted as one Block. With a tone it becomes a note or a warning, like alerts in GitHub and callouts in Notion (see the "Tone" subsection below). It is inserted with the **"Wrapper"** item of the Slash menu (`/wrapper` or "+") and with **"Add › Wrapper"** in the Block handle: an empty Wrapper with one paragraph lands under the current Block, and the caret goes into the paragraph inside. The Wrapper has no button of its own on the Toolbar.

- **Inside — any Blocks:** a paragraph, a heading, lists, a quote, a code block, a table, an image, a horizontal rule, but not another Wrapper or a Column layout. There is no nesting at the Schema level, so you cannot create a nested Wrapper or Column layout by pasting or from `value`. A Wrapper pasted into a Wrapper, list, quote or cell unwraps into its Blocks, and a Column layout inside a Wrapper unwraps into the columns' Blocks.
- **Placement.** A Wrapper can appear in the Document and in a column of a Column layout. From a column, the "Wrapper" item puts it under the current Block in the same column; from a Wrapper, list, quote or cell, under their Block. Insertion is one edit, undone with one `Ctrl/⌘+Z`.
- **The Blocks of a Wrapper have their own handle** at the left edge of the Wrapper. For them a Wrapper works like the Document: "Add ›" puts a new Block below in the same Wrapper, "Move up", "Move down" and `Alt+Shift+↑/↓` do not leave it, and "Delete" on the only Block leaves an empty paragraph.
- **The Wrapper's own handle** appears when it is selected as a whole (`Backspace` on the Block under it): "Move up", "Move down", "Duplicate" and "Delete" act on it together with its content.
- **"Unwrap"** is a Block action of the `wrapper` Tool: an item of the handle menu on the Wrapper itself and on a Block directly in it, in the Tools' actions section before "Delete". The Blocks take the Wrapper's place, and the caret stays in its text. One edit, one undo.
- **In the Editor a Wrapper without a tone is outlined with a gray dashed line** and inner padding — the same look as the columns of a Column layout; in `RichTextView` there is no outline, and the spacing between Blocks is as in the Document: the border is for the author, not the reader. A Wrapper with a tone is visible to the reader too — with the same look as in the Editor.

| Key in a Wrapper                               | What it does                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Enter` in an empty last paragraph             | If the Wrapper has other Blocks, the paragraph moves under the Wrapper, and the caret with it: a way out without the mouse. A sole paragraph stays inside                           |
| `Backspace` at the start / `Delete` at the end | Text does not leave the Wrapper and does not merge with a Block outside; an empty heading, as everywhere, becomes text                                                              |
| `Backspace` in the only empty paragraph        | Removes the empty Wrapper whole: an empty paragraph takes its place, with the caret in it (in a column, in the same column). One edit, one undo. `Delete` does not remove a Wrapper |
| `↑` / `↓` at the Wrapper edge                  | To the Block above it / below it; at the Document edge, a gap cursor, so you can put a paragraph before or after the Wrapper                                                        |
| `Tab` / `Shift+Tab`                            | Not intercepted: as in the Document (in a column, moving across columns). No keyboard trap                                                                                          |

**The markup** is a `div` with `data-block="wrapper"` and Blocks inside; the only attribute of its own is the tone `data-tone`, and without a tone there is none:

```html
<div data-block="wrapper">
  <h3>Before you start</h3>
  <p>Check your repository access.</p>
</div>
```

This is Redactor's markup: its HTML with a Wrapper is read as is on paste and in `value`, and `class`, `style` and other attributes on it are dropped. Without the `wrapper` Tool, a Wrapper from `value` and paste unwraps into Blocks one after another, and the text is not lost — the tone goes away with it.

### Tone

A tone turns a Wrapper into a note: **a soft tone background and a 3 px stripe on the left** in the color of the tone's strong step, the text is ordinary Document text, and the inner padding is like that of `Alert` (12 px at the sides, 10 px top and bottom). The look is **the same in the Editor and in `RichTextView`**: a Wrapper with a tone has no dashed outline even in the Editor — the boundary is visible from the background and the stripe, and the author does not see a second outline that the reader does not have. A Wrapper without a tone looks as described above: a dashed outline in the Editor only.

It is chosen in the **"Tone ›"** submenu of the handle menu — on a Block directly in a Wrapper and on the Wrapper itself selected as a whole; "Unwrap" is below it, in the actions section before "Delete". The items are radio (`menuitemradio`): "None" and five tones named by the meaning of the note: "Note", "Tip", "Important", "Warning", "Caution" (like GitHub alert keywords); next to the name is a small swatch of the background and stripe. The current one is checked, and the name of the "Tone ›" item includes the current tone: "Tone: Note" (in the Russian locale, "Тон: Заметка"), and without a tone, "Tone: None". A tone change is one edit, one undo; the caret stays in place, and focus is in the Document. Choosing the current tone makes no edit.

| `data-tone` | Menu item (ru / en) | GitHub alert     | Background (theme) | Stripe (theme)     | Paper (`paper`): background / stripe |
| ----------- | ------------------- | ---------------- | ------------------ | ------------------ | ------------------------------------ |
| `accent`    | Заметка / Note      | `> [!NOTE]`      | `--accent-soft`    | `--accent-strong`  | `--accent-soft` / `--accent` ¹       |
| `success`   | Совет / Tip         | `> [!TIP]`       | `--success-soft`   | `--success-strong` | `--od-green-2-a12` / `--od-green-1`  |
| `neutral`   | Важно / Important   | `> [!IMPORTANT]` | `--bg-3`           | `--fg-3`           | `--od-cloud-11` / `--od-cloud-4`     |
| `warning`   | Внимание / Warning  | `> [!WARNING]`   | `--warning-soft`   | `--warning-strong` | `--od-amber-2-a14` / `--od-amber-1`  |
| `danger`    | Осторожно / Caution | `> [!CAUTION]`   | `--danger-soft`    | `--danger-strong`  | `--od-red-3-a12` / `--od-red-1`      |

¹ In a light app, the "Note" stripe on the Paper is the light theme's `accent-strong`, like a link (see the "Surface" section).

- **The names are the kit's `Tone` vocabulary**, not the menu words: `data-tone="warning"` goes to the database, and neither the menu label nor the interface language changes it. The theme substitutes the color, as with `data-color`: a saved Document reads in `dark`, `light`, `dim`, with any accent and brand. The values are the roles `--rte-tone-<tone>-background` and `--rte-tone-<tone>-border` (`src/editor/styles/tokens.ts`): in a theme they resolve to the kit's status tokens, on the Paper (`surface="paper"`) to the primitives of the light theme. The Schema does not support a custom tone color (`style`).
- **"Important" is a neutral tone**, and it has two departures from `TONE_TOKENS.neutral`. The background is `bg-3`, not `bg-2`: the Editor's field itself sits on `bg-2`, and in the field "Important" would be left without a background; `bg-3` is the app background that the text tokens are calibrated for, and in weight it is closer to the soft backgrounds of the other tones in dark themes than `bg-4` is. In the light theme this background is almost white — the stripe carries the tone there. The stripe is `fg-3`, not the decorative `line`: it carries meaning and holds 3:1.
- **Contrast** (`npm run contrast`, the color pairs for Callout tones): the Document's text on each background is at least 4.5:1 (the worst is `warning`, 7.15 in the dark theme on `surface-elevated`; on the Paper 13.3), the stripe is at least 3:1 both against the app background around the Wrapper (the worst is 4.51 for "Note" on the Paper) and against its own fill (the worst is 3.68, "Note" on the Paper; in the app theme 4.60). This holds in all themes, accents and brands, and on the Paper.
- **Secondary text in a Wrapper with a tone uses higher-contrast roles.** The `fg-1`–`fg-3` and `accent-strong` steps are calibrated for app backgrounds, and on the colored tone backgrounds the contrast of a quote would be 4.23:1, of a link 3.97, of a caption and gray text 3.59. So inside a Wrapper with a tone a link, a quote (and the language label in the code block header), an image caption, a done task list item, gray text color (`data-color="muted"`) and the empty caption placeholder use the roles `--rte-tone-link`, `-secondary`, `-muted`, `-muted-foreground`:

  | What                                      | Role outside a tone          | In the app theme | On the Paper (`paper`) |
  | ----------------------------------------- | ---------------------------- | ---------------- | ---------------------- |
  | link                                      | `--rte-link`                 | `--fg-0`         | `--od-cloud-1`         |
  | quote, code block header                  | `--rte-secondary`            | `--fg-0`         | `--od-cloud-2`         |
  | image caption, done item, gray text color | `--rte-muted`, `-text-muted` | `--fg-0`         | `--od-cloud-3`         |
  | empty caption placeholder                 | `--rte-muted-foreground`     | `--fg-0`         | `--od-cloud-3`         |

  In the app theme, on all five backgrounds only `fg-0` holds 4.5:1 (`fg-1` gives 4.23 on "Note"), so inside a tone secondary text uses the main text's colors: a quote is still told apart by the stripe, a done item by strikethrough, a caption by font size, a link by underline (a Document link always has it). On the Paper, `cloud-2` and `cloud-3` pass on the tone backgrounds too and stay; the link (the accent gave 3.68) and the placeholder are moved to higher-contrast roles. The worst pair is 7.15:1 in a theme (`warning`, dark theme), 5.30:1 on the Paper (caption and placeholder on "Note"). Outside a Wrapper and in a Wrapper without a tone, the roles do not change. The gate does not measure the author's text color — palette and custom color — on a tone background: that is the author's choice.

- **An unknown tone is dropped** — both on parsing (`value`, paste, Source mode) and in `sanitizeRichText`: `data-tone="purple"`, `"Accent"` and `data-tone` on any other tag are removed, and the Wrapper stays without a tone. A Wrapper in a Wrapper, list, quote or cell is unwrapped into its Blocks, and its tone goes away. If unsanitized HTML with an unrecognized tone reaches `RichTextView`, it renders the Wrapper without any tone styling.
- **A tone is styling.** The saved HTML has no ARIA roles (`note`, `alert`) and no `aria-*` attributes: the screen reader reads the Wrapper's Blocks like the Blocks around it. So the meaning of a note is stated **in words** in its text — "Warning: …", "Tip: …": the background color must not be the only way the meaning is conveyed (WCAG 1.4.1).
- **Source mode** shows `data-tone` on a Wrapper as is; the field text passes through the Schema, like `value`.

**Markdown — GitHub alerts.** `getMarkdown()` exports a Wrapper with a tone as a quote whose first line holds the alert keyword (`[!NOTE]`), followed by its Blocks inside the quote:

```md
> [!WARNING]
>
> ### Before you upgrade
>
> Back up the database.
```

`setMarkdown()` and a Markdown paste read such a quote back into a Wrapper with a tone: the keyword is alone on the first line, in any case (`[!note]`). An ordinary quote, a keyword with text on the same line (`> [!NOTE] text`), an unrecognized keyword (`[!INFO]`) and an alert inside a list or quote stay a quote — GitHub does not show an alert in these cases either. Pasting an alert quote where a Wrapper is not allowed (inside a Wrapper, list, quote or cell), and `setMarkdown()` without the `wrapper` Tool, give Blocks one after another, without the keyword — like a Wrapper from HTML in the same place. A Wrapper without a tone is still just Blocks one after another in Markdown, and a raw `<div data-block="wrapper">` inside Markdown does not create a Wrapper.

The strings are `editor.wrapper` ("Wrapper"), `editor.unwrap` ("Unwrap"), `editor.wrapperTone` ("Tone: {current}"), `editor.wrapperToneNone` ("None") and `editor.wrapperToneName` (the names of the five tones) in the English and Russian message catalogs; the icons are `WrapperIcon`, `UnwrapIcon` and `PaletteIcon` (for "Tone ›"). The decision is ADR-0057.

## Details

The `details` Tool (present in `full`, not in `basic`) is a Block made of a title and content that the reader opens and closes: details under a heading, like a spoiler on GitHub or a toggle in Notion. The engine is the Details extension from Tiptap, and the API follows it (ADR-0048). It is inserted with the **"Collapsible block"** item of the Slash menu (`/collapsible`, `/details` or "+") and with **"Add › Collapsible block"** in the Block handle: an empty open Block with the caret in the title. Insertion is one edit, undone with one `Ctrl/⌘+Z`.

- **Title and content.** The title (`summary`) is one line of text with Marks, with no line breaks or Blocks. The content is any Blocks: a paragraph, a heading, lists, a quote, a code block, a table, an image, a horizontal rule, another Details Block. There are no Column layouts or Wrappers inside: there is no nesting at the Schema level, and a Column layout or a Wrapper from `value` or paste unwraps into its Blocks. The Block itself stands wherever any Block can: in the Document, a column of a Column layout, a Wrapper, a quote, a cell and the content of another Block. The Slash menu puts it under the handle's Block: from a paragraph, under it; from a list or a quote, under the whole list or quote; from a Wrapper, a column or the content of another Block, inside them.
- **Opening.** In the Editor, to the left of the title there is a button with a chevron: a real `button` named from the catalog ("Details: {title}") with `aria-expanded`. It is in the Tab order (from the Document, Tab leads to the button of the nearest Block below the caret), Enter and Space open and close the Block, and focus stays on the button. Collapsed content is hidden from the caret as well: the arrow keys do not take it inside. In `readOnly` the Block still opens and closes.
- **The `persist` option.** `tool("details", { persist: true })`, `false` by default (as in Tiptap). Without it the open state lives only in the display: opening does not reach the Document, the undo history or `onChange`, `open` is not written to the HTML and is not read from `value`, and a Block opened during editing is not published open without anyone asking. With `persist: true` an open Block writes `open=""`, `open` is read from `value`, paste and `setMarkdown()`, and opening or closing is an edit of the Document (`onChange`, undo). A Block inserted from the menu is open with any `persist`. The options are read once, when the engine is created; an invalid value (not a boolean) is replaced by the default with a `console.error` in development.
- **The Block handle works like a Wrapper's.** The handle at the title is the handle of the whole Block: "Move up", "Move down", "Duplicate" and "Delete" take it with its content. The Blocks in the content have their own handle at the left edge of the content: "Add ›" puts a new Block below in the content, "Move up", "Move down" and `Alt+Shift+↑/↓` do not leave it. There is no "Tone ›" for the Block. **"Remove collapsing"** is a Block action of the `details` Tool: an item on the Block itself and on a Block directly in its content, in the Tools' actions section before "Delete". The title becomes a paragraph, the content Blocks follow it, and the caret stays in its text. One edit, one undo.
- **In the Editor the Block is outlined with a frame** (`--rte-hr`) and inner padding, the title is semibold, and the `summary` marker is replaced by the button; in `RichTextView` there is the same frame and the same title, but with the browser's native marker.

| Key                                           | What it does                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Enter` in the title of an open Block         | The caret goes into the content: into the empty first paragraph if there is one, otherwise into a new paragraph at the start |
| `Enter` in the title of a collapsed Block     | A new paragraph under the Block                                                                                              |
| `Enter` in the empty last content paragraph   | A way out: the paragraph moves under the Block, and the caret with it                                                        |
| `Backspace` at the start of the title         | The Block falls apart, like "Remove collapsing"                                                                              |
| `Backspace` further into the title            | Deletes one character; an emoji or a composed character whole                                                                |
| `↓` / `→` from the title of a collapsed Block | A gap cursor right under the Block, past the hidden content                                                                  |
| `Tab` / `Shift+Tab`                           | Not intercepted: as in the Document. No keyboard trap                                                                        |

**The markup** is the kit's tags `details` and `summary` and the content wrapper `div[data-type="detailsContent"]`, with no classes or `style`:

```html
<details>
  <summary>How to build the package</summary>
  <div data-type="detailsContent"><p>Run the gates, then the build.</p></div>
</details>
```

`open` is written only with `persist`, and empty: `<details open="">`. HTML without the content wrapper (GitHub, browsers: `<details><summary>…</summary><p>…</p></details>`) reads the same way — the Schema completes it; a Block without content gets an empty paragraph. Without the `details` Tool a Block from `value` and paste unwraps: the title becomes a paragraph, the content Blocks follow, and no text is lost.

**The sanitizer** lets `details`, `summary` and the content wrapper through only in this shape. `summary` only directly in `details`; `div[data-type="detailsContent"]` only directly in `details` and only with that `data-type` value; `open` only on `details` and only empty (`open="open"` is removed, and the Block stays closed). Outside such a place the tags lose their wrapper, and their content stays as Blocks in a row. `iframe`, `class`, `style` and handlers are stripped, as everywhere. The allow-list is not narrowed by the `tools` set: `open` passes even with `persist: false` — another screen may have written it, and a server has no right to cut what it did not write.

**Markdown is raw HTML, as on GitHub.** `getMarkdown()` writes the Block with `details` and `summary` tags and Markdown inside:

```md
<details>
<summary>How to build the package</summary>

Run the gates, then the build.

</details>
```

The blank line after `summary` makes GitHub read the content as Markdown, and the Block collapses there. The title is inline Markdown on one line: GitHub will show its asterisks as they are, but the `getMarkdown()` → `setMarkdown()` round trip loses nothing; `<` in a title is written as `&lt;`. With `persist` an open Block is written as `<details open>`. `setMarkdown()` reads such a Block back — with nested Blocks, lists and code, where `</details>` inside a fence is not taken for the closing tag; `<details open>` without `persist` gives a closed Block. A tag with no matching `</details>` stays text. This differs from a Column layout and a Wrapper without a tone, which unwrap in Markdown: a Details Block has a common form in Markdown, and columns do not. Without the `details` Tool the same lines unwrap into Blocks in a row (an empty paragraph may remain after the closing tag).

The strings are `editor.details` ("Collapsible block"), `editor.unwrapDetails` ("Remove collapsing") and `editor.detailsToggle` ("Details: {title}", "Details: no title" for a Block without a title) in the message catalog (English and Russian); the icons are `DetailsIcon` for the insert item and `UnwrapIcon` for "Remove collapsing". The decision is ADR-0048 ("for the future": there was no customer at release).

## Formulas

The `mathematics` Tool is LaTeX formulas: inline in a paragraph and block on a line of their own. The engine is the Mathematics extension from Tiptap and KaTeX, and the API follows the extension (ADR-0048); the decision about KaTeX is ADR-0070. The Tool is in no Preset — neither `full` nor `basic`: KaTeX is heavy, and the Presets do not load it. You switch it on by name or with a `tool()` entry:

```tsx
import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, "mathematics"]} />;

// A custom KaTeX macro: \RR works in the Editor and in RichTextView with the same `tools`.
<RichTextEditor
  tools={[...RICH_TEXT_PRESETS.full, tool("mathematics", { macros: { "\\RR": "\\mathbb{R}" } })]}
/>;
```

- **Inserting.** Two Slash menu items ("/", "+" and the Block handle's "Add ›"): **"Formula"** (`/formula`, `/latex`, `/math`) goes into the line at the caret, and **"Block formula"** is a Block of its own: in place of an empty paragraph with the caret, otherwise right after the Block that holds the caret. A paragraph always follows a block formula, so there is somewhere to put the caret. The item opens a Popover with a LaTeX field, focus goes straight into it; the formula is inserted with the "Insert" button or a key (table below). An insertion is one edit, undone with one `Ctrl/⌘+Z`. There is no Toolbar button: two more buttons would push `full` onto a second row. The typing rules of the Tiptap extension work: `$$x^2$$` in a line gives an inline formula, `$$$x^2$$$` in an empty paragraph a block one.
- **Editing.** A click on a formula or `Enter` on a selected one opens a **kit Popover** at the formula itself instead of Tiptap's built-in editing: a LaTeX field, a live preview and the error in the field. From the keyboard an inline formula is selected with `Shift+→` or `Shift+←` from a caret next to it: a plain arrow moves the caret across an inline atom without selecting it (that is how ProseMirror works). A block formula is selected with the arrows, like any Block atom. "Apply" changes the formula in place (one edit), "Remove formula" deletes it, Escape closes the Popover without touching the Document and returns focus to the text. In `readOnly` and in a disabled field a formula is only shown.
- **Invalid LaTeX never changes the Document.** Parsing runs on every keystroke: while KaTeX cannot read the formula, the field shows its message ("Invalid LaTeX: …", `aria-invalid`; the KaTeX text is in English — the engine does not translate it) and the apply button is disabled. An unreadable formula already in the Document is not lost: in the Editor it stays as source, underlined with a wave in the error color, and can be fixed in the Popover.
- **Only the source is in the Document.** The HTML is the same as Tiptap's, with no classes and no `style`; the rendered KaTeX markup is not in the Document, so changing the KaTeX version does not touch saved Documents, and the HTML is compatible with other Tiptap editors.
- **The atom text is the LaTeX.** `getText()`, `getSelectedText()`, copying as text and the `maxLength` counter see the LaTeX source (`x^2` weighs 3). Search (`search`) searches that LaTeX: a match inside a formula highlights the whole formula and counts in "N of M", while "Replace" and "Replace all" leave formulas alone (the "Find and replace" section).
- **Lazy and on demand.** KaTeX, the extension, the Popover and the KaTeX CSS are brought by the Tool's Loader (ADR-0058, item 11.1), and only to an Editor that names `mathematics` in `tools`; `basic` and `full` do not load them. While the chunk is on its way the field shows the Skeleton: formulas as LaTeX source in monospace, a block formula at least 4 rem tall, so the field hardly jumps when the chunk arrives (nobody knows the exact height before rendering: a fraction is taller than this reserve, a formula without one is shorter).
- **KaTeX CSS and fonts come with the same chunk.** The chunk imports `katex/dist/katex.min.css` from the `katex` package the consumer installs with the command above: the bundler (Next.js, Vite, webpack) emits the lazy chunk's CSS itself and takes the fonts from the same package. The consumer has no step, and a page without formulas gets neither CSS nor fonts. `katex.render` draws formulas into the DOM: KaTeX sets sizes through the elements' `style` properties, not as a string of attributes in HTML. KaTeX's output is HTML and MathML (`htmlAndMathml`): a screen reader reads the MathML, and the visual HTML is hidden from it.
- **View.** `RichTextView` draws formulas with an Island. The server puts the LaTeX source into the empty element, so without JS and before rendering it is visible as text; after mounting, the lazy Island loads KaTeX with its CSS and draws each formula from `data-latex` in place. The Island is mounted only for a Document that has formulas; without them nothing is loaded. There is no new prop and no server helper: formulas are drawn for any Document, and the View's `tools` is needed only so that the formula options (`macros`) match the Editor's. An unreadable formula stays as source with the `data-math-error` attribute.

| Key                                                     | What it does                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `Shift+→` / `Shift+←` from a caret by an inline formula | Selects the formula                                           |
| `Enter` on a selected formula                           | Opens the edit Popover, does not split the paragraph          |
| `Enter` in the inline formula field                     | Applies                                                       |
| `Enter` in the block formula field                      | Line break: a block formula is a column (`aligned`, matrices) |
| `Ctrl/⌘+Enter` in the block formula field               | Applies                                                       |
| `Escape` in the Popover                                 | Closes without changes, focus returns to the text             |
| `Backspace` / `Delete` on a selected formula            | Deletes the formula                                           |

**Options.** `tool("mathematics", { macros, strict })` are the KaTeX options that do not affect the saved HTML. `macros` are custom macros: a name with a backslash and its substitution (`{ "\\RR": "\\mathbb{R}" }`). `strict` is what to do with non-LaTeX input (Unicode in math mode): `"ignore"` (the default), `"warn"` or `"error"`; the default is `"ignore"`, not `"warn"` as in KaTeX, so the console does not chatter on every typed character. The options are read once, when the engine is created; a wrong value (from JS without types) is replaced by the default, with one `console.error` in development. The options are data, and `RichTextView` reads the same ones from its `tools`. The kit turns KaTeX's `trust` off (`\href`, `\url` and `\includegraphics` do not work) and limits sizes (`\rule` and spaces to 50 em at most), so a formula from someone else's Document cannot stretch the page. A macro defined with `\gdef` inside a formula works only in that formula: every render (the Editor's, its Popover's and `RichTextView`'s) gets a fresh copy of `macros`, so the next formula does not see it and the Editor agrees with the View.

**Markup** is Tiptap's, with no classes and no `style`:

```html
<span data-type="inline-math" data-latex="e^{i\pi} + 1 = 0"></span>
<div data-type="block-math" data-latex="\int_0^1 x^2\,dx"></div>
```

**The sanitizer** lets `span[data-type="inline-math"]` and `div[data-type="block-math"]` with `data-latex` through: the pair is open only on these two tags and only with these values; `data-latex` on another tag or next to a foreign `data-type` is removed. A formula element is a leaf: rendered KaTeX markup from someone else's HTML is cut, and an element without `data-latex` loses its wrapper. A `<` is allowed in `data-latex` — it is LaTeX text, which DOMPurify escapes on output; in any other Schema attribute value `<` is still not allowed, and the boundary is pinned by a test (`tests/editor-sanitize-mathematics.test.tsx`). The `tools` set does not narrow the allow list: formulas pass even where the Tool is off. **A space in the pairs DOMPurify cuts.** DOMPurify 3 removes an attribute whose value contains `]>`, `-->`, `--!>` or `</style`, `</script` and the like (the check runs before the kit's hooks), yet LaTeX legitimately contains such text: `\left[0,1\right]>x`. So the Editor writes `data-latex` with a space inside the pair (`]>` → `] >`, `-->` → `-- >`, `--!>` → `--! >`, `</` → `< /`), and the saved HTML passes the consumer's sanitizer whole; `sanitizeRichText` does the same to foreign HTML before DOMPurify's check. In math mode KaTeX does not render spaces, so the formula looks the same. **The limit:** inside `\text{…}` the space is visible (`\text{</b>}` shows `< /b>`).

**Markdown** is `$…$` in a line and `$$…$$` on lines of their own; the `getMarkdown()` → `setMarkdown()` round trip loses nothing.

```md
Euler's identity: $e^{i\pi} + 1 = 0$.

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
```

The parsing rules are stricter than the Tiptap extension's, for the sake of money in text: there is no space after the opening `$`, none before the closing one, and no digit after the closing one, so "costs $5 or $6" stays text. An escaped sign (`\$`) inside a formula is part of the formula. A block formula needs lines of its own: `$$a$$ and text` on one line stays text. Pasting plain text with `$…$` does not create a formula unless the text has other Markdown (the paste signs are headings, lists, code, `**bold**` and links, not dollars); `setMarkdown()` always reads formulas.

**Without the Tool** a formula from `value`, `defaultValue`, a JSON envelope and a paste is not lost: an Editor without `mathematics` reads it as text — an inline one as `$…$`, a block one as a `$$…$$` paragraph. The author sees the LaTeX, on save it stays in the Document as plain text, and without the Tool `getMarkdown()` and `setMarkdown()` know no formulas (`$…$` stays text). The server sanitizer lets formulas through with any `tools` set.

The strings are `editor.mathInline` ("Formula"), `editor.mathBlock` ("Block formula"), `editor.mathLatex`, `editor.mathPreview`, `editor.mathEmpty`, `editor.mathInvalid`, `editor.mathInsert`, `editor.mathApply` and `editor.mathRemove` in the message catalog (English and Russian); the icons are `FormulaIcon` and `BlockFormulaIcon`. The decision is ADR-0070 ("for the future": ADR-0048, there was no customer at release).

## Footnotes

The `footnotes` Tool is footnotes: a reference with an automatic number in the text, and the footnotes' texts collected in a list at the end of the Document. It is in `full` and not in `basic` (a comment does not need footnotes). The decision is ADR-0076; the model is the one GFM, Plate and `tiptap-footnotes` use, not the Word and Google Docs one, where the text lives inside the reference and the list is only drawn: without JS a View has no such list, and Markdown could not be written one to one.

Terms: a **Footnote** holds the text, a **Footnote reference** is the number in the text, and the **Footnote list** is the block at the end (the words follow GFM; the Editor has no pages, so there is one word, "footnote", and Word's "endnote" is only a synonym for search).

- **Inserting.** The **"Footnote"** item of the Slash menu (`/footnote`) and of the "…" menu of the Toolbar. The reference goes at the end of the selection (the selected text stays), the footnote goes to its place in the list, and the caret moves into the footnote's text. One edit, one `Ctrl/⌘+Z`. There is no shortcut: `Ctrl/⌘+Alt+F`, which is Word's, is Find and replace here, and typing `[^` is not caught.
- **Where a reference can stand.** Anywhere there is running text: a paragraph, a heading, a list item, a table cell, an image caption, a quote, the title and the content of a Details Block, a Column layout column, a Wrapper. It cannot stand in a code block, in inline code, in a formula, and in a footnote (there are no nested footnotes). Where it cannot, the item is unavailable and `insert()` returns `false`.
- **One reference, one footnote.** As in Word and Google Docs. A second reference to a footnote (a `[^x]` used twice in Markdown, a duplicated paragraph, a paste) becomes its own footnote with a copy of the text, so no text is lost.
- **The kit keeps the list.** A footnote exists while its reference does: deleting the reference deletes the footnote in the same edit, and `Ctrl/⌘+Z` brings back both. Moving text moves the footnotes and renumbers them. A footnote cannot be deleted from the list directly, and an empty footnote stays. A Document with no footnotes has no list. The list is always the last Block of the Document, and there is one of it: a Block that lands after the list (the caret in the gap below it, a paste) is put before it.
- **A footnote is one paragraph** of text with Marks, links and hard breaks (`Shift+Enter`), not Blocks. In the Editor it has no Block handle, no Slash menu and no "+".
- **Jumps.** A click, or `Enter` on a selected reference, puts the caret at the end of its footnote and scrolls to it. The number button of every footnote ("Back to text, footnote 2") and `Enter` in a footnote put the caret right after the reference. The jumps work in `readOnly` (the Document does not change) and not in a disabled field.

| Key                                    | In a footnote or on a reference                  |
| -------------------------------------- | ------------------------------------------------ |
| `Enter` on a selected reference        | To the end of its footnote                       |
| `Enter` in a footnote                  | Back to the text, right after the reference      |
| `Shift+Enter` in a footnote            | A hard break; it stays one footnote              |
| `Backspace` at the start of a footnote | Nothing: footnotes do not merge                  |
| `Delete` at the end of a footnote      | Nothing                                          |
| `↑` / `↓`                              | Between the text and the list, as between Blocks |

- **Atom text.** The reference's text is its number in square brackets: `getText()`, `getSelectedText()`, copying as text and the `maxLength` counter see `[1]` (it weighs 3). The footnotes' texts count as ordinary text. The Table of contents does not show the reference's number in a heading.
- **Clipboard.** Copy and cut carry the text of the footnote with the reference. A paste into the same or another Editor makes a new footnote with a new key and the same text; a cut and paste moves the footnote with its text. A footnote list in the clipboard is not pasted on its own (its footnotes already travel with their references), and a footnote whose reference is not there becomes a paragraph. An Editor without the Tool follows the general rule: the markup goes and the text stays.
- **Incomplete HTML is repaired without losing text** — from `value`, `defaultValue`, Source mode, the JSON envelope and a paste. It is the kit's repair, not the author's edit: no `onChange` and no history step for a loaded Document. A reference without a footnote gets an empty footnote. A footnote without a reference becomes a paragraph before the list. A list that is not at the end, or several lists, are collected into one at the end. A repeated key gives the second reference its own footnote with a copy of the text. The numbers are recomputed.

**Markup.** The key is eight lowercase letters and digits, random, and it does not change when the footnotes are renumbered; the number is computed at display time and the number in the HTML is a snapshot (the order of the references is the source of truth).

```html
<p>
  Text<sup data-footnote-ref="k3x9q2mf"
    ><a href="#fn-k3x9q2mf" id="fnref-k3x9q2mf" role="doc-noteref">1</a></sup
  >
</p>
<section data-block="footnotes" role="doc-endnotes" aria-label="Footnotes">
  <ol>
    <li id="fn-k3x9q2mf">
      <p>Footnote text</p>
      <a href="#fnref-k3x9q2mf" role="doc-backlink">↩</a>
    </li>
  </ol>
</section>
```

The roles are DPUB-ARIA. The list's name (`aria-label`) is the catalog's `editor.footnotes` in the language of the Editor's message catalog, written into the HTML like the rest of the Document's text. The list has a short rule above it, small secondary text and no visible heading.

**The sanitizer.** These are the first `id` and the first `href="#…"` in the Schema, and they are open only here: `id` only as `fnref-<key>` on the reference's anchor and `fn-<key>` on a footnote in the list; `href="#…"` only as `#fn-<key>` on the reference's anchor and `#fnref-<key>` on the backlink, to the same key; `role` only as `doc-noteref`, `doc-endnotes` and `doc-backlink` in their places; `aria-label` only on the list. The `link` Tool still takes no `#`, and headings get no `id`. A `section` without the `footnotes` marker, or not at the top level, loses its wrapper, and the reference is rebuilt to the form above whatever stood inside it. Because the keys differ, two Documents on one page (a feed of comments) do not collide, and the anchors work in the View, in an email and in a PDF made from the same HTML. **Two renderings of the same Document on one page do share their ids** (an Editor next to a `RichTextView` preview of the same HTML): the keys belong to the Document, not to the rendering, so a jump in the second one goes to the first. Show one rendering at a time, or accept that the jumps go to the first. The bare `richTextSanitizeConfig()` stays closed to them: only `sanitizeRichText` admits them, with its hooks. A sanitizer of your own must not copy `id`, `role`, `aria-label` or `data-footnote-ref` from `RICH_TEXT_SCHEMA.attributes` as plain attributes: it would admit any `id` on any tag. Leave them out and the footnotes keep their text without the jumps (see "Schema and security").

**Markdown** is GFM, with nothing lost in either direction.

```md
Text[^1] and more[^2].

[^1]: The first note.

[^2]: The second note.
```

`getMarkdown()` writes `[^1]` … `[^n]` and the definitions at the end; a hard break inside a footnote continues on an indented line. Reading: a label (`[^note]`) becomes a number; a reference with no definition stays the text `[^note]`; a definition with no reference becomes a paragraph at the end, with its label; a label used twice gives two footnotes; the second and later paragraphs of a definition (indented by four spaces) are joined to the first with a hard break, because a footnote is one paragraph. Plain text with a definition line is recognized as Markdown on paste. This adds nothing to "What is lost on export".

**Without the Tool** a Document with footnotes opened in an Editor does not lose its text: the reference's number stays as text (`1`, superscript if `superscript` is on), the footnotes' paragraphs follow it without the "↩" arrow (it would lead nowhere), and Markdown keeps `[^1]` and its definition as text.

**Lazy.** The Tool is a lazy built-in (ADR-0058, item 11.1): the nodes with their node view, the keys, the upkeep of the list, the jumps and the Markdown rules are a separate chunk that the Tool's Loader brings, and only to an Editor that has `footnotes` in `tools` (`full` does, `basic` does not). The Editor requests the chunk on its first render in the browser and shows the Skeleton until it arrives; the Skeleton draws the references and the list from `value` in the same markup the Editor saves, with the list named in the interface language. The Slash menu item, the Schema and the sanitizer are not in the chunk, so `sanitizeRichText` and `RichTextView` import nothing extra. Before Readiness `handle.tool("footnotes")` is `null`, like any Tool's commands, and a command that is called without the chunk returns `false`.

**View.** `RichTextView` shows the references and the list and follows the jumps as plain anchors: no JS, no Island. Run the Document through `sanitizeRichText` first (see "Schema and security").

**State and commands.** `useRichTextToolState(ref, "footnotes")` returns `FootnotesToolState`: `footnotes` is the list in order, each `{ number, text }` (a hard break is a line break), and `current` is the number of the footnote the caret is in or whose reference is selected, otherwise `null`. `handle.tool("footnotes")` returns `FootnotesToolCommands`, and every command returns a `boolean`. The Tool has no options.

| Command            | What it does                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `insert()`         | The same as the "Footnote" item: a reference at the end of the selection, its footnote, the caret in it. One undo step |
| `goToFootnote(n)`  | The caret at the end of footnote `n` (from 1), scrolled into view; works in `readOnly`                                 |
| `goToReference(n)` | The caret right after the reference of footnote `n`, scrolled into view; works in `readOnly`                           |

`insert()` is `false` in `readOnly`, in a disabled field, in Source mode, where a reference cannot stand, and when the character limit would be exceeded. The jumps are `false` for a number that has no footnote, in a disabled field and in Source mode.

The strings are `editor.footnote` ("Footnote"), `editor.footnotes` (the list's name) and `editor.footnoteBack` (the number button's name) in the message catalog (English and Russian); the icon is `FootnoteIcon`. Stories: `Inputs/RichTextEditor`, `Footnotes`, `FootnotesRenumbering`, `FootnotesMarkdown`, `FootnotesReadOnly` and `FootnotesRussian`.

## Date mention

The `date` Tool is a date inside a line of text: an inline Atom that is chosen in the kit's `Calendar`, stored in a form a machine can read, and shown in the author's format. The term is Date mention (as in Notion); the decision is ADR-0079. The Tool is in `full` and not in `basic` (in a comment, a date is typed as text). It is a plain name, and the format is set with a `tool()` entry:

```tsx
import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

<RichTextEditor
  tools={[...RICH_TEXT_PRESETS.full, tool("date", { format: { dateStyle: "long" } })]}
/>;
```

- **Inserting.** The Slash menu item **"Date"** (`/date`, `/today`, and the Russian words for them; "/" and "+", but not the Block handle's "Add ›", which means a new Block below, and a mention is inline) opens a Popover at the caret with the `Calendar` and the focus on today. Picking a day, by a click or `Enter`, inserts the mention at once, so `Enter` alone inserts today. The **"Time"** switch adds a time field (`HH:MM`); with it on, a picked day does not insert, and the "Insert" button or `Enter` in the time field does. A typed date in the text is never turned into a mention by itself. The insertion is one edit, undone with one `Ctrl/⌘+Z`. There is no Toolbar button.
- **Editing.** A click on a mention or `Enter` on a selected one opens the same Popover on its day: another day (without the time switch) changes the mention in one edit, **"Remove time"** turns a date with a time back into a date, **"Delete date"** deletes the mention, `Escape` closes the Popover without changes. A mention is selected from the keyboard with `Shift+→` or `Shift+←` from a caret next to it (a plain arrow moves the caret across an inline atom, that is how ProseMirror works). The words are re-written in the **current** locale of the author at every edit. In `readOnly` and in a disabled field a mention is only shown, with no Popover.
- **The value is `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM±HH:MM`.** A date has no zone and never shifts by a day. A date with a time carries the UTC offset of the author's browser at the moment of insertion (`2026-10-18T15:00+03:00`). The kit does not know time zones (ADR-0008): it writes the offset down and never recalculates it, so the reader's zone plays no part.
- **The text is written once, in the author's locale.** `<time datetime="2026-10-18">Oct 18, 2026</time>`: the Document holds the words the reader will see. `RichTextView` shows them as is, so a page reads the same with no JS, in a letter and in a PDF, and never differs between the server and the browser. The words come from the locale of `UiProvider` and the `format` option. A reader in another locale sees the author's format; the same date can be written differently by different authors (`Oct 18, 2026` and `18 Oct 2026`), while `datetime` is one.
- **The atom text is the visible text.** `getText()`, `getSelectedText()`, copying as text and the `maxLength` counter see the words ("Oct 18, 2026" weighs 12). Find and replace (`search`) steps over a mention like over any other Atom and does not search its words. A mention is a plain Atom: the Bubble menu does not surround it.
- **Lazy in part.** The Calendar, react-aria and the Popover are a separate chunk, loaded when a mention is inserted or edited for the first time. The node and the Slash menu item are in the start bundle and weigh little, so the Skeleton already shows a mention as a `time` with its words.
- **View.** There is no Island and no new prop: a mention is a `time` element with text, readable without JS. The View's `tools` is not needed for it.

**Options.** `tool("date", { format })`, where `format` is an `Intl.DateTimeFormatOptions` object for the date; by default it is the format of `formatDate`, `{ day: "2-digit", month: "short", year: "numeric" }`. It is data, not a function, so the text of a Document does not depend on the screen's code. It is **replaced as a whole**, not merged with the default (`{ dateStyle: "long" }` next to `day` would be an error in Intl). For a date with a time the kit adds hours and minutes in the locale's own cycle (`15:00` in German, `3:00 PM` in English; `timeStyle: "short"` next to `dateStyle`). Only date fields are allowed: a value with `hour`, `minute`, `second`, `timeStyle`, `timeZone`, `hourCycle` and the like, or a combination Intl rejects, is a mistake and is replaced by the default, with one `console.error` in development. The options are read once, when the engine is created.

**Command.** `ref.current?.tool("date")?.insert(value?)` inserts a mention at the caret in one edit: `value` is a date `YYYY-MM-DD` or a date with a time `YYYY-MM-DDTHH:MM±HH:MM`, and its text is written by the current locale and `format`. Without `value` it opens the Popover, as the Slash menu item does. It returns `true` when the mention is inserted or the Popover is opened, and `false` for a read-only field, Source mode, or a `value` that is not a date in these two forms (a day that does not exist, a time without an offset, `Z`). There is no Tool state: a screen reads the dates from the HTML by `time[datetime]`.

**Markup:**

```html
<p>
  Due <time datetime="2026-10-18">Oct 18, 2026</time>, meeting at
  <time datetime="2026-10-18T15:00+03:00">Oct 18, 2026, 3:00 PM</time>.
</p>
```

**The sanitizer** lets `time[datetime]` through when `datetime` is exactly `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM±HH:MM` and a real calendar date (`2026-02-29`, month 13, hour 24 and `Z` instead of an offset are not): the same check as in the Editor. The element keeps only text; marks and tags inside it are cut. A `time` in any other form loses its wrapper and keeps its words. The `tools` set does not narrow the allow list.

**Someone else's `<time>`** (a value, a paste, Source mode) becomes a mention when `datetime` is in the two forms above, and its text is kept as it is: the words are not re-written until the author edits the mention. An empty element gets its text from `format`. A `time` with a period, a year, a week, a time without an offset or a `Z`, and one that wraps more than 120 characters (page markup, not a date) stays ordinary text, losslessly.

**Without the Tool** a mention from `value`, `defaultValue`, a JSON envelope and a paste is not lost: the Editor reads it as its words. The server sanitizer lets `time[datetime]` through with any `tools` set.

**Markdown** writes the text of a mention; the machine value is lost on export (a line in "What is lost on export"), and `setMarkdown()` reads the words as plain text. For a lossless copy use HTML or the JSON envelope.

The strings are `editor.date` ("Date"), `editor.dateTime`, `editor.dateTimeField`, `editor.dateTimePlaceholder`, `editor.dateRemoveTime`, `editor.dateRemove`, `editor.dateInsert` and `editor.dateApply` in the message catalog (English and Russian); the icon is `DateMentionIcon`. The decision is ADR-0079.

## Emoji

The `emoji` Tool (present in `full`, not in `basic`) is the "Emoji" button on the Toolbar right after "Table ▾", before undo and redo. It opens a **kit popover** (`Popover`) with a grid of a curated set: "Favorites" (20) and six categories of ten — "Smileys", "Gestures", "Animals", "Food", "Activities", "Travel". There is a single grid; the categories follow one another, each under its label. There is no full Unicode set, search, "recent", skin tones or `:shortcodes:`, and there never will be: this is a quick path to familiar symbols, not an OS emoji picker.

**An emoji is plain text.** It has no Block or Mark of its own, like `clearFormatting`: the Schema, the sanitizer and Markdown do not change, and the inserted symbol ends up in the output HTML, into `RichTextView` and into `getMarkdown` like any other text. To turn the button off, remove `emoji` from `tools`; the whole grid goes with it.

- **Insertion.** Click a cell or press `Enter` or Space in the grid. With an empty selection the emoji is inserted at the caret position, with a non-empty one **at the end of the selection, without erasing it**. The caret is placed right after the emoji, the popover closes, and focus returns to the Document. One undo reverts the insertion.
- **`maxLength`.** Insertion is an ordinary edit, so the limit stops it: if the limit is reached, the emoji is not inserted; if less room remains than the symbol takes (most emoji take two UTF-16 code units, as `length` counts them), it is not inserted either: an emoji is never inserted partially.
- **Nowhere to insert** (an image or table cells are selected) — the button is `aria-disabled`, and the popover does not open.
- **The set's content** is data in one server-safe module without React or DOM: categories in order, and for each emoji the symbol and a name key. One emoji may appear in two categories ("Favorites" repeats part of the others). There is no emoji library.

**Keyboard.** When the popover opens, focus is on the grid, as in the table size grid; `aria-activedescendant` identifies the current cell.

| Key            | Action                                                   |
| -------------- | -------------------------------------------------------- |
| `←` / `→`      | Previous / next emoji, across a category boundary        |
| `↑` / `↓`      | A row up / down (ten emoji per row)                      |
| `Home` / `End` | To the start / end of the row; with `Ctrl`, first / last |
| `Enter`, Space | Insert the current emoji                                 |
| `Escape`       | Close the popover and return focus to the Document       |

Inside `Dialog` and `Drawer`, you can choose an emoji with both the mouse and the keyboard, and Escape closes only the popover: Radix layers share one stack (ADR-0041). The strings are `editor.emoji` (the button's name), `editor.emojiGrid` (the grid's name), `editor.emojiCategory` (category labels) and `editor.emojiName` (the name of each emoji) — in the message catalog, in English and Russian.

## Source mode

The `source` Tool (present in `full`, not in `basic`) is the "HTML" toggle button on the **fixed** Toolbar, in the "Whole Block" group right after "+", as in Redactor. It replaces the Document with a monospace field holding the current Document's HTML; pressing it again switches back to the visual mode. The mode has no keyboard shortcut; the Keyboard shortcuts popover is available in the mode.

```tsx
<RichTextEditor preset="full" value={html} onChange={setHtml} /> // the "HTML" button is already on the Toolbar
<RichTextEditor tools={["bold", "italic", "link", "history", "source"]} /> // or explicitly in tools
```

**What is visible.** The HTML is formatted: a top-level Block on its own line, the children of Block containers (list items, table rows and cells, the columns of a Column layout, parts of a `figure`, a task list item) indented by two spaces, a Block's content on its tag's line (text whitespace is unchanged), the content of `pre` as is. The formatting is lossless: applying unchanged text produces the same Document. An empty Document opens as an empty field, not as `<p></p>`. There is no syntax highlighting.

**Look.** The field is **always dark, using the kit's colors**, not the code block's syntax highlighting palette: in `dark` and `dim`, the theme's deepest background with its text and border; in `light` and on the Paper (`paper`), the same values of the dark theme (the variables `--rte-source-background`, `--rte-source-foreground`, `--rte-source-border`, which can be overridden). On the Paper (`paper`), the light sheet stays under the dark field: the sheet's contents change, not the sheet itself. The corner radius is as for code, the font is monospace 13 px, as in `CodeView`; the padding is as for the Document area. On entry the height is at least the Document's height, then the field grows with its content and can be stretched vertically by hand. With `maxHeight` or `resizable` the field lives in the same scroll area as the Document (see the "Field height" section). Text selection in the field also comes from the dark theme for the current accent (`--selection-dark`), with the field's light text: the light theme's light selection was unreadable on the dark field.

**Applying — on exit, on losing focus and on reads.** The field's text goes through the Schema with the same parsing as an incoming `value` (everything not in the Schema is dropped — `script`, `on*` handlers, arbitrary `style` and `class`, `javascript:`; markup of disabled Tools is stripped, the text stays), and replaces the Document in **one edit** — one `Ctrl/⌘+Z` undo in the Document returns it to the state before applying. Applying is triggered by:

- leaving the mode with the "HTML" button;
- focus leaving the field (`blur`) — the field's text is not reformatted: the author continues with their own text, and the fresh formatting is visible at the next entry;
- form submission (`submit`, in the capture phase — before the consumer's `onSubmit`) and building `new FormData(form)`;
- `ref.getHTML()`, `ref.getMarkdown()`, `ref.getText()` and `ref.getJSON()`, and the insertions `ref.insertHTML()` and `ref.insertText()`;
- switching to `readOnly` and the button disappearing (a `toolbar` change) — the mode closes;
- unmounting the Editor — for example, when Escape in the HTML field closes the `Dialog` around it: `blur` does not reach the field then, and the edit is not lost.

If the text did not change since entry or the last time it was applied, or parsing produced the same Document (only the whitespace between Blocks changed), there is no edit, no history step and no `onChange`: opening the mode, looking and closing it again is safe. Otherwise `onChange` receives the new HTML **immediately**, without `changeDelay`, as on `blur`; typing in the HTML field does not call `onChange`. The hidden `name` field is updated together with applying.

The `required` check in the mode is evaluated against **the field's text** on every change, not the applied Document: the browser validates the form before the `submit` event, so `form.requestSubmit()` with focus in the HTML field lets through text typed into the field while the Document is empty, and blocks the form when the field has been cleared but the Document is not empty. The text is parsed by the same Schema as on applying, and it is empty exactly when the Document would be empty: `<p></p>` or only tags the Schema drops block submission, `<hr>` does not. Without `required` the text is not parsed while typing.

**Programmatic replacements in the mode.** A new `value` (not equal to the last one emitted), `setMarkdown()` and `clear()` replace the Document, and the field's text is overwritten with the formatting of the new Document: the screen that holds `value` outranks an unsaved edit. The field is not reset when the `value` it emitted comes back as a prop.

- **`maxLength`** does not truncate the text when it is applied — like `setMarkdown`: the counter shows the excess. In the mode the counter reflects the last applied state.
- **`disabled`** and `<fieldset disabled>` disable the HTML field and the button; the mode stays open.
- **What is off in the mode.** The other Toolbar buttons and menus are `aria-disabled` (they stay in the arrow-key order but do not fire); there is no Block handle, Bubble menu or `/` Slash menu. The engine stays mounted and hidden: the edit history is preserved.
- **Where the button is absent.** The button is absent from the floating Toolbar and the Bubble menu (`toolbar="floating"`, `"bubble"`): they appear above a selection in the Document, and in this mode there is no Document; with `toolbar="none"` and in `readOnly` there is no Toolbar. On a touch screen the Toolbar is always fixed — so the mode exists there.
- **SSR.** The mode is internal state, not a prop; it always starts visual, so the server output is the same as without the `source` Tool.

`RichTextView`, the Schema, the `sanitizeRichText` sanitizer and the allowlist are not changed by the mode: it does not widen the Schema: HTML from the field goes through it the same way as an incoming `value`. The strings are `editor.source` (the button's name, "HTML") and `editor.sourceField` (the field's name, "HTML source" in English, "HTML-код документа" in Russian) in the message catalog, in English and Russian; the icon is `SourceIcon`.

## Find and replace

The `search` Tool (present in `full` and in `basic`) is find and replace over the Document. The "Find" button (a magnifying glass icon) sits at the right edge of the fixed Toolbar, before the Keyboard shortcuts popover; `Ctrl/⌘+F` with focus in the Document opens the find panel (outside the field the browser's find works), `Ctrl/⌘+Alt+F` opens it with focus in the replace field, and the `open` command of the Tool (`ref.current?.tool("search")?.open()`) opens it from screen code.

```tsx
<RichTextEditor preset="basic" /> // the "Find" button and Ctrl/⌘+F are already there
<RichTextEditor tools={["bold", "italic", "history", "search"]} /> // or explicitly in tools
```

- **The find panel** is non-modal, under the right edge of the Toolbar (without a fixed Toolbar, in the field's top corner; on a narrow screen, full width). On top are the counter "3 / 12", "Previous match", "Next match" and "Close find and replace" as three icon buttons; below are the find field, the replace field, the "Match case" and "Whole words" checkboxes, the "Regular expression" switch, and the "Replace" and "Replace all" buttons. Focus is not trapped: what was found is edited in the Document, and you return to the field.
- **Opening.** Selected text within one Block becomes the query (a selection across Blocks does not: a match does not cross a Block boundary). A repeated `Ctrl/⌘+F` with the find panel open puts focus into the find field and selects its text. The "Find" button is a toggle with `aria-pressed`.
- **Match highlighting.** All matches get a soft fill in the `warning` tone, the current one has a stronger fill and a border; when you navigate, type the query or click "Replace", the current match is selected, and if it is not visible, it is scrolled to the middle of the free area: below the sticky Toolbar and the find panel, inside a field with `maxHeight`; a visible match does not move. Matches are recomputed in the same transaction that changes the Document. The classes `rte-search-match` and `rte-search-current` are decorations and are not stored in the Document.
- **Scope.** The text of Blocks, including table cells and code blocks. A match does not cross the boundary of a Block or an inline Atom (an image, a mention, a hard break); Marks inside do not interfere — "bo**ld**" is found as "bold". **Formulas (`mathematics`) are the exception:** their LaTeX source is searched as a separate string, and a match inside an inline or block formula highlights the whole formula, selects it as a node when you step onto it and counts once in "N of M", however many times the query repeats inside. A match with the neighbouring text does not cross the edge of a formula.
- **Options.** When "Match case" is unchecked, case is ignored. "Whole words" finds word boundaries by Unicode letters and digits, so it works for Cyrillic too (JavaScript's `\b` recognizes only Latin letters). With "Regular expression" the query is a JavaScript expression; an invalid one shows an error under the find field (`aria-invalid`) and highlights nothing. Empty matches of the expression (`x*`) are skipped.
- **Keys.** `Enter` in the find field goes to the next match, `Shift+Enter` to the previous one, wrapping around; `Enter` in the replace field is "Replace". `Escape` closes the find panel, removes the highlighting and puts the caret on the current match.
- **Replacing.** "Replace" replaces the current match, one edit and one undo; the next one then becomes current. "Replace all" is one transaction and one undo. The new text takes the Marks of the start of the match; an empty replacement deletes what was found. **Search finds formulas but does not replace them:** they are edited only through the Popover. "Replace all" leaves them, and the counter after it shows what remains (the formulas with the query inside); if the current match is a formula, "Replace" takes the nearest following text match; when only formulas are left, both buttons are disabled. With a regular expression, the groups `$1…$9`, `$&` (the whole match) and `$$` (a dollar sign) work in the replacement — against the text where the match was found, so expressions with lookbehind and lookahead replace correctly too; without the expression, `$` is an ordinary character. In `readOnly` there is no replace field or buttons — only find.
- **Accessibility.** The panel is a `role="search"` region named "Find and replace"; the counter is announced through a live region with `aria-live="polite"` ("3 of 12", "No matches"), the fields have labels, and the switch is `role="switch"`.
- **Weight.** The match highlighting plugin and the shortcuts are in the engine from the start; the find panel (fields, checkboxes, switch) is a lazy chunk that loads the first time the panel opens and does not delay Readiness.

Message catalog strings: `editor.search` (the button and the `Ctrl/⌘+F` Keyboard shortcuts popover row), `searchReplace` (`Ctrl/⌘+Alt+F`), `searchPanel`, `searchField`, `replaceField`, `searchPrevious`, `searchNext`, `searchClose`, `searchMatchCase`, `searchWholeWord`, `searchRegex`, `replaceOne`, `replaceAll`, `searchCount({ current, total })`, `searchNoMatches`, `searchInvalid`.

### Find options

A `tool("search", options)` entry sets the **starting flags**: the panel opens with them, and the commands use them until the search is closed. The flags stay switchable in the panel, and the kit does not remember them between openings: closing the panel returns them to the starting values.

| Option      | Meaning                                      | Default |
| ----------- | -------------------------------------------- | ------- |
| `matchCase` | The panel opens with "Match case" on         | `false` |
| `wholeWord` | The panel opens with "Whole words" on        | `false` |
| `regex`     | The panel opens with "Regular expression" on | `false` |

```tsx
// Searching code in Documents: case matters, so nobody has to switch the flag on each time.
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, tool("search", { matchCase: true })]} />
```

### Find state and commands

The state is read with `useRichTextToolState(ref, "search")`, and the commands are called on `ref.current?.tool("search")`. The general rules for both are in the "Handle (`ref`) and your own toolbar outside the field" section.

| State field | Meaning                                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`      | The find panel is open.                                                                                                                                              |
| `query`     | The query. Closing the panel removes the query and the highlighting; without a panel, the `setQuery` command sets it.                                                |
| `flags`     | The flags `{ matchCase, wholeWord, regex }`. Closing the panel returns them to the starting values from the options.                                                 |
| `total`     | How many matches of the query are in the Document.                                                                                                                   |
| `current`   | The index of the current match, from 0; `-1` means no matches.                                                                                                       |
| `error`     | The error text if the query is an invalid regular expression (the JavaScript engine's message, not localized); otherwise `null`. With an error there are no matches. |

The state has no match positions.

| Command                      | What it does                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open({ replace?, query? })` | Opens the panel, like the "Find" button and `Ctrl/⌘+F`. `query` puts the query in the field and in the Document highlighting at once; without it, the text selected within one Block becomes the query. `replace: true` puts focus in the replace field. `false` in Source mode.            |
| `close()`                    | Closes the panel and removes the highlighting. Focus and the caret stay where they were, unlike `Escape` in the panel. A panel that is already closed is not an error.                                                                                                                      |
| `setQuery(query, flags?)`    | Sets the query. Flags not named in `flags` (and flags set to `undefined`) come from the open panel, or from the options when there is none. A non-empty query scrolls to the first match after the caret. `true` means the query was applied, even with no matches; `false` in Source mode. |
| `next()`, `previous()`       | They select the next or previous match, wrapping around at either end, and scroll the field's scroll area or the window to it, even when focus is outside the Document; they do not take focus. `false` means no matches.                                                                   |
| `replace(text)`              | Replaces the current match: one edit, one undo; the next match becomes current. Formulas are skipped. `false` means no text matches or a field the author cannot edit.                                                                                                                      |
| `replaceAll(text)`           | Replaces all text matches: one edit, one undo; formulas stay and count in `total`. The conditions are the same as for `replace`.                                                                                                                                                            |

The query and the flags live in the engine, so `setQuery`, `next` and `replace` work without an open panel: you can build your own find interface on them. The panel and the commands share one search, so a replacement made from code shows up in the panel. Scrolling after `next`, `previous` and `setQuery` arrives a moment after the call: its code loads on first use and is not part of the Editor's entry chunk.

**A counter in the Status bar.** While the find panel is open, the screen can show "3 of 12" next to the character counter. Closing the panel removes the query, and the counter disappears.

```tsx
import { useRef } from "react";
import { RichTextEditor, useRichTextToolState } from "@olddevs/ui/editor";
import type { RichTextEditorHandle } from "@olddevs/ui/editor";

function ArticleBody({ html }: { html: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  // `null` before mount and on the server, so the screen renders the same in both places.
  const search = useRichTextToolState(ref, "search");

  return (
    <RichTextEditor
      ref={ref}
      aria-label="Article body"
      defaultValue={html}
      status={
        search?.open && search.query ? (
          <span>{search.total ? `${search.current + 1} of ${search.total}` : "No matches"}</span>
        ) : null
      }
    />
  );
}
```

## Invisible characters

The `invisibleCharacters` Tool (present in `full`, not in `basic`) shows the invisible characters of the Document: spaces (`·`), hard breaks `Shift+Enter` (`↵`) and paragraph ends (`¶`). This is how you find double spaces, a trailing space and stray empty paragraphs. The engine is the Invisible Characters extension from Tiptap, and the API follows it (ADR-0048); the Tool has no Block, and the Schema, the sanitizer and Markdown do not change. The "Invisible characters" checkbox item (a pilcrow with an arrow) is the last section of the "…" menu of the fixed Toolbar, set off from "Clear formatting" by a divider; from screen code the `toggle` command switches the characters.

```tsx
<RichTextEditor /> // the item in "…" is there, the characters are hidden
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, tool("invisibleCharacters", { visible: true })]} /> // shown from the start
```

- **Display only.** The marks are decorations over the Document: they are not in it. `value`, `onChange`, `getHTML()`, `getMarkdown()`, `getJSON()`, `getText()`, the edit history, `maxLength`, copying and `RichTextView` do not see them. Showing and hiding is not an edit: `onChange` is not called and there is no undo step.
- **Hidden by default.** In Tiptap the extension starts shown (`visible: true`); in the kit it starts hidden: the Tool is in `full`, and a kit update must not change how every Editor on that Preset looks. The author turns the display on with the "…" menu item or the `visible` option.
- **What is shown.** Every ordinary space of the text (in a code block too) is `·`; a hard break is `↵`; the end of every paragraph is `¶`, including an empty one and one in a list, quote, cell, column or Details Block. A heading and a code block have no end mark: the extension puts it on a paragraph only. A non-breaking space and other Unicode whitespace are not shown. In an empty field the paragraph mark gives way to the `placeholder`.
- **Look.** The kit's CSS draws the marks, not text: a muted color (`--rte-muted-foreground`, recomputed for its background inside a toned Wrapper) and zero width. The text does not shift or wrap differently, the marks cannot be selected and the mouse does not catch them. The kit does not load the extension's own CSS (`injectCSS: false`): it would write its own `<style>` into the page `head`, bypassing the theme tokens.
- **The menu item.** A checkbox (`menuitemcheckbox`) with `aria-checked`: the characters are shown; choosing it toggles the display and closes the menu. There is no separate Toolbar button: an extra button wrapped the `full` Toolbar onto a second row in a column of about 640 px, so the item sits in "…", whose button does not make the row longer. It has no shortcut, like "HTML", and there is no Slash menu item: this is a display mode, not an insertion. The item exists only on the fixed Toolbar; the floating Toolbar, the Bubble menu and `readOnly` do not have it. If no other item of "…" is among the Tools, the "…" menu is rendered for this one alone. In the Source mode the Document is not on screen, so "…", like the other Toolbar menus, gets `aria-disabled` and does not open; the `toggle` command returns `false` there. In a `disabled` field "…" is disabled. From the keyboard the item is reached like the others: Enter, Space or `↓` opens "…", then the arrows move and Enter or Space toggles the display.
- **Weight.** The extension is in the engine from the start and has no lazy chunk. It builds the marks over the whole Document when the engine is created and over the changed range on every transaction, shown or hidden: on very long Documents this is noticeable at load.

The message catalog string is `editor.invisibleCharacters` ("Invisible characters"): the name of the "…" menu item; the icon is `InvisibleCharactersIcon`. The decision is ADR-0048 ("for the future": there was no customer at release).

### Invisible characters options

A `tool("invisibleCharacters", options)` entry sets only the start: after that the button and the command control the display.

| Option    | Meaning                                                   | Default |
| --------- | --------------------------------------------------------- | ------- |
| `visible` | The characters are shown from the start, before any press | `false` |

### Invisible characters state and command

`useRichTextToolState(ref, "invisibleCharacters")` reads the state and `ref.current?.tool("invisibleCharacters")` calls the command. The general rules for both are in the "Handle (`ref`) and a custom toolbar outside the field" section.

| State field | Meaning                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- |
| `visible`   | The characters are shown. Follows the button, the command and the `visible` option at start. |

| Command    | What it does                                                                                                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggle()` | Show the characters if hidden and hide them if shown: the same as the button. The new value is read from the state. `false` in the Source mode. The kit added no `show` and `hide`: `toggle` and `visible` are enough. |

```tsx
import { useRef } from "react";
import { RichTextEditor, useRichTextToolState } from "@olddevs/ui/editor";
import type { RichTextEditorHandle } from "@olddevs/ui/editor";

function ProofreadingToggle({ html }: { html: string }) {
  const ref = useRef<RichTextEditorHandle>(null);
  // `null` before mount and on the server: the screen renders the same in both places.
  const visible = useRichTextToolState(ref, "invisibleCharacters", (state) => state.visible);

  return (
    <>
      <button
        type="button"
        aria-pressed={visible === true}
        onClick={() => ref.current?.tool("invisibleCharacters")?.toggle()}
      >
        Invisible characters
      </button>
      <RichTextEditor ref={ref} aria-label="Article text" defaultValue={html} />
    </>
  );
}
```

## Fullscreen mode

The `fullscreen` Tool (present in `full`, not in `basic`) expands the field to the whole window for long work with text (ADR-0082). It is **a layer of the kit**, not the browser's Fullscreen API: the API has no support for elements on iPhone, the Editor's popovers live in a portal and would not show inside a fullscreen element, and the browser keeps `Esc` for itself. So the layer works the same everywhere, including inside a `Dialog` or a `Drawer`. The Tool has no Block and no markup: the Schema, the sanitizer, Markdown, JSON and `RichTextView` do not change.

```tsx
<RichTextEditor /> // the "Fullscreen" item in "…" is there
<RichTextEditor preset="basic" /> // no fullscreen mode
```

- **The way in.** The "Fullscreen" checkbox item (an expand icon) in the "view" section of the "…" menu, on the fixed Toolbar and in the Bubble menu; from screen code the `open()`, `close()` and `toggle()` commands. There is no shortcut: `F11` and `Ctrl/⌘+Shift+F` belong to the browser and to Find.
- **The look.** The layer is the app's background across the window. The Toolbar is across the top, the Status bar at the bottom, and the Document scrolls itself as a column of about 72 characters in the middle; the Table of contents, if enabled, stays at the left. The Paper stays a sheet on the app's background. `maxHeight` and `resizable` do not apply while the layer is open (the area takes the height of the window, and the height handle is gone) and come back after it. On a phone the layer is `100dvh`, the Toolbar sticks to the top, and the on-screen keyboard is not handled separately, as everywhere in the kit.
- **The way out.** "Collapse" is a visible button at the right edge of the Toolbar (and in the corner of the layer when there is no fixed Toolbar: `toolbar="floating"`, `"bubble"` or `"none"`, `readOnly`), because a touch screen has no `Esc`. `Esc` collapses the field **one level at a time** (ADR-0041, ADR-0077): with the `blockSelection` Tool the first `Esc` in the text selects the Block, the second ends the selection and collapses the field; in a `Dialog` or a `Drawer` the next `Esc` closes the window. An open menu, popover or the Slash menu of the Editor keeps its own `Esc`. Without `blockSelection` the first `Esc` collapses the field.
- **Nothing is lost.** It is the same engine, the same edit history, caret and selection: the field's DOM moves into the layer and back, and the caret scrolls into view. On the way out the page returns to where it was scrolled, and focus goes to the Document. `onFocus` and `onBlur` do not fire: the layer is a part of the field. `value`, `onChange`, `getHTML()` and the other exports do not see the mode.
- **Layers.** The layer joins the stack of ADR-0041 at the step above a `Dialog` (`alert`) and below popovers (`popover`), so the Editor's menus, popovers and tooltips lie on top of it, and the Insert table dialog opened from it too. It locks the page scroll (`useScrollLock`) while it is open. It enters and leaves with the kit's existing `fadein` and `fadeout`; with `prefers-reduced-motion` the movement goes and the fade stays (ADR-0043).
- **Focus stays in the layer.** `Tab` from the last control goes to the first, and `Shift+Tab` from the first to the last, so the keyboard never walks into the page behind. The page, and the `Dialog` or `Drawer` around the field, are `aria-hidden` and `inert` while the layer is open and come back as they were. Live regions (a toast, a status line) are left alone.
- **Announcement.** The change of the mode is announced through the Field notice (`status`): "Fullscreen mode on" and "Fullscreen mode off".
- **Where it does not open.** In the Source mode (the Document is not on screen) and in a `disabled` field `open()` returns `false`. A `readOnly` field opens: reading a long text is the point.
- **Weight.** The layer uses the non-modal Radix dialog the kit already depends on (the focus scope that pauses the focus trap of a `Dialog` around the field, and the layer order of `Esc`); it adds no package.

The message catalog strings are `editor.fullscreen` (the item and the layer's name), `fullscreenExit` ("Collapse"), `fullscreenOpened` and `fullscreenClosed`; the icons are `ExpandIcon` and `CollapseIcon`.

### Fullscreen mode state and commands

`useRichTextToolState(ref, "fullscreen")` reads the state and `ref.current?.tool("fullscreen")` calls the commands. The general rules for both are in the "Handle (`ref`) and a custom toolbar outside the field" section. There are no options.

| State field | Meaning                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| `open`      | The field fills the window. It turns `false` when collapsing starts, not when the fade ends |

| Command    | What it does                                                                                                          |
| ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `open()`   | Expand the field, the same as the item. `false` when it is already open, in a `disabled` field and in the Source mode |
| `close()`  | Collapse it, the same as "Collapse". `false` when it is not open                                                      |
| `toggle()` | Open it if collapsed, collapse it if open. `false` where `open()` is refused                                          |

## Focus mode

The `focus` Tool (present in `full`, not in `basic`) shows everything outside the Block with the caret faint, at 40% opacity, as in iA Writer and Ulysses (ADR-0082). The Tool is two things: decorations over the Document, and a checkbox item. It has no Block, and the Schema, the sanitizer and Markdown do not change. It is a separate Tool from `fullscreen` because the mode is useful in an ordinary field too.

```tsx
<RichTextEditor /> // the item in "…" is there, the mode is off
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, tool("focus", { enabled: true })]} /> // on from the start
```

- **Display only.** The dimming is decorations: `value`, `onChange`, `getHTML()`, `getMarkdown()`, `getJSON()`, the edit history and `RichTextView` do not see it. Turning the mode on and off is not an edit.
- **What is current.** The Block unit of Block selection (ADR-0077): the Block of its container. In a list it is the **item** (a nested item dims the text of the item around it), a table is one Block as a whole, a Block of a column is one Block, not the whole Column layout. A text selection across Blocks keeps all of them as they are. The footnote list is never a Block unit, but the focus mode follows its notes: with the caret in one footnote that note is as it is, and the text Blocks and the other notes are dimmed; with the caret in the text the whole list is dimmed like any other Block.
- **What dims.** Everything outside the Block goes to 40% opacity: text, its list markers, images, videos, code Blocks and block formulas, and a toned Wrapper, a Details Block or a table as a whole, fill and frame included. Opacity, not a color, so a link, an author color, a marker fill and a code Block's highlight keep their own colors, only fainter, on the theme, on the Paper and on the Wrapper tones alike. Nothing goes faint twice: inside a Wrapper or a table that is already faint the text stays as it is. A container with the caret inside keeps its frame, and its other Blocks dim as text. **The contrast of the dimmed text is below 4.5:1 on purpose** (about 3:1 on the dark themes, 2.4:1 on the light theme and the Paper): it is the background around the Block being written, not the text being read, and it comes back in full as soon as the caret reaches it or the focus leaves the Document.
- **When it is off.** There is no dimming without focus in the Document (the Toolbar or the page has it), over a Block selection, and in a `readOnly` field. It comes back with the focus.
- **Off at the start.** The Tool is in `full`, and a kit update must not change how every Editor on that Preset looks, so the mode is off until the author turns it on with the "Focus mode" item of the "…" menu (the fixed Toolbar and the Bubble menu), or the `enabled` option does. There is no shortcut.
- **Scrolling is ordinary.** There is no typewriter mode that keeps the caret line in the middle: it scrolls on every character and looks bad with reduced motion.

The message catalog string is `editor.focusMode`; the icon is `FocusModeIcon`.

### Focus mode options

A `tool("focus", options)` entry sets only the start: after that the item and the command control the mode.

| Option    | Meaning                       | Default |
| --------- | ----------------------------- | ------- |
| `enabled` | The mode is on from the start | `false` |

### Focus mode state and command

`useRichTextToolState(ref, "focus")` reads the state and `ref.current?.tool("focus")` calls the command.

| State field | Meaning                                                                         |
| ----------- | ------------------------------------------------------------------------------- |
| `enabled`   | The mode is on. Follows the item, the command and the `enabled` option at start |

| Command    | What it does                                                                            |
| ---------- | --------------------------------------------------------------------------------------- |
| `toggle()` | Turn the mode on if off and off if on, the same as the item. `false` in the Source mode |

## Table of contents

The `toc` Tool puts the Table of contents of the Document in the Editor's left gutter: the same strip of strokes and the same list as [`RichTextToc`](../content/rich-text-toc.md), but the Editor holds the place itself (ADR-0068). It is in neither Preset, `full` or `basic`: the Table of contents moves the text, and a kit update does not change the layout of screens that did not ask for it. Switch it on by name:

```tsx
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, "toc"]} defaultValue={html} />
```

A `tool("toc", options)` entry also switches the Tool on and configures it at the same time (see "Table of contents options" below).

- **Place.** A column to the left of the Document, inside the field frame. It exists only while there is a strip, from two `h1`–`h4` headings at the top level and in Wrappers: with the second heading the text moves right; without it the text stays at the edge, as without the Tool. The first stroke is level with the first line of the first heading.
- **Sticky positioning.** The strip sticks under the fixed Toolbar (and under the app header: `--topbar-h`, ADR-0016); without a Toolbar, to the edge of the window. In a field with `maxHeight` or `resizable` it sticks to the top of the scrolling area, and the highlight and the jump count from there; the page does not scroll.
- **The list** works as in `RichTextToc`: hover opens it to the right of the strip, Enter and Space open it from the keyboard, arrows move between items, Escape closes it; the current section is highlighted in the strip and in the list; the width is 240px, and a long heading is cut with an ellipsis. A click on an item does not close the list: moving the pointer away does.
- **A jump while editing** puts the caret at the end of the heading, so you can type right away, as in the document outline of Google Docs; the Table of contents does the scrolling, and the heading flashes a fading background. In `readOnly` there is no caret, so focus goes to the heading itself.
- **A live Document.** The list is rebuilt shortly after each edit: a new, renamed or removed heading shows in the strip. In Source mode there is no Table of contents, because the Document is hidden.
- **No Toolbar button.** To show or hide the Table of contents, the screen changes `tools` (and remounts the field with a `key`, as for any set of Tools).

Message catalog string: `editor.toc` ("Table of contents"), the name of the strip and the label of the list.

### Table of contents options

A `tool("toc", options)` entry switches the Tool on and configures it. The standalone [`RichTextToc`](../content/rich-text-toc.md#public-api) takes the same `offsetVar`, `levels` and `listWidth`: the two share one core.

| Option      | Meaning                                                                                                                                                                                                                                                                                                                                                               | Default        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `offsetVar` | The name of the CSS variable that holds the height of the screen's sticky header (ADR-0016), written in full with the two leading dashes: `--header-h`. A jump puts the heading under the header, and the highlight treats a section as current from the header's bottom edge. It does not move the Editor's own sticky Toolbar, which still sits under `--topbar-h`. | `--topbar-h`   |
| `levels`    | The heading levels in the Table of contents: a subset of 1–4. A heading of any other level is in neither the strip nor the list, and item indentation is counted from the largest remaining level. An empty array and invalid values are replaced by the default. With fewer than two headings left, there is no gutter.                                              | `[1, 2, 3, 4]` |
| `listWidth` | The list width: pixels or a CSS length. Fixed rather than sized to the longest heading.                                                                                                                                                                                                                                                                               | `240`          |

```tsx
// The screen's header publishes its height in `--header-h`; the Table of contents needs only H2 and H3.
<RichTextEditor
  tools={[...RICH_TEXT_PRESETS.full, tool("toc", { offsetVar: "--header-h", levels: [2, 3] })]}
  defaultValue={html}
/>
```

### Table of contents state and commands

The state is read with `useRichTextToolState(ref, "toc")`, and the command is called on `ref.current?.tool("toc")`.

| State field | Meaning                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `headings`  | The headings in reading order, the same as in the strip and the list: top level and Wrappers, only the levels from `levels`, no empty ones. Each is `{ level, text, index }`: a level 1–4, the text without markup, and the index of the list item, from 0. The list is returned even with one heading, although there is no gutter then. |
| `current`   | The index of the current section in `headings`, from 0; `-1` means no headings. It follows scrolling. After the Document is edited, `headings` changes at once, while `current` catches up with a delay while the list is rebuilt.                                                                                                        |

The headings are read from the Document, not from the DOM: the list is ready on the first frame without waiting for the lazy Table of contents UI, and it changes together with the edit. The state has no DOM nodes or ProseMirror positions.

There is one command, `jumpTo(index)`: go to a heading of the list, like a click on an item. The index is counted in the same list (with `levels` applied, from 0, empty headings skipped) and is taken from the state snapshot: right after the Document is edited, it leads to the heading that the snapshot names, even though the Table of contents UI rebuilds its list with a delay. While editing, the caret goes to the end of the heading; in `readOnly`, the heading itself gets focus; scrolling puts it under the sticky header (`offsetVar`) and the Toolbar, and the heading's highlight fades. `false` means there is no heading with that index, the Table of contents UI has not loaded yet, or Source mode is on. Fewer than two headings is not a reason to refuse: there is no gutter, but the list exists, and the jump works.

**External navigation.** The screen builds breadcrumbs, a minimap or a list of sections next to the field from the state, instead of parsing the Document's DOM a second time.

```tsx
import type { RefObject } from "react";
import { useRichTextToolState } from "@olddevs/ui/editor";
import type { RichTextEditorHandle } from "@olddevs/ui/editor";

function SectionNav({ target }: { target: RefObject<RichTextEditorHandle | null> }) {
  const toc = useRichTextToolState(target, "toc");
  if (!toc) return null;

  return (
    <nav aria-label="Sections">
      <ul>
        {toc.headings.map((heading) => (
          <li
            key={heading.index}
            aria-current={heading.index === toc.current ? "location" : undefined}
          >
            <button
              type="button"
              onClick={() => target.current?.tool("toc")?.jumpTo(heading.index)}
            >
              {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

## Typography

The `typography` Tool is replacements while typing: a straight `"` becomes a quotation mark, `--` a dash, `...` an ellipsis, `->` an arrow, `(c)` the © sign. The engine is the Typography extension from Tiptap, and the API follows it (ADR-0048); the kit adds quotes by the language of the message catalog and nested guillemets. The Tool is in no Preset, neither `full` nor `basic`: it changes the text being typed, and a kit update must not do that where nobody asked for it. Switch it on by name or with a `tool()` entry:

```tsx
import { RICH_TEXT_PRESETS, RichTextEditor, tool } from "@olddevs/ui/editor";

<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, "typography"]} />;

// A Russian Document under an English interface: the quote set is explicit,
// and sizes like 3x3 must not turn into 3×3.
<RichTextEditor
  tools={[...RICH_TEXT_PRESETS.full, tool("typography", { quotes: "ru", multiplication: false })]}
/>;
```

- **Input rules only.** The Schema, the sanitizer and Markdown do not change: `value` and `getHTML()` get plain Unicode characters with no new tags or attributes, and `RichTextView` shows them like any other text. The Tool has no Toolbar button, no Slash menu item, no state and no commands.
- **It works while typing.** A rule fires on a character the author typed on the keyboard. Pasted text, `value`, `defaultValue`, `setMarkdown()` and `insertText()` are left as they are.
- **It does not fire inside code.** In the `code` Mark and in a code Block, `--`, `"` and `(c)` stay as typed: code does not break.
- **Every replacement is undone in one step.** `Backspace` right after a replacement brings the typed characters back (`--` instead of `—`). `Ctrl/⌘+Z` right after a replacement does the same: the replacement is a separate history step, the first press brings the typed characters back, the second removes them. After the next character, `Backspace` is ordinary.

### Rules

All the Tiptap rules are on. Each has an option of the same name: `false` switches the rule off, a string replaces the character.

| Typed                  | Result  | Option                                                        |
| ---------------------- | ------- | ------------------------------------------------------------- |
| `--`                   | —       | `emDash`                                                      |
| `...`                  | …       | `ellipsis`                                                    |
| `<-`, `->`             | ←, →    | `leftArrow`, `rightArrow`                                     |
| `(c)`, `(tm)`          | ©, ™    | `copyright`, `trademark`                                      |
| `(sm)`, `(r)`          | ℠, ®    | `servicemark`, `registeredTrademark`                          |
| `1/2 `, `1/4 `, `3/4 ` | ½, ¼, ¾ | `oneHalf`, `oneQuarter`, `threeQuarters` (with a space after) |
| `+/-`, `!=`            | ±, ≠    | `plusMinus`, `notEqual`                                       |
| `<<`, `>>`             | «, »    | `laquo`, `raquo`                                              |
| `2x3`, `2*3`           | 2×3     | `multiplication`                                              |
| `^2`, `^3`             | ², ³    | `superscriptTwo`, `superscriptThree`                          |
| `"`                    | a quote | `openDoubleQuote`, `closeDoubleQuote` and the `quotes` set    |
| `'`                    | ‘, ’    | `openSingleQuote`, `closeSingleQuote`                         |

The multiplication rule fires on any `2x3` and `2*3`, so "a 3x3 grid" becomes "a 3×3 grid": if the Document is full of sizes, set `multiplication: false`. An empty string and an invalid value are replaced by the default, with one `console.error` per Tool in development. Options are read once, when the engine is created.

### Quotes by the catalog language

The `quotes` option picks the set for `"`: `"auto"` (default), `"ru"` or `"en"`. `"auto"` takes the set from the message catalog, from the `editor.typographyQuotes` string: `"ru"` in `@olddevs/ui/locales/ru`, `"en"` in the English fallback and in any catalog without that string. The set is read when the quote is typed, so a catalog change on a mounted field is picked up without a remount. An explicit set is for a Document whose language differs from the interface.

| Set  | `"` at the start of a Block, after a space or a bracket | `"` after a word   |
| ---- | ------------------------------------------------------- | ------------------ |
| `en` | “                                                       | ”                  |
| `ru` | « (inside «…» — „)                                      | » (inside „…“ — “) |

In the Russian set quotes nest by what is open in the current Block before the caret: typing `"He said "hi""` gives «He said „hi“». An opening quote inside «…» gives „, a closing quote inside „…“ gives “, and a closing quote inside «…» with nothing nested closes the guillemet. A closing quote with nothing open is just ». Russian typography has no third level: an opening quote inside „…“ gives « again. Open quotes are counted within one Block.

A single `'` does not depend on the set and follows the Tiptap rules in both: after a space or at the start of a Block it is ‘, otherwise ’ (which is also the apostrophe: `it's` → it’s).

An explicit `openDoubleQuote` or `closeDoubleQuote` string beats the `quotes` set and switches nesting off: the quotes go as a pair, the opening one after a space, the start of a Block or a bracket and the closing one everywhere else, and the one of the pair that is not given comes from the set. `false` switches the rule off; with both off, `"` stays straight.

The message catalog string is `editor.typographyQuotes`: not text for the screen but the language of the quote set, `"ru"` or `"en"`. The decision is ADR-0048 ("for the future": there was no requesting customer at release).

## Video by link

The `youtube` and `twitch` Tools put video in the Document: a link to a video, recording or clip that the reader watches in a player on the page. It is one shared Block, `video`, and the `tools` set decides which services are allowed: only `youtube`, only `twitch` or both. The kit does not use the Youtube and Twitch extensions from Tiptap: link recognition and the player URL are the kit's own code modelled on them, so there is nothing to install, and the API follows them (ADR-0048: there was no requesting screen at release). The decision is ADR-0071. The Tools are in no Preset, neither `full` nor `basic`: the player pulls in a third-party service (CSP, privacy), and a kit update must not do that where nobody asked for it.

```tsx
import { RICH_TEXT_PRESETS, RichTextEditor } from "@olddevs/ui/editor";

// Both services; YouTube only is "youtube", Twitch only is "twitch".
<RichTextEditor tools={[...RICH_TEXT_PRESETS.full, "youtube", "twitch"]} />;
```

- **The Document holds a link, not a player.** The Block stores the service, the link to the video in canonical form and an ordinary link inside. The link is what a reader without JavaScript, Markdown and any other view sees. The Document holds neither the player URL nor the page domain: a Document saved in an admin screen works on a public site with another domain, and the player parameters change without rewriting Documents.
- **The kit draws the player at display time, and by default it stands at once.** In the Editor it is a node view, in `RichTextView` an Island of the kit that is mounted only if the HTML has a video block. In place of the video there is the service's `iframe` with `loading="lazy"`, in the same 16:9 frame that the Skeleton and the server HTML reserve, so the height of the Block does not jump. An empty placeholder in place of a video would read as broken. There is no autoplay: the player is on the page but does not play. If the player URL cannot be built, the link to the video stays in its place.
- **The player URL is built at display time.** YouTube is always `https://www.youtube-nocookie.com/embed/<id>` (a playlist is `/embed/videoseries?list=<id>`, a start time is `?start=`). Twitch is `https://player.twitch.tv/?video=<id>&parent=<page domain>&autoplay=false` (a channel is `channel=`, a clip is `https://clips.twitch.tv/embed?clip=<name>&parent=…`); `parent` is the `location.hostname` of the current page. The `iframe` gets a `title` ("YouTube video", "Twitch video"), `loading="lazy"`, an `allow` with `fullscreen`, `autoplay` and `picture-in-picture`, and `referrerpolicy="strict-origin-when-cross-origin"` (YouTube does not start the player without a referrer). `nocookie` cannot be turned off and `parent` cannot be configured.
- **The `autoload` option.** `tool("youtube", { autoload: false })` and `tool("twitch", { autoload: false })` bring back the earlier behavior, a placeholder with the service name, the link and a **"Play"** button: **not a single request goes to the service until the reader presses it** (in the Editor too, so that editing does not pull in the player). The button is named "Play YouTube video" (the visible label is contained in the name in full); after the click the `iframe` starts playing at once (`autoplay=1` for YouTube, `autoplay=true` for Twitch) and focus moves into the player. The default is `true`. The options type is `VideoToolOptions`, one for both Tools. A Tool's option applies only to the blocks of its own service: `youtube` with `autoload: false` and `twitch` with no entry give a placeholder for YouTube videos and an immediate player for Twitch. The option does not change the Document: it still holds only a link, `iframe` never enters the Document, and the sanitizer does not change. `RichTextView` reads the same option from its `tools`. A wrong value (from JS without types) is replaced with the default, with a single `console.error` in development.
- **Privacy.** Unless `autoload` is turned off, the reader's browser contacts YouTube and Twitch when the page opens: once the frame scrolls near the screen (`loading="lazy"`), not on a click. YouTube goes through `youtube-nocookie.com`, but the request is made all the same. For screens where this matters (consent for third-party services, internal systems with a data policy), set `autoload: false`: then nothing goes to the service until the reader presses "Play".
- **One "Video" item inserts it.** In the Slash menu ("+", `/video`, `/youtube`, `/twitch`) and in "Add ›" of the Block handle: a popover with a link field, and the service is detected from the URL among the enabled Tools. A link of another service and a link of a service that is not in `tools` are the same error in the field ("Enter a link to a YouTube / Twitch video", naming only the enabled services). The Block lands in place of an empty paragraph or after the current Block, and there is always a paragraph with the caret below it; the insertion is one undo step.
- **A bare link in an empty paragraph.** A video link pasted from the clipboard into an empty paragraph becomes a Block at once; one typed alone in a paragraph (as text or as a link) does on `Enter`. A link among words, in a non-empty paragraph, and a link of a disabled service stay plain text or a link.
- **The Block is an Atom.** Arrow keys (from a neighboring paragraph) and a click on the frame select it, and the Block handle moves, duplicates and deletes it, like an image; `Backspace` and `Delete` on the selected Block remove it together with the player. A click and keys inside the `iframe` belong to the player, not the Editor: the field hands it focus, and the Block cannot be selected by clicking the player itself. Keyboard focus leaves the player the usual way, as from any `iframe`: `Tab` and `Shift+Tab`. Its Atom text is the link (it goes into the `maxLength` counter, `getText` and copying). The Block stands wherever an image Block does: at the top level, in a Column layout column, in a Wrapper, in a quote and in the content of a Details Block.
- **A lazy Tool.** The node, the node view with the player and the link field live in a separate chunk (ADR-0058, item 11.1) and load only if `tools` has `youtube` or `twitch`; until Readiness the Skeleton shows the Block as its link.

### Which links are read

The canonical form is what goes into the Document, whatever form the author pasted. `http` and a link without a scheme are accepted on input, but in the Document the URL is always `https`.

| Service | Read                                                                                                           | In the Document                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| YouTube | `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`; `m.` and `music.`; a time `t=`, `start=` | `https://www.youtube.com/watch?v=<id>` (a time is `&t=<seconds>`) |
| YouTube | `youtube.com/playlist?list=`, `/embed/videoseries?list=`                                                       | `https://www.youtube.com/playlist?list=<id>`                      |
| Twitch  | `twitch.tv/videos/<number>`, a time `?t=1h2m3s`                                                                | `https://www.twitch.tv/videos/<number>`                           |
| Twitch  | `clips.twitch.tv/<name>`, `twitch.tv/<channel>/clip/<name>`                                                    | `https://clips.twitch.tv/<name>`                                  |
| Twitch  | `twitch.tv/<channel>` — the channel's live stream                                                              | `https://www.twitch.tv/<channel>`                                 |

Another host, `youtube.com.evil.example`, a login or a port in the URL, and service sections of Twitch (`/directory`, `/videos` without a number…) give no video.

**The HTML of the Tiptap extensions** (`div[data-youtube-video] iframe`, `div[data-twitch-video] iframe`, a lone `iframe` with a player URL) turns into the same Block when pasted into the Editor and in `value`: the player URL (`youtube-nocookie.com/embed/…`, `player.twitch.tv/?video=…`, `clips.twitch.tv/embed?clip=…`) is translated back into the link to the video, and the player parameters and `parent` are dropped. An `iframe` never gets into the Document.

### Markup and sanitizing

```html
<div
  data-block="video"
  data-provider="youtube"
  data-src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
>
  <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer"
    >https://www.youtube.com/watch?v=dQw4w9WgXcQ</a
  >
</div>
```

**The sanitizer is not loosened: `iframe` is always stripped**, also with `youtube` or `twitch` in `tools` (ADR-0058, items 2.3 and 12.6 stay as they are). The new rules are ordinary ones: `div[data-block="video"]`, `data-provider` is `youtube` or `twitch`, `data-src` is the canonical `https` link to a video of that service (`https://www.youtube.com/watch?v=<id>` with an optional `&t=`, `https://www.youtube.com/playlist?list=<id>`, `https://www.twitch.tv/videos/<number>`, `https://www.twitch.tv/<channel>`, `https://clips.twitch.tv/<name>`), that is, exactly what the Editor writes; the link inside follows the kit's link policy. A readable but non-canonical form (`youtu.be`, a host without `www`), a player URL such as `youtube-nocookie.com` and a foreign host do not pass: a Block with them loses its wrapper, and the link stays. So does a Block without a valid service and a video Block inside a video Block. Names of kit Tools do not narrow the allowlist: the Block passes sanitizing with any `tools`, and the decision "show a player or not" is made by the Editor or `RichTextView`. The bare `richTextSanitizeConfig()` does not let `data-src` through; only `sanitizeRichText` does, after checking the URL.

**Without the Tool a Block becomes its link instead of vanishing.** A video Block from `value`, `defaultValue`, a JSON envelope and a paste, when its service is off (neither `youtube` nor `twitch` in `tools`, or only the other one is on), unfolds into a paragraph with the link: with the `link` Mark, or the URL as text if there is none. The same `value` with the right Tool shows a player.

### Video in Markdown

Video in Markdown is a link: `getMarkdown()` writes the canonical URL on a line of its own between blank lines.

```md
Watch the recording:

https://www.youtube.com/watch?v=dQw4w9WgXcQ

The rest follows.
```

`setMarkdown()` reads such a line (a bare URL or a URL in `<…>`) back as a Block if the service is on: the round trip through the Handle loses nothing, and the URL comes back in canonical form. Markdown counts everything else as no player and leaves a link: a URL among words, `[text](address)`, a URL in a list item or a quote, a URL of a disabled service. Markdown creates a player only at the top level of the Document.

### The View and CSP

`RichTextView` does not sanitize HTML (see "Schema and security") and, with no engine, shows the Block as its link, the server HTML. The Island is mounted only if the HTML has `data-block="video"`: it finds the blocks whose service and URL pass `isVideoSrc` and puts the player in their place; the others stay a link. Without JavaScript a reader sees the link. The Island is a separate chunk, so a page without video does not pay for it. Pass `tools` for video only if the Editor has `autoload: false`: `tool("youtube", { autoload: false })` in the View's `tools` brings back the "Play" placeholder there; with no entry the player stands at once, as in the Editor by default.

The page that shows the player has to allow it an `iframe`: add this line to the Content-Security-Policy (only the hosts of the services you need)

```
frame-src https://www.youtube-nocookie.com https://player.twitch.tv https://clips.twitch.tv;
```

Without it the browser blocks the `iframe` (at once, or after the click with `autoload: false`): the frame stays empty, and the Document and the link do not suffer. The `frame-src` permission is needed whatever the value of `autoload`.

The strings are `editor.video` ("Video"), `editor.videoLink`, `editor.videoInsert`, `editor.videoNotFound`, `editor.videoPlay` ("Play"), `editor.videoPlayLabel` and `editor.videoPlayer` in the message catalog (English and Russian); the service names are brand names and are not translated. The icons are `VideoIcon` for the Insert item and `PlayIcon` for the placeholder's button.

## Paste from Office

Word, Excel, Google Docs, Google Sheets and SharePoint do not put plain HTML on the clipboard. A Word list arrives as paragraphs with "1." typed into the text, a highlight as a `background` style, the bold header of an Excel table as a class rule in a `<style>` block. The Schema keeps only what it knows, so without help a list from Word becomes paragraphs with frozen numbers, and a marker disappears. The `pasteCleanup` Tool (in `full` and `basic`) turns this HTML into markup the Schema reads, **before** the Schema reads it: it can only change what the Schema then sees, never widen it.

```tsx
// In both Presets already; an exact list keeps it by name.
<RichTextEditor
  tools={["history", "bold", "bulletList", "orderedList", "highlight", "pasteCleanup"]}
/>
```

- **Picture side and width.** A picture that names a side comes in aligned, from Word or from a web page: `align="left|right"` on the `img` or the `figure`, `float: left|right` in the `style`, and Word's `mso-wrap-style: none` (in line with the text) gives no side. This step has a sign of its own, not an application: a picture with `float`, `align` or `mso-wrap-style` in its tag. The width in the source goes to the nearest preset that leaves room for text when it is a percentage (`width: 40%` gives 33%, `100%` gives 75%), and a size in pixels, points or ems gives 50%, because the width of the target Document is unknown. A picture with no side comes in at its own size, as before. The result is the Image alignment of the `image` Tool, so without the Tool the picture is dropped, as any picture is.
- **Only office sources.** Except for the picture side, the cleanup runs when the clipboard HTML carries the marks of its application: the Office namespaces and `Mso*` classes of Word, the `Excel.Sheet` ProgId, the `docs-internal-guid-…` wrapper of Google Docs, the `data-sheets-*` attributes of Google Sheets, the `data-ccp-props` and `OutlineElement` markup of SharePoint and Word Online. A copy from a web page, an IDE or another editor comes in exactly as before: a code-highlighting background from a docs site does not become a marker.
- **Word lists** become `ul` and `ol` again, with their nesting and with `start` when a numbered list does not begin at 1. The markers Word types into the text ("1.", "a.", "•") are removed. The Schema keeps no numbering kind, so a nested list shows letters and Roman numerals by the kit's list styles, not by the source. Lists from a Word that writes no `mso-list` (Word 2007 on Windows through Firefox) are recognized by the list paragraph class and the marker.
- **Office junk** is removed: Word bookmarks and every link inside the copied document (a table of contents copied from Word keeps its text; the Schema accepts no relative address anyway), `<o:p>`, Office-only conditional comments, a `<br>` between two Blocks. Safari's `Apple-converted-space` spans become plain spaces. External links and empty paragraphs the author made stay.
- **Horizontal lines.** A top or bottom paragraph border (Word, and Google Docs for a document that came from Word) becomes a divider (`hr`) when the `horizontalRule` Tool is on: an empty bordered paragraph is replaced by it, a paragraph with text keeps the text and gets the divider on the bordered side. Left and right borders (a box or a bar) and table borders are not lines. A line inserted in Google Docs ("Insert → Horizontal line") becomes one divider too, without the empty paragraphs Docs wraps it in. A row of `---` or `___` typed as text stays text.
- **SharePoint and Word Online.** A paragraph with `role="heading"` and `aria-level` becomes a heading of that level (the heading Tools then decide which levels stay, as for any pasted heading: H5 and H6 become paragraphs); flat lists, where every item is a separate list with its level in an attribute, are rebuilt into nested lists, also across the chunks Word for the web splits a long copy into; end-of-paragraph markers and the empty boundaries a table of contents leaves behind are removed. Word for the web does not put paragraph borders on the clipboard, so a bordered paragraph gives no divider there.
- **Excel cells.** From the class rules of a cell only the meaning is taken: bold, italic, underline, strikethrough, horizontal alignment and the fill. Fonts, sizes, borders, number formats and text colors are not carried over. Safari drops the class rules of an Excel copy but writes their values into each cell, and the result is the same.
- **Table column widths** (OLDSUI-310). The widths a table from Word, Excel, Google Docs or Google Sheets carries become the column widths of the table, as shares of its width rounded to steps of 5% (see "Tables", "Column widths"): Excel and Sheets write a `col` per column (points and pixels, the exact points win), Docs writes `col width`, and Word writes `width` on the cells, which are read from a row without merged cells. A hidden column (`width: 0`), a column with no width, a single column and a table of more than 20 columns are left to the content, as before the step. The pixels, points and `style` themselves are not kept.
- **Background → marker.** A background on text, on a table cell or on a paragraph becomes the `highlight` Mark with the palette marker of the **nearest hue**. A low-saturation background gives `gray`; white, black and transparent backgrounds are dropped. A text color is **not** mapped to the palette (see the "Color, highlight and alignment" section).
- **Without the target Tool** the result of a step is cut by the Schema, as before: with `highlight` off the text comes without a marker, with `horizontalRule` off there is no divider, without `heading1` an H1 becomes a paragraph.
- **If a step fails**, the paste goes in without cleanup, exactly as the Editor pasted before the Tool existed, and a development build writes a warning to the console. The author does not see a message. The steps load in their own chunk as soon as the Editor mounts, so they do not weigh on the start of the field; a paste in the first moments after mount, before the chunk has arrived, also goes in without cleanup.
- **What is not done.** Zero-margin paragraphs of Google Docs are not merged into line breaks (they are the author's paragraphs), the formatting of the first pasted paragraph is not carried onto an empty paragraph, and Word equations come in as Word renders them. Images in a paste follow the "Images" section.

**What was checked.** The behavior is tested on real clipboard captures: Word for Mac, Word for the web, Excel for Mac, Google Docs and Google Sheets copied into Chrome, Safari and Firefox; Word and Excel (Microsoft 365) on Windows copied into Chrome and Firefox; Word 2007 on Windows through Firefox; Google Docs through Chromium. Cases the captures do not hold (a SharePoint list that starts at another number, heading levels 5 and 6) are covered by synthetic HTML in the same shape. Edge and Opera are Chromium, like Chrome, and were not captured separately. Report a paste that comes out wrong, with the clipboard HTML.

Without `pasteCleanup` in `tools` (an exact list without it) the Editor pastes office HTML the way it did before: through the Schema alone.

## Status bar and Field notice

Under the field inside the frame there are two independent areas. The **Status bar** is what the screen puts there itself: "Saved", a word count, a co-author. The **Field notice** is what the kit and Tools report: an upload result, a paste rejection. The first is a React node in the `status` prop, the second is data and an engine command.

### Status bar: `status`

```tsx
<RichTextEditor
  value={html}
  onChange={setHtml}
  maxLength={2000}
  status={
    <span className="flex gap-3">
      <span role="status">{saved ? "Saved" : ""}</span>
      <span>{countWords(html)} words</span>
    </span>
  }
/>
```

- The line sits inside the field's frame, in the `maxLength` counter row: **its own content at the start, the kit's counter at the end**. Without `maxLength`, or while there is no counter (it appears at 80 % of the limit), the line is sized by its own content alone. An empty `status` (`null`, `undefined`, `false`, `""`) renders no line.
- **The container has no `role` and no `aria-live`: the kit does not announce the line.** A word count changes on every edit, and reading it aloud would mean talking over typing. If you need "Saved" to be announced, wrap only that in `role="status"` (the example above; with autosave on `onBlur`, see [the recipe on the extension API page](../../api/editor-extension.md#saved-in-the-status-bar)). Do not wrap the whole line in `role="status"`.
- It is visible in `readOnly` and in `disabled` alike: it is part of the field's frame, not of editing. With `disabled` the frame is muted as a whole, like other fields, together with the line.
- The counter keeps its `id` and stays in the field's `aria-describedby` while visible; the screen's content is not part of the field's description.
- Take the data from your own state: the word count from `value`/`onChange`, "Saved" from the server's response. Tools have no access to the Status bar: it has no owning Tool.
- The default color is the second text step; the size is 11 px, with monospace digits. Set your own color on your own node: the third text step does not reach a 4.5:1 contrast ratio on the field's background.
- `RichTextView` has no Status bar: it shows sanitized HTML without an engine.

### Field notice: `showNotice`

One area under the field and only the latest message: **a new one replaces the previous one**, and `showNotice(null)` clears it. A notice is data, not a React node: a tone and the finished text.

```tsx
type FieldNotice = { tone: "status" | "error"; text: string };

// From the screen, through `ref.editor`:
ref.current?.editor?.commands.showNotice({ tone: "error", text: "Couldn't insert the card." });
ref.current?.editor?.commands.showNotice(null);
```

- **`status`** is invisible and only announced: the text goes to a `role="status"` live region outside the Document. Visually, the upload progress is shown by a placeholder in the Document, and live regions inside `contenteditable` are not read everywhere. It stays until it is replaced or cleared; a User edit does not touch it.
- **`error`** is visible as a `role="alert"` line under the field, above the Status bar, **until the next User edit**, a new notice or `showNotice(null)`. An edit is any change to the Document; a programmatic `value` replacement and `clear()` do not count as an edit; `setMarkdown()` and `setJSON()` clear the error. Show an error when the Document did not change as a result: without the line it would look like "nothing happened".
- The notice has no durations, close buttons or spinners of its own: it goes away on its own only after an edit; otherwise it is cleared by a command.
- **The command does not change the Document**: no transaction, no history step, no `onChange`. `editor.can().showNotice(…)` does not show a notice.
- A notice without text (`text: ""`) is the same as `null`. The kit does not translate the text: it is shown as is, without markup. The kit's own messages (files) go through the `editor.*` message catalog, and the strings of custom Tools come from their own message catalog.
- **Who calls it.** The screen — `ref.current.editor.commands.showNotice(…)`. A custom Tool — from its Extensions: `this.editor.commands.showNotice(…)` in a Tiptap extension. Every Editor has the command regardless of `tools`, including without `image`. The `FieldNotice` type is exported from `@olddevs/ui/editor`; it also provides the types for `editor.commands.showNotice`.
- Image messages go through the same channel: "Uploading photo.png…" and "photo.png uploaded" are `status`; an upload failure, "not an image" and "files can't be uploaded" are `error`. An `error` from a Tool and a file message share one area: a new one replaces the previous one.

## Field height: `maxHeight` and `resizable`

By default the Editor grows with the Document, and a long text stretches the page. `maxHeight` limits the **Document area**: up to the limit the field grows as usual, beyond it the Document scrolls inside the frame. `resizable` adds a height handle at the area's bottom edge. The decision is ADR-0059.

```tsx
<RichTextEditor aria-label="Description" maxHeight={320} value={html} onChange={setHtml} />
<RichTextEditor aria-label="Note" maxHeight="24rem" resizable defaultValue={draft} />
```

- **Units.** A number is pixels, a string is any CSS length (`"24rem"`, `"60vh"`). There is no row-count option like `maxRows` in `TextControl`: Blocks have different heights.
- **What scrolls.** Only the Document area: the Document, its Skeleton, the Source mode field and the Block handle. The fixed Toolbar above it and the Status bar with the Field notice under it stay in place, the frame does not move. The scrollbar sits at the frame.
- **`resizable` with `maxHeight`** — `maxHeight` becomes the **starting height**, not a limit: the field stretches both taller and shorter. Two systems that control height at the same time produce a field that jumps on every edit. The same reasoning applies to `autosize` in `TextControl`. Without `maxHeight` the start is the Document's height. The area does not shrink below 128 px (a few lines).
- **The height handle is the kit's own, not the browser's corner.** The browser renders the native `resize: vertical` as its own corner, which ignores the theme: in a dark one it is a white square on the frame. The kit's handle is a strip at the area's bottom edge with a grip in the middle, styled like the `SplitPanel` strip: the grip is `--line`, on hover `--fg-2`, while dragging and on focus the accent. The visible strip is 10 px, the hit zone 26 px (WCAG 2.5.8). For keyboard users there is a slider "Resize the editor" (`editor.resizeField`, the value is `editor.fieldHeight`): the Up and Down arrow keys move it by 16 px, with Shift by a pixel; dragging with the mouse moves focus to it, so you can fine-tune the height with the arrow keys. A double click on the strip returns the starting height. A height set by dragging persists until the field unmounts: saving it between visits is the screen's job.
- **The Block handle and overlays travel with the text.** The "⋮" handle sits inside the area and scrolls together with the Block; beyond the area's edge it is clipped and does not overlap the Toolbar. The floating Toolbar, the Bubble menu and the image panel listen to the area's scroll, not the page's; at the area's edge they flip below the selection. The Text card and the "/" Slash menu follow the range and the caret the same way: their anchor is tied to the Document (`contextElement`).
- **Without the props nothing changes:** the area is a plain element without styles, the field grows with the Document, and the Toolbar sticks to the top of the browser window.
- **In fullscreen mode neither prop applies.** The area takes the height of the window and scrolls itself, there is no height handle, and both come back when the field is collapsed (see "Fullscreen mode").

## Paper: `surface`

`surface="theme"` (the default) renders the Document in the app's theme, as in Notion, Confluence and Slack. `surface="paper"` renders **a light Paper in any theme** (`dark`, `dim`, brand), like "Switch Modes" in Word: the text, links, text color and highlight, tables, image captions, the task list, the code block (GitHub Light) and the author's color look as in the light theme.

```tsx
<RichTextEditor surface="paper" aria-label="Email body" value={html} onChange={setHtml} />
```

**When to use the Paper.** A Document that will leave the app with a light look: a print or PDF preparation screen, an email editor, a document template. The author sees the text as it will be read, and the author's color does not lose contrast when the theme changes. For notes, comments and task descriptions the Paper is not needed: the Document lives in the app and follows its theme.

**What stays in the app theme.** The Paper is only the editable area. The Toolbar (fixed and floating), the Slash menu, the link, image and color popovers, the table menu, dialogs, the labels and counter under the field, the field's frame and the focus ring around it are in the app theme: this is the interface, not the Document. The Paper's edge is the app theme's `--line` frame and `--shadow-1` shadow, so the Paper stands apart on both a dark and a light background.

**How it is built.** The Paper carries a nested `data-theme="light"` — through it the highlights (`--marker-*`) and the syntax highlighting theme take light values. The kit tokens (`--fg-0`, surfaces, `--accent-strong`) are declared only on `:root[data-theme]` and do not understand a nested theme, so the Document reads not them but the `--rte-*` roles (`src/editor/styles/tokens.ts`): in a theme they map to kit tokens, on the Paper to the same `--od-*` primitives that the light theme assigns. A test checks the match with the light theme by parsing `styles.css`.

- **The accent on the Paper is the app theme's fill** (`--accent`), not the light `accent-strong`: for a brand and the violet accent the light step exists only in a light app. The fill is designed for white text on top of it, so used as text on the white Paper it meets 4.5:1 with any brand. In a light app the link, the `accent` color and focus on the Paper use exactly the light `accent-strong`.
- **Focus inside the Paper** (the code block language button, task list checkboxes) is an outline of the same accent: the dark theme's light `accent-strong` does not reach 3:1 contrast on white.
- **The code block header on the Paper** is light: the background and text come from the syntax highlighting theme selected by the nested `data-theme`, and the border and line are the Paper's roles. The language button, the language label and "Copy" use the `--rte-secondary` role, hover is `--rte-control-hover`, not the tokens of a `ghost` button: those would have stayed with dark theme values, and a light icon would end up on a white header.
- **The Callout tone on the Paper** has its own `--rte-tone-*` roles with light theme values (see the "Wrapper" section, "Tone"): the app theme's status `*-soft` and `*-strong` would be dark on a white Paper.
- **Contrast** is checked by `npm run contrast`: every Paper pair against the Paper itself, in each theme × accent × brand.
- `RichTextView` with the same `surface` shows the Document on the same Paper.

## Handle (`ref`) and your own toolbar outside the field

The screen drives the field through `ref` (`RichTextEditorHandle`) and builds its own toolbar with the `useRichTextEditorState` hook. Both come from `@olddevs/ui/editor`:

```tsx
import { RichTextEditor, useRichTextEditorState } from "@olddevs/ui/editor";
import type { RichTextEditorHandle } from "@olddevs/ui/editor";
```

### `ref` methods

| Method                                                     | What it does                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertHTML(html): boolean`                                | Inserts HTML at the caret in place of the selection. To insert a Block, pass its HTML to this method.                                                                                                                                                                             |
| `insertText(text): boolean`                                | Inserts text literally, without HTML parsing; a line break is a hard break (in a code block, a newline character).                                                                                                                                                                |
| `getText()`                                                | The Document's text without markup; Blocks are separated by an empty line, an Atom is its Atom text.                                                                                                                                                                              |
| `getSelectedText()`                                        | The selected text; for a caret, `""`. An Atom is included only as a whole.                                                                                                                                                                                                        |
| `isEmpty(): boolean`                                       | Emptiness by the kit's rule — the same one that decides `required` and what is written to the form as `""`: any Atom (`hr`, an image, a custom one), a hard break and a table (even with empty cells) are content; a Block without text (paragraph, heading, list, quote) is not. |
| `focus(position?)`                                         | `"end"` (the default), `"start"` or `"restore"`: return focus to where the selection was, for example after your own dialog or menu.                                                                                                                                              |
| `blur()`                                                   | Remove focus from the Document.                                                                                                                                                                                                                                                   |
| `undo()`, `redo()`                                         | Undo and redo an edit; they work with the `history` Tool enabled.                                                                                                                                                                                                                 |
| `tool(name)`                                               | The commands of a Tool: `tool("search")?.open()`, `tool("toc")?.jumpTo(2)`. `null` means the Tool is not in the set, has no commands, or the engine has not been created yet. See "Tool commands: `handle.tool()`".                                                               |
| `openSearch({ replace? })`                                 | **Deprecated**, removed in 5.0: the same as `tool("search")?.open({ replace })`; warns once in development.                                                                                                                                                                       |
| `canUndo()`, `canRedo()`                                   | Whether `undo` and `redo` are available: `false` without `history`.                                                                                                                                                                                                               |
| `getHTML()`, `getMarkdown()`, `setMarkdown(md)`, `clear()` | See "Public API" and "Markdown".                                                                                                                                                                                                                                                  |
| `getJSON()`, `setJSON(document): boolean`                  | The Document as a lossless JSON envelope, and replacing the Document with an envelope; `false` means the envelope was rejected. See "JSON".                                                                                                                                       |
| `editor`                                                   | The underlying Tiptap `Editor` for commands of Marks, Blocks and custom Tools; its API **follows Tiptap's major version**, not the kit's contract.                                                                                                                                |

**Insertion.** `insertHTML` and `insertText` return `true` if the Document changed and `false` if not: there is no engine yet, the field is read-only or disabled, the insertion would go past `maxLength`, or the Schema dropped everything inserted. The HTML goes through the Schema like an incoming `value`: a Block of a disabled Tool is dropped (the text inside it stays as an ordinary paragraph), and if nothing is left, nothing is inserted. **An insertion that goes past `maxLength` is not performed at all** and returns `false`: a template cut off in the middle is worse than a refusal; what to tell the user is up to the screen. The caret is placed after the inserted content; the method does not take focus itself — if the insertion comes from a button or a dialog, start with `focus("restore")`. In a field that has never been focused, the caret is at the start of the Document.

**User edit and Programmatic replacement.** Insertion, `undo` and `redo` count as User edits: a separate history step (undo removes the insertion alone, not together with the typing before it), `onChange` fires after `changeDelay`, and the `maxLength` limit applies. `clear()`, `setMarkdown()`, `setJSON()` and a new `value` count as Programmatic replacements, and the limit does not truncate them; `onChange` fires immediately for `clear()`, `setMarkdown()` and `setJSON()`, but is not called for a new `value`. In `readOnly` and in a disabled field, insertion returns `false`, and `undo` and `redo` do nothing.

**Calling a method before Readiness is safe** — on the server, before mount and while Tool Loaders are running (see the "Custom Tool" section). The engine is created in the browser after the first render and the Loaders, so a call at this moment neither throws nor queues.

- Reads return a known value: `getHTML()` the incoming `value`, `getText()` and `getSelectedText()` `""`, `getJSON()` `null`, and `isEmpty()` evaluates the incoming value by the same rule as after mount (a custom Block before mount is always content: only its Extensions can tell whether it is an Atom).
- Writes and focus do nothing.
- Insertion and `setJSON()` return `false`, and `canUndo()` and `canRedo()` return `false` as well.

On the server `ref.current` is empty until the Editor mounts, so write `ref.current?.…`.

**Source mode.** `getText()` applies the HTML field's edit, like `getHTML()`; insertion applies it, inserts into the Document and overwrites the field; `focus` and `blur` act on the HTML field; `undo` and `redo` do nothing (a `textarea` has its own undo); `getSelectedText()` returns `""`.

### Your own toolbar: `useRichTextEditorState`

`useRichTextEditorState(ref, selector)` is a selector hook on top of Tiptap's `useEditorState`. The `selector` receives `editor` and returns a slice of state; the component re-renders **only when the slice changes** (compared by value, so you can return an object), and typing that does not change the slice does not touch the toolbar. While there is no engine — before mount and on the server — the hook returns `null` and the selector is not called; when the engine appears, the screen re-renders by itself.

The toolbar's commands go through `ref.current.editor.chain().focus()…run()` — the same command syntax as the commands of Tools. The kit has no command registry of its own.

```tsx
import { useRef } from "react";
import { RichTextEditor, useRichTextEditorState } from "@olddevs/ui/editor";
import type { RichTextEditorHandle } from "@olddevs/ui/editor";

function Screen() {
  const ref = useRef<RichTextEditorHandle>(null);
  const state = useRichTextEditorState(ref, (editor) => ({
    bold: editor.isActive("bold"),
    // Without the `history` Tool the engine has no `undo` command.
    canUndo: editor.can().undo?.() === true,
  }));

  return (
    <>
      <button
        type="button"
        aria-pressed={state?.bold ?? false}
        // A click on the toolbar must not take focus out of the Document.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => ref.current?.editor?.chain().focus().toggleBold().run()}
      >
        Bold
      </button>
      <button
        type="button"
        disabled={!state?.canUndo}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => ref.current?.undo()}
      >
        Undo
      </button>
      <RichTextEditor ref={ref} aria-label="Text" />
    </>
  );
}
```

**Recipe: the buttons of an external toolbar call `preventDefault` on `mousedown`.** A click on a button moves focus to it, the field loses focus, and a command without `.focus()` in the chain would go astray. `preventDefault` on `mousedown` keeps focus in the Document, so the selection does not disappear either visually or for the floating Toolbar and the Bubble menu, which hide when focus is lost. ProseMirror's selection survives losing focus even without this, but the visibility of the floating Toolbar, the Bubble menu and the image panel depends on focus. The rule "a click on a custom toolbar does not clear the selection" is not part of the public contract: this is a recipe, not a property of the field. A button that opens its own dialog, where focus inevitably moves away, calls `ref.current?.focus("restore")` when the dialog closes.

**History with an external toolbar.** The Handle provides `undo()` and `redo()` and their availability. For the `disabled` state of an "Undo" button, get availability from the hook's slice — `editor.can().undo?.() === true`: the slice re-renders the toolbar right after an edit. `ref.current.canUndo()` is a one-off read in a handler, and it is not subscribed to re-rendering. Without the `history` Tool the engine has no `undo` command (hence the `?.`), and both buttons stay unavailable.

### Tool state: `useRichTextToolState`

`useRichTextToolState(ref, name, selector?)` gives the screen the state of a Tool: a "3 of 12" counter from Find in the Status bar, or external navigation built from the headings of the Table of contents. The hook sits next to `useRichTextEditorState` and follows the Handle's engine in the same way, but it returns not a slice of the Tiptap engine but a typed snapshot of the kit's contract. The state fields of the built-in Tools are in the "Find and replace", "Table of contents", "Invisible characters", "Footnotes", "Block selection", "Text part language" and "Date mention" sections.

- **Name and type.** `name` is a Tool from the `tools` set; the snapshot type is inferred from the `RichTextTools` map: `search` returns `SearchToolState`, `toc` returns `TocToolState`, `invisibleCharacters` returns `InvisibleCharactersToolState`, `footnotes` returns `FootnotesToolState`, `blockSelection` returns `BlockSelectionToolState`, `language` returns `LanguageToolState`. A name outside the map (a custom Tool without typing) gives `unknown`.
- **Re-renders only when the snapshot changes.** The snapshot is recomputed on every engine transaction and on kit signals that the engine does not have: the find panel opening and closing, and the current section of the Table of contents changing on scroll. The screen re-renders when the result becomes different (plain data — primitives, arrays and plain objects — is compared by value, like `useRichTextEditorState`; `Date`, `Map`, `Set` and class instances are compared by reference), so typing that does not change the snapshot does not touch it. A custom Tool's `state` that creates such values anew on every call re-renders the screen on every transaction.
- **A selector.** The third argument subscribes the screen to a slice: `useRichTextToolState(ref, "search", (state) => state.total)` re-renders it only when the number of matches changes. With `null`, the selector is not called.
- **`null`** is what the hook returns before mount and in the screen's first render, on the server, after the Editor unmounts, and when the Tool is not in the set: Presets do not include `toc`, so you enable it by name or with a `tool("toc")` entry. This way the screen renders the same on the server and in the browser.
- **A snapshot is data**: no DOM nodes, functions or ProseMirror positions. Do not mutate it.
- **Cost.** The hook is not part of the `RichTextEditor` entry chunk: only a screen that imports it pays for it.

The state of a custom Tool is declared with `defineTool` (the `state` field) and read with the same hook: ["Options, state and commands"](../../api/editor-extension.md#options-state-and-commands).

### Tool commands: `handle.tool()`

`ref.current?.tool(name)` returns the commands object of a Tool: `tool("search")?.open({ query: "TODO" })`, `tool("toc")?.jumpTo(2)`. The commands of the built-in Tools are described in the "Find and replace", "Table of contents", "Invisible characters", "Footnotes", "Block selection" and "Text part language" sections.

```tsx
<button type="button" onClick={() => ref.current?.tool("search")?.open({ query: "TODO" })}>
  Find TODO
</button>
```

- **The type is inferred from the `RichTextTools` map**, by the Tool's name. A name outside the map gives `unknown`.
- **`null`** when the Tool is not in `tools`, has no commands, or the engine has not been created yet. That is why the commands of a disabled Tool are unavailable both in types (`?.`) and at run time.
- **Every command returns a `boolean`:** done or not (Source mode, no matches, no such heading, a field that cannot be edited). A refusal is `false`, as with `insertHTML`, not an exception.
- **Take the object on every call** instead of keeping it between renders: it is cheap, and this way you always work with the live engine.
- **The Handle gets no new method for each command.** The commands of the built-in Tools go through `tool(name)`, not through new methods; `openSearch` remains for compatibility only. Commands of Marks, Blocks and anything a Tool has not declared are still called through `ref.current.editor`.

## Events

The screen learns about the Editor through callback props; there is no event bus. The decision is recorded in ADR-0058, section 9.

```tsx
<RichTextEditor
  ref={ref}
  aria-label="Email"
  value={html}
  onChange={setHtml}
  onReady={() => ref.current?.insertHTML("<p>Hello!</p>")}
  onFocus={() => setEditing(true)}
  onBlur={() => save(ref.current?.getHTML() ?? "")}
/>
```

- **`onReady()`** takes no arguments and is called **once per mount**, when the engine is created. By then `ref` is already usable: in the callback you can insert a template or set focus. It fires in `readOnly` and in `disabled` too; a re-render, a `placeholder` change or a change of the callback itself do not cause a second call. An error in the `tools` set (there is no engine, see "Custom Tool") and server rendering do not call `onReady`. Readiness means the engine is created **and all Tool Loaders have run** (see the "Custom Tool" section): `onReady` waits for them, and on a Loader failure it is not called — and after "Retry" it is called once, when the engine is created.
- **`onFocus()` and `onBlur()`** report Field focus and take no arguments (the DOM event is not passed through). Here the field means the whole field: the Document, the Toolbar, popovers and kit dialogs (link, color, image, "Insert table"), the Source mode field. Moving between them does not lose Field focus: from the text to the Toolbar, to the link popover and back, neither `onBlur` nor `onFocus` fires — as with a composite form field. The Document's focus (the engine's `focus` and `blur`) is different: a click on the Toolbar removes it, while Field focus stays.
- **Before `onBlur` a pending `onChange` is flushed**, wherever focus moves away from (the Document, the Toolbar, a popover), so autosave on `onBlur` gets the fresh Document. `onBlur` fires a tick after focus leaves: in that time focus could have come back into the field. If the Editor is unmounted with focus inside, `onBlur` is not called (a pending `onChange` is still delivered).

### Paste and drop order

Only the Extensions of a custom Tool can intercept pasting from the clipboard and dropping — through the ProseMirror plugins `transformPastedHTML`, `transformPasted`, `handlePaste` and `handleDrop` in `engine`. The Editor has no hooks or props of its own named `onPaste` and `onDrop`.

- **The handlers of custom Tools see the event before the built-in ones** — Markdown paste, image upload, Column layout and Paste from Office (`pasteCleanup`) — wherever a custom Tool appears in `tools`. Every `transformPastedHTML` runs in turn, so the cleanup of `pasteCleanup` works on what a custom Tool's `transformPastedHTML` returned. A `handlePaste` or `handleDrop` that returns `true` takes the whole event: the built-in ones never get it. This way a link to a video can be turned into a custom Block before Markdown parses it.
- **Schema parsing and the limit always apply.** What a paste brought beyond the Schema (`<script>`, `onclick`, unknown tags, values that break the attribute rules) is dropped, as with an incoming `value`; HTML cleanup (`transformPastedHTML`) happens before the Schema and cannot weaken it. A transaction of your own handler that takes the text beyond `maxLength` is **rejected entirely**; tail trimming exists only in the built-in paste from the clipboard (a transaction flagged `paste`).
- **Files other than images are handled by a custom Tool** in `handlePaste` and `handleDrop`: its own upload function and its own upload URL, set through the options of its extension. The Editor has no general `onUploadFile`. A file that no handler claims reaches the kit: an image is uploaded through `onUploadImage`, and anything else gets the message "`name` is not an image" (`editor.imageNotImage` in the message catalog).

```tsx
const PdfDrop = Extension.create({
  name: "acme_pdfDrop",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: new PluginKey("acme_pdfDrop"),
      props: {
        handlePaste: (_view, event) => takePdf(event.clipboardData?.files),
        handleDrop: (_view, event) => takePdf(event.dataTransfer?.files),
      },
    }),
  ],
});

// A Tool without a Block: behavior only.
export const pdfTool: CustomTool = { name: "acme_pdfDrop", engine: [PdfDrop] };
```

## Public API

- `value` + `onChange(html)` or `defaultValue` — as in the other fields ([conventions.md](../../conventions.md), "State management"). An empty Document is `""`, not `<p></p>`. `defaultValue` also accepts a JSON envelope (`RichTextDocument`, see the "JSON" section); `value` and `onChange` are always HTML.
- **`onChange` is called no more often than once per `changeDelay` ms** (300 by default), on the trailing edge, and immediately — on `blur`, before the form's `submit` and when building `new FormData(form)`. Serializing the Document to HTML is a walk over the whole tree, and on every keystroke it would slow typing in long Documents. `changeDelay={0}` emits every edit.
- **An incoming `value` equal to the last emitted HTML does not recreate the Document** and does not move the cursor: the ordinary round trip, where the field emits a value and gets it back, is safe. A different `value` replaces the whole Document; such a replacement is not an edit, and `onChange` is not called for it.
- `name` renders an `<input type="hidden">` with the current HTML — the value is included in `FormData` and in native form submission.
- `maxLength` is the character limit: the Document's text without markup and without Block separators; an Atom counts as the length of its Atom text (a horizontal rule 0, a hard break 1, an image the caption length; see "Custom Tool"). The remaining-count indicator appears at 80 % of the limit and is part of the field's description; input beyond the limit is rejected, a paste is trimmed to what fits: the tail is cut by characters, and an Atom that did not have room is dropped entirely along with everything after it. **A `value` longer than the limit loads in full**: this is the screen's data, it may be shortened but not lengthened, and the counter shows by how much the limit is exceeded.
- `readOnly` — the engine keeps running, the text can be selected and is submitted with the form, editing is disabled. `disabled` — as in other fields: editing is disabled, the field is muted, and it is not submitted with the form.
- **`<fieldset disabled>` disables the Editor, like a native field** — both `Form pending` and the consumer's `fieldset`. Switching on the fly is picked up (a `MutationObserver` on the `disabled` attribute of ancestor `fieldset` elements), without remounting. The DOM is read, not the `Form` context: that covers both cases with one rule.
- `placeholder` defaults to the string from the message catalog (`editor.placeholder`).
- `onReady()`, `onFocus()`, `onBlur()` — field events, no arguments; see "Events". `onReady` is once per mount, `onFocus` and `onBlur` report the Field focus (the Document, the Toolbar, popovers, the HTML field), and before `onBlur` a pending `onChange` is flushed.
- `onUploadImage(file) → Promise<string>` — the image uploader, see "Images". Without it files are not accepted.
- `maxHeight` — the height limit of the Document area (a number is pixels, a string is a CSS length), beyond it the Document scrolls inside the frame; `resizable` — a height handle at the area's bottom edge (a slider for keyboard users), and `maxHeight` with it is the starting height. See "Field height".
- `surface` — `"theme"` (default) or `"paper"`: a light Paper in any theme, see "Surface". The type is `RichTextSurface`.
- `status` — a React node of the Status bar inside the field's frame, at the start of the counter row; the kit does not announce it. The engine command `showNotice({ tone, text } | null)` is the Field notice. Both are in "Status bar and Field notice"; they follow the kit's semver.
- `tools` — kit names, Configured Tools `tool(name, options)` for `search`, `toc`, `details`, `mathematics`, `youtube`, `twitch`, `typography`, `invisibleCharacters`, `focus`, `language` and `date`, `defineTool(…)` definitions and descriptions of custom Tools (`CustomTool`, including their `buttons`, `insertItems`, `blockActions`, `textCards` and `trigger`), Presets as arrays — `RICH_TEXT_PRESETS`; see "Tools and Presets" and "Custom Tool". A description with an error is a field error.
- `ref` (`RichTextEditorHandle`): `getHTML()` — the current HTML, without waiting for the delay and without `onChange` (in Source mode it first applies the field's edit — then `onChange` is called if the Document changed; the same for `getMarkdown()`); `getMarkdown()` and `setMarkdown(md)` — see "Markdown"; `getJSON()` and `setJSON(document)` — see "JSON"; `clear()` — clear the Document, and `onChange("")` notifies the screen; `focus(position?)`, `blur()`, `insertHTML`, `insertText`, `getText`, `getSelectedText`, `isEmpty`, `undo`, `redo`, `canUndo`, `canRedo` — see "Handle (`ref`) and your own toolbar outside the field"; `tool(name)` — the commands of a Tool, see "Tool commands: `handle.tool()`"; `openSearch({ replace? })` — deprecated, removed in 5.0, replaced by `tool("search")?.open({ replace })`; `editor` — the underlying Tiptap `Editor`, its API **follows Tiptap's major version**, and before mount and on the server it is `null`. `focus()` without an argument puts the caret at the end of the Document (in Source mode, in the HTML field).
- `useRichTextEditorState(ref, selector)` — a hook for your own toolbar outside the field, see "Handle (`ref`) and your own toolbar outside the field".
- `useRichTextToolState(ref, name, selector?)` — the hook for Tool state (`search`, `toc`, `invisibleCharacters`, `fullscreen`, `focus` and custom Tools with `defineTool`): a data snapshot, `null` before mount, after unmount and without the Tool; see "Tool state: `useRichTextToolState`". It follows the kit's semver, as do `tool()`, `defineTool()`, `handle.tool()` and the `RichTextTools` map.
- SSR: the engine is created only in the browser (`immediatelyRender: false`). On the server it renders a Skeleton without a Document — the frame and the space reserved for the Toolbar — and a hidden field with the incoming value. After hydration the Skeleton shows the Document cleaned by the Schema, and the editable area takes its place after the Loaders, without a height jump. The exception is a JSON envelope in `defaultValue`: only the engine builds its HTML, so with it the Skeleton is a frame without a Document, the hidden field is empty until Readiness, and the height changes once when the Document appears.

## Markdown

The Markdown engine is the `@tiptap/markdown` package (the same version range as the rest of Tiptap, in the install command above) and `marked` (`^17`, as in the dependencies of `@tiptap/markdown`): every Editor has its own `marked` instance, so one Editor's `tools` set does not change Markdown parsing in another Editor on the same page.

- **Paste.** Plain text from the clipboard that contains Markdown syntax — a `#` heading, a list item (including `- [ ]`), a `>` quote, a code fence, a table delimiter row, `**bold**`, `~~strikethrough~~`, `` `code` ``, a link (`[text](url)`, with a title `[text](url "title")`, an autolink `<https://…>` and a link reference definition line `[1]: https://…`), `*italic*` and `_italic_` at word boundaries — is turned into Blocks and Marks. Text without this syntax is pasted as paragraphs: "6 = 2 * 3" or `file_name_v2` does not become markup. A single line with markup continues a paragraph rather than breaking it.
- **Links.** All forms of a Markdown link are understood — inline, with a title, reference-style (`[text][1]`, `[text][]`, `[text]` and the definition line `[1]: address`) and an autolink in angle brackets; likewise in `setMarkdown`. In the Schema a link has only a URL: the title is dropped, the definition line is not carried into the Document, and neither are the angle brackets, and `getMarkdown()` writes any of them as an ordinary link `[text](address)`. The URL goes through the same policy as in the popover: a relative one (`/docs`, `#part`) does not become a link; its text remains.
- **A copy from a code editor.** VS Code, JetBrains IDEs, Sublime Text and the like put HTML on the clipboard next to the text — the same source, colored by syntax highlighting. If this HTML is a single monospace element (a `div` or `pre` with a monospace font) with only lines and `span` coloring inside, its text matches the clipboard's plain text up to whitespace, and the plain text looks like Markdown by the syntax above, then the plain text is parsed as Markdown. The syntax highlighting colors are not carried into the Document: they belong to the code editor's theme, not to the author. Code that does not look like Markdown is pasted as usual.
- **When a paste stays text.** If the clipboard holds any other HTML next to the text (a copy from a browser, Word, Google Docs), the usual HTML parsing applies — Markdown is not looked for in it; a copy from an office application is cleaned by `pasteCleanup` first (see the "Paste from Office" section). Pasting "as plain text" (`Ctrl/⌘+Shift+V`) and pasting into code also give the original characters. If nothing the Schema can accept is left of the pasted Markdown (with `table` disabled, a lone table; with `codeBlock` disabled, a lone code block), the original text is pasted rather than nothing.
- **Tables.** A GFM table (`| a | b |` and a delimiter row, at least `---` in a cell for paste recognition) becomes a table, with the first row as the header; `getMarkdown()` exports the table back, always with a header row (without one, with an empty one). Multiline cell content goes into Markdown as one line, with line breaks as `<br>`; `|` in a cell is escaped. **Column alignment is preserved in both directions:** `:---:` and `---:` become `data-align` on the column's cells on paste and `setMarkdown`, and `getMarkdown()` writes them back; `:---` is the default and gives no attribute. **Markdown cannot express cell merging:** `getMarkdown()` spreads a merged cell over the grid — the text stays in its top-left position, the covered positions become empty cells, so the columns below do not shift; the merge itself is lost, and `setMarkdown(getMarkdown())` returns the table without it.
- **Footnotes.** GFM footnotes are read and written: `[^1]` in the text and `[^1]: text` definitions (see the "Footnotes" section for the rules); plain text with a definition line is recognized as Markdown on paste.
- **`getMarkdown()`** is the Document as Markdown, right now, without waiting for `changeDelay`. An empty Document and a call before mount (there is no engine on the server) give `""`.
- **`setMarkdown(md)`** replaces the Document with the parsed Markdown. Like `clear()`, this is a Programmatic replacement: `onChange` receives the new HTML immediately and only once, and the `maxLength` limit does not truncate it. Before mount it does nothing.
- **The Schema wins.** The parsed result goes through the Editor's Schema: everything not in it now is dropped, `setMarkdown` included. In this version of the kit the following are lost: images with a URL outside `http`/`https` (they are removed entirely, with their `alt`), links with a URL outside the `http`/`https`/`mailto` policy (the link text stays) and raw HTML inside Markdown (it is removed entirely, except the `details` and `summary` of a Details Block). Without the `taskList` Tool, task lists become ordinary list items, without `codeBlock` the code block is removed, and without `table` the table is removed. Markdown never yields a Column layout or a Wrapper without a tone: their Blocks follow one another. A Details Block is read from raw HTML `<details><summary>` and exported as the same (see the "Details" section). A Wrapper with a tone comes only from a GitHub alert (`> [!NOTE]` and four more values, see the "Wrapper" section, "Tone"), and `getMarkdown()` exports it the same way. With `heading1`, `#` gives H1, and `getMarkdown` writes H1 as `#`. Without it, `#` is demoted to H2; `#####` is demoted to H4 in any case. What exactly is accepted is decided by the set of Tools, not by this list.
- **Video.** A video Block is a link: `getMarkdown()` writes the canonical URL on a line of its own, and `setMarkdown()` reads such a line back as a Block if the service is on; a link among words, in a list and `[text](address)` stay links (section "Video by link").
- **Custom Tools.** Custom Markdown rules live in the Extensions; without them a custom Block is exported as its content, and an Atom as its Atom text (see the "Custom Tool" section, "Outside the Editor").
- **What is lost on export.** Markdown does not express text color and highlight color, Block alignment, underline, a fragment's language, an image's width, alignment and caption, table cell merging, table column widths and a list inside a cell: an image is exported as `![alt](url)`, `getMarkdown()` omits the rest, and `setMarkdown(getMarkdown())` returns the Document without them. A date mention is exported as its text, and its machine value (`datetime`) is lost. This is how the format works: for lossless storage use HTML, and for a lossless file use the JSON envelope (see the "JSON" section).

## JSON

A JSON envelope is the Document for a file, a template or a transfer between products **without loss**: it keeps everything Markdown loses (color, highlight, alignment, underline, a fragment's language, an image with width, alignment and caption, cell merging, column widths, Column layout, a Wrapper with a tone). The envelope is an exchange format **alongside HTML, not instead of it**: `value`, `onChange`, the hidden form field, `RichTextView` and server sanitization still work with HTML (ADR-0061).

```ts
import type { RichTextDocument } from "@olddevs/ui/editor";

// { format: "olddevs-rich-text", version: 1, doc: { type: "doc", content: [...] } }
const saved: RichTextDocument | null = ref.current?.getJSON() ?? null;
const opened: boolean = ref.current?.setJSON(JSON.parse(fileText)) ?? false;
```

- **Shape.** `format` is always `"olddevs-rich-text"`, `version` is the tree format number (currently `1`), `doc` is the Document tree with a root node `"doc"`. The node and attribute names in `doc` are the format's contract: if the Schema renames them, the kit bumps `version` and reads old files itself. Do not check or build `doc` by hand: use what `getJSON()` returned.
- **`getJSON()`** is the Document as an envelope, right now, without waiting for `changeDelay`. In Source mode the HTML field's edit is applied first, as with `getHTML()`. Before mount and on the server it gives `null`.
- **`setJSON(document): boolean`** replaces the Document with an envelope. The parameter is `unknown`: pass the result of `JSON.parse` of the file directly, and the Editor checks the shape. Like `setMarkdown()`, this is a Programmatic replacement: `onChange` receives the new HTML immediately and only once, the `maxLength` limit does not truncate it, the method does not take focus, and in Source mode the field's text is rewritten. `false` means the envelope was rejected or there is no engine yet; the Document is untouched, and what to tell the user ("the file does not fit") is up to the screen.
- **What is rejected entirely:** not an object, an unrecognized `format`, a different `version` (including its absence), a `doc` without a root `"doc"` node, and a tree from which nodes cannot be built (a malformed node, an empty text node). A bare Tiptap tree from `editor.getJSON()` is rejected too: without an envelope an Editor file cannot be told from any other JSON.
- **The Schema wins — for JSON too.** An envelope goes through the Schema as strictly as HTML: a Block of a disabled Tool unwraps into its text, a Mark that is not in the Schema is removed, and attributes are checked by **the same rules as for HTML**. A dangerous link or image URL, a color outside the palette, an author's color not in the `#rrggbb` form, `data-*` outside the Schema's list, and values of custom Tools outside their rules are dropped in the Document itself, not only on output. The author's whitespace is not collapsed by the `getJSON()` → `setJSON()` round trip.
- **`defaultValue` with an envelope** is the initial Document from JSON, uncontrolled mode only (`value` wins). It passes the same check as `setJSON()`, is applied when the engine appears, without `onChange` and without an undo step; a rejected one gives an empty Document and one error in the development console. Until Readiness, with an envelope the Skeleton is a frame without a Document, `getHTML()` is `""`, and `isEmpty()` evaluates the envelope's tree by the `required` rule.
- **Custom Tools** write no JSON rules: a Block, Atom or Mark of a custom Tool included in `tools` goes through the round trip itself and is checked by the rules of its description; a disabled one unwraps, and an Atom without content is removed, as in HTML.
- **The kit has no "Download" and "Open file" buttons** — that is screen code made of the kit's primitives; see the `JsonExportImport` story in Storybook for an example. For database storage, use the HTML from `onChange`: the server sanitizes it (`sanitizeRichText`), and the kit has no server-side JSON sanitization.

## Schema and security

The Schema is the only source of allowed markup. Everything not in it is dropped **both when `value` is loaded and on paste**: `<script>`, `on*` handlers, the `style` attribute (except the author's color, below), links to `javascript:`, `data:` and any URLs other than absolute `http`, `https` and `mailto`, images with a URL outside `http`/`https` (`data:` — base64 — and `blob:` included), `width`, `height` and `class` on `<img>`, disallowed tags. Text from a dropped tag is kept; only the tag is lost. The one exception to "no `id` and no `#` link" is the footnote markup: it passes only in its exact shape and place (see the "Footnotes" section).

The allowlist of this release with `preset="full"` (disabled Tools narrow it):

<!-- allow-list -->

| What       | Allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocks     | `p`, `h1`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `blockquote`, `hr`, `pre`, `table`, `tbody`, `tr`, `th`, `td`; `label`, `input`, `span` — only inside a task list item; `div` — there too, and also the Column layout and its columns (a Column layout only at the top level, a column only directly in it) and the Wrapper (at the top level and directly in a column, not in another Wrapper), and video (the same `div` with the value "video" of data-block and an ordinary link inside; there is no player in the Document, an iframe is always stripped); `details` — the Details Block, with `summary` and a content `div` inside it (both only directly in `details`; outside it the tags are removed); `figure` — an image, with `img` and an optional `figcaption` inside it (they do not exist outside `figure`); formulas — an inline `span` and a block `div` with the attributes "data-type" and "data-latex", both elements empty; footnotes — the list at the end of the Document is `section` with the value "footnotes" of data-block, only at the top level, holding an `ol` of `li` with a `p` and the backlink; the reference is the `sup` and `a` that are in Marks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Marks      | `strong`, `em`, `u`, `s`, `code`, `sup`, `sub`, `mark` (only with a color), `br`, `a`, `time` (a date mention)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Attributes | `ol[start]` — only when numbering does not start at 1; `ul[data-type]`, `li[data-type]`, `li[data-checked]` — a task list; `input[type]`, `input[checked]` — its checkbox; `code[class]` — the code block language, only `language-python`, `language-typescript`, `language-javascript`, `language-go`, `language-html`, `language-json`, `language-yaml` or `language-markdown` (no class without a language); `span[data-color]`, `mark[data-color]` — text color and highlight, only names from the Editor's own palette — text color on `span`, highlight on `mark`; `span[style]`, `mark[style]` — an arbitrary author's color, only `color:#rrggbb` and `background-color:#rrggbb`, and not together with data-color; `p[data-align]`, `h1[data-align]`, `h2[data-align]`, `h3[data-align]`, `h4[data-align]` — Block alignment, center or right; `th[colspan]`, `td[colspan]` — horizontal merge, an integer from 2 to 20; `th[rowspan]`, `td[rowspan]` — vertical, from 2 to 50; `th[data-align]`, `td[data-align]` — column alignment, center or right, on each of its cells; `a[href]` — only http, https or mailto (the footnote anchors below are the one exception); `a[rel]` — always `noopener noreferrer`; `img[src]` — only absolute http or https, no data and blob; `img[alt]` — always, empty for an image without a description; `img[data-width]` — 25, 33, 50, 75 or 100; `figure[data-align]` — image alignment, `left` or `right`, the text wraps around the image (the centre has no attribute); `div[data-block]` — the Column layout (`layout`), its column (`column`), the Wrapper (`wrapper`) and video (`video`); `div[data-layout]` — the Column layout variant, column shares in percent: `100`, `50-50`, `33-33-33`, `25-25-25-25`, `60-40` or `40-60`; `div[data-tone]` — the Callout tone, only on it: `neutral`, `accent`, `success`, `warning` or `danger` (no attribute without a tone); `div[data-type]` — the content wrapper of a Details Block ("detailsContent", only directly in `details`) and a block formula ("block-math"); `span[data-type]` — an inline formula, only the value "inline-math"; `span[data-latex]`, `div[data-latex]` — the LaTeX source of a formula, only next to its "data-type", and the only attribute value where "<" is allowed; `div[data-provider]` — the service of a video Block, only on it: "youtube" or "twitch"; `div[data-src]` — the link to a video of that service in canonical form, only on a video Block and only "https": on www.youtube.com (a video or a playlist) or on www.twitch.tv and clips.twitch.tv (a recording, a channel, a clip); `details[open]` — an open Block, only an empty "open", written with the "persist" option; `sup[data-footnote-ref]` — a footnote reference, the key of its footnote: eight lowercase letters and digits; `a[id]`, `a[role]` — only on the anchor inside the reference ("fnref-" and the key, "doc-noteref") and on the backlink ("doc-backlink"); `li[id]` — "fn-" and the key, only on a footnote in the list; `section[data-block]`, `section[role]`, `section[aria-label]` — the footnote list: "footnotes", "doc-endnotes" and its name; these are the only `id` and `#` link targets in the Schema, and `a[href]` takes "#fn-" or "#fnref-" and the key only on the same anchors, to the footnote or reference with the same key |
| Dates      | `time[datetime]` — a date mention, only on `time`: exactly `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM±HH:MM` and a real calendar date; the element holds only the author's text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Language   | `span[lang]` — the language of a fragment: any BCP 47 tag (`en`, `pt-BR`, `zh-Hant-TW`), written in its canonical case, and only on a plain `span`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Columns    | `colgroup`, `col` — column widths of a table: one `colgroup`, the first child of a `table`, with 2 to 20 `col` directly in it. A `colgroup` that breaks the rule of the next row is removed whole, and the table is sized by its content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Shares     | `col[data-width]` — a column's share of the table's width in percent: a multiple of 5 from 5 to 95, and the shares of one `colgroup` add up to 100 (`RICH_TEXT_SCHEMA.tableColumnShares`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Tiptap writes a task list item like this: `<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>…</p></div></li>`. A sanitizer should let `input`, `label`, `span` and `div` through only inside such an item, and `input` only with `type="checkbox"`.

A table is `table > tbody > tr > th|td`; a cell has only `colspan` and `rowspan` (`colspan` is an integer from 2 to 20, `rowspan` from 2 to 50) and `data-align` (`center` or `right`), no `style` and no `colwidth`. `thead`, `tfoot` and `caption` are not in the Schema and the Editor does not write them (the header row is the first row of `th`); column widths are an optional `colgroup` of `col[data-width]` before `tbody` (the two rows above), and `sanitizeRichText` removes the whole `colgroup` unless it is the first one in the table with 2 to 20 `col`, each a valid share, adding up to 100; `tbody`, `tr`, `th` and `td` outside a table are thrown out by the HTML parser itself, so no hook is needed for them.

There are no other classes, no `style` (except the author's color), no `id`, `role` or `aria-*` (except the footnote markup, see the "Footnotes" section) and no `data-*` (except the twelve Schema names: `data-type` (a task list, the content wrapper of a Details Block and formulas), the `data-latex` of a formula, `data-checked`, `data-color`, `data-align`, `data-width`, `data-block`, `data-layout`, `data-tone`, `data-provider`, `data-src` and `data-footnote-ref`; custom Tools add `data-mark` and `data-<name>` to them) in the emitted HTML: typography lives on the container, not on the Document's nodes.

**`style` is a narrow exception.** The author's color is written as `<span style="color:#rrggbb">` and `<mark style="background-color:#rrggbb">`, and nothing else is ever in `style`: no other properties, no other tags, no other color forms. DOMPurify's `ALLOWED_ATTR` is shared by all tags and does not check values, so the bare `richTextSanitizeConfig()` has no `style` at all, and only `sanitizeRichText` lets it through ([RichTextView](../content/rich-text-view.md#sanitization-on-the-consumers-server)), checking the tag and value against `RICH_TEXT_SCHEMA.customColor.styles`.

**The Schema is not sanitization.** Client-side cleaning does not protect against XSS: a request that bypasses the interface can carry anything. User HTML is sanitized by the consumer's server — `sanitizeRichText(html, DOMPurify)` against the allowlist above. The list grows with the set of Blocks, and the helper with it; it and the closed config `richTextSanitizeConfig()` are described on the [RichTextView](../content/rich-text-view.md#sanitization-on-the-consumers-server) page. The table above repeats `src/editor/core/schema.ts` and is verified by a test. Until Readiness the Skeleton shows `value` already parsed by the Schema in the browser (see the "Custom Tool" section), and on the server it renders no Document, so the Editor, unlike `RichTextView`, does not put unsanitized HTML into the page. This does not replace server-side sanitization: the value goes on into the database and into `RichTextView`.

**An allowlist of your own.** `RICH_TEXT_SCHEMA.attributes` is data: it names the attributes, but not the tag, the place and the shape of value each one is allowed in. That rule lives in the hooks of `sanitizeRichText`, so copying the names into another sanitizer's allowlist is safe only for the attributes that are harmless whatever stands in them. Sanitize with `sanitizeRichText` (or `richTextSanitizeConfig()` together with its hooks) whenever you can. If you cannot, sort the attributes this way:

| Attributes                                                                                                         | In your own allowlist | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (on `li` and `a`), `role` (on `a` and `section`), `aria-label` (on `section`), `data-footnote-ref` (on `sup`) | Do not copy           | They are the footnote markup. As plain attributes they pass on every tag with any value: an author's `id` clobbers the page's named elements and `getElementById` (DOM clobbering) or collides with its anchors, `role` makes any element pose as a button or an alert, `aria-label` renames any element for a screen reader. `sanitizeRichText` admits each one only as `fn-<key>`, `fnref-<key>`, `doc-noteref`, `doc-endnotes` or `doc-backlink`, on its own tag, in the footnote markup. Without them the footnotes keep their text and lose the jumps |
| `lang` (on `span`)                                                                                                 | Better with the hook  | Inert, nothing reads it but the browser and assistive technology, so it is not an injection. A plain copy lets any tag and any string through, and that changes the voice a screen reader reads with. The kit's closed config leaves it out                                                                                                                                                                                                                                                                                                                |
| `time[datetime]`, `col[data-width]`, `figure[data-align]`, `img[data-width]`                                       | Safe as plain data    | No script, address or style: the kit's styles select only the fixed values (`left`, `right`, a share from 5 to 95, a width preset), and any other value does nothing. The bare config has them. What the hooks add is the shape of the value (the two `datetime` forms, shares that add up to 100); the Editor re-checks it on load anyway. `img` itself and its `src` still need the hooks                                                                                                                                                                |

## Accessibility and forms

- The editable area is `role="textbox"` with `aria-multiline`.
- **The Toolbar** is `role="toolbar"` named from the message catalog (`editor.toolbar`, "Formatting") with **one Tab stop**: Tab enters the Toolbar, the Left and Right arrow keys move between the buttons, Home and End go to the edges, and the next Tab moves focus to the Document. The Toolbar remembers where focus was. It is built on the kit's `Toolbar`.
- Buttons are icons with `aria-label`; toggle buttons (bold, italic, underline in the Bubble menu, link, image) announce their state with **`aria-pressed`** — a screen reader announces whether italic is on at the caret. One-off actions (undo, redo) are ordinary buttons. A button of a custom Tool announces `aria-pressed` only if it has `isActive`, and its shortcut is in the tooltip and in `aria-keyshortcuts`; an empty label is replaced with the Tool's name. An action unavailable right now is `aria-disabled`, not `disabled`: it stays in the arrow-key order.
- A hover and focus tooltip names the action and the shortcut; the shortcut is also announced with `aria-keyshortcuts` (`Control+B` or `Meta+B` on Apple). On Apple the label is `⌘+⇧+S`, elsewhere `Ctrl+Shift+S`, using the same check the engine uses to decide which key is `mod`.
- **The Slash menu on `/`** follows the `combobox` pattern from the WAI-ARIA Authoring Practices Guide (APG): focus stays in the field, the list is `role="listbox"` with `role="group"` sections, and the field points to it with `aria-controls` and to the current row with `aria-activedescendant` (the row has `aria-selected`). The field announces `aria-autocomplete="list"`. `aria-expanded` is not set on the field: ARIA 1.2 does not allow it on `role="textbox"`, and the role of a multiline Document cannot be changed to `combobox`. A row's name is its label; the `##` shortcut hint is not read to the screen reader.
- The list on `/` is a layer of the kit's `Popover` (Radix): Escape closes only it, not the `Dialog` or `Drawer` around the field, and what was typed stays as text. "+" is the kit's `Menu` with `aria-haspopup`, and Escape in it behaves the same way (ADR-0041).
- **The Keyboard shortcuts popover** is the kit's `Popover`: a button with `aria-haspopup="dialog"` and `aria-expanded`, the popover is `role="dialog"` named "Keyboard shortcuts", with a `table` inside having column headers (`columnheader`) and a row header (`rowheader`) for each command, and each shortcut is marked up with `<kbd>`. Escape and a click outside close the popover and return focus to the button; in a `Dialog`, only the popover (ADR-0041). Tests: `tests/rich-text-editor-shortcuts.test.tsx`, in the browser `tests-visual/interactions.spec.ts` ("RichTextEditor inside Dialog: Escape closes the shortcuts reference").
- **The floating Toolbar** is the same `role="toolbar"` with one Tab stop and the same arrow keys; it appears above a non-empty selection, and on a touch screen it is replaced by the fixed one. To move from the Document to any Toolbar, press `Alt+F10` (see the "Keyboard: `Alt+F10`" section).
- **The link popover** is `role="dialog"` named "Link" (`editor.link`); the field is labeled (`editor.linkAddress`), the URL error (`editor.linkInvalid`) is associated with the field through `aria-describedby` and sets `aria-invalid`. The "Link" button is a toggle with `aria-pressed` when the caret is in a link.
- **Image.** The popover is `role="dialog"` named "Image" (`editor.image`); the "Image address" and "Alternative text" fields are labeled, the second one's hint is associated through `aria-describedby`, and the URL error (`editor.imageInvalid`) sets `aria-invalid`. The width presets are a `role="group"` "Width" of toggle buttons with `aria-pressed`. The selected image's panel is a `role="toolbar"` "Image" with one Tab stop. The width handles are for the mouse only (`aria-hidden`, no focus): the same width is in the popover and on the panel. Upload progress is a `role="status"` live region outside the Document (live regions inside `contenteditable` are not read everywhere), and a failure is a visible `role="alert"` line under the field: this is the Field notice, the same one that `showNotice` shows.
- **The "¶" menu** is the kit's `Menu`: radio items (`menuitemradio`) with `aria-checked` on the current Block type, shortcuts labeled in the items. Enter, Space and `↓` on the button open the menu; the arrow keys move between the items. Escape closes the menu and returns focus to the button; inside `Dialog` and `Drawer`, only the menu, not the dialog (ADR-0041). The button's name includes the current type: "Block type: Text"; the menu is named by its button. The state is in a menu rather than in a row of toggle buttons: a checked item announces it the same way as `aria-pressed`, and the value on the button is announced without opening the menu — ADR-0054.
- **The "…" menu** is the kit's `Menu` with an icon button "More formatting": Marks and "Code block" are checkbox items (`menuitemcheckbox`) with `aria-checked`, shortcuts labeled in the items. Inside `Dialog` and `Drawer` the items are chosen with both mouse and keyboard, and Escape does not close the dialog while the menu is open (ADR-0041).
- **The "Highlight" and "Color" popovers** — a button with `aria-haspopup="menu"` and `aria-expanded`; inside is a `menu` named like the button, and the grids are a `group` with a heading ("Text color", "Highlight color"). The swatches are `menuitemradio` with `aria-checked` and a name **in words** ("Red", "Pink"): color is not the only cue (WCAG 1.4.1). "Custom color…" is also a `menuitemradio`, checked when the color is the author's; "Remove color" and "Remove highlight" are `menuitem` with a tooltip. The selected swatch has a ring around it on the popover's background, and focus is an accent outline outside that ring: both cues are visible at the same time. The "Highlight" button's name includes the current color ("Highlight: Pink"). Navigation follows APG menu roles over the grid: the arrow keys move rather than choose.
- **The custom color popover** is `role="dialog"` named "Custom text color" or "Custom highlight color"; focus on open is on the color picker button, whose visible name states the value ("Color #d92d20") and changes with it. The contrast warning is `role="status"`: the screen reader announces its appearance. Escape closes one layer at a time (ADR-0041): the color picker, then the popover, then the `Dialog` or `Drawer` around the field; focus returns to the Document.
- **Text part language.** The `lang` of a marked fragment is what a screen reader switches its voice by (WCAG 3.1.2, level AA). "Language ›" is a submenu of the "…" menu: radio items (`menuitemradio`, `aria-checked`) in words, with the page's own language marked "primary", and "Remove language mark", which gets `aria-disabled` when there is nothing to remove. The dotted underline is not the only carrier of the meaning: it only helps the author see the border, and the View draws nothing.
- **The "Alignment" and "Lists" menus** are like "¶": a button with `aria-haspopup="menu"` and the current value in its name ("Alignment: Align center", "List: numbered"), radio items with `aria-checked`, shortcuts labeled in the items; Enter, Space and `↓` open, Escape closes only the menu and returns focus to the button. Alignment and lists are menus rather than three toggle buttons each in a row: a value announced in the button's name and a check in the menu convey the same as `aria-pressed`, and the row is four buttons shorter — ADR-0054.
- **The "Table" menu** is the kit's `Menu` with submenus (`SubmenuTrigger`): a button with `aria-haspopup="menu"`, items with `›` having `aria-haspopup` and `aria-expanded`, "Header row" is `menuitemcheckbox`, column alignment is `menuitemradio`, and unavailable items get `aria-disabled` and stay in the arrow-key order. The "Table ›" submenu is a react-aria popover with a grid (the `grid` pattern from APG, `aria-activedescendant`, the size in words in a live region). Escape closes one level at a time, and in a `Dialog` the dialog goes last (ADR-0041). The "Insert table" dialog is the kit's `Dialog`: focus on open is in the "Columns" field, and on close it goes back to the Document. Tests: `tests/rich-text-editor-table-menu.test.tsx`, in the browser `tests-visual/rich-text-editor-table-menu.spec.ts`.
- **Emoji.** The button is `aria-haspopup="dialog"`; the popover is `role="dialog"` named "Emoji" (`editor.emoji`) with a `role="grid"` ("Choose an emoji") where focus stays on the grid and `aria-activedescendant` names the current cell, as in the table size grid. Categories are a `rowgroup` with a name ("Favorites", "Smileys"…), an emoji is a `gridcell` named from the message catalog (`editor.emojiName`: "Fire", "Red heart"), not by the symbol: screen readers pronounce symbols differently, and sometimes stay silent. The symbol in the cell is hidden from the screen reader. Escape closes the popover and returns focus to the Document.
- **Column layout.** Columns go in the markup left to right — the screen reader reads them in the same order, and they stack in the same order on a narrow screen. A column has no role of its own: it is a group of Document Blocks, not a widget. A Tab press that the Document handles (columns, list, table) does not reach the focus trap of the `Dialog` and `Drawer` around the field; a Tab press that it lets through (the last column on Tab, the first on Shift+Tab; a paragraph outside a list) moves focus on — there is no keyboard trap.
- **Wrapper.** It has no role of its own: it is a group of Document Blocks, not a widget, and the screen reader reads its Blocks in order, like the Blocks around it. `Tab` in a Wrapper is not intercepted — there is no keyboard trap; `Enter` in an empty last paragraph and the arrow keys at its edge move the caret out of a Wrapper. **A tone** adds no roles or `aria-*` — it is styling only: the meaning of a note ("Warning: …") is written by the author in words (WCAG 1.4.1). The "Tone ›" submenu is the kit's `Menu`: radio items with `aria-checked`, and the submenu item's name includes the current tone.
- **Details.** The opening button is a real `button` named from the catalog (`editor.detailsToggle`: "Details: {title}") with `aria-expanded`; it is in the Tab order, Enter and Space open the Block, and focus stays on the button. The content of a collapsed Block is hidden from both the screen reader and the caret. In `RichTextView` the Block is a native `details` and `summary`: the kit adds no role or name, the browser opens it, from the keyboard and without JavaScript. `Tab` in the Block is not intercepted — there is no keyboard trap.
- **Formulas.** KaTeX outputs HTML and MathML: a screen reader reads the MathML (which also carries the LaTeX source as an annotation), and the visual HTML is hidden from it with `aria-hidden`. The Popover is a dialog named "Formula" or "Block formula", focus goes straight into the LaTeX field, the error is in the field itself (`aria-invalid` and the text "Invalid LaTeX: …"), and Escape returns focus to the text. From the keyboard an inline formula is selected with `Shift+→`, and `Enter` on a selected one opens editing. In `RichTextView` the LaTeX source is visible before rendering.
- **Source mode.** The "HTML" button is a toggle with `aria-pressed`, in the Toolbar's arrow-key order like any button. The field is a native `textarea` named from the message catalog ("HTML source", `editor.sourceField`); the hint and error of `FormField` go into its `aria-describedby`, merged the same way as for the Document; `aria-invalid` mirrors the Document. Autocorrections are off: `spellcheck="false"`, `autocapitalize`, `autocorrect` and `autocomplete` are `off`, `dir="ltr"`. Tab and `Shift+Tab` are native: the field inserts no tab character, and there is no keyboard trap; undo inside the field is the ordinary text field undo. Entering puts focus in the field (caret at the start), leaving with the button puts it in the Document (caret at the end). `Alt+F10` moves focus from the field to the "HTML" button, as from the Document to the Toolbar: the Toolbar announces this shortcut in the mode too. The other Toolbar buttons in the mode are `aria-disabled`, in the arrow-key order. A click on the `FormField` label and a `required` failure move focus into the HTML field. Tests: `tests/rich-text-editor-source.test.tsx`, in the browser `tests-visual/rich-text-editor-source.spec.ts`.
- **Field notice and Status bar.** A `role="status"` live region is present in every Editor and is empty while there is no `status` notice; an error is `role="alert"` under the field. The Status bar is a container without `role` and `aria-live`: the kit does not announce it, and the screen wraps "Saved" in `role="status"` itself. The line is visible with `readOnly` and `disabled`, and the counter stays in `aria-describedby`. Tests: `tests/rich-text-editor-notice.test.tsx`; in the showcase — `StatusLine`, `StatusLineReadOnly`, `FieldNotice`.
- **Text card.** `role="dialog"` without `aria-modal`, named by the contribution's label (`label`); focus on open stays in the Document. A `role="status"` live region announces the appearance with the phrase `editor.textCardShown` including the label and the `Alt+F10` shortcut; `Alt+F10` moves focus into the Text card, and Escape returns the caret and hides it. See the "Text card" section.
- **Block selection.** The Field notice's `role="status"` announces the count ("Blocks selected: 3"), the end of the selection and the results of actions; the highlight is for sighted users only. The first `Esc` in the text selects the Block and does not close a `Dialog` or a `Drawer` (the second does): see the "Block selection" section.
- A task list item's checkbox is named from the message catalog (`editor.taskCheckbox`): "Done: <item text>".
- **Name.** The browser associates `<label for>` only with native form controls, and `contenteditable` is not one of them. So `FormField` publishes the `id` of its label through context, and the `RichTextEditor` inside it references the label through `aria-labelledby` and puts focus in the Document on a click on the label. For this the Editor needs no `id` and `FormField` needs no `htmlFor` (but set `htmlFor` out of habit — it does no harm). The Editor does not touch the label's DOM, it only listens for the click. An explicit `aria-label` and `aria-labelledby` outrank the label. If none of this is set, the name comes from the message catalog (`editor.label`) — there is no nameless field, but such a name says nothing about the content: give your own.
- The `FormField` hint and error are announced together with the field: their `id` values go into `aria-describedby` and are **merged** with its own description from the prop. An error sets `aria-invalid` and styles the frame as invalid; an explicit `aria-invalid` prop outranks it.
- **`required` works like the native one.** An empty Document (no text, no Atom — `hr`, an image, a custom Atom — and no table) blocks submission of an **ordinary** `<form>`: the browser shows a validation message with the text from the message catalog (`editor.required`, follows the kit's locale), and focus goes to the Editor. As soon as the Document has content, the block is lifted immediately, without waiting for `changeDelay`. In Source mode, emptiness is decided by the HTML field's text parsed by the Schema — also immediately, while typing (see the "Source mode" section). `readOnly` and `disabled` are not checked, as with native fields. The asterisk on the label comes only from `FormField required`.
- How it works: a hidden `<input type="hidden" name>` is **excluded from constraint validation by the specification**, and `contenteditable` is not form-associated, so next to it there is an invisible text field without `name` — it carries `setCustomValidity`, while the hidden field still puts the value into `FormData`.
- In the kit's `Form` (`noValidate`) the browser validates no field — there the consumer signals that a field is required through `FormField error`, as for `TextControl`.
- `readOnly` and `disabled` are announced with `aria-readonly` and `aria-disabled`.
- All strings come from the `editor.*` message catalog, with the Russian locale from `@olddevs/ui/locales/ru`. Key names in tooltips (`Ctrl`, `Shift`) are not translated: they are the legends on the keys.

**Manual testing** — outside CI, before releasing significant changes to the Editor: VoiceOver on macOS and iOS, NVDA, input through an IME (Japanese and Chinese), Android Chrome with Gboard, paste from Word and Google Docs.

## Anti-patterns

- Storing and showing the Editor's HTML without server-side sanitization.
- Showing a Document with footnotes twice on one page (the Editor and a `RichTextView` preview of the same HTML): both carry the same `fn-…` and `fnref-…` ids, and a jump in the second goes to the first.
- Storing the Markdown from `getMarkdown()` as the main value: color, highlight, alignment and underline are lost in it.
- Loading a JSON file with `ref.editor.commands.setContent(json)` instead of `setJSON()`: on a Block of a disabled Tool Tiptap silently replaces the whole Document with an empty one, attributes from the JSON pass without Schema rules, and the screen is not notified of the replacement through `onChange`.
- Storing the JSON envelope in the database instead of the HTML from `onChange`: the kit's server sanitization (`sanitizeRichText`) reads HTML, while the envelope is a file and template format.
- Allowing `style` on the server by bypassing `sanitizeRichText` (for example, by adding it to `ALLOWED_ATTR` of the bare config): the Editor writes it only as the author's color (`color:#rrggbb` on `span`, `background-color:#rrggbb` on `mark`), and any other CSS would not have come from it.
- Using the author's color where the Document is shown in several themes: unlike the palette, it does not follow the theme.
- Setting `changeDelay={0}` "just in case" on long Documents: the form gets fresh HTML before submission anyway.
- Setting a link with a `ref.editor` command that bypasses the popover, using a relative URL or a scheme outside `http`/`https`/`mailto`: in HTML such a link goes out without `href`.
- Putting an Editor with `toolbar="floating"` or `"bubble"` in a container with `overflow: hidden` right against its top edge: the Toolbar or the Bubble menu above the first line is clipped.
- Repainting the Editor's overlays with a solid color through the consumer's `className` or CSS: the Glass is removed by the system's transparency and contrast setting, and a hand-made background stops respecting that setting.
- Overriding the Bubble menu's token colors with your own: the inverse pair is checked for contrast in all themes and brands, and a hand-picked color is not. A brand of your own overrides `--accent-on-inverse` in its own CSS rule, like `--accent-strong`.
- Calling `ref.editor` methods as part of the kit's contract — Tiptap commands follow the engine's major versions; common tasks are covered by the Handle (`insertHTML`, `getText`, `focus`, `undo`), and `editor` is the escape hatch for commands of Marks, Blocks and custom Tools. The exception is `showNotice`: it is a kit command and follows semver.
- Building the buttons of your own toolbar without `preventDefault` on `mousedown`: a click takes focus out of the field, and the floating Toolbar together with the Bubble menu disappear.
- Reading `ref.current.editor.isActive(...)` during render of your own toolbar instead of `useRichTextEditorState`: the toolbar is not notified of a selection change and does not re-render.
- Wrapping the whole Status bar in `role="status"`: the word count would be read aloud on every edit. Announce only what is needed (`Saved`).
- Rendering your own error line under the field, duplicating the Field notice (paste and upload errors): `showNotice` already provides a line with `role="alert"`, and your own copy would be announced twice.
- Wrapping short labels and headings in `RichTextEditor`: it is a field for a Document, not for a line.
- Hiding a button with a style while leaving the Tool in `tools`: the Schema still lets it through — from a paste and by shortcut. Disable the Tool, not the button.
- Changing `tools` on a mounted field expecting the Schema to be rebuilt: the set is read when the engine is created.
- Conveying the meaning of a note by the Callout tone alone: a screen reader cannot see the background, a color-blind person cannot tell the tones apart, and in Markdown without alert support only a quote remains. Write it in words — "Warning: …" (WCAG 1.4.1).
- Coloring text inside a Wrapper that has a tone with a palette color or a custom color: on a colored background its contrast may fall below 4.5:1 — the gate checks the Document's main and secondary text, not the author's color.
- Changing `tool(…)` on a mounted field expecting new options: they are read when the engine is created, like `tools`. To change options, remount the field with a key.
- Taking the number of Find matches or the headings of the Table of contents from `ref.current.editor`, from the Document's DOM or from internal plugin keys: that is not the kit's contract and it follows the Tiptap major. Use `useRichTextToolState` for this.
- Calling `openSearch()` in new code: the method is deprecated and will disappear in 5.0. Use `tool("search")?.open()`.
- Writing `tool("bold", …)` or options the Tool does not have in `tools`: the compiler stops it, and in JS without types the extra option is dropped with a `console.error`.
- Keeping the `blockSelection` Tool (it is in `full`) in a comment field inside a `Dialog` or a `Drawer` and expecting one `Escape` to close the window: the first `Escape` in the text selects the Block, and the window closes on the second. Use `preset="basic"` or an exact `tools` list without it for such a field.
- Reading the selected Blocks from `ref.current.editor.state.selection` or from the `.rte-block-selected` class: that is not the kit's contract. Use `useRichTextToolState(ref, "blockSelection")` for the count and `handle.tool("blockSelection")` for the commands.

## Links

- Source: `src/editor/RichTextEditor.tsx`; the Toolbar is `src/editor/ui/EditorToolbar.tsx`, the formatting menus ("¶", "…", "Alignment", "Lists") are `src/editor/ui/FormatMenus.tsx` and `src/editor/core/blockTypes.ts`, the floating one is `src/editor/ui/FloatingToolbar.tsx`, the Bubble menu is `src/editor/ui/SelectionBubble.tsx`, the shared display condition and position are `src/editor/ui/selectionMenu.ts`; the link is `src/editor/features/link/link.ts`, the Tool description `src/editor/features/link/linkTool.tsx` and the URL form `src/editor/features/link/LinkPopover.tsx`; emoji are the Tool description `src/editor/features/emoji/emojiTool.tsx` and the grid `src/editor/features/emoji/EmojiGrid.tsx`; buttons from Tool descriptions and the frame of their popovers are `src/editor/ui/ToolButtonView.tsx`, their shortcuts are `src/editor/core/toolButtons.ts`, the shortcuts of their Insert items and Block actions are `src/editor/core/toolEntryShortcuts.ts`; the image is `src/editor/features/image/image.ts` (node, upload, file paste), `src/editor/features/image/ImagePopover.tsx`, `src/editor/features/image/ImageToolbar.tsx`; the Field notice is the command `src/editor/core/fieldNotice.ts`, the file texts `src/editor/features/image/imageNotice.ts`, the live region, the error line and the Status bar `src/editor/ui/FieldStatus.tsx`; a custom Tool is the public form `src/editor/core/customTool.ts`, the engine and set validation `src/editor/core/customToolEngine.ts`, the `tools` expansion and the options of built-in Tools `src/editor/features/builtins.ts`; `tool()` and the `RichTextTools` map `src/editor/core/toolOptions.ts`, the command types `src/editor/core/toolCommands.ts`, the state types `src/editor/core/toolState.ts`, the state hook `src/editor/hooks/useRichTextToolState.ts`, the Find and Table of contents descriptions `src/editor/features/search/searchTool.ts` and `src/editor/features/toc/tocTool.ts`; the table is `src/editor/features/table/tables.ts` (nodes, merging, alignment, Markdown), `src/editor/features/table/tableActions.ts` (menu commands, sorting, size memory), `src/editor/features/table/TableMenuButton.tsx` (the "Table" menu), `src/editor/features/table/TableSizeGrid.tsx` and `src/editor/features/table/TableInsertDialog.tsx`; the Column layout is `src/editor/features/layout/layout.ts` (nodes, commands, keyboard) and `src/editor/features/layout/columnLayouts.ts` (variants as data); the Wrapper is `src/editor/features/wrapper/wrapper.ts` (node, insertion, unwrapping, tone, keyboard, Markdown) and `src/editor/features/wrapper/wrapperTones.ts` (tones and GitHub alerts labels as data); the Details Block is `src/editor/features/details/details.ts` (nodes, insertion, unwrapping, keyboard), `detailsMarkdown.ts` (Markdown as raw HTML) and `detailsTool.ts` (the Tool description); the Document with Block containers is `src/editor/core/document.ts`; the Handle is `src/editor/core/handle.ts`, the hook is `src/editor/hooks/useRichTextEditorState.ts`; Source mode is the state and applying in `src/editor/RichTextEditor.tsx`, HTML formatting in `src/editor/core/sourceFormat.ts`; Tools and Presets are `src/editor/core/tools.ts`; Block commands are `src/editor/core/blockCommands.ts`; the Block handle is `src/editor/ui/BlockHandle.tsx`; the shortcut table and labels are `src/editor/core/shortcuts.ts`, the Keyboard shortcuts popover is `src/editor/ui/ShortcutsButton.tsx`; the Glass of overlays is `src/editor/styles/glass.ts`; the Slash menu is `src/editor/core/insertItems.ts` (the item registry), `src/editor/ui/SlashMenu.tsx`, `src/editor/ui/InsertMenuButton.tsx`, `src/editor/core/slashCommand.ts`; the Schema as data is `src/editor/core/schema.ts`; the palette and alignments are `src/editor/styles/palette.ts`, the color extensions are `src/editor/features/color/styleExtensions.ts`; the author's color is the form and parsing `src/editor/features/color/customColor.ts`, contrast `src/editor/features/color/contrast.ts`, the popover `src/editor/features/color/CustomColorPopover.tsx`; typography is `src/editor/styles/prose.ts`; the code block is `src/editor/features/code/codeBlock.ts` (extension, aliases, `Alt+F10`), `src/editor/features/code/CodeBlockView.tsx` (the header: language and "Copy"), `src/editor/features/code/CodeCopyButton.tsx` (the button with a tooltip), `src/editor/features/code/codeHeader.ts` (header classes shared with the View), the Paper (`surface="paper"`) is `src/editor/styles/surface.ts` and `src/editor/styles/tokens.ts`, `src/editor/features/code/codeLanguages.ts` (languages as data), `src/editor/features/code/lowlight.ts` (grammars), `src/editor/styles/codeTheme.ts` (the syntax highlighting theme), the server helper is `src/editor/features/code/highlight.ts`; find and replace is `src/editor/features/search/searchTool.ts` (the Tool), `src/editor/features/search/searchPlugin.ts` and `src/editor/features/search/SearchPanel.tsx`; JSON is `src/editor/core/jsonDocument.ts`; Field height is the resize handle `src/editor/ui/FieldResizer.tsx`; emoji (the set's data) is `src/editor/features/emoji/emoji.ts`; the character limit is `src/editor/core/maxLength.ts`; Markdown is `src/editor/core/markdown.ts`.
- Image alignment source: `src/editor/features/image/imageLayout.ts` (the rules that tie the side to the width), `src/editor/features/image/ImageAlignGroup.tsx` (the three toggles), the keys in `src/editor/features/image/image.ts` and `src/editor/features/color/styleExtensions.ts`, the float and `clear` rules in `src/editor/styles/prose.ts` (`IMAGE_ALIGN_CLASS`) and the paste step `src/editor/features/pasteCleanup/imageAlignment.ts`. Tests: `tests/rich-text-editor-image-align.test.tsx`, `tests/rich-text-editor-image-align-ui.test.tsx`, `tests/rich-text-editor-image-align-handles.test.tsx`, `tests/rich-text-image-align-css.test.tsx`, `tests/editor-sanitize-image-align.test.tsx` and `tests/editor-paste-cleanup-image-alignment.test.tsx`. Storybook: `ImageAlignment`, `ImageAlignmentNarrow`, `ImageAlignmentInColumn`, `ImageAlignmentPasteFromWord`, `ImageAlignmentRussian` and `ImageAlignmentView`.
- Block selection source: `src/editor/features/blockSelection/` (the Tool, the keys, the moves), the selection itself `src/editor/core/blockSelection.ts`, the Block unit `src/editor/core/blockUnit.ts`, the group actions `src/editor/core/blockWrap.ts` and `src/editor/core/blockTurn.ts`.
- Tests: `tests/rich-text-editor-footnotes.test.tsx`, `tests/rich-text-editor-footnotes-markdown.test.tsx` and `tests/rich-text-editor-footnotes-schema.test.tsx` (footnotes), `tests/rich-text-editor-block-selection.test.tsx` (Block selection, `Esc` in `Dialog` and `Drawer`) and `tests/rich-text-editor-block-range.test.tsx` (the Block handle over a range), `tests/rich-text-editor-text-card.test.tsx` (Text card), `tests/rich-text-editor.test.tsx`, `tests/rich-text-editor-handle.test.tsx` and `tests/rich-text-editor-handle-ssr.test.tsx` (Handle and hook), `tests/rich-text-editor-toolbar.test.tsx`, `tests/rich-text-editor-block-menu.test.tsx`, `tests/rich-text-editor-more-menu.test.tsx`, `tests/rich-text-editor-align-list-menus.test.tsx`, `tests/rich-text-editor-insert-menu.test.tsx`, `tests/rich-text-editor-schema.test.tsx`, `tests/rich-text-editor-markdown.test.tsx`, `tests/rich-text-editor-color.test.tsx`, `tests/rich-text-editor-custom-color.test.tsx`, `tests/rich-text-editor-link.test.tsx`, `tests/rich-text-editor-floating.test.tsx`, `tests/rich-text-editor-bubble.test.tsx`, `tests/rich-text-editor-glass.test.tsx`, `tests/rich-text-editor-table.test.tsx`, `tests/rich-text-editor-lazy-builtins.test.tsx` (lazy code block and table: `basic` does not load them, `full` shows a Skeleton until the chunks load), `tests/rich-text-editor-image.test.tsx`, `tests/rich-text-editor-notice.test.tsx`, `tests/rich-text-editor-code-block.test.tsx`, `tests/rich-text-editor-block-commands.test.tsx`, `tests/rich-text-editor-block-handle.test.tsx`, `tests/rich-text-editor-shortcuts.test.tsx`, `tests/rich-text-editor-layout.test.tsx`, `tests/rich-text-editor-wrapper.test.tsx`, `tests/rich-text-editor-wrapper-tone.test.tsx`, `tests/rich-text-editor-details.test.tsx`, `tests/rich-text-editor-mathematics.test.tsx`, `tests/rich-text-editor-mathematics-lazy.test.tsx` (formulas: Slash menu, Popover, Markdown, without the Tool; laziness and Skeleton), `tests/editor-sanitize-mathematics.test.tsx` and `tests/rich-text-view-mathematics.test.tsx` (the sanitizer and the View's Island), `tests/rich-text-editor-source.test.tsx`, `tests/rich-text-editor-custom-tool.test.tsx` (a custom Tool; test Tools are in `tests/editor-test-tools.ts`), `tests/rich-text-editor-custom-ui.test.tsx` (Insert items and Block actions of a custom Tool), `tests/rich-text-editor-trigger.test.tsx` (a custom Trigger character: opening, picking, the query, asynchronous items, set errors), `tests/rich-text-editor-custom-button.test.tsx` (buttons of a custom Tool), `tests/rich-text-editor-custom-markdown.test.tsx` (Markdown of a custom Block by default and by its own rules), `tests/rich-text-editor-atom-text.test.tsx` (Atom text, the count toward `maxLength`, emptiness), `tests/rich-text-editor-empty-table.test.tsx` (an empty table is content), `tests/rich-text-editor-max-height.test.tsx` (`maxHeight` and `resizable`: what is inside the scroll area, the position of the Block handle during scrolling), `tests/rich-text-editor-events.test.tsx` (`onReady`, `onFocus`, `onBlur`, paste and drop order), `tests/rich-text-editor-loaders.test.tsx` (Extensions Loaders, "Retry"), `tests/rich-text-editor-skeleton.test.tsx` (Skeleton), `tests/rich-text-editor-emoji.test.tsx` (emoji), `tests/rich-text-editor-json.test.tsx` (JSON), `tests/editor-search.test.tsx`, `tests/editor-search-panel.test.tsx` and `tests/editor-search-replace.test.tsx` (find and replace), `tests/rich-text-editor-tool-options.test.tsx` and `tests/editor-tool-options-types.test.ts` (`tool()` options), `tests/rich-text-editor-tool-state.test.tsx`, `tests/rich-text-editor-tool-state-ssr.test.tsx` and `tests/editor-tool-state-types.test.ts` (state), `tests/rich-text-editor-tool-commands.test.tsx`, `tests/editor-search-commands-reveal.test.tsx` and `tests/editor-tool-commands-types.test.ts` (`handle.tool()` commands), `tests/rich-text-editor-define-tool.test.tsx`, `tests/editor-define-tool-types.test.ts` and `tests/editor-define-tool-server.test.tsx` (`defineTool`), `tests/rich-text-paper.test.tsx`, `tests/rich-text-paper-css.test.tsx`, `tests/editor-entry.test.ts`, `tests/editor-schema-entry.test.ts`, `tests/editor-highlight-entry.test.ts`; in the browser — `tests-visual/interactions.spec.ts` ("RichTextEditor inside Dialog" — Escape in the style list, in the Slash menu, in the link popover and in the code block language menu; "RichTextEditor inside-dialog" and "inside-drawer" — the "…" menu and the color popovers with mouse and keyboard; "RichTextEditor insert menu"; "RichTextEditor block commands" — real `⌥⇧↑/↓`, `⌘]`, `⌘[` and `⌘⇧D`), `tests-visual/rich-text-editor-image.spec.ts` (file drag and width handles), `tests-visual/rich-text-editor-bubble.spec.ts` (the Bubble menu in `Dialog`, `Drawer` and a scroll container, at the viewport edge, the inverse surface in three themes), `tests-visual/rich-text-editor-layout.spec.ts` (Column layout in a `Dialog`: columns side by side and Tab across them, arrow keys, a stack on a phone), `tests-visual/rich-text-editor-wrapper.spec.ts` (Wrapper: a dashed outline in the Editor and no frame in `RichTextView`, the tone looks the same in both, exit with Enter, `↑` out of a Wrapper), `tests-visual/rich-text-editor-mathematics.spec.ts` (formulas: KaTeX rendering with its fonts, the Skeleton, the Popover, the View's Island, axe), `tests-visual/rich-text-editor-details.spec.ts` (the Details Block: opening in the Editor and in `RichTextView`, the button from the keyboard), `tests-visual/rich-text-editor-block-handle.spec.ts` (the handle menu in a `Dialog`: `Ctrl/⌘+/`, Escape by levels; the handle's position at the Block's first line), `tests-visual/rich-text-editor-trigger.spec.ts` (a custom Trigger character: the list at the caret, real typing of `@`, picking by mouse and Enter, `a@b` inside a word, axe in three themes), `tests-visual/rich-text-editor-source.spec.ts` (Source mode: field height, growth with content, focus on entry and exit), `tests-visual/rich-text-editor-height.spec.ts` (Field height), `tests-visual/rich-text-editor-emoji.spec.ts` (emoji), `tests-visual/rich-text-editor-skeleton.spec.ts` (Skeleton).
- The extension API at a glance, "Stability" and recipes — [Editor extension API](../../api/editor-extension.md).
- Viewing without editing — [RichTextView](../content/rich-text-view.md).
- Storybook: `Inputs/RichTextEditor` (the `SearchStatusLine`, `TableOfContentsOptions`, `TableOfContentsExternalNavigation`, `ToolCommands`, `DefinedTool` and `DefinedToolConfigured` stories; `BlockHandleOverRange`, `BlockHandleOverRangeMenu`, `BlockSelection`, `BlockSelectionPaper`, `BlockSelectionInList`, `BlockSelectionInColumns`, `BlockSelectionInDialog`, `BlockSelectionReadOnly` and `BlockSelectionRussian` for Block selection).
- Code origin: minimal-tiptap (MIT); syntax highlighting theme colors — highlight.js (BSD-3-Clause); licenses are in the package `NOTICE`.

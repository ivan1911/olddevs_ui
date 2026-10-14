# @olddevs/ui

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

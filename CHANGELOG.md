# @olddevs/ui

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

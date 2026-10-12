# @olddevs/ui

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

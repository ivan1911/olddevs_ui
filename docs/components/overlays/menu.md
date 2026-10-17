---
component: Menu
exports: [Menu, MenuButton, MenuItem, MenuSection, MenuSeparator, MenuTrigger, SubmenuTrigger]
category: overlays
status: stable
source: src/components/overlays/Menu.tsx
story: src/components/overlays/Menu.stories.tsx
---

# Menu

## Summary for AI

`Menu` is a compound action menu opened by `MenuTrigger`. Inside `MenuTrigger`,
use the dedicated `MenuButton`, not a regular `Button`: only it reads react-aria's
`ButtonContext`. The menu suits heterogeneous commands, sections, checkable items
and submenus; it is not for choosing a field value. A nested `Menu` inside
`SubmenuTrigger` opens beside its item on its own, and below it on a narrow
screen: you do not need to set `placement`. The "menu aim" (protection that keeps a
submenu from closing while the pointer travels toward it) comes from react-aria;
do not write your own.

## When to use

- Contextual actions for an entity, an overflow button, a sort or view menu.
- You need sections, a separator, a shortcut, a disabled/danger item or a submenu.
- Several checkable items belong to one `MenuSection`.

## When not to use

- Use `Select` to choose a value in a form, and `Combobox` for user input with
  a list of options.
- Use `ContextMenu` for a right-click menu.
- Do not use `Button` instead of `MenuButton`: the menu does not get the open/focus props.

## Minimal example

```tsx
<MenuTrigger>
  <MenuButton iconOnly aria-label="Actions" icon={<MoreIcon />} />
  <Menu>
    <MenuItem onAction={rename}>Rename</MenuItem>
    <MenuSeparator />
    <MenuItem tone="danger" onAction={remove}>
      Delete
    </MenuItem>
  </Menu>
</MenuTrigger>
```

## Public API

`MenuTrigger` and `SubmenuTrigger` re-export react-aria. `MenuButton` accepts
the props that set the button's look, `icon`, `children`, `disabled`, `aria-label`
and `className`; `aria-label` is required if the button has no text, and with
`iconOnly` it never does. `Menu` accepts the usual `AriaMenuProps`, plus `offset`,
the gap between the panel and the button in pixels (default 6), and `placement`,
the side where the panel opens (default for the root menu `bottom start`; also
`bottom end`, `top start`, `top end`, `end top`, `start top`, `right top` and
`left top`; the submenu default is described below). `end top` and `start top`
open beside the panel at the end or the start of the line, so they swap sides in
right-to-left writing; `right top` and `left top` don't depend on the writing
direction.

`MenuItem` accepts the `AriaMenuItem` props, `icon`, `shortcut`, `tone`,
`disabled` and `className`; pass the action in `onAction`. `MenuSection` accepts
`label` and the react-aria selection props. For toggles, set `selectionMode`,
`selectedKeys` and `onSelectionChange` on the section, not `checked` on the item.
`MenuSeparator` separates groups.

A submenu, a `Menu` inside a `SubmenuTrigger`, opens to the right of its item by
default, with its top edge level with the item. When there is not enough room on
the right, react-aria flips it to the left. In a right-to-left layout everything is
mirrored: the submenu opens to the left of its item. On a narrow screen (up to 639px wide)
there is no room on either side, so the submenu opens below its item, over the
parent menu. An explicit `placement` on the nested `Menu` wins over the default,
phones included; to pick the side yourself without breaking right-to-left
writing, use `end top` or `start top`. The root menu opens as before, at `bottom start`. The Editor's
submenus follow the same rule.

Moving the pointer diagonally toward a submenu neither closes it nor switches to a
neighboring item: this "menu aim" is handled by react-aria's `SubmenuTrigger`. The kit
does not replace it and adds none of its own, so do not write one on top of it.

react-aria sets the menu panel's height from the visible area. Items that do
not fit scroll inside the panel (`overflow-y: auto`, the scroll does not leak to
the page) instead of being rendered past its edge over the content. On iOS the panel
overrides the height that react-aria computed with its own — 24rem or 60% of the
dynamic screen height, whichever is smaller: in Safari on iOS 27 react-aria gave
the panel a height of about zero. The same applies to `ContextMenu`: they share
the look of the panel.

On a touch screen without hover (`hover: none` and `pointer: coarse`) items do not
show `shortcut`: there is no keyboard there. The shortcut cannot be turned off
with a prop and does not need to be — on desktop and with a trackpad it is visible as
before.

## Accessibility and keyboard

react-aria provides the menu roles, focus management and keyboard navigation.
`Menu` is already wrapped in a `Popover`. A section item with `selectionMode` gets the correct
role and `aria-checked` from the library. Inside a `Dialog` or a `Drawer`, the
first Escape closes the menu and the next one closes the dialog; an item can be
chosen with both mouse and keyboard, and a click on an item does not close the
dialog. This cross-library contract is checked in Storybook and a browser test;
a rule in `@olddevs/ui/styles.css` restores the panel's pointer events inside
Radix's modal layer. See [the Menu source](../../../src/components/overlays/Menu.tsx).

## Good examples

- A "View" section with `selectionMode="multiple"`.
- `SubmenuTrigger` with a `MenuItem` as the first child and a nested `Menu` as the second.
- `shortcut` as a visual hint, while handling the shortcut stays the app's job.

## Anti-patterns

- Managing the selected state on `MenuItem` by hand.
- Using a menu as navigation between pages or tabs.
- Putting interactive forms inside an ordinary menu item.

## Related sources and Storybook

- `src/components/overlays/Menu.tsx`, `src/lib/menu.ts`
- `src/components/overlays/Menu.stories.tsx`

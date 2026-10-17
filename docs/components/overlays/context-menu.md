---
component: ContextMenu
exports:
  [
    ContextMenu,
    ContextMenuCheckboxItem,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuRadioGroup,
    ContextMenuRadioItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
  ]
category: overlays
status: stable
source: src/components/overlays/ContextMenu.tsx
story: src/components/overlays/ContextMenu.stories.tsx
---

# ContextMenu

## Summary for AI

`ContextMenu` is an action menu for a right click and the context menu key.
It uses Radix but looks like `Menu`. For an ordinary click-trigger menu choose
`Menu`; do not imitate a right click by hand.

## When to use

- Quick actions on a card, a table row, a canvas element or a file.
- You need a nested submenu or an independent checkbox item.
- The trigger has a clear target that the actions apply to.

## When not to use

- Use `Menu` or plain `Button` components for the main visible action bar.
- Use `Select` or `Combobox` to pick a form value.
- Do not open a context menu without a target element just for the sake of a visual menu.

## Minimal example

```tsx
<ContextMenu>
  <ContextMenuTrigger>
    <Card>File</Card>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onSelect={edit}>Rename</ContextMenuItem>
    <ContextMenuItem tone="danger" onSelect={remove}>
      Delete
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

## Public API

`ContextMenu`, `ContextMenuTrigger` and `ContextMenuSub` re-export Radix `Root`,
`Trigger` and `Sub`. `ContextMenuContent` creates a portal and accepts `children`/
`className`. `ContextMenuItem` accepts `children`, `icon`, `shortcut`,
`tone`, `disabled`, `onSelect`, `className`. `ContextMenuCheckboxItem` adds
controlled `checked` and `onCheckedChange` right on the item — unlike `Menu`.

`ContextMenuRadioGroup` and `ContextMenuRadioItem` implement single selection: the value
is set on the group (`value`, `onValueChange`), the item carries only its own
`value`. The selection lives on the group precisely because "exactly one is
selected" is a property of the group: an item that does not know its group has no
way to set `aria-checked="false"` on the other items. An item of this kind has no
icon of its own: the check mark occupies the slot.

`ContextMenuLabel` and `ContextMenuSeparator` give the menu its structure. For a submenu,
wrap `ContextMenuSubTrigger` and `ContextMenuSubContent` in `ContextMenuSub`.
The sub-trigger accepts `children`, `icon`, `className`; the sub-content accepts
`children` and `className`.

## Accessibility and keyboard

Radix provides the role, focus management, checkbox selection and keyboard
access to the context menu. Do not replace `ContextMenuCheckboxItem` with a plain
item with a checkmark you render yourself: you would lose `menuitemcheckbox` and
`aria-checked`.

The same goes for single selection: a list with one marked item is a
`ContextMenuRadioGroup`, not a set of plain items with a checkmark on the current
one and not checkboxes. A checkbox also promises multiple selection, which is not
available here.

`shortcut` is only displayed; handling the command stays in the app. See [the ContextMenu source](../../../src/components/overlays/ContextMenu.tsx).

## Good examples

- A right click on a card with a `ContextMenuLabel`, actions and a separator.
- A controlled checkbox "Dense grid" through `checked`/`onCheckedChange`.
- A nested "Move to…" submenu built with `ContextMenuSub`.
- Choosing one value from a list — a `ContextMenuRadioGroup` inside a submenu.

## Anti-patterns

- Mixing the `MenuSection` API with `ContextMenuCheckboxItem`.
- Showing single selection with checkboxes or plain items with a checkmark.
- Relying on `shortcut` as a real keybinding.
- Hiding the only way to perform a key operation behind a right click.
- Wrapping the content of a `VirtualGrid` cell in a `ContextMenu`: Shift+F10 does
  not open the menu, and a click on an item selects the cell. Cells have the
  `contextMenu` property ([VirtualGrid](../content/virtual-grid.md)).

## Related sources and Storybook

- `src/components/overlays/ContextMenu.tsx`, `src/lib/menu.ts`
- `src/components/overlays/ContextMenu.stories.tsx`

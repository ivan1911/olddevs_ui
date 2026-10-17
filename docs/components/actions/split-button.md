---
component: SplitButton
exports: [SplitButton]
category: actions
status: stable
source: src/components/actions/SplitButton.tsx
story: src/components/actions/SplitButton.stories.tsx
---

# SplitButton

## Summary for AI

`SplitButton` is a primary action with a menu button for its variants next to it, as **two separate buttons**. The accessible name of the menu button is built from `label`, so `label` is a string, not a node. Menu items go in `children`.

## When to use

- The action has related variants: "Export" and next to it "to XLSX", "to JSON", "selected only".
- One of the actions is clearly the primary one, and making people open a menu for it is an extra step.

## When not to use

- If all the variants are equal, use a `MenuButton` with a menu and no highlighted action.
- If there are two variants and both are visible, use a `ButtonGroup` of two buttons.
- If the variants are display modes, not actions, use `Segmented` or `ToggleGroup`.

## Minimal example

```tsx
<SplitButton label="Export" onClick={exportAll} icon={<DownloadIcon aria-hidden />}>
  <MenuItem onAction={exportXlsx}>Export to XLSX</MenuItem>
  <MenuItem onAction={exportJson}>Export to JSON</MenuItem>
  <MenuSeparator />
  <MenuItem onAction={exportSelected}>Selected rows only</MenuItem>
</SplitButton>
```

## Public API

- `label` is a **string**: the label of the primary action and the source of the name of the menu button.
- `icon` is the icon on the left of the primary action. If a button can enter `loading`, give it an icon from the start: otherwise the loading indicator adds a slot, and the label shifts.
- `onClick` is called only by the primary action; the menu button does not call it.
- `variant`, `tone`, `size` are the same axes as on `Button` and mean the same thing.
- `disabled` and `loading` disable **both** buttons and close a menu that is already open — and **do not bring it back** when `disabled` or `loading` is lifted: otherwise the menu would open by itself once a submission ended.
- `placement` is the side the panel opens to, `bottom end` by default. The side values of `Menu` are narrowed here: a panel that slides sideways lands on top of the primary action.
- `children` is the menu content: `MenuItem`, `MenuSection`, `MenuSeparator`.
- `className` is applied to the **group**; on `Button`, the prop of the same name goes on the button. There are two elements here, and "a class on the button" has no unambiguous target.
- The remaining props are **not passed through** for the same reason: `id`, `type` or `data-*` have no unambiguous target. A button that has to submit a form needs a `Button` and a `MenuTrigger` side by side, assembled by hand.

## Why two buttons, not one with the menu in its right part

If the right part of a button opens a menu, the result is one element with two
different outcomes and one accessible name. The second outcome cannot be reached
from the keyboard at all, and a screen reader announces one action instead of
two. These are two separate controls.

## Why `label` is a string

The name of the menu button is built from the label. A node would give a name
that does not exist — or would require a second prop with the same label as a
string. One label would live in two places and drift apart at the first edit.

## Keyboard

- **Two tab stops, not one.** Tab goes to the primary action, the next Tab to the menu button. The whole rationale of the component rests on this: a single button whose right part opens a menu would leave the second outcome unreachable from the keyboard.
- The menu opens from the menu button with Enter, Space and Down Arrow — `MenuTrigger` does this.
- Escape closes the menu and **returns focus to the menu button** instead of sending it to `<body>`.
- Disabling the component while the menu is open closes the panel: otherwise it would look disabled while the items kept working.

## Accessibility and semantics

- The menu button's name comes from the message catalog: `splitButton.more({ action })` → "Другие действия: Экспорт" with `@olddevs/ui/locales/ru`, "More actions: Export" without a provider. Without the action's label, several menu buttons on a page are indistinguishable when read aloud by a screen reader.
- The menu button carries `aria-haspopup` and `aria-expanded` — `MenuTrigger` sets them.
- The group does not get `role="group"`: an unnamed group is an extra screen reader announcement, and a name would duplicate the button's label.
- See `src/components/actions/SplitButton.tsx`, `src/components/actions/SplitButton.stories.tsx`, `tests/split-button.test.tsx`, [Menu](../overlays/menu.md).

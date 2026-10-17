---
component: Toolbar
exports: [Toolbar, ToolbarProps]
category: actions
status: stable
source: src/components/actions/Toolbar.tsx
story: src/components/actions/Toolbar.stories.tsx
---

# Toolbar

## Summary for AI

An action bar with the `toolbar` role and a single tab stop: Tab enters it and
leaves it, arrow keys move focus inside, `Home` and `End` go to the edges, and returning to
the toolbar puts focus on the last used action. A wrapper over react-aria's
`Toolbar`. A name is required — `aria-label` or `aria-labelledby`. You can put
`Button`, `Toggle`, `ToggleGroup`, `Menu`, `SplitButton` and Radix triggers
(`Popover`, `ContextMenu`) inside without extra work; groups are divided by
`Separator`.

## When to use

- A row of several actions on one object — an editor, a viewer, a canvas — that
  a keyboard user works through one after another. Without a toolbar every action costs a
  tab stop, and the content after it cannot be reached.
- The actions are grouped by meaning and are conveniently divided with a `Separator`.
- A component built ahead of demand (ADR-0048): nobody had asked for it at release,
  and the API was modeled on its analogs — Radix `Toolbar`, React Aria `Toolbar`,
  Fluent 2 `Toolbar`, MUI X `Toolbar`. Your screen is the first test of this API,
  not a violation of the contract.

## When not to use

- For a bar above a table with a title, a counter, search and filters, use
  `TableToolbar`. It deliberately has **no** `toolbar` role: arrow keys inside a
  search field belong to the caret, and the toolbar intercepts them in the
  capture phase (see below). This is not an omission but a decision — [the page](../table/toolbar.md).
- For actions on selected rows, use `SelectionBar`; for a page header with
  buttons, use `PageHeader`.
- For two or three buttons that nobody works through one by one with the
  keyboard, an ordinary `ButtonGroup` or a `flex` row with `gap` is enough. The
  `toolbar` role promises the screen reader a keyboard model — do not add it for
  layout.
- For choosing a section, use `Tabs`; for a display mode, use `Segmented`.
- Input fields (`TextControl`, `SearchControl`, `Select` with a text field) do
  not work in a toolbar the way people expect: the toolbar takes the arrow keys
  along its axis away from them, and the caret no longer moves through the text.
  Move the field outside the toolbar.

## Minimal example

```tsx
import { Button, MenuItem, Separator, SplitButton, ToggleGroup, Toolbar } from "@olddevs/ui";

<Toolbar aria-label="Document tools">
  <ToggleGroup
    aria-label="Text style"
    options={[
      { id: "bold", label: "B", "aria-label": "Bold" },
      { id: "italic", label: "I", "aria-label": "Italic" },
    ]}
    value={style}
    onChange={setStyle}
  />
  <Separator />
  <Button variant="ghost" onClick={copy}>
    Copy
  </Button>
  <Separator />
  <SplitButton label="Export" onClick={exportPdf}>
    <MenuItem>Export to PNG</MenuItem>
  </SplitButton>
</Toolbar>;
```

## Public API

| Prop                             | Default      | Meaning                                                                                                                       |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `aria-label` / `aria-labelledby` | —            | **Exactly one of the two is required**: a string or the `id` of a visible heading. Both at once, or neither, is a type error. |
| `orientation`                    | `horizontal` | The arrow axis: `horizontal` — left and right, `vertical` — up and down; a vertical toolbar stacks its actions in a column.   |
| `children`                       | —            | The actions and a `Separator` between their groups.                                                                           |
| `className`                      | —            | Classes on the toolbar element.                                                                                               |

`ref` points to the toolbar element (`forwardRef`, as in the rest of the kit). The
other props (`id`, `data-*`) are not passed through: the toolbar is a layout with
behavior, not a wrapper for an arbitrary `div`.

The name is required at the type level, not by convention: an unnamed `toolbar`
is announced by the screen reader as "toolbar" with no hint of what it is for,
and there are usually several on a screen. The type picks exactly one source of
the name — a second one would drift from the first on edit. This is the kit's
general rule for components without a visible label — [conventions.md](../../conventions.md#accessible-name).

## A separator between groups

The kit's `Separator` inside a toolbar lays itself out **across the toolbar's
axis**: a vertical separator in a horizontal toolbar and a horizontal one in a
vertical toolbar. The axis comes through the react-aria context; an
`orientation` set on the separator itself always wins. Outside a toolbar `Separator` is still horizontal.

React context passes through portals, so the kit's overlays — `PopoverContent`,
`Dialog` and `Drawer` — reset the toolbar axis at their boundary: a `Separator`
and a `ToggleGroup` in a popover or dialog opened from the toolbar behave as if
outside it. The popup of the react-aria `Menu` resets the separator's context by itself. In a
portal built directly on Radix, the toolbar axis reaches the content — set the
separator's `orientation` explicitly there.

## Overflow

In a horizontal toolbar the actions **wrap onto a second row** (`flex-wrap`), as
in `Segmented`, `PageHeader` and `SelectionBar`. There is no "more" menu and no
priority+, and none is planned: a hidden action is unreachable by default, while
wrapping hides nothing. The arrow-key order is the markup order, that is, the reading
order. A vertical toolbar does not wrap: its height is set by the consumer's
layout, and its width follows the content.

Wrapping works element by element, and a `Separator` is an element like any other:
when the toolbar wraps, a separator may end up at the end of a row. This is the
accepted price of simplicity; CSS cannot hide separators at row boundaries, and the toolbar will not
count rows in JS.

## Keyboard

- **Tab** enters the toolbar with one stop and leaves it with one — however many
  actions it holds.
- **Arrow keys** along the toolbar's axis (`←`/`→` or `↑`/`↓`) move to the adjacent
  action. The edges **do not wrap around**: a loop would hide that the actions
  have run out. Unavailable (`disabled`) actions are skipped; an action with
  `aria-disabled` (for example, `Button asChild disabled`) stays in the arrow-key navigation order, as the
  [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) (APG) advises.
- **Home** and **End** go to the first and last action — the same ones the arrow keys
  stop at (actions hidden by styling do not count as an edge). The component adds
  this itself: the react-aria hook does not handle them. In a text field, on a
  slider and in composite widgets with their own Home and End (list, tabs, grid,
  tree) the keys stay with them; on a checkbox and a radio button they do not, since
  those have no caret.
- **Coming back**: Tab moves focus to the toolbar's edge only so that the browser
  leaves it; on the way back focus lands on the action it left, not on the edge.
  If that action is gone, the toolbar's edge gets focus.
- **The cross-axis arrow keys are left alone.** In a horizontal toolbar `↓` still
  opens `Menu` and `SplitButton`. In a vertical one the Down Arrow and Up Arrow
  keys are taken by arrow-key navigation — a menu there opens with Enter or Space.

## What goes inside: verified

| Content                                              | Arrow keys | Comment                                                                                                                                |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`, `Toggle`                                   | yes        | —                                                                                                                                      |
| `ToggleGroup`                                        | yes        | A nested group does not take the arrow keys from the toolbar; in a vertical toolbar it stacks into a column                            |
| `MenuTrigger` + `MenuButton` + `Menu` (react-aria)   | yes        | The list of menu items is rendered in a portal: arrow keys inside an open menu belong to the menu; Escape returns focus to the trigger |
| `SplitButton`                                        | yes        | Both buttons are separate stops in arrow-key navigation; the primary action and the menu work the same as outside a toolbar            |
| `Popover` + `PopoverTrigger asChild` (Radix)         | yes        | The trigger is an ordinary button; focus inside the popover content moves by its own rules                                             |
| `ContextMenu` + `ContextMenuTrigger asChild` (Radix) | yes        | The trigger is a button; the menu opens on `contextmenu`; Escape returns focus to the button                                           |

`ContextMenuTrigger` **without `asChild`** wraps an arbitrary `span`, which does not
receive focus and is not part of arrow-key navigation: there is no keyboard path to such a
menu from the toolbar. If a context menu is the only way to reach the actions,
duplicate them with a button.

## Accessibility and semantics

- react-aria sets the `toolbar` role and `aria-orientation`; the name comes from
  the required props.
- A nested group (`ToggleGroup`, a named `ButtonGroup`) inside a toolbar gets the
  `group` role, not a second `toolbar`.
  The toolbar hook then puts an `aria-orientation` on the group, which is not
  allowed for the `group` role (axe: `aria-allowed-attr`, critical) — the kit's
  `ToggleGroup` removes this attribute itself. If you build a group on react-aria's
  `ToggleButtonGroup`, remove `aria-orientation` from it yourself.
- The arrow-key behavior is key interception in the capture phase, not roving tabindex: the
  toolbar's elements keep their own tab stops, and Tab leaves by programmatically
  moving focus to the edge. As a result, **any** input field inside loses the
  arrow keys along the toolbar's axis.

## Anti-patterns

- A `Toolbar` without a name — the types will not allow it; do not hide this
  with a cast.
- Putting a search field or a numeric field in a toolbar — the arrow keys
  no longer move the caret. This is also why `TableToolbar` has no role.
- Building a "more" menu out of the overflow — the actions wrap instead of
  being hidden.
- Adding a toolbar for three buttons in a row — it is an extra screen reader
  announcement and a promise of a keyboard model nobody asked for.
- Expecting `ContextMenuTrigger` without `asChild` to be a stop in arrow-key navigation.

## Related sources and Storybook

- Source: `src/components/actions/Toolbar.tsx`; the separator's axis — `src/components/content/Separator.tsx`.
- Tests: `tests/toolbar.test.tsx` (the contract), `tests/toolbar-compat.test.tsx`
  (compatibility with `Menu`, `SplitButton` and Radix triggers).
- Showcase: `src/components/actions/Toolbar.stories.tsx`. Level — periphery
  (ADR-0014): no snapshots. Wrapping on a narrow screen and browser behavior
  were checked by hand on the built showcase.

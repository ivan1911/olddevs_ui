---
component: SelectionBar
exports: [SelectionBar, useStickyOffset]
category: navigation
status: stable
source: src/components/navigation/SelectionBar.tsx, src/hooks/useStickyOffset.ts
story: src/components/navigation/SelectionBar.stories.tsx
sourceHash: 1463db91349e
---

# SelectionBar and useStickyOffset

## Summary for AI

`SelectionBar` is a bulk-actions bar: "12 selected" and what can be done with them. The counter comes from the message catalog with plural forms for the locale; `countLabel` overrides it when you need to name the entity ("12 documents selected"). The bar sticks under the application's top bar and takes its actual height from a CSS variable. `useStickyOffset` is the same stickiness mechanism on its own, for your own bars.

## When to use

- A list or grid supports selecting several objects, and there are actions that apply to them.
- There is more than one action: a single one is better shown right in the object's row.

## When not to use

- For actions on a **single** object, use the row menu (`Menu`) or buttons at the end of the row.
- A filter bar does not fit: it has no count of selected items and no "clear selection".
- For confirming a destructive action, use `ConfirmDialog`.

## Minimal example

```tsx
import { Button, SelectionBar } from "@olddevs/ui";

<SelectionBar
  count={selected.size}
  countLabel={(n) => `${n} ${n === 1 ? "document" : "documents"} selected`}
  onClear={clearSelection}
  secondary={<button onClick={selectAll}>Select all ({total})</button>}
>
  <Button size="sm" icon={<CalendarIcon />} onClick={schedule}>
    Schedule
  </Button>
  <Button size="sm" variant="outline" tone="danger" icon={<DeleteIcon />} onClick={remove}>
    Delete
  </Button>
</SelectionBar>;
```

## Public API

| Prop         | Default                | Meaning                                                                   |
| ------------ | ---------------------- | ------------------------------------------------------------------------- |
| `count`      | —                      | How many are selected. At zero the bar is not rendered at all.            |
| `countLabel` | `N selected`           | Your own label, for when you count domain entities and need plural forms. |
| `onClear`    | —                      | Clear the selection. Without it there is no "Clear selection" button.     |
| `children`   | —                      | Actions, usually `Button size="sm"`.                                      |
| `secondary`  | —                      | The right edge: "Select all", a link to help.                             |
| `sticky`     | `true`                 | Stick under the top bar.                                                  |
| `offsetVar`  | `--topbar-h`           | The name of the variable with the bar's height.                           |
| `aria-label` | `Actions on selection` | The group's name for the screen reader.                                   |

Two slots, not one: `children` take all the free space and push `secondary` to the right edge, and on a narrow screen `secondary` moves up next to the counter while the actions wrap to a second row.

At medium widths, when the actions do not fit on one line with the counter, they wrap as whole buttons within their part of the bar instead of shrinking: a button label never breaks onto two lines, and its icon is never squashed.

The "render nothing at zero" rule belongs to the bar, not to the calling code: otherwise every call site would write its own `count > 0 &&`, and one of them would eventually forget it.

## Stickiness contract

The application publishes the real height of its top bar in a CSS variable (`--topbar-h` by default), and the bar reads it. A hard-coded number will not do: on narrow screens the top bar is shorter, and a gap is left through which the scrolling content shows. The decision and the rejected options are in ADR-0016.

A missing variable is a legitimate state: the offset is zero, and the bar sticks to the top of the viewport.

`useStickyOffset` returns `sentinelRef` (attached to an empty zero-height block **before** the sticky element) and `isStuck`. Once stuck, the bar loses its top rounded corners — otherwise the corners reveal the page background at the seam.

## Accessibility

The bar is a `role="group"` with an accessible name: for a screen reader it is a set of actions on the selection, not random buttons in the middle of the page. The counter comes first and is read together with the group name. The clear button is named "Clear selection" — without a name it would be an unnamed button, and axe flags it as `critical`.

## Related sources and Storybook

- Sources: `src/components/navigation/SelectionBar.tsx`, `src/hooks/useStickyOffset.ts`
- Stories: `src/components/navigation/SelectionBar.stories.tsx`
- Tests: `tests/selection-bar.test.tsx`, `tests/sticky-offset.test.tsx`, browser stickiness scenarios — `tests-visual/interactions.spec.ts`

---
component: Grid
exports: [Grid, GridProps, GridColumns, GridMinItemWidth, GridGap]
category: content
status: stable
source: src/components/content/Grid.tsx
story: src/components/content/Grid.stories.tsx
sourceHash: 964d8a4c81d8
---

# Grid

## Summary for AI

A responsive grid of equal columns built on Tailwind utilities. Columns are set
by a number (a responsive ladder), by an object keyed by the kit's breakpoints
(`base`/`sm`/`md`/`lg`/`xl`), or by a minimum cell width for auto-fill. It has
no behavior: no roles, no keyboard, no state — only layout.

## When to use

- A set of uniform blocks: pricing cards, metric tiles, document previews — a
  dozen or two, without virtualization.
- The number of columns has to change with the screen width together with
  `AppShell` and `FormLayout`, not on your own breakpoints.
- A component "for the future" (ADR-0048): there was no requesting screen at release, and
  the API was taken from analogues — Mantine `SimpleGrid`, Chakra `SimpleGrid`,
  MUI `Grid`, Ant `Row`/`Col`, Cloudscape `ColumnLayout`. Your screen is the first
  test of this API, not a breach of the contract.

## When not to use

- Hundreds of cells or keyboard selection of cells — that is `VirtualGrid`: it has
  its own scrolling, the `listbox`/`option` roles and arrow keys across the grid.
- Form fields in one or two columns — that is `FormLayout`: it also sets
  label placement for the fields.
- Cells of different widths, column merging (`span`), masonry — not here: the grid
  has only equal columns. A complex screen layout stays with the consumer's
  classes.
- A stack or a row of elements with a gap is `flex` with `gap` on the consumer's
  side; the package does not export `Stack` and `Inline`.

## Minimal example

```tsx
import { Card, Grid } from "@olddevs/ui";

<Grid columns={3}>
  <Card>Basic</Card>
  <Card>Team</Card>
  <Card>Company</Card>
</Grid>;
```

## Public API

| Prop             | Default | Meaning                                                                                                                     |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `columns`        | `1`     | A number `1`–`6` — a responsive ladder (below); an object `{ base, sm, md, lg, xl }` — the exact number from each width up. |
| `minItemWidth`   | —       | `120`, `160`, `200`, `240`, `280`, `320` — the minimum cell width in pixels; as many columns as fit.                        |
| `gap`            | `md`    | The gap as a scale step: `none` 0, `xs` 8, `sm` 12, `md` 16, `lg` 24, `xl` 32 pixels.                                       |
| `as`             | `div`   | The tag: `div`, `ul` or `ol`. For a list, the children are `<li>`.                                                          |
| `div` attributes | —       | `className`, `id`, `aria-*`, `data-*` reach the element; `ref` goes to it too (`forwardRef`).                               |

`columns` and `minItemWidth` are **mutually exclusive**, and the type says so:
there are either as many columns as you specify or as many as fit. TypeScript
does not accept both at once. A JS consumer can still pass both — then
`minItemWidth` wins and `columns` is ignored, and in development mode the console
reports it once ([warning rules](../../conventions.md#предупреждения-в-режиме-разработки)).

The values are closed sets, not arbitrary numbers: every class is written out in
full in the source, otherwise Tailwind would not see it and the grid would
silently be left without columns.

### A number is a responsive ladder

A single number does not mean "this many columns at any width". It means "this
many on a wide screen": the number in `columns` is a **ladder, not a fixed
number**. This is the owner's decision, and there is no need to change it in
favor of "number = exactly that many columns". Exactly N columns at any width is
the object `{ base: N }`.

| Screen width        | `columns={1}` | `columns={2}` | `columns={3}`…`{6}` |
| ------------------- | ------------- | ------------- | ------------------- |
| up to 640           | 1             | 1             | 1                   |
| from `sm` (640)     | 1             | 2             | 2                   |
| from `lg` (1024) up | 1             | 2             | 3…6                 |

The jump to the full number sits at `lg`, not `md`: from `md`, `AppShell` shows
the side navigation, and it takes 240 pixels from the content. `FormLayout` with
`columns={2}` likewise gives one column on a phone.

### An object is an exact number per breakpoint

```tsx
<Grid columns={{ base: 1, sm: 2, md: 3, xl: 6 }}>{tiles}</Grid>
<Grid columns={{ base: 3 }}>{tiles}</Grid> // three columns at any width
```

Breakpoints are mobile-first, as in Tailwind: a value applies from the given width
and up until the next key overrides it. The breakpoints are the standard ones:
`sm` 640, `md` 768, `lg` 1024, `xl` 1280 pixels; `base` starts at zero. This is
the width of the **screen**, not of the container: the grid changes layout at the same
widths as the shell. The kit has no container queries yet.

### Minimum cell width

```tsx
<Grid minItemWidth={200}>{previews}</Grid>
```

The grid fills each row automatically: `repeat(auto-fill, minmax(min(100%, 200px), 1fr))`.
Empty tracks are kept (`auto-fill`, not `auto-fit`), so three cells on a wide
screen do not stretch across the whole row — they are the same size as the cells
of a full row. In a container narrower than 200 pixels, a cell shrinks to the
container's width instead of overflowing the edge.

## Accessibility

- By default the grid is a `div` and announces nothing: layout is not meaning.
- Render a set that is a list with `as="ul"` (or `ol` if the order matters) and
  `<li>` inside — the screen reader announces a list and the number of items. Name
  the list with `aria-label` if there is no heading next to it.
- The reading and tab order is the order of the children in the markup. The grid
  does not change it and must not: visually reordering the cells would no longer match
  the keyboard order.

## Anti-patterns

- Building a column class at runtime (`` `grid-cols-${n}` ``) — it is not in
  the CSS. That is what `columns` is for.
- Setting `columns={4}` and expecting four columns on a phone. For an unchanging
  grid use `columns={{ base: 4 }}`.
- Passing `columns` and `minItemWidth` together.
- Putting children other than `<li>` into `as="ul"` — a screen reader
  announces a list without items as empty.
- Using `Grid` for hundreds of cells: all of them end up in the DOM — that is a
  job for `VirtualGrid`.

## Related sources and Storybook

- Source: `src/components/content/Grid.tsx`; the "value per breakpoint → classes"
  map is the internal `src/lib/responsive.ts` (not public API).
- Tests: `tests/grid.test.tsx`; every class of the map in the built CSS —
  `tests/class-coverage.test.ts`. jsdom cannot see the column count at different
  window widths: it was checked by hand in a browser on the showcase stories.
- Showcase: `src/components/content/Grid.stories.tsx`. The level is periphery
  (ADR-0014): no snapshots.

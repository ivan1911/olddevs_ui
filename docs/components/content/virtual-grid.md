---
component: VirtualGrid
exports: [VirtualGrid, VirtualGridItem]
category: content
status: stable
source: src/components/content/VirtualGrid.tsx
story: src/components/content/VirtualGrid.stories.tsx
---

# VirtualGrid

## Summary for AI

A virtualized card grid: the visible cells and a small overscan around them live in the DOM. It
scrolls **its own container** (`scroll="container"`, the consumer sets the height) or **the
browser window** (`scroll="window"`). A cell is any node; buttons inside it are allowed. It
loads more pages as the user nears the end and selects cells by dragging across them.

## When to use

- Hundreds and thousands of previews: images, documents, covers.
- A screen with a large grid on a scrolling page, with a sticky bar and incremental loading — `scroll="window"`.
- A grid in a dedicated area of known height — `scroll="container"`.

## When not to use

- For a dozen cards: a plain CSS grid is simpler.
- For a data table — that is `DataTable`.
- For a grid sorted by dragging: virtualization and drag and drop together are not verified in
  the kit. Drag-to-select (`dragToSelect`) selects cells; it does not move them.

## Minimal example

```tsx
import { VirtualGrid, MediaCard } from "@olddevs/ui";

<VirtualGrid
  items={images.map((k) => ({
    id: k.id,
    textValue: k.name,
    content: <MediaCard preview={<Image src={k.url} alt="" />} title={k.name} />,
  }))}
  aria-label="Images"
  minItemWidth={180}
  minItemHeight={220}
  className="h-[520px]"
/>;
```

## Props

| Prop                | Default       | Purpose                                                                              |
| ------------------- | ------------- | ------------------------------------------------------------------------------------ |
| `items`             | —             | Cells: `id`, `content`, `textValue`, `contextMenu`.                                  |
| `aria-label`        | —             | **Required.**                                                                        |
| `minItemWidth`      | `180`         | Minimum cell width in pixels. The number of columns is calculated from it.           |
| `minItemHeight`     | `180`         | Minimum cell height in pixels. If the content is taller, the cell grows.             |
| `gap`               | `12`          | Gap between cells, pixels.                                                           |
| `edgeGap`           | `true`        | A `gap` around the grid edges; `false` — outer cells flush.                          |
| `maxColumns`        | —             | Cap on the number of columns.                                                        |
| `emptyText`         | —             | What to show in an empty grid.                                                       |
| `scroll`            | `"container"` | What scrolls: its own container or the browser window — see below.                   |
| `offsetVar`         | `--topbar-h`  | Variable with the sticky bar height (`window` mode), the same as for `SelectionBar`. |
| `selectionMode`     | `"none"`      | Selection axis: `single`, `multiple`.                                                |
| `selectionBehavior` | `"toggle"`    | `toggle` — a click toggles; `replace` — like a file manager.                         |
| `rangeSelection`    | `"replace"`   | Shift range: replaces the selection (`replace`) or is added to it (`add`).           |
| `selectedKeys`      | —             | The selected keys (react-aria `Selection`); the consumer owns the state.             |
| `onSelectionChange` | —             | The new set of selected cells; pass it back as it came.                              |
| `dragToSelect`      | `false`       | Selection by dragging across cells. Only with `selectionMode="multiple"`.            |
| `onAction`          | —             | `(id, { rect }) => void` — a cell was opened: click, Enter, tap.                     |
| `onLoadMore`        | —             | Load the next page — when less than the visible area height is left.                 |
| `isLoadingMore`     | `false`       | Loading in progress: an indicator under the last row.                                |
| `loadingMore`       | spinner       | A custom loading indicator, for example a row of skeletons.                          |
| `className`         | —             | Grid classes. In `container` mode **the consumer sets the height**.                  |

Sizes are numbers, not react-aria's `Size` class: a library class in the kit's public API would
make the consumer import it just to pass two numbers.

## Scrolling: its own container or the window

**`scroll="container"`** (default) — the grid scrolls itself. The consumer must give it a
height — `h-[520px]`, `flex-1` inside a column, anything definite. Without a height the grid
grows with its content, and there is nothing to scroll.

**`scroll="window"`** — the grid grows with its content, the page scrolls, and the DOM still
holds only the cells in the visible area: react-aria's virtualizer intersects its area with the
window itself. This is the mode for such a screen: with a sticky bar and a bottom panel.

```tsx
<VirtualGrid items={items} aria-label="Photos" scroll="window" onLoadMore={loadMore} />
```

**A sticky bar.** When an arrow key moves focus past the top of the viewport, the cell does not
end up under the bar: the grid keeps the offset set by the CSS variable named in `offsetVar`. By
default that is `--topbar-h`, which `TopBar` publishes; `SelectionBar` and `useStickyOffset` use the
same variable
(ADR-0016). If you have your own
bar, publish its height in this variable or point `offsetVar` at your own variable.

**Measured:** 3000 cells in window mode — from 95 to 155 in the DOM; on scroll the set
of rendered cells shifts. This is checked in a browser because jsdom has no layout and the
virtualizer renders nothing there
(ADR-0028,
addendum).

## Loading pages — `onLoadMore`

```tsx
<VirtualGrid
  items={items}
  aria-label="Photos"
  scroll="window"
  onLoadMore={() => fetchNextPage()}
  isLoadingMore={isFetchingNextPage}
/>
```

The grid calls `onLoadMore` when less than the visible area (or container) height is left to the
end of what is loaded, and again after each new page while the end is still close. A repeat call
during loading is possible: the consumer tracks the "already loading" and "nothing more to load"
flags. While `isLoadingMore`, an indicator is shown under the last row — the kit's spinner or
your `loadingMore`.

Tests that run in jsdom and use `onLoadMore` need an `IntersectionObserver` stub: the load-more
trigger relies on it, and jsdom has none.

## The layout calculates the columns

`GridLayout` takes the grid width and the minimum cell size. There is no `matchMedia` or
`ResizeObserver` in the kit's code: the number of columns is the layout's result, not our
calculation. `edgeGap={false}` removes the edge offset — a "1fr without margins" grid.

The roles (`grid` with `data-layout="grid"`, `row` and `gridcell` on cells), the keyboard and
typeahead are also provided by react-aria. Roles are not set by hand: the keyboard would then stop
matching the declared markup. Before 3.47.0 the grid was a `listbox` with `option` elements — see the
[migration note](../../api/migration-notes.md).

## Selection belongs to the grid, not the cell

The axis is switched on explicitly, by the `selectionMode` prop (`single` or `multiple`). The
consumer keeps the selected keys and passes them as the `selectedKeys` / `onSelectionChange`
pair — the kit gives the shape, the state stays outside
(ADR-0023).

```tsx
const [selected, setSelected] = useState<Selection>(new Set());

<VirtualGrid
  items={items.map((p) => ({
    id: p.id,
    textValue: p.name,
    content: (
      <MediaCard
        preview={<Image src={p.url} alt="" />}
        title={p.name}
        selected={selected === "all" || selected.has(p.id)}
        actions={<Checkbox slot="selection" label={`Select ${p.name}`} />}
      />
    ),
  }))}
  aria-label="Frames"
  selectionMode="multiple"
  selectedKeys={selected}
  onSelectionChange={setSelected}
  className="h-[520px]"
/>;
```

**The selection checkbox is `Checkbox slot="selection"`** in the cell content: the
grid wires it to its own axis, so it has no state of its own. `MediaCard` stays display-only: you
can pass it `selected`, which renders the state, and `onSelectedChange` is not needed.

**Buttons in a cell are allowed**: "favorite", "download". The cell is a `gridcell`, and a
button in it is not nested interactive content. Pressing the button neither selects nor opens
the cell, **if the button comes from react-aria** — the kit's `Button`, `Button` or
`ToggleButton` from `react-aria-components`: the cell catches the press through `usePress`, and
only a button built on `usePress` stops it on itself. A plain `<button onClick>` hands the press
to the cell — a click on "favorite" would open the card as well.

**Keep the selection as it arrives.** `onSelectionChange` hands over react-aria's `Selection` —
a `Set` that carries the Shift range anchor on the object itself. Pass it back into
`selectedKeys` without copying it: `new Set(keys)` loses the anchor, and Shift+click selects one
cell instead of a range. The exception is `"all"` (⌘A in the grid): the consumer expands it into
a concrete set themselves.

**Before 3.1.0 the opposite rule applied here**: "selection is switched on at `MediaCard`". It
could not be followed. A grid cell was an `option`, a button inside an `option` was a nested
interactive element, and axe rightly called it a serious violation. Since 3.47.0 the cell is a
`gridcell`, and a selection checkbox inside it is allowed — but it is the checkbox of the grid's
axis, not the card's own state.

**Click and selection — `selectionBehavior`.** `toggle` (default): a click toggles the cell, and
if `onAction` is set, it opens it; Space then selects. `replace` — like a file manager: a click
selects one cell, Ctrl/Cmd adds, and a double click and Enter open.

**The Shift range — `rangeSelection`.** By react-aria's rule (`replace`) Shift replaces the
selection with a range from the anchor, and whatever is selected outside the range is cleared.
`add` adds the range to the previous selection and clears nothing.

**Drag to select — `dragToSelect`.** Hold a cell and drag across its neighbors: they are
added as a range in `items` order, and at the edge of the viewport (or container) the grid scrolls
itself. A quick swipe is scrolling, not the gesture: selection starts after the hold and only
once the finger has moved to another cell. Touch only, and only with
`selectionMode="multiple"`. The gesture is not the only way to the same result: the selection
checkbox and Shift with the arrow keys give the same result with a mouse and with a keyboard.

## Acting on a cell — `onAction`

A click or Enter **opens** the cell rather than selecting it: a preview, navigation, a record
card. That is what the grid's `onAction(id, { rect })` is for; selection has nothing to do with
it. `rect` is the cell's rectangle at the moment of the action: the card can expand out of the
cell's position.

```tsx
<VirtualGrid
  items={items}
  aria-label="Files"
  onAction={(id, { rect }) => openPreview(String(id), rect)}
  className="h-[520px]"
/>
```

Without `selectionMode` the cell is never selected: `onSelectionChange` stays silent and there is
no `aria-selected`. With `selectionMode`, both the action and selection work according to react-aria's
rules: a click and Enter call `onAction`, and Space selects. If a click must select, do not pass
`onAction`, or use `selectionBehavior="replace"`.

Do not build "open" on `selectionMode="single"` by selecting a cell and opening it on the
selection change: a repeat click on the same cell then opens nothing, and closing the preview
leaves the cell selected.

## A cell's context menu — `contextMenu`

The cell's `contextMenu` field (`items[n].contextMenu`) holds the menu items: `ContextMenuItem`,
`ContextMenuSeparator`, `ContextMenuSub` and the rest of the
[`ContextMenu`](../overlays/context-menu.md) component family. The grid sets the panel, the trigger and the
isolation from selection itself, so there is no need to wrap the cell in `ContextMenu` by hand.

```tsx
import { ContextMenuItem, ContextMenuSeparator, VirtualGrid } from "@olddevs/ui";

<VirtualGrid
  items={files.map((f) => ({
    id: f.id,
    textValue: f.name,
    content: <MediaCard preview={<Image src={f.url} alt="" />} title={f.name} />,
    contextMenu: (
      <>
        <ContextMenuItem onSelect={() => rename(f)}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem tone="danger" onSelect={() => remove(f)}>
          Delete
        </ContextMenuItem>
      </>
    ),
  }))}
  aria-label="Files"
  className="h-[520px]"
/>;
```

The menu opens on a right click, on a long press on a touch screen and from the keyboard —
**Shift+F10** or the context menu key on a focused cell (the menu is centered on the cell).
A closed menu returns focus to the cell. A menu item neither selects the cell, nor moves focus
to it, nor calls `onAction`: the panel's events are stopped at the cell boundary. A cell
without `contextMenu` stays as before — no wrapper, no handlers.

**A long press only opens the menu.** On a touch screen a long press on a cell with a menu opens the
menu and nothing else: the cell is neither opened nor selected. react-aria has a rule for a grid
with selection and `onAction` — "a long press starts selection" — and it used to fire
along with the menu; now the grid suppresses it on cells with a menu. A cell without a menu keeps
react-aria's rule: a long press selects it. There is no conflict with `dragToSelect`: the hold
only arms the drag — the finger moves, the menu does not open; the finger stays, the menu opens
and the drag does not start.

**Why not `ContextMenu` around `content`.** That is how it was done before the field appeared, and it
produced two failures. First: a right click works, but Shift+F10 does not, because focus is on the
cell while the menu button is inside it. Second: events from the panel, which is rendered in a
portal, bubble up the React tree to the cell and select it. Both failures are now closed inside the
grid.

The menu does not replace visible actions: an essential operation must not be available only
through a right click ([ContextMenu](../overlays/context-menu.md)).

## Anti-patterns

- In `container` mode, not setting the height — there is nothing to scroll.
- Setting `scroll="container"` and also wrapping the grid in an `overflow: auto` element instead of
  using `scroll="window"` on a page that scrolls the window.
- Putting a heavy subtree into `content`: it re-renders on scroll.
- Building "open" on `selectionMode="single"` instead of `onAction`.
- Keeping your own selection checkbox in the card's state instead of `Checkbox slot="selection"`.
- Wrapping `content` in your own `ContextMenu` instead of the cell's `contextMenu`: Shift+F10
  does not open the menu, and a click on an item selects the cell.

## Related sources and tests

- Source: `src/components/content/VirtualGrid.tsx`, the drag —
  `src/components/content/useDragToSelect.ts`
- Tests: `tests/virtual-grid.test.tsx` (roles, action, menu, selection, modes; the container
  size is patched in jsdom); virtualization, window scrolling and the bar, incremental loading, the drag and
  the long press — in a browser, `tests-visual/interactions.spec.ts`
- Showcase: `src/components/content/VirtualGrid.stories.tsx` (the `Library` story — all of it
  together, on the window scroll)

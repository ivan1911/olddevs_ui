---
component: DataDisplay
exports: [Badge, Stat, DescriptionList, Table]
category: content
status: stable
source: src/components/content/Badge.tsx, src/components/content/Stat.tsx, src/components/content/DescriptionList.tsx, src/components/content/Table.tsx
story: src/components/content/Table.stories.tsx, src/components/content/Badge.stories.tsx, src/components/content/Stat.stories.tsx, src/components/content/DescriptionList.stories.tsx
sourceHash: c982b98a16d0
---

# Data display: `Badge`, `Stat`, `DescriptionList`, `Table`

## Summary for AI

Choose the component by the shape and meaning of the data: `Badge` answers "how
many" or "is there anything new", `Stat` is for a single metric with context,
`DescriptionList` for "property — value" pairs, and `Table` for repeating
rows and columns. `StatusBadge` is not a `Badge`: it describes the state of an
entity and is documented in [feedback](../actions/feedback.md).

## When to use

- `Badge` — a number, a short label or a dot next to an icon or object.
- `Stat` — a key metric with a label, a change and a short explanation.
- `DescriptionList` — a set of heterogeneous properties of an object, for example
  photo parameters, where each label belongs to one value.
- `Table` — comparable records that need a shared header, rows and, when needed,
  sorting, selection or column resizing.

## When not to use

- Do not use `Badge` for the status "draft", "published" or "error": that is
  `StatusBadge`. For a number inside a clickable filter, use `Chip count`.
- Do not compute `Stat deltaTone` from the sign: a rise in errors may be bad, and
  a drop in costs may be good. The calling code supplies that judgment.
- Do not use `DescriptionList` as a replacement for a table with dozens of
  same-shaped rows.
- Do not turn on sorting, selection, a sticky header or column resizing "just in case":
  `Table` shows each axis only when its props are passed.

## Minimal examples

```tsx
import { Badge, DescriptionList, Stat, Table } from "@olddevs/ui";

<Badge overlay>{5}</Badge>
<Stat label="Subscribers" value="12,480" delta="+320" deltaTone="success" hint="this week" />
<DescriptionList items={[{ label: "Size", value: "2.4 MB" }]} />
```

```tsx
const columns = [{ id: "name", header: "Name", cell: (item: User) => item.name, sortable: true }];

<Table aria-label="Users" items={users} columns={columns} sort={sort} onSortChange={setSort} />;
```

## Public API

### `Badge`

| Prop       | Default  | Meaning                                                                                                                    |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `tone`     | `danger` | The tone of the counter's importance, not the status of the object.                                                        |
| `dot`      | `false`  | Renders a dot with no content: "there is something new", but not a count.                                                  |
| `max`      | `99`     | A number above the limit is shown as `${max}+`.                                                                            |
| `overlay`  | `false`  | Positions the badge absolutely in the top right corner of its neighbor; the parent must be positioned, usually `relative`. |
| `children` | —        | A number or a short label.                                                                                                 |

### `Stat`

| Prop                  | Default | Meaning                                                                                   |
| --------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `label`, `value`      | —       | A required pair of term and value.                                                        |
| `hint`                | —       | A short explanation under the value.                                                      |
| `delta` / `deltaTone` | —       | The change and its explicit semantic judgment; without `deltaTone` the change is neutral. |
| `size`                | `md`    | `md` — a dense group of metrics, `lg` — the main figure of the screen.                    |

### `DescriptionList`

| Prop     | Default   | Meaning                                                                                                                                                |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `items`  | —         | An array of required `{ label, value }` pairs.                                                                                                         |
| `layout` | `columns` | `columns` — label on the left, value on the right on a wide screen; `stack` — value under the label. On a narrow screen both layouts stack vertically. |

### `Table`

| Prop                                | Purpose and constraints                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`, `items`                  | Required data. Every item needs a stable `id`; every column needs `id`, `header`, `cell`.                                                                                                         |
| `aria-label`                        | A required name for the table; a screen reader uses it to identify the table.                                                                                                                     |
| `sort`, `onSortChange`              | Controlled sorting. Pass both props and mark the columns that can be sorted as `sortable`. The table does not store the state.                                                                    |
| `selectedKeys`, `onSelectionChange` | Controlled multiple selection. The checkbox column appears only if both props are passed.                                                                                                         |
| `stickyHeader`                      | Makes the header sticky; the outer container must have a set height and scrolling.                                                                                                                |
| `resizable`                         | Turns on column resizing by mouse and keyboard. Only in this mode does `column.width` become the initial resizable width.                                                                         |
| `onRowAction`                       | A row action: a click and Enter open the record (the handler receives the item from `items`), while its checkboxes select it. Turned on by passing the prop — see below.                          |
| `renderDetail`                      | What to show under a row. Turns on the expansion axis: without the prop there is no expander column and no detail rows in the markup.                                                             |
| `expandedKeys`, `onExpandedChange`  | Controlled expansion. A set of keys, like selection; there is no "one row or several" switch — see below. Without these props, the table manages expansion itself and keeps the state internally. |
| `rowLabel`                          | The row's name for the labels of per-row buttons. Without it all the expanders have the same name — see below.                                                                                    |
| `emptyText`                         | The content of the empty state; by default a message-catalog string (`table.empty`): "Nothing here" without a provider, "Ничего нет" with `locales/ru`.                                           |

`TableColumn.width` is applied as a CSS width without `resizable`; with
`resizable` it is passed as `defaultWidth`. So do not expect `width` in an
ordinary table to become user state.

**`onRowAction` is a row action alongside selection.** A click on a row and Enter
on a focused row call `onRowAction(item)`; its checkboxes select it, and
Space on a row still toggles the selection. The rule is react-aria's "selection
mode", and it is worth knowing in advance:

- while nothing is selected, a click on a row is the action;
- once a selection exists, a click on a row toggles it, so you can keep selecting
  by clicking anywhere on the row instead of aiming at a checkbox; the action stays on Enter;
- without selection (`selectedKeys` not passed) a click always calls the action.

Buttons, links and menus inside cells keep their own click and do not activate
the row: a manual `stopPropagation` is not needed. A detail row and the expander
button do not call the action. A row with an action gets a pointer cursor.

**Expansion is the only axis that could not be added as a layer on top.**
`DataTable` adds column visibility, order, density and the table bar (`toolbar`)
from the outside: they change what goes into `Table` through props. A detail row
lives **inside** `<tbody>`, between the rows of the react-aria collection, and
cannot be inserted from the outside. The analysis is in
ADR-0022.

**There is no "one row or several" switch.** `Accordion` has one, but
`Accordion` can hold the state itself and `Table` cannot: a prop it cannot back
up would be a promise that breaks silently. How many rows are open at once is up
to whoever holds the state, by putting one key or several into the set.

**Pass `rowLabel` whenever expansion is on.** Without it all the buttons have
the same name, and a screen reader that lists buttons reads twenty identical
"Show details". The first column cannot serve as the name: its `cell` returns a
`ReactNode`, which may hold an avatar or markup, and junk would end up in the
name.

**The boundary with `DataTable`** (since 2.2.0): anything that can be expressed by
`Table` props from the outside does not move inside `Table`. If something could
have been done as a layer on top and ended up here, the boundary has already
shifted.

## State and accessibility

- `Stat` and `DescriptionList` use `dl` with `dt`/`dd`, so the label and the value
  are available as a linked pair.
- `Table` has react-aria's standard keyboard contract for cells, headers, sorting
  and selection. react-aria puts `aria-sort` on a sortable column, and only
  after hydration: the static server markup does not contain it (the icon shows
  the direction). The cause is in the library: it decides whether to set the
  attribute based on the platform, and the server does not know the platform. On
  Android, where TalkBack does not support the attribute, there is none at all;
  elsewhere a sortable column always has it, `none` on an unsorted one. So the
  server and the client start from the same markup, and a page with server
  rendering gets no React hydration-mismatch warning.
- Column identifiers stay public in `sort`; the internal prefix protects against
  a clash with `item.id` and must not appear in the consumer's state.
- Do not add your own Checkbox to the selection column: the component uses
  `Checkbox slot="selection"`, tied to the table state.
- The expander is a real `<button>` in its own cell with `aria-expanded`, not a
  clickable row: a whole-row target conflicts with links and checkboxes inside
  it and is not reachable by keyboard.
- **`selectedKeys` is the selection of visible rows, not of the whole result
  set.** "Select all" marks what arrived in `items`; the kit does not support
  selecting records outside the current page, and the interface labels do not promise it.

## Anti-patterns

```tsx
// Bad: a red counter is interpreted as an entity error.
<Badge tone="danger">Error</Badge>

// Good: the state of an entity is a StatusBadge.
<StatusBadge tone="danger">Error</StatusBadge>

// Bad: the table does not know where to send the sorting.
<Table aria-label="Photos" items={items} columns={columns} sort={sort} />

// Good: the screen controls the state.
<Table aria-label="Photos" items={items} columns={columns} sort={sort} onSortChange={setSort} />

// Bad: "open the order" as a link in a cell with a manual stopPropagation on
// pointerdown, mousedown and Enter — otherwise the click also selects the row.
cell: (order) => <Link onPointerDown={stop} onMouseDown={stop} onKeyDown={stopEnter} onClick={() => open(order)}>{order.id}</Link>

// Good: the row action is a table prop; selection stays on the checkboxes.
<Table
  aria-label="Orders"
  items={orders}
  columns={columns}
  selectedKeys={selected}
  onSelectionChange={setSelected}
  onRowAction={(order) => open(order.id)}
/>
```

## Related sources and Storybook

- Sources: `src/components/content/Badge.tsx`, `src/components/content/Stat.tsx`,
  `src/components/content/DescriptionList.tsx`, `src/components/content/Table.tsx`.
- Stories: `src/components/content/Table.stories.tsx`, `src/components/content/Badge.stories.tsx`, `src/components/content/Stat.stories.tsx`, `src/components/content/DescriptionList.stories.tsx`.
- The table axis boundaries, AvatarGroup accessibility and Badge collapsing are
  tested in `tests/data.test.tsx`.
- The row action: `tests/table-row-action.test.tsx` (jsdom) and the test "Table: a
  row click and Enter run the row action…" in `tests-visual/interactions.spec.ts`.
  Hydration of sortable columns: `tests/table-hydration.test.tsx`.

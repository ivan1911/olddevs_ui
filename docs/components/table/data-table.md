---
component: DataTable
exports: [DataTable]
category: table
status: stable
source: src/components/table/DataTable.tsx
story: src/components/app-shell/AppShell.stories.tsx
---

# DataTable

## Summary for AI

An application-level table with ready-made behavior on top of the low-level `Table`:
column visibility and order, density, loading and error states, a table toolbar slot
(`toolbar`). It keeps no state of its own: it accepts `state` and reports changes as a
patch, usually to `useTableState`.

## When to use

- A list of entities in an admin panel: filters, column preferences, bulk actions.
- Anywhere a table needs a table toolbar and user preferences.

## When not to use

- For a simple table without settings — that is `Table`: it stays low-level and
  puts nothing extra into the markup.
- For "property — value" pairs — that is `DescriptionList`.

## Minimal example

```tsx
import { DataTable, TableToolbar, useTableState } from "@olddevs/ui";

const { state, set } = useTableState();

<DataTable
  aria-label="Documents"
  columns={columns}
  items={rows}
  state={state}
  onStateChange={set}
  selectable
  loading={isFetching}
  error={error ? <ErrorState title="Failed to load" /> : undefined}
  toolbar={<TableToolbar title="Documents" count={total} />}
/>;
```

## Props

| Prop            | Default | Purpose                                                              |
| --------------- | ------- | -------------------------------------------------------------------- |
| `state`         | —       | The whole state. Usually from `useTableState`.                       |
| `onStateChange` | —       | Changes as a single patch: invariants live in the hook, not here.    |
| `selectable`    | `false` | The checkbox column. A separate prop — see below.                    |
| `loading`       | `false` | Loading is in progress. The behavior depends on whether data exists. |
| `error`         | —       | **Always** replaces the body, even when there is data.               |
| `toolbar`       | —       | The table toolbar — usually `TableToolbar`.                          |

The other props go to `Table` — including `renderDetail`, `rowLabel` and
`onRowAction`.

**A row action next to selection.** `onRowAction(item)` together with
`selectable`: a click on a row and Enter open the record, while the checkboxes
mark it. While nothing is selected, a click on a row is the action; once a
selection exists, a click on a row toggles it (react-aria's rule), and the action
stays on Enter. A link in a cell with a manual `stopPropagation` is not needed
for this: a manual `stopPropagation` is an anti-pattern, it breaks the row's keyboard model. Details
and the anti-pattern are in [Data display](../content/data-display.md).

**Hydration.** `aria-sort` is set by react-aria, and only after hydration: on
Android it is absent altogether, on other platforms every sortable column has
it, and the server does not know the platform. So the server markup of a table
with sorting matches the client's, and React does not report a mismatch.

## The boundary with `Table`

**An add-on, not a replacement.** Inside is the same `Table` as outside: column
visibility and order, density and states are expressed by its props. Only the
expansion axis had to be added to `Table` itself: the detail
row lives inside `<tbody>`, between the react-aria collection rows, and an
add-on cannot insert it
(ADR-0022).

A boundary violation has a verifiable sign: **if something could have been
done with props from outside and it ended up inside `Table`, the boundary has
already shifted.**

**`selectable` is a separate prop, not "since there is state, it is needed".**
`selectedKeys` is always in the state, and if the add-on passed it
unconditionally, the checkbox column would appear on tables that do not need
selection. The add-on does not override the `Table` rule "an axis is enabled by the
presence of a prop".

**A hidden column does not make it into the markup**; it is not hidden with a
class: a hidden column would stay in the accessibility tree as a header without
cells, and a screen reader would read a table with a column that is not on screen.

## The table does not own the data

**`items` are not split into pages.** `state.page` and `state.pageSize` are part
of the state and are carried into the URL, but slicing is the consumer's job: in
an app these are the server request parameters, not an array slice in the
component. The kit knows neither the total number of records nor where they come
from.

The same goes for sorting and filters: `DataTable` reports them as a state patch
and shows what it is given. Filtered and sorted data arrives from outside.

## Loading, empty and error

**The first load and a refetch** are told apart — a single priority order (error, loading, empty) is wrong here:

| State                    | What is on screen                                       |
| ------------------------ | ------------------------------------------------------- |
| Error                    | Instead of the body, **always**, even when data exists  |
| Loading **without** data | A skeleton instead of the body, the column headers stay |
| Loading **with** data    | The data stays under `aria-busy`, dimmed                |
| Empty                    | Only when loading has finished and there is no error    |

Data shown alongside an error lies: the user cannot tell stale from current. And
collapsing the table into a skeleton on every page change is a layout jump on
every step, and that jump is why the rule was rewritten.

## Related sources and tests

- Implementation: `src/components/table/DataTable.tsx`.
- Tests: `tests/data-table.test.tsx` — column preferences, the four states and
  telling the first load from a refetch, no checkbox column without
  `selectable`, expansion through state.
- `tests/table-row-action.test.tsx` — `onRowAction` next to selection;
  `tests/table-hydration.test.tsx` — server markup and hydration of sortable
  columns, including on Android.
- Story: `AdminEntityList` in
  `src/components/app-shell/AppShell.stories.tsx`.

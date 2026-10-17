---
component: FilterBar
exports: [FilterBar, FilterBarAdd]
category: table
status: stable
source: src/components/table/FilterBar.tsx, src/components/table/FilterBarAdd.tsx
story: src/components/table/FilterBar.stories.tsx
---

# FilterBar and FilterBarAdd

## Summary for AI

`FilterBar` shows the applied filters as removable tags; `FilterBarAdd` is an
add button with a choice of field and value, or of range bounds (amount, date).
Neither **knows which filters exist**: the list is passed as a prop, and the
kit has no domain vocabulary.

## When to use

- Above a list with more than one filter, where the set of filters changes.
- In the `filters` slot of `TableToolbar`.

## When not to use

- For toggling a single attribute ("favorites only") — that is a `Chip` or
  `Segmented`: there it is a toggle, not a removal.
- For entering arbitrary text — that is `SearchControl`.
- For a "contains" or "one of" filter — apart from equality and a range there
  are no operators in the model (see below).

## Minimal example

```tsx
import { FilterBar, FilterBarAdd, useTableState } from "@olddevs/ui";

const { state, set } = useTableState();

<FilterBar filters={state.filters} onFiltersChange={(filters) => set({ filters })}>
  <FilterBarAdd
    fields={FIELDS}
    filters={state.filters}
    onAdd={(f) => set({ filters: [...state.filters, f] })}
  />
</FilterBar>;
```

## `FilterField` — a field description

```ts
interface FilterField {
  id: string;
  /** The field label. A string: it also ends up in the token label. */
  label: string;
  /** The field kind. Defaults to "values". */
  kind?: "values" | "number-range" | "date-range";
  /** Allowed values for "values". With an empty list the field does not appear in the field list; for ranges pass []. */
  values: { id: string; label: string }[];
}
```

The list of fields is passed as a prop in full: the kit does not know which
filters exist in your product, and no domain vocabulary appears in it.

## Ranges

`kind: "number-range"` and `kind: "date-range"` (ADR-0063)
replace the choice of a value with two inputs, "From" and "To": a `NumberInput`
for numbers and a `DatePicker` for dates. The field is described with an empty `values`:

```tsx
const FIELDS: FilterField[] = [
  { id: "amount", label: "Amount", kind: "number-range", values: [] },
  { id: "created", label: "Created", kind: "date-range", values: [] },
  { id: "status", label: "Status", values: STATUSES },
];
```

The filter that gets built is an ordinary `TableFilter` with an optional `to`:

| What was entered   | `value` | `to`           | Tag label                    |
| ------------------ | ------- | -------------- | ---------------------------- |
| 50 and 100         | `"50"`  | `"100"`        | "Amount: 50–100"             |
| only "from" 50     | `"50"`  | `""`           | "Amount: from 50"            |
| only "to" 100      | `""`    | `"100"`        | "Amount: to 100"             |
| only "to" March 12 | `""`    | `"2026-03-12"` | "Created: to March 12, 2026" |

- **`to` present — a range, `to` absent — equality.** An empty string in `to`
  is not the same as a missing key: it is an open bound, and check it
  with `to !== undefined`. Numbers are passed as strings, dates as ISO `YYYY-MM-DD`,
  as everywhere in the kit.
- **"Apply" is enabled once at least one bound is set.** An inverted range
  ("from 100 to 50") cannot be applied: it would select nothing, and the user
  would read an empty result as "no data". In the "To" calendar the dates before
  "From" are unavailable, and vice versa.
- **The kit builds the label** through the message catalog: the labels of the "From"
  and "To" inputs are `fromField` and `toField`, the tag label templates are
  `rangeBetween`, `rangeFrom`, `rangeTo`. Numbers and dates in the label are
  formatted in the `UiProvider` locale; a date always includes the year: the
  label is stored in the page URL and in a saved view, and a link labeled "to
  March 12" would mean a different date when it is opened a year later. The label
  is stored in the filter's `label` and in the page URL. If a filter has `to` but
  no `label`, `FilterBar` labels it with the same templates, but the bounds in
  the label stay raw, unformatted.
- **A field with an already applied range is not offered again.** Two ranges on
  one field are an intersection, not an addition, and the tags could not be
  told apart. The tag identifier is `<field>:range`.
- **The consumer computes the filtered rows.** The kit describes the shape of the
  filter, it does not filter data
  (ADR-0023):
  how to treat the bounds (inclusive, in which time zone) is the application's
  decision.
- **In the page URL** (`tableStateToParams`) `to` is written as the fifth part of
  the filter entry; links of three and four parts are read as before. The fifth part is
  written even when empty, otherwise "from 50" would turn into equality.

## Decisions visible in the API

**The tags are built on react-aria's `TagGroup`, not on `Chip`.** A chip cannot be
removed; it is for toggling. Keyboard support comes without extra work: Delete and
Backspace on a tag remove it.

**A tag has its own `id`, and the label is not an identifier.** Two filters on
the same field produce tags that look identical, and removing the right one by
label would be impossible; the label is also localized and truncated. A tag is
removed by `filter.id`.

**There are no operators in the model.** Without `to` a tag means equality, with
`to` — a range: `gte` and `lte` are the same range with an empty bound and do not
deserve an axis of their own
(ADR-0063).
`contains` and `in` still wait for a requesting screen
(ADR-0023).

**The remove button's label is generic, without the filter's name.** react-aria
appends its tag's label to the button's name by itself; adding the filter name by hand produced
"Remove filter Section: Contracts Section: Contracts". The screen reader still
reads the filter — the library adds it. This is checked against the computed
accessible name, not the markup.

**"Clear all" appears once there are two filters.** With one filter the button does
exactly what the tag's remove button does and only lengthens keyboard navigation.

**An already applied value is not offered again.** Otherwise the user adds a
second identical tag, the result does not change, and they are left with two
filters that look the same. When there is nothing to add, the button is disabled.

**Focus returns to the button after adding.** If focus is lost, it falls back to the start of
the document and keyboard navigation of the page starts over.

## Related sources and tests

- Implementation: `src/components/table/FilterBar.tsx`, `src/components/table/FilterBarAdd.tsx`.
- Tests: `tests/filter-bar.test.tsx` — removal by mouse and keyboard, the
  composite button name, duplicate prevention, focus return, the two components
  working together; `tests/filter-bar-ranges.test.tsx` — ranges (bounds, the
  localized label, an inverted range); `tests/table-state.test.tsx` — `to` in the
  page URL.
- Story: `Ranges` and `RangesFromScratch` in `FilterBar.stories.tsx`.
- State: [`useTableState`](../../api/utilities.md).

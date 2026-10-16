---
component: RangeCalendar
exports: [RangeCalendar]
category: date-time
status: stable
source: src/components/date-time/RangeCalendar.tsx
story: src/components/date-time/RangeCalendar.stories.tsx
sourceHash: 0d83dbf9735c
---

# RangeCalendar

## Summary for AI

`RangeCalendar` is a building block for a single continuous React Aria `DateValue` range. Its `onChange` is called only for a completed range; it does not replace the ready-made `DateRangePicker` with its trigger and presets.

## When to use

- You need a custom composition of a range calendar inside your own panel.
- You need one or two visible months (`months={1 | 2}`) and all of React Aria's constraints.

## When not to use

- For a standard range field with presets and clearing, use `DateRangePicker`.
- For a single date, use `Calendar`/`DatePicker`.

## Minimal example

```tsx
<RangeCalendar value={range} onChange={setRange} months={2} locale="ru-RU" />
```

## Public API

- Inherits React Aria's `RangeCalendarProps<DateValue>`: controlled `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, unavailable dates.
- An empty controlled value is passed as `null`.
- **A range can be objects or ISO strings.** `value` and `defaultValue` accept `{ start, end }`, where the bounds are either `@internationalized/date` objects or `YYYY-MM-DD` strings (the strings are the same as `DateRange` in `DateRangePicker`). `minValue`, `maxValue` and `defaultFocusedValue` accept a string too (`minValue="2026-03-09"`); there is no need to import `@internationalized/date` (the package itself stays a peer dependency of the kit). An unparsable string does not throw: a range with such a bound is treated as empty (half a range is never selected) and the bound as not set.
- `onChange(range, iso)` is called once both bounds are chosen. The first argument is `{ start, end }` of calendar objects, as in React Aria (it always was); the second is the same range as a pair of ISO strings, that is, the same `DateRange`. Whoever stores the range as strings needs only `onChange={(_, iso) => setRange(iso)}`. What `onChange` receives does not depend on whether `value` is passed as objects or strings: existing calls with objects work unchanged.
- `isDateUnavailable` receives a calendar object: `date.toString()` returns the day as a `YYYY-MM-DD` string.
- `months` is 1 or 2 and defaults to 1; without `locale`, the locale comes from above: from `UiProvider`, the consumer's `I18nProvider` or the browser; `locale` overrides it for this calendar.
- A server-rendered calendar hydrates cleanly. The heading above the grid ("March – April 2026") is the same on the server and in the browser: `Intl` in Node puts thin spaces around the dash, and the kit converts them to regular ones. The browser renders the "today" dot after mounting: the server does not know what day it is for the reader, so the first render has no dot.

## Accessibility and keyboard

- React Aria handles range selection, grid semantics and the keyboard.
- The start and end of the range look different from the middle; do not replace this with arbitrary cell classes.
- See `src/components/date-time/RangeCalendar.tsx`, `src/components/date-time/RangeCalendar.stories.tsx`, `tests/matrix.tsx`.

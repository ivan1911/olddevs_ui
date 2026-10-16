---
component: DatePicker
exports: [DatePicker, formatDate]
category: date-time
status: stable
source: src/components/date-time/DatePicker.tsx
story: src/components/date-time/DatePicker.stories.tsx
sourceHash: 389a684cb62f
---

# DatePicker

## Summary for AI

`DatePicker` is a ready-made trigger + popover for a single calendar date. The value the component accepts and returns is an ISO `YYYY-MM-DD` string, not a JS `Date`, so the time zone cannot shift the date.

## When to use

- A form needs a single day with a compact trigger and a calendar.
- Your API, URL or state already uses ISO strings.

## When not to use

- For custom placement of the grid, use `Calendar`.
- For date and time together, use `DateTimePicker`; for a range, use `DateRangePicker`.

## Minimal example

```tsx
<DatePicker value={publishDate} onChange={setPublishDate} minValue="2026-03-09" />
```

## Public API

- `value?: string | null`; `onChange(date: string)` receives an ISO string after the user picks a date.
- `minValue`, `maxValue`, `isDateUnavailable` limit the choice in the calendar; this is a UI boundary and does not replace server-side validation.
- `minValue` and `maxValue` are ISO strings `YYYY-MM-DD`, like `value` (`minValue="2026-03-09"`); there is no need to import `@internationalized/date` (the package itself stays a peer dependency of the kit). An `@internationalized/date` object is still accepted. An unparsable string is treated as an unset bound. `isDateUnavailable` receives a calendar object: `date.toString()` returns the day as a `YYYY-MM-DD` string.
- In `DateTimePicker` these bounds are calendar bounds, that is, day bounds: see [DateTimePicker](date-time-picker.md#public-api) for details.
- `placeholder`, `disabled`, `locale`, `triggerClassName` configure the control.
- `formatDate(isoDate, locale?)` is a public utility for displaying an ISO calendar date the same safe way; do not use `new Date("YYYY-MM-DD")` unless the date is a UTC instant.

## Accessibility and keyboard

- **The `FormField` hint and error are announced together with the field.** The
  description is passed through context, and `aria-describedby` is set on the
  trigger; the consumer's `aria-describedby` value is not overridden but merged
  with it. Before version 3.0.0 the react-aria component families did not pick up the form description — it was on
  screen but never reached the screen reader
  (ADR-0031).
- The popover uses `Calendar` with its grid and keyboard contract; it closes on selection.
- Associate an external label through `FormField` and `htmlFor` only when the trigger is bound to it in your composition; do not rely on the placeholder.
- See `src/components/date-time/DatePicker.tsx`, `src/components/date-time/DatePicker.stories.tsx`, `tests/matrix.tsx`.

---
component: Calendar
exports: [Calendar, NAV_BUTTON_CLASS, WEEKDAY_CELL_CLASS]
category: date-time
status: stable
source: src/components/date-time/Calendar.tsx
story: src/components/date-time/Calendar.stories.tsx
---

# Calendar

## Summary for AI

`Calendar` is a low-level controlled building block for picking a single React Aria `DateValue`. For a ready-made form field, use `DatePicker`; choose `Calendar` only for your own composition.

## When to use

- You need an inline calendar grid with React Aria props: `value`, `defaultValue`, `onChange`, unavailable dates and constraints.
- You need your own overlay or layout around the calendar.

## When not to use

- For ordinary compact date selection, use `DatePicker`.
- For a range with two bounds, use `RangeCalendar` or `DateRangePicker`.
- Do not store a calendar date as a `Date`: it has a time zone. Use `DateValue` at the `Calendar` boundary, or an ISO string in a ready-made `DatePicker`.

## Minimal example

```tsx
<Calendar value={date} onChange={setDate} locale="ru-RU" minValue={today(getLocalTimeZone())} />
```

## Public API

- Inherits React Aria's `CalendarProps<DateValue>`, including controlled/uncontrolled value, `minValue`, `maxValue`, `isDateUnavailable`.
- **A date is an object or an ISO string.** `value`, `defaultValue`, `minValue`, `maxValue` and `defaultFocusedValue` accept both an `@internationalized/date` object and a `YYYY-MM-DD` string, like `DatePicker`. There is no need to import `@internationalized/date` for this (the package itself comes with the kit): `minValue="2026-03-09"`. An unparsable string (`2026-02-29`, garbage from the address bar) does not throw: the value is treated as empty and the bound as not set.
- `onChange(value, iso)`: the first argument is a calendar object, as in React Aria (it always was); the second is the same day as an ISO string. Whoever stores the date as a string needs only `onChange={(_, iso) => setDate(iso)}`. What `onChange` receives does not depend on whether `value` is passed as an object or a string: existing calls with objects work unchanged.
- `isDateUnavailable` receives a calendar object: `date.toString()` returns the day as a `YYYY-MM-DD` string.
- Without `locale`, the locale comes from above: from `UiProvider`, the consumer's `I18nProvider` or the browser; `locale` overrides it for this calendar and affects labels and the first day of the week; `className` applies to the root.
- `NAV_BUTTON_CLASS` and `WEEKDAY_CELL_CLASS` are public style constants for a consistent custom composition, not separate components.

## Accessibility and keyboard

- React Aria implements `grid`, full accessible names for dates and keyboard navigation.
- Today is marked with a dot, the selected date with a fill; do not make the dot and the fill the only indicator of a date in your own markup around the calendar: React Aria provides the cell name (the full date).
- See `src/components/date-time/Calendar.tsx`, `src/components/date-time/Calendar.stories.tsx`, `tests/matrix.tsx`.

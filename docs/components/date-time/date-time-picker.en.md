---
component: DateTimePicker
exports: [DateTimePicker, maskTime, normalizeTime]
category: date-time
status: stable
source: src/components/date-time/DateTimePicker.tsx
story: src/components/date-time/DateTimePicker.stories.tsx
sourceHash: f7084730cbb6
---

# DateTimePicker

## Summary for AI

`DateTimePicker` is composed of `DatePicker` and `TimePicker`. The consumer stores the date and time separately: an ISO date without a time zone and an `HH:MM` time string.

## When to use

- You need user input for the publication/event date and time as two independent values.
- You need shared calendar-date constraints and a disabled state.

## When not to use

- For a single day without a time, use `DatePicker`.
- For an arbitrary calendar layout, compose `Calendar` and `TimePicker` yourself.
- Do not treat the result as a ready-made UTC timestamp: the time zone and server-side conversion belong to the domain.

## Minimal example

```tsx
<DateTimePicker date={date} onDateChange={setDate} time={time} onTimeChange={setTime} />
```

## Public API

- The contract is `date`, `onDateChange`, `time`, `onTimeChange`; `minValue`, `maxValue` (calendar, day bounds), `disabled`, `hourCycle` (`12` or `24`, as in `TimePicker`), `locale` and `timeZoneLabel` (a time-zone label to the right of the time) are also supported.
- The `minValue` and `maxValue` bounds are **calendar bounds, that is, day bounds**: calendar cells are dates without a time, and the comparison is by day. `minValue={…T14:00}` in the sense of "no earlier than an hour from now" will not work — the same day at nine in the morning passes. The component accepts no time bounds: "no earlier than an hour from now" depends on a time zone the kit does not know, and on the moment of submission, not rendering. This is a consumer rule.
- `maskTime(value)` is a public helper that coerces input to the `HH:MM` format; `normalizeTime(value, fallback)` normalizes a valid time. These are helpers, not components.
- Use strict date and time APIs; do not merge them into a `Date` at the UI boundary.

## Accessibility and keyboard

- The child pickers keep their own accessible names and keyboard contracts.
- See `src/components/date-time/DateTimePicker.tsx`, `src/components/date-time/DateTimePicker.stories.tsx`, `tests/matrix.tsx`.

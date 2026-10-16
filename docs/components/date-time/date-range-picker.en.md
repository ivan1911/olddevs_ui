---
component: DateRangePicker
exports: [DateRangePicker]
category: date-time
status: stable
source: src/components/date-time/DateRangePicker.tsx
story: src/components/date-time/DateRangePicker.stories.tsx
sourceHash: 084346a5a1d1
---

# DateRangePicker

## Summary for AI

`DateRangePicker` is a ready-made range picker: a trigger, `RangeCalendar`, relative presets and a separate clear control. `onChange` is called only after both bounds are picked.

## When to use

- In a filter or report, users pick "from/to" dates and often use "7 days", "30 days" and other presets.
- The consumer can store both an expanded `DateRange` and the original `RelativePeriod`.

## When not to use

- For an arbitrary range layout, use `RangeCalendar`.
- For a single date, use `DatePicker`.
- Do not use it to pick only the start of a range: the component emits only a complete range.

## Minimal example

```tsx
<DateRangePicker
  value={range}
  period={period}
  onChange={(nextRange, nextPeriod) => {
    setRange(nextRange);
    setPeriod(nextPeriod);
  }}
  onClear={() => {
    setRange(null);
    setPeriod(null);
  }}
/>
```

## Public API

- `value?: DateRange | null`, where the bounds are ISO strings; `period?: RelativePeriod | null` ties the selected preset to the range.
- `onChange(range, period)` receives `period=null` on a manual pick; `onClear` is required for the clear button to appear, because clearing must reset both values: `value` and `period`.
- `presets`, `timeZone`, `minValue`, `maxValue`, `defaultFocusedValue`, `locale` define the allowed ranges and relative presets.
- `minValue`, `maxValue` and `defaultFocusedValue` are ISO strings `YYYY-MM-DD`, like `value` (`minValue="2026-03-09"`); there is no need to import `@internationalized/date` (the package itself comes with the kit). An object is still accepted; an unparsable string is treated as an unset bound.
- `isDateUnavailable(date)` marks specific days unavailable — booked dates, holidays: in the calendar they are struck through and cannot be picked. The function receives a calendar object; `date.toString()` returns the day as a `YYYY-MM-DD` string. `RangeCalendar` and `DatePicker` have the same prop. Presets ignore the rule: they are clamped only by `minValue` and `maxValue`, and a preset that covers an unavailable day is picked as is — if that is not allowed, do not leave such a preset in `presets`.
- `open`/`onOpenChange` let you control the popover; otherwise internal state is used.

## Accessibility and keyboard

- The clear control is a separate button next to the trigger, not an interactive element inside a button.
- The two-month view appears at a screen width of 640 pixels and up; do not rely on an incomplete selection for a network request.
- Sources: `src/components/date-time/DateRangePicker.tsx`, `src/components/date-time/DateRangePicker.stories.tsx`.

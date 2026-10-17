---
component: TimePicker
exports: [TimePicker, upcomingSlots]
category: date-time
status: stable
source: src/components/date-time/TimePicker.tsx
story: src/components/date-time/TimePicker.stories.tsx
---

# TimePicker

## Summary for AI

`TimePicker` is a time field with a mask and a list of upcoming slots. The value the component accepts and returns is an `HH:MM` string; input is normalized on blur or confirmation. An empty field stays empty: since 3.6.0, moving focus out of it does not fill in `00:00`.

## When to use

- The user can quickly type an exact time or pick a convenient slot.
- The time is stored separately from the calendar date, for example in `DateTimePicker`.

## When not to use

- For a complete point in time that includes a date, use `DateTimePicker`.
- For a free-form string that is not necessarily a time, use `TextControl`.

## Minimal example

```tsx
<TimePicker value={time} onChange={setTime} step={30} aria-label="Publication time" />
```

## Public API

- `value?: string | null`; `onChange(time: string)` is required; `step` defaults to 30 minutes.
- `hourCycle?: 12 | 24` is the hour cycle of the field and the list; the default is `24` (`14:30`). With `12`, the field and the slots show `2:30 PM`; you can type `230p` or `2:30 PM`, and a typed 24-hour time (`14:30`) is accepted too. This affects only display and input: `value` and `onChange` stay `HH:MM`. The `AM` and `PM` labels and the `h:mm AM` mask come from the catalog (`timePicker.am`, `timePicker.pm`, `timePicker.placeholder12`). If no day period is typed, the day period of the previous value is used, and `AM` for an empty field.
- `placeholder` and `aria-label` come from the message catalog (`timePicker.placeholder`,
  `timePicker.label`): without a provider they are `HH:MM` and "Time", with `@olddevs/ui/locales/ru` —
  `ЧЧ:ММ` and "Время". A prop overrides the catalog string individually. `disabled` and `className` are available.
- `invalid` shows the field in an error state: the line under the time turns red (including when focused), and `aria-invalid` is set on the field. The validation rule stays with the consumer. Inside a `FormField` with `error` the prop is not needed: the flag comes from the form, as it does for `TextControl` and `NumberInput`, and an explicit `invalid={false}` clears it. The form's hint and error are also announced with the field — their `id` goes into `aria-describedby`.
- `upcomingSlots(step, now)` is a public utility that returns the full 24-hour list, starting from the nearest future slot. It is useful for presentation, but it is not a UI component.

## Accessibility and keyboard

- The input has combobox semantics; focus stays in the field, and the list reports the active slot through `aria-activedescendant`.
- The Down Arrow and Up Arrow keys move through the slots, Enter picks a slot or confirms the typed text, Escape closes the list and keeps bubbling up to the parent overlay.
- Sources: `src/components/date-time/TimePicker.tsx`, `src/components/date-time/TimePicker.stories.tsx`, `tests/timepicker.test.tsx`.

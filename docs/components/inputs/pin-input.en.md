---
component: PinInput
exports: [PinInput]
category: inputs
status: stable
source: src/components/inputs/PinInput.tsx
story: src/components/inputs/PinInput.stories.tsx
sourceHash: 9f00cd939372
---

# PinInput

## Summary for AI

Entry of a verification code: N single-digit fields that report **one string** as the value.
Pasting a whole code spreads it across the fields, Backspace on an empty field
moves focus back to the previous one, and `autocomplete="one-time-code"` is on the first field. The code is numeric.

## When to use

- A code from an SMS or an email, a PIN, a two-factor authentication code.

## When not to use

- For a password, use `PasswordInput`: one field and a show button.
- An alphabetic code is deliberately not supported, see below.

## Minimal example

```tsx
import { PinInput } from "@olddevs/ui";

const [code, setCode] = useState("");

<PinInput value={code} onChange={setCode} label="SMS code" />;
```

## Props

| Prop        | Default | Purpose                                                               |
| ----------- | ------- | --------------------------------------------------------------------- |
| `value`     | —       | The whole code, as a string.                                          |
| `onChange`  | —       | Called with a string, not an array or an event.                       |
| `length`    | `6`     | How many fields.                                                      |
| `label`     | —       | The accessible name of the group. Required, enforced by the compiler. |
| `disabled`  | —       | Disables all fields.                                                  |
| `autoFocus` | —       | Focuses the first field when the component appears.                   |
| `invalid`   | —       | Shows the code in an error state: the field borders turn red.         |

## The value is a string, and it has no holes

The consumer needs the whole code: it goes into a request as one string, and
every caller would have to parse an array.

A consequence follows: the fields are a **display of one
value**, not N independent ones. Deleting a character in the middle shifts the
rest to the left, as in a regular text field.

Clearing a field and typing a non-digit are different events. On focus the content
of the field is selected, so a letter typed over an occupied digit is reported as a
replacement of the selection. If the component did not tell them apart, it would
erase a digit because of a character it never even showed.

## Paste is intercepted, not left to the browser

The SMS delivers the code as a whole, and the user pastes it into the first
field. With `maxLength=1` the browser itself trims the pasted text to the first
digit — so the component handles the paste event: the digits are taken from
the text and spread across the fields starting from the current one.

`autocomplete="one-time-code"` is on the **first** field — this is how the browser
and iOS offer the code from the notification; on the others it would get in the way.

## The code is numeric — and that is a decision

`inputMode="numeric"` and `one-time-code` are about digits, and the input filter is
the same here: everything except digits is dropped, both on input and on paste. An
alphabetic code would need a second axis and case rules; it will be added when a
screen needs it, not before.

## Error: `invalid`

`invalid` turns the borders of all the code fields red and sets `aria-invalid` on each field.
The validation rule stays with the consumer: the prop only shows the result.

Inside a `FormField` with `error` you pass no prop — the flag arrives from the form the same way as
for `TextControl` and `NumberInput`, and the fields turn red together with the text below them. An
explicit `invalid={false}` clears it: the consumer knows more about their field than the form does.
A hint without an error does not make the code invalid.

## Keyboard

- typing a digit — focus moves forward;
- Backspace on an empty field — a step back **with deletion** of the previous
  digit: otherwise focus runs into an empty field and there is nothing to erase;
- Left Arrow and Right Arrow move between the fields;
- focus selects the field content: with `maxLength=1`, typing over an occupied
  field otherwise does not go through at all.

Each field is named ("Digit 3 of 6"): without names the screen reader reads six
nameless fields in a row.

## Related sources and tests

- Implementation: `src/components/inputs/PinInput.tsx`; the wave contents are in
  ADR-0024.
- Tests: `tests/pin-input.test.tsx` — paste of a whole code and from the middle,
  the digit filter, Backspace, arrow keys, field names, trimming by length.
- Story: `src/components/inputs/PinInput.stories.tsx`.

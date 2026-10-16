---
component: MaskedInput
exports: [MaskedInput, formatMask, unmask, maskCapacity]
category: inputs
status: stable
source: src/components/inputs/MaskedInput.tsx
story: src/components/inputs/MaskedInput.stories.tsx
sourceHash: 9fcb60e26838
---

# MaskedInput

## Summary for AI

A field with an input mask, built on `TextControl`. The mask comes as a prop — the
kit knows nothing about the domain. The value is **unmasked**; the display is
formatted; both are passed to the consumer. The caret is what the component exists for.

## When to use

- Input in a fixed format: a date, a document series and number, a code, an account number.
- A phone number — there is a ready-made `PhoneInput` built on the same engine.

## When not to use

- For amounts and any other numbers, use `NumberInput` with `formatOptions`: there
  the grouping separators and the decimal separator come from the locale, and a mask would
  hard-wire them.
- For a date with a calendar, use `DatePicker`.

## Minimal example

```tsx
import { MaskedInput } from "@olddevs/ui";

const [value, setValue] = useState("");

<MaskedInput mask="99.99.9999" value={value} onChange={(raw) => setValue(raw)} aria-label="Date" />;
```

## Props

| Prop             | Default | Purpose                                                                 |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| `mask`           | —       | The pattern: `9` is a digit, `a` is a letter, `*` is a digit or letter. |
| `value`          | —       | The unmasked value, without the mask literals.                          |
| `onChange`       | —       | `(raw, formatted)` — both representations at once.                      |
| `showMask`       | `true`  | Show the format in the field itself: `+7 (___) ___-__-__`.              |
| `shellClassName` | —       | Classes for the shell with the border.                                  |
| the rest         | —       | Passed straight through to the `input`.                                 |

## How the user learns the format

Two ways at once, and they do not replace each other.

**A mask guide in the field itself.** An empty field shows the whole mask,
literals included: `+7 (___) ___-__-__`; as you type, it is consumed from left to
right. Before kit version 2.4.0 the format was **not** communicated **at all**: `formatMask` stops
where the value ends, so an empty field was an empty rectangle, and a half-filled
one a stump with no remainder.

The mask guide is decoration: it is `aria-hidden` and does not reach the screen
reader. Turn it off with `showMask={false}` where the format is already stated
nearby and repeating it in the field is noise: a short well-known mask in a dense
table, a field under a label with an example.

**The `FormField` hint.** It is the format for the screen reader: tied to the field
through `aria-describedby`, so it is read on entering the field and stays available
when the user checks what they typed. By then the mask guide has already been replaced
by the input, and the hint has not.

The format is not set with a placeholder: it disappears at the very first character,
that is, exactly when it is needed for checking. The analysis and sources are in ADR-0026.

## A character that does not fit is announced

A character that did not fit its token is dropped — but not silently: a live region
next to the field says what was expected here ("A digit is expected here"), and a
filled mask answers that there is no more room.

Exactly one typed character is parsed: per-character announcements for fifteen
characters are noise, and text in the wrong format is caught by value validation,
not by the input field.

When text is pasted, what is counted is not which characters it contains but how
many did not fit. A value that did not fit the mask is truncated — and the
truncation is announced aloud, because the result looks plausible and therefore
goes unnoticed: `89161234567`, a common form of a Russian phone number on the
clipboard, with the mask `+7 (999) 999-99-99` turns into `+7 (891) 612-34-56`,
that is, into someone else's number. The mask takes the leading "8" as the first
digit, everything shifts and the last digit falls off.
Neither the component nor the eye notices this, so the live region does.

Silent dropping is not a minor thing: the reference implementation of
[USWDS](https://designsystem.digital.gov/components/input-mask/accessibility-tests/)
failed the WCAG 3.3.3 test on it (there, a mismatched character also cuts off the
whole rest of the input).

## The value is unmasked, the display is formatted

Storing the format means storing a display decision: the mask can change, while
the brackets recorded with it stay in the database forever.

**Both** representations are passed to the consumer: the unmasked one is needed by a
request, the shown one by whoever stores the text as is. Passing only one forces
many consumers to reformat.

Parsing is positional, together with the mask, not "throw out everything that
looks like a literal": in the mask `+7 (999)` the literal `7` is also a digit, and
a naive filter would carry it into the value, making the number eleven digits long.

## The caret and Backspace

Formatting redraws the whole string, and after that the browser puts the caret at
the end — editing the middle of a number becomes impossible. The position is
computed from the mask: the caret stays after the same number of value
characters that were to its left.

**Backspace across a literal deletes a value character, not the literal.**
Otherwise the caret runs into `)`: the literal is deleted, comes right back with
the formatting, and the keypress changes nothing — the defect looks like a stuck key.

A paste needs no separate handler: the pasted text arrives in the same input event
and is fitted to the mask in the same way as typed text.

This is checked in a live browser (`tests-visual/interactions.spec.ts`): the caret
position after a redraw is native mechanics that jsdom does not have.

## There is no escaping in the mask

There is no way to express the literal `9`. This is a limitation, not an
oversight: none of the kit's formats needs a mandatory literal digit, and
`\` would turn the mask into a syntax that needs separate documentation. If such a
format appears, escaping will appear too.

## The pure mask functions are available separately

`formatMask(raw, mask)`, `unmask(display, mask)` and `maskCapacity(mask)` are
exported: they are handy for preparing a value before sending or for checking
completeness without mounting the component.

## Related sources and tests

- Implementation: `src/components/inputs/MaskedInput.tsx`, mechanics in `src/lib/mask.ts`;
  the scope of the wave is in ADR-0024.
- Tests: `tests/mask.test.ts` — formatting, parsing, the caret on strings;
  `tests/masked-input.test.tsx` — input, paste, Backspace across a literal, both
  representations; browser one — the caret after a redraw.
- Showcase stories: `src/components/inputs/MaskedInput.stories.tsx`.

---
component: PhoneInput
exports: [PhoneInput, RU_PHONE_MASK]
category: inputs
status: stable
source: src/components/inputs/PhoneInput.tsx
story: src/components/inputs/PhoneInput.stories.tsx
---

# PhoneInput

## Summary for AI

`MaskedInput` with a phone mask, `inputMode="tel"` and `autocomplete="tel"`.
There is **one fixed format**, set by a prop. The number is not parsed, the
country is not detected, there is no validation.

## When to use

- A phone field in a form where the format is known in advance.

## When not to use

- For international input with country detection, this component is the wrong choice:
  it cannot do this and never will, see below.
- For any other format, use `MaskedInput` with your mask.

## Minimal example

```tsx
import { PhoneInput } from "@olddevs/ui";

const [phone, setPhone] = useState("");

<PhoneInput value={phone} onChange={(raw) => setPhone(raw)} aria-label="Phone" />;
```

## Props

| Prop       | Default              | Purpose                                                               |
| ---------- | -------------------- | --------------------------------------------------------------------- |
| `mask`     | `+7 (999) 999-99-99` | The number format. `RU_PHONE_MASK` is exported.                       |
| `value`    | —                    | Unmasked digits without literals.                                     |
| `onChange` | —                    | `(raw, formatted)` — as in `MaskedInput`.                             |
| `showMask` | `true`               | The format is visible in the field itself: `+7 (___) ___-__-__`.      |
| the rest   | —                    | Passed to the `input`; `inputMode` and `autoComplete` are overridden. |

## The "format from the locale" promise is withdrawn

The kit's original specification introduced `PhoneInput` with a locale-based format. The promise was withdrawn
deliberately (ADR-0024):

- `Intl` does **not format** phone numbers at all — there is nothing in the locale to
  take a format from;
- proper parsing means `libphonenumber`, which weighs hundreds of kilobytes and would be a
  kit dependency that an admin panel without phone numbers has no reason to pull in;
- a mask for one format is wrong for other countries, and this page states that
  limitation.

So the format is a prop with a default, not a derived value. A default is a
choice, not the truth.

## What the component does not do

It does not parse the number, does not keep a list of countries, **does not
validate**. This is the first time the kit deals with a specific domain, and the
boundary is drawn narrowly: a mask and two attributes. `Form` deliberately declines
to validate, and `PhoneInput` does not reconsider that: the rules for deciding
whether a number is real stay with whoever submits it.

## Related sources and tests

- Implementation: `src/components/inputs/PhoneInput.tsx` — a thin layer over
  [MaskedInput](masked-input.md).
- Tests: `tests/phone-input.test.tsx` — the default mask, a non-default format, both
  representations passed to `onChange`, overridden attributes, no validation.
- Story: `src/components/inputs/PhoneInput.stories.tsx`.

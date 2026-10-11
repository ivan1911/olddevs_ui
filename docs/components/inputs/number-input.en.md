---
component: NumberInput
exports: [NumberInput]
category: inputs
status: stable
source: src/components/inputs/NumberInput.tsx
story: src/components/inputs/NumberInput.stories.tsx
sourceHash: e9b0a093db1d
---

# NumberInput

## Summary for AI

`NumberInput` is a controlled numeric field with step buttons. An empty field returns `null`, not `0` and not `NaN`.

## When to use

- You need numeric input with `min`, `max`, `step` or `Intl.NumberFormat` formatting.
- A form needs a field with an accessible name and "less/more" steps.

## When not to use

- For a free-text identifier or code, use `TextControl`; for a phone number there is `PhoneInput`.
- For continuous selection on a visual scale, use `Slider`/`RangeSlider`.

## Minimal example

```tsx
<NumberInput
  label="Publication limit"
  value={limit}
  onChange={setLimit}
  min={0}
  max={100}
  step={1}
/>
```

## Public API

- `value` and `onChange` are required; the value `null` means an empty input.
- `label` is required and ties the name to the inner React Aria input; the `FormField` wrapper does not replace it.
- `formatOptions` is passed to `Intl.NumberFormat`; `invalid` only shows the invalid state; the validation rule stays with the consumer. Inside a `FormField` with `error` the flag arrives from the form on its own; an explicit `invalid={false}` clears it.
- `shellClassName` applies to the border, `className` to the root NumberField.

## Currency is a `NumberInput`, not a separate component

`CurrencyInput` **does not exist** in the kit, and this is a decision
(ADR-0024), not a gap.
A currency field comes down to `formatOptions`:

```tsx
<NumberInput
  label="Amount"
  value={amount}
  onChange={setAmount}
  formatOptions={{ style: "currency", currency: "RUB" }}
/>
```

`Intl.NumberFormat` inside react-aria formats the currency, parses the input and
takes the grouping separators and the decimal separator **from the locale**: in `ru-RU`
that is `1 234,56 ₽`, in `en-US` — `$1,234.56`. A separate component would be a
wrapper with no logic of its own, like a `ThemeSwitcher` over `Segmented`.

Percentages and units of measure are handled by `Intl.NumberFormat` too:

```tsx
<NumberInput label="Discount" formatOptions={{ style: "percent" }} />
<NumberInput label="Weight" formatOptions={{ style: "unit", unit: "kilogram" }} />
```

A mask is no help here: `MaskedInput` would hard-wire the separators, and in
another locale the field would show the format of another locale.

## Accessibility and forms

- The step buttons get their names from `label` automatically.
- Do not turn emptiness into zero: it changes the meaning of the data.
- Source: `src/components/inputs/NumberInput.tsx`; checks — `tests/number-input.test.tsx`.

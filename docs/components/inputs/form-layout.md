---
component: FormLayout
exports: [FormLayout, FieldRow]
category: inputs
status: stable
source: src/components/inputs/FormLayout.tsx
story: src/components/inputs/FormLayout.stories.tsx
---

# FormLayout and FieldRow

## Summary for AI

Form layout: `columns` (1 or 2) and `labels` (`top` or `side`), plus
`FieldRow` for a full-width field. Only the position of nodes — no validation,
no field composition, no state. Side labels are supported only by `FormField`:
it renders the label.

## When to use

- A form with several fields: settings, editing an entity, registration.
- You need labels in a left column or two columns of fields.

## When not to use

- For submitting and locking during a request — that is `Form`; the two are used together.
- For a group of fields with a shared heading — the native `<fieldset>` and `<legend>`.
  The kit has no separate `Fieldset` on purpose: a wrapper around them would add
  nothing but a name in the exports.

## Minimal example

```tsx
import { FieldRow, FormField, FormLayout, TextControl } from "@olddevs/ui";

<FormLayout columns={2} labels="side" labelWidth="8rem">
  <FormField label="First name" htmlFor="name">
    <TextControl id="name" shellClassName="w-full" />
  </FormField>
  <FormField label="Last name" htmlFor="surname">
    <TextControl id="surname" shellClassName="w-full" />
  </FormField>
  <FieldRow>
    <FormField label="Address" htmlFor="address">
      <TextControl id="address" shellClassName="w-full" />
    </FormField>
  </FieldRow>
</FormLayout>;
```

## Props

| Prop         | Default | Purpose                                                       |
| ------------ | ------- | ------------------------------------------------------------- |
| `columns`    | `1`     | Number of columns. On narrow screens there is always one.     |
| `labels`     | `"top"` | Where field labels go: above the field or in the left column. |
| `labelWidth` | `12rem` | Width of the label column — any CSS length.                   |

`FieldRow` has no props: it is a `div` with `col-span-full`.

## A CSS grid, not a JS calculation

A single column on narrow screens is switched on by a media query (`sm:grid-cols-2`),
not by `matchMedia`. A layout that depends on JS is wrong before
hydration, and the first frame of the form is exactly that moment.

`FieldRow` takes **all** the columns (`col-span-full`), not a fixed two:
`col-span-2` in a one-column layout would create an implicit second column, and
the form would fall out of alignment where nothing was changed.

## `labels="side"` applies to `FormField`, not to arbitrary children

This follows from the field rendering its own label: the layout cannot move it
into the left column, and only passes the axis through context
(ADR-0025).

The layout sets the position for **any** child — a bare `<input>`, a field from
another library, a whole block. But it knows nothing about their labels, and
`labels="side"` silently changes nothing for them. An explicit `layout` on the
field wins over the layout.

The column width lives in the `--form-label-w` variable; `labelWidth` is the dedicated
prop for setting it, and it wins over the same variable passed through `style`.

## What the component does not do

No validation, no field composition, no state — `Form` deliberately gave up its own
validation, and the layout does not revisit that. A boundary violation can be
recognized by a test: a prop that affects not the position of nodes but their composition.

## Related sources and tests

- Implementation: `src/components/inputs/FormLayout.tsx`, the label axis is in
  `src/components/inputs/FormField.tsx`.
- Tests: `tests/form-layout.test.tsx` — both axes, priority of the field prop,
  `FieldRow` in both layouts, children from outside the kit; `tests/form-field.test.tsx` —
  identical field markup without the axis.
- Showcase stories: `src/components/inputs/FormLayout.stories.tsx`.

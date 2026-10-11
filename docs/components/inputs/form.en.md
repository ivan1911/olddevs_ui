---
component: Form and FormField
exports: [Form, FormField]
category: inputs
status: stable
source: src/components/inputs/Form.tsx
story: src/components/inputs/Form.stories.tsx
sourceHash: aea08fad91f4
---

# Form and FormField

## Summary for AI

`Form` standardizes submit and locking during a request, but does not create a validation system. `FormField` combines label, control, hint and error; the rules and the error state belong to the consumer.

## When to use

- You need to prevent a repeated form submission through `pending`.
- Ordinary controls need an associated label, a hint and a consistent way to show errors.

## When not to use

- Do not look for a global `validationErrors` prop: there is no such public API.
- Do not expect `FormField` to replace the `label` of components built on React Aria: `NumberInput` still requires its own `label`.

## Minimal example

```tsx
<Form pending={saving} onSubmit={submit}>
  <FormField label="Name" htmlFor="name" required error={errors.name} hint="Up to 80 characters">
    <TextControl id="name" value={name} onChange={(e) => setName(e.target.value)} required />
  </FormField>
  <Button type="submit">Save</Button>
</Form>
```

## Public API

- `Form.onSubmit` is required; the component prevents native submit and does not call the callback while `pending`.
- `pending` disables the children through a fieldset, including fields added later. A `RichTextEditor` inside `<fieldset disabled>` (including one set by the consumer, not only `Form pending`) is disabled the same way as a native field.
- `Form` sets `noValidate` (`validationBehavior="aria"`): the browser's native validation does not work in it, and a required `RichTextEditor`, like a native `required`, does not block submission — the consumer shows the error through `FormField error`.
- `FormField`: `label` is required, `htmlFor` ties it to the control's `id`, `error` replaces `hint`, `required` renders only a visual asterisk. `hintPersistent` keeps a rule hint ("8–64 characters, a digit and a letter") under the field even with an error. The error goes under it, and both describe the field; an explanatory hint ("how should we address you") is still replaced by the error (ADR-0065).
- `error` is carried all the way **to the field**: kit fields read the invalid flag from context and set `aria-invalid` themselves, so the border turns red too, not only the text under the field. An explicit `aria-invalid` on the field wins — the consumer knows more about their field than the form does.

## The `layout` axis on `FormField`

`layout="stack"` (the default) — the label above the field, as it always was;
`layout="side"` — the label in the left column, the field, the note and the error on the right.

The axis lives **on the field, not on the layout**: `FormField` renders the label,
and the layout cannot move it into the left column — it sits inside
its own flex. The analysis is in
ADR-0025.

Without the prop, the field takes the axis from the nearest `FormLayout`; without
a layout it is `stack`, and the markup does not change by a single node (this is
checked by a test on the whole markup). An explicit prop wins over context.

The width of the label column is the `--form-label-w` variable with a default of
`12rem`; `subgrid` is not used, because it requires an outer grid with a known
number of tracks, and the field must also work on its own:

```tsx
<div style={{ "--form-label-w": "8rem" }}>
  <FormField label="Narrow column" htmlFor="x" layout="side">
    <TextControl id="x" />
  </FormField>
</div>
```

A long label wraps inside its column and does not move the field.

In the side layout, the field, the note and the error sit in **one** column as a
whole, not one cell per node. A grid places children into cells, not by meaning,
and a second child (a "from" and "to" range, a field with a button next to it)
would otherwise land in the next row under the label.

## Accessibility and forms

- Set both `htmlFor` and `id`; a placeholder does not replace a label.
- The FormField error is announced with `role="alert"`; the field itself must also be marked as required, through `required` or `aria-required`.
- **The hint and error are tied to the field through `aria-describedby`.** `FormField` generates the `id`, and the kit fields pick it up — `TextControl` and everything built on it (`MaskedInput`, `PhoneInput`, `PasswordInput`, `SearchControl`), `NumberInput`, `Select`, `Combobox`, `DatePicker`, `TagInput` and others. This does not override the field's own description: a description passed as a prop is extended, not replaced.
- The role and the description share the duties: `role="alert"` announces the error the moment it appears (it appears after submit, when focus has already moved away), while the description is read on returning to the field. The analysis is in ADR-0026.
- The value format is a hint, not a placeholder: a placeholder disappears at the first character, that is, exactly when it is needed to check what was typed.
- **The label publishes its own `id` through context.** `<label for>` names only the native `input`, `textarea`, `select`; a field that is not among them (the `contenteditable` of `RichTextEditor`) refers to the label through `aria-labelledby`. So `FormField` puts a stable `id` (from `useId`) on the `<label>` and hands it to the fields the same way as the description and the invalid state. Only `RichTextEditor` reads it; the consumer does not need to know the label's `id`, and `htmlFor` is still set — native fields need it. The `FormField` markup changes by one attribute — the label's `id`.
- Sources: `src/components/inputs/Form.tsx`, `src/components/inputs/FormField.tsx`; tests `form.test.tsx`, `form-field.test.tsx`.

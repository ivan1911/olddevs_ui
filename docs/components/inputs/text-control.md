---
component: TextControl
exports: [TextControl]
category: inputs
status: stable
source: src/components/inputs/TextControl.tsx
story: src/components/inputs/TextControl.stories.tsx
---

# TextControl

## Summary for AI

`TextControl` is a base text field or textarea with a shared form shell. Whoever owns the state uses either the regular React `value`/`onChange` contract or `defaultValue`; the component does not convert the value into a domain string.

## When to use

- Single-line text, a multi-line description, a password or another native input.
- You need the `icon` and `trailing` slots, a shared border and focus with other fields.
- For a textarea you need `as="textarea"`; for growing text — `autosize` and, if needed, `maxRows`.

## When not to use

- For search with a built-in magnifier and clearing, use `SearchControl`.
- For numbers, a step and local formatting, use `NumberInput`.
- For a closed set, use `Select`; for a free value with a list of options, use `Combobox`.

## Minimal example

```tsx
<TextControl id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
<TextControl as="textarea" rows={3} autosize maxRows={6} showCount maxLength={500} />
```

## Public API

- Accepts the native input props. `as` is `input` (the default) or `textarea`; `rows` applies only to a textarea.
- `shellClassName` styles the shell, `className` the control itself; do not mix them if you change the width/border.
- `icon` and `trailing` sit inside the shared shell. For a textarea the counter from `showCount` is shown at the bottom; for an input — on the right.
- `autosize` works only with a textarea: `rows` becomes the minimum, `maxRows` limits the growth.
- `underlay` renders a layer **under** the value, in the same line: a mask guide, a format sample. It is not a slot next to the field but a layer under it — hence not `icon`/`trailing`. Alignment is held by a shared field class and a shared grid cell, not by pixel fitting. The component itself sets `aria-hidden` on the layer and turns off pointer events and text selection on it: there is nothing to read there, and if it intercepted clicks, clicking the field's own text would no longer focus the field. The layer is for a single-line field only: it has no effect together with `autosize`.

## Height step

| `size` | Height | When                                                                |
| ------ | ------ | ------------------------------------------------------------------- |
| `md`   | 42 px  | The default. A form: the field sits among labels and other fields   |
| `sm`   | 36 px  | A control panel: the field sits in a row with a button and `Select` |

Thirty-six is not an invented number: it is the height of `Button size="md"` and of
the `Select` pill trigger, that is, the height the kit itself has already chosen twice.
Before the step, this field was the only one that fell out of this row.

**Only the vertical padding** changes: the border, corner radius, shadow, font and
line box are the same. The hit area stays above the threshold — 36 is one and a
half times the minimum WCAG 2.5.8 target.

**The step does not apply to `as="textarea"`.** There the height is governed by
`rows` and `autosize`, and a third system competing with them for the same number
would give a field that collapses after every keystroke.

**`shellClassName` and `className` are still there.** Corner radius, width and
background genuinely differ between products, and the step does not replace them: it
covers only the height — the one dimension that two products had already worked out separately,
arriving at different numbers.

The compact field of an `EditableList` row is not this step but 32 px of the row
height itself: there the number comes from the list row, not from a scale.

## Accessibility and forms

- Pass `id` and tie it to `FormField htmlFor`; a placeholder does not replace a label.
- The `FormField` hint and error are announced automatically: the field takes their `id` values from context and adds them to `aria-describedby`. A description passed as a prop is not replaced: the ids are added to it — the attribute holds a list (ADR-0026).
- `disabled` also makes the shell inactive; `readOnly` keeps the value readable.
- See `src/components/inputs/TextControl.tsx`, `src/components/inputs/TextControl.stories.tsx`.

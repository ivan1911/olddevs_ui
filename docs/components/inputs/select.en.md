---
component: Select
exports: [Select]
category: inputs
status: stable
source: src/components/inputs/Select.tsx
story: src/components/inputs/Select.stories.tsx
sourceHash: cf9905bc2278
---

# Select

## Summary for AI

`Select` picks a value only from the closed list `items`. `searchable` filters that list but does not allow free input. `multiple` changes the shape of value and the callback to an array.

## When to use

- The values are known in advance: a category, a status, a collection, a set of filters.
- You need search within a long but still closed list.
- You need one or several selected items with a type-safe value shape.

## When not to use

- If the user may create a new value, use `Combobox`.
- If you need checkboxes with complex markup that differs from one to the next, use `CheckboxGroup`.
- If you need exactly one mode, always selected, use `Segmented`.

## Minimal example

```tsx
<Select items={[{ id: "draft", label: "Draft" }]} value={status} onChange={setStatus} placeholder="Status" clearable />

<Select multiple items={tags} value={tagIds} onChange={setTagIds} searchable countLabel={(n) => `Selected: ${n}`} />
```

## Public API

- An item must have `id` and `label`; `keywords`, `meta`, `renderMedia` and domain fields are optional.
- Without `multiple`: `value?: SelectId | null`, `onChange(id | null)`; with `multiple: true`: `value?: SelectId[]`, `onChange(ids)`. Clearing produces `null` or `[]` respectively.
- `searchable` is false by default; `clearable`, `highlightSelected`, placeholders, `icon`, `triggerClassName`, `contentClassName` configure the presentation.
- `disabled` disables the whole field: the trigger cannot be focused, the panel does not open (and an open one closes), the clear button disappears, the pill is dimmed. Behavior and look are as with `Button` and `TextControl`.
- `aria-label` (or `aria-labelledby`, a reference to a label that is already rendered) sets the field's name. The name is **combined** with the trigger content and does not replace it: the field is announced as "Icon, Circle, button". If both are set, `aria-labelledby` wins.
- `missingLabel` labels a value for which no item was found in `items`: this happens while the list is loading and when the record was deleted. By default the key itself is shown — it is more honest than a placeholder if it is human-readable; for machine identifiers (UUIDs) set the label yourself.
- For a wide form the label limit can be lifted: `triggerClassName="[--select-label-max:none]"`.
- **Anything you put in the trigger's text row must fit in 20 px.** The trigger row is a `leading-5` line box, and the control's height depends on it: a filter pill is 36 px (the same as a `Button` of size `md`), and a trigger in a form with `py-2.5` padding is 42 px (the same as `TextControl`, `NumberInput`, `SearchControl` and `DateRangePicker`). A taller child stretches the trigger and throws it out of line with the fields next to it. That is why `renderMedia(item, px)` receives the side of the square as a number, 20 in the trigger and 28 in the list, and you should draw exactly that. This does not apply to the `icon` and `trailing` slots of the input fields: they sit beside the field rather than in its text row.
- A custom font size in `triggerClassName` keeps the height only if it is a step of the [type scale](../../theming.md#типографическая-шкала): every step sets its own line box. An arbitrary `text-[15px]` displaces the `text-[13px] leading-5` pair as a whole, and the height is again derived from the `1.5` multiplier.

## Accessibility and keyboard

- **The hint and error of `FormField` are announced together with the field.** The
  description arrives through context, and `aria-describedby` is set on the trigger;
  the value set by the consumer is not replaced but merged with it. Before version 3.0.0 the
  components built on react-aria did not pick up the form description — it was on the screen
  but did not reach the screen reader
  (ADR-0031).
- The trigger reports `aria-haspopup="listbox"` and the expanded state; clearing is a separate button.
- **The field name in a form is set by `aria-label` or `aria-labelledby`, not by
  the `FormField` label.** A composite control does not accept an `id`, so there is
  nothing for `htmlFor` to bind to: without an explicit name the screen reader
  announces only the trigger content — "No icon, button" — and two such fields side
  by side cannot be told apart by ear. In a filter bar no name is needed: there the
  placeholder is the name of the filter. The name from `aria-label` goes into a hidden node and is
  read **together** with the value; a plain `aria-label` on the button would win over
  the content, and the field would stop reporting what is selected in it (the same
  technique is in `TreeSelect`).
- In the list, the arrow keys, Home/End, Enter/Space and Escape work. In searchable mode the arrow keys move focus between the search and the list.
- Sources: `src/components/inputs/Select.tsx`, `src/components/inputs/Select.stories.tsx`, `tests/select.test.tsx`.

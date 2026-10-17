---
component: Combobox
exports: [Combobox]
category: inputs
status: stable
source: src/components/inputs/Combobox.tsx
story: src/components/inputs/Combobox.stories.tsx
---

# Combobox

## Summary for AI

`Combobox` combines free text input with a list of options. Picking from the list helps, but the value may not match `items`; this is what fundamentally sets it apart from `Select`.

## When to use

- The user may type a new tag, address, name or other valid text.
- You need a list of options and filtering while typing.

## When not to use

- You need a strictly closed vocabulary — `Select`, including with `searchable`.
- You need to enter several tags — `TagInput`.

## Minimal example

```tsx
<Combobox
  aria-label="City"
  items={[{ id: "msk", label: "Moscow" }]}
  inputValue={city}
  onInputChange={setCity}
  allowsCustomValue
/>
```

## Public API

- `items` is an array of `{ id, label, meta? }`; `meta` is shown in the right column.
- The other supported props come from React Aria ComboBox: use controlled `inputValue`/`onInputChange`, and `selectedKey`/`onSelectionChange` only when the scenario needs it.
- `menuTrigger` is `focus` by default, so the list of options is visible on entering the field; `notFoundText` configures the empty list.
- `placeholder` belongs to the field, `className` to the root.

## Accessibility and keyboard

- **The hint and error of `FormField` are announced together with the field.** The
  description arrives through context, and `aria-describedby` is set on the input;
  an `aria-describedby` passed by the consumer is not overridden but extended with
  the form description. Before kit version 3.0.0 the react-aria components did
  not pick up the form description — it was on the screen
  but did not reach the screen reader
  (ADR-0031).
- React Aria provides the combobox behavior, filtering and `aria-activedescendant`.
- **Inside `Dialog` and `Drawer` an option can be selected with the mouse.** The list
  lives in a react-aria portal under `<body>`, where the Radix modal layer disables
  pointer events; the kit gives it back to the overlay with a rule in
  `@olddevs/ui/styles.css`. Before this fix an option could be selected only from
  the keyboard.
- Provide an accessible name through `aria-label` or an associated label.
- See `src/components/inputs/Combobox.tsx`, `src/components/inputs/Combobox.stories.tsx`, `tests/combobox.test.tsx`.

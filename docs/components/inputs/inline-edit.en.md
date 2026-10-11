---
component: InlineEdit
exports: [InlineEdit]
category: inputs
status: stable
source: src/components/inputs/InlineEdit.tsx
story: src/components/inputs/InlineEdit.stories.tsx
sourceHash: b0f02517df86
---

# InlineEdit

## Summary for AI

Edit a value in place: value button → field → confirmation.
The confirmed value arrives as a prop and the component does **not store** it.
Escape restores both the value and the focus on the button.

## When to use

- A field that is read more often than edited: a title in a card, the properties
  of an object, a cell of a settings list.

## When not to use

- In a form that is filled in as a whole, use a regular field in `FormField` instead.
- When the edit has to be confirmed with a "Save" button together with the other
  fields: `InlineEdit` confirms by itself, on Enter or when focus leaves.

## Minimal example

```tsx
import { InlineEdit } from "@olddevs/ui";

const [title, setTitle] = useState("Daily digest");

<InlineEdit value={title} onChange={setTitle} label="Title" />;
```

## Props

| Prop              | Default         | Purpose                                                                 |
| ----------------- | --------------- | ----------------------------------------------------------------------- |
| `value`           | —               | The confirmed value. The component does not store it.                   |
| `onChange`        | —               | Confirmation. Called **only** when the value has changed.               |
| `label`           | —               | The accessible name of the field. Required, enforced by the compiler.   |
| `editing`         | —               | Controlled edit mode. Without the prop the component manages it itself. |
| `onEditingChange` | —               | Reports the intent to open or close editing.                            |
| `placeholder`     | message catalog | What to show on the button when the value is empty.                     |
| `disabled`        | —               | Disables both the button and the field.                                 |

## The confirmed value is not stored

Only the draft lives inside — what is being typed right now. The confirmation is passed to the parent, and in the next frame the value comes back as a prop.

The difference shows where it matters: if the server refused to save and the
consumer did not change `value`, the component shows the **previous** one, not an
invented one of its own. The draft also starts from the current value on every
open — between edits it may have been changed by the parent.

## Focus handling is the core of this component

- **Opening** puts the focus in the field instead of leaving it on the button:
  otherwise a keyboard user would open the field and type into nothing.
- **Escape** restores the previous value **and** the focus on the button. This is
  a requirement: without a way to cancel, someone who started editing by
  mistake cannot leave without saving — a click elsewhere confirms, Enter confirms.
- **Enter** confirms and also returns focus: the field disappears, and without
  returning focus it would have gone to `<body>`.
- **A click elsewhere** confirms and does **not** take the focus: the user went
  where they wanted.

Cancel clears its flag **when editing opens**, not only in the blur handler: after
Escape the field unmounts and `blur` never arrives — the flag would stay raised,
and the next edit would silently not be confirmed by a click elsewhere.

This is checked in a live browser (`tests-visual/interactions.spec.ts`): in jsdom
`document.activeElement` after unmounting behaves differently, and the test would
pass on a broken component.

## The button name is built from the content

The value has to be in the accessible name: "Daily digest, edit". An `aria-label`
would override it, and the screen reader would announce "edit title" without
reading what is written there.

## Related sources and tests

- Implementation: `src/components/inputs/InlineEdit.tsx`; the scope of the wave is in
  ADR-0024.
- Tests: `tests/inline-edit.test.tsx` — the three transitions, cancel, no storing,
  controlled mode; browser ones — focus return and a click elsewhere.
- Showcase stories: `src/components/inputs/InlineEdit.stories.tsx`.

---
component: KeyboardAccessibility
exports: [Keyboard, VisuallyHidden]
category: content
status: stable
source: src/components/content/Keyboard.tsx, src/components/content/VisuallyHidden.tsx
story: src/components/content/Keyboard.stories.tsx, src/components/content/VisuallyHidden.stories.tsx
sourceHash: 35adb64d94db
---

# Keyboard and VisuallyHidden

## Summary for AI

`Keyboard` is a controlled on-screen keyboard for an existing text field: it edits
the string and the selection through handlers, and does not receive the field's
DOM ref. `VisuallyHidden` keeps text in the accessibility tree but does not show
it visually. It is not a way to hide content from everyone.

## When to use

- `Keyboard` — when a screen has to offer pointer or touch text editing and the
  owner can store `value`, `selection` and the current layout. `SearchControl`
  already knows how to integrate it through its keyboard API.
- `VisuallyHidden` — to supplement a clear visible name with details for the
  screen reader, for example a count next to a heading.

## When not to use

- `Keyboard` is an on-screen keyboard, not a way to show a keyboard shortcut.
  "Ctrl+K" is rendered with `Kbd`, and the overview of shortcuts is `ShortcutsHelp`
  ([page](../overlays/shortcuts-help.md)).
- Do not use `Keyboard` as the only way to enter text: it is a supplement to a
  real text control, not a replacement for it.
- Do not try to edit the field through a ref or an artificial DOM event: pass the
  state and update it through `onChange` and `onSelectionChange`.
- Do not use `VisuallyHidden` to remove text from the accessibility tree: `display: none`,
  `visibility: hidden` and an element hidden from assistive technology have
  different semantics.
- Do not hide the only accessible label of an interactive control: a user without
  a screen reader must also be able to tell what the control does.

## Minimal example

```tsx
import { Keyboard, type KeyboardSelection } from "@olddevs/ui";

const [value, setValue] = useState("");
const [selection, setSelection] = useState<KeyboardSelection>({ start: 0, end: 0 });
const [layout, setLayout] = useState<"ru" | "en">("ru");

<Keyboard
  value={value}
  selection={selection}
  onChange={setValue}
  onSelectionChange={setSelection}
  layout={layout}
  onLayoutChange={setLayout}
  onSubmit={submitSearch}
  onRequestClose={closeKeyboard}
/>;
```

```tsx
<Heading level={2}>
  Drafts<VisuallyHidden elementType="span"> — eight of them</VisuallyHidden>
</Heading>
```

`elementType="span"` is **required** when `VisuallyHidden` sits inside running text: by default the component
renders a `<div>`, and in a heading or paragraph that is invalid nesting — React
reports a hydration error, and the browser splits the paragraph. For a hidden
subtree that is a block of its own, the default fits.

## Public API

### `Keyboard`

| Prop                            | Purpose and constraints                                                                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`                         | The current controlled string.                                                                                                                                                                                      |
| `selection`                     | The current range of UTF-16 positions `{ start, end }` in `value`; it must be updated together with the value.                                                                                                      |
| `onChange`, `onSelectionChange` | Required handlers. Pressing a key inserts its character at the selection, replacing the selected text; Backspace deletes the previous Unicode code point.                                                           |
| `layout`, `onLayoutChange`      | The required layout, `ru` or `en`, and a controlled switch.                                                                                                                                                         |
| `onSubmit`                      | An optional confirmation; called without creating an artificial DOM submit event.                                                                                                                                   |
| `disabled`                      | Disables all keys, the move handle and the close button.                                                                                                                                                            |
| `preserveFocus`                 | When working with a pointer, it does not take focus away from the external text field; this is an integration choice.                                                                                               |
| `label`                         | The panel's accessible name; from the message catalog by default (`keyboard.label`): "Russian keyboard" or "English keyboard" without a provider, "Русская клавиатура" / "Английская клавиатура" with `locales/ru`. |
| `closeLabel`, `onRequestClose`  | The accessible name and the handler of the close button. Without the handler the close button is not rendered.                                                                                                      |

Exported types: `KeyboardLayout` (`"en" | "ru"`), `KeyboardSelection`,
`KeyboardProps`.

### `VisuallyHidden`

`VisuallyHidden` is re-exported from `react-aria-components` together with the
`VisuallyHiddenProps` type. Wrap the subtree to be hidden in the component; it
does not change the subtree's text semantics, it only makes it visually hidden.

## Behavior and accessibility

- The panel has an accessible name, the buttons have accessible names, and Shift
  and the symbols mode reflect their state through `aria-pressed`.
- The arrow keys, Home and End move focus between the panel's keys; the on-screen Enter key
  on the panel calls `onSubmit` if a handler is passed.
- The panel is visible from the `md` width up; on a narrow screen it is not there.
- The move handle moves the panel with the mouse and the arrow keys.
- Shift, the symbols mode and Caps Lock are the panel's internal state. The
  field's content and the layout stay with the owner; the panel only requests a
  layout switch through `onLayoutChange`.
- `VisuallyHidden` stays in the accessibility tree. Unlike `display: none`, a
  screen reader reads the text.

## Anti-patterns

```tsx
// Bad: the new value is saved, but the cursor position stays the old one.
<Keyboard value={value} selection={selection} onChange={setValue} onSelectionChange={() => {}} … />

// Good: both values belong to the same state owner.
<Keyboard value={value} selection={selection} onChange={setValue} onSelectionChange={setSelection} … />
```

## Related sources and Storybook

- Sources: `src/components/content/Keyboard.tsx`, `src/components/content/VisuallyHidden.tsx`.
- Stories: `src/components/content/Keyboard.stories.tsx`, `src/components/content/VisuallyHidden.stories.tsx`.
- Editing, navigation and accessible names are tested in
  `tests/keyboard.test.tsx`; the hidden text — in `tests/wave7-layout.test.tsx`.

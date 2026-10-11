---
component: TagInput
exports: [TagInput]
category: inputs
status: stable
source: src/components/inputs/TagInput.tsx
story: src/components/inputs/TagInput.stories.tsx
sourceHash: 7c9521708c37
---

# TagInput

## Summary for AI

`TagInput` is a controlled set of strings. Enter or a comma turns the draft into a tag; duplicate tags are ignored, and Backspace in an empty field removes the last one.

## When to use

- The user enters several arbitrary tags, including ones made of several words.
- You need each tag to be removable in an accessible way, and the `max` limit.

## When not to use

- If the set is predefined, use `Select multiple`, `CheckboxGroup` or `ToggleGroup`.
- If you need only a single free-form text value, use `TextControl` or `Combobox`.

## Minimal example

```tsx
<TagInput label="Tags" value={tags} onChange={setTags} placeholder="Enter a tag" max={8} />
```

## Public API

- `value` and `onChange` are required; they are the only source of the set of tags.
- `label` or `aria-label` names the group; the input automatically gets a separate name "…: add".
- `max` disables input when the limit is reached. `disabled` blocks the input; `placeholder` disappears when the set is full.
- A pasted string is split at commas; spaces inside tags are kept; adding on blur happens only when focus leaves the component entirely.

## Accessibility and keyboard

- **The hint and error of `FormField` are announced together with the field.** The
  description arrives through context, and `aria-describedby` is set on the input,
  not on the group of tags; the value set by the consumer is not replaced but merged
  with it. Before version 3.0.0 the components built on react-aria did not pick up the form
  description — it was on the screen but did not reach the screen reader
  (ADR-0031).
- Enter on an empty input deliberately does not submit the form.
- The remove button has a name that includes the specific tag; do not replace it with a custom button.
- See `src/components/inputs/TagInput.tsx`, `src/components/inputs/TagInput.stories.tsx`, `tests/tag-input.test.tsx`.

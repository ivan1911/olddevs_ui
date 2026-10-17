---
component: SearchControl
exports: [SearchControl]
category: inputs
status: stable
source: src/components/inputs/SearchControl.tsx
story: src/components/inputs/SearchControl.stories.tsx
---

# SearchControl

## Summary for AI

`SearchControl` is a controlled search field on top of `TextControl`: a magnifier, an accessible name, clearing and an optional on-screen keyboard. It does not debounce queries and does not intercept Escape.

## When to use

- Search over a list, a library or an API with a single visual contract.
- You need a clear button that returns focus to the field.
- On a wide screen (from `md`) you need the on-screen `Keyboard` through the `keyboard` prop.

## When not to use

- For plain text — `TextControl`.
- For choosing from a list of options — `Combobox`; for filtering a closed list — a searchable `Select`.
- Set a shared debounce policy in the consumer, not here.

## Minimal example

```tsx
<SearchControl
  label="Search collections"
  value={query}
  onChange={setQuery}
  placeholder="Find a collection…"
/>
```

## Public API

- `value`, `onChange(string)`, `label` are required. A `placeholder` does not replace `label`.
- `clearable` is true by default; `clearLabel`, `shellClassName` and native input props are available.
- `keyboard` requires `layout` and `onLayoutChange`; `defaultOpen` affects only the initial opening; `onSubmit` is called by the on-screen keyboard.

## Height step

`size` is passed through to `TextControl`: `md` is 42 pixels (the default), `sm` is
36, the same height as `Button size="md"` and of the `Select` pill in the same
toolbar row.

The step lives on `TextControl`, not here. Search is deliberately built on it, and a
height of its own for search would mean a second way to compute it inside the
package itself — exactly the divergence `SearchControl` was introduced to avoid.

## Accessibility and keyboard

- Escape deliberately passes through to the parent overlay; add an `onKeyDown` handler if you need to clear the query.
- The on-screen keyboard button is hidden below `md`; a mouse click on the keyboard panel returns the caret to the field.
- Source: `src/components/inputs/SearchControl.tsx`; checks — `tests/search-control.test.tsx`.

---
component: PageHeader
exports: [PageHeader]
category: navigation
status: stable
source: src/components/navigation/PageHeader.tsx
story: src/components/navigation/PageHeader.stories.tsx
---

# PageHeader

## Summary for AI

`PageHeader` is the single page header with an `h1`, an optional description and
action nodes. Use it once per page; do not choose a size — the component
has no size scale and should not have one.

## When to use

- The top of a page, with its main title.
- Primary actions are needed next to it: create, upload, open filters.
- On mobile the actions can wrap under the title automatically.

## When not to use

- For a heading inside a card/section, use `SectionHeader`.
- For a modal title, use `Dialog`/`ModalHeader`.
- Do not use more than one `PageHeader` on one semantic page.

## Minimal example

```tsx
<PageHeader
  title="Library"
  subtitle="3,527 photos"
  actions={<Button tone="accent">Upload</Button>}
/>
```

## Public API

`title` is required and accepts a `ReactNode`; it is rendered in an `h1`. `subtitle` and
`actions` are also of type `ReactNode`. The component accepts the other native `div` props,
including `className` and `ref`; the native `title` prop is deliberately excluded so that it does not
conflict with the required heading. On desktop the header lays its content out
in a row, on a narrow layout in a column; actions can wrap.

## Accessibility and keyboard

The heading is always an `h1`, so the `title` text must be the name of the current
page, not an action verb. each action in `actions` must be an accessible control on its own;
`PageHeader` does not add an aria-label or handlers to them. See the
[PageHeader source](../../../src/components/navigation/PageHeader.tsx).

## Good examples

- `title` as text or icon + text in one ReactNode.
- The primary action in `actions`, secondary actions next to it.
- `subtitle` with a count or a short description of the page.

## Anti-patterns

- A `title` with a nested heading, even though `PageHeader` already creates the `h1`.
- Overriding the `PageHeader` title through the DOM `title` attribute.
- Using actions as a place for unrelated global navigation.

## Related sources and Storybook

- `src/components/navigation/PageHeader.tsx`
- `src/components/navigation/PageHeader.stories.tsx`

---
component: SectionHeader
exports: [SectionHeader]
category: navigation
status: stable
source: src/components/navigation/SectionHeader.tsx
story: src/components/navigation/SectionHeader.stories.tsx
sourceHash: 1a1ce76c770c
---

# SectionHeader

## Summary for AI

`SectionHeader` is a heading inside a section or card: the title on the left, an auxiliary
`right` node on the right. The semantic `level` is chosen by the document hierarchy,
independently of the visual `size`.

## When to use

- A block heading inside a page or card, next to a counter, a link,
  a period control or a small button.
- You need a real h2/h3/h4, not a styled div.

## When not to use

- For the page's single `h1`, use `PageHeader`.
- For a modal header, use `ModalHeader`.
- Do not use `size` to fix the logical heading hierarchy.

## Minimal example

```tsx
<SectionHeader title="Publication contents" level={2} right={<Button size="sm">Add</Button>} />
```

## Public API

`title` is required and can be a ReactNode. `right` takes a ready-made ReactNode
for an action/status. `size` is `sm` or `md` (the default): it is only the font size.
`level` is `2 | 3 | 4`, 3 by default; it determines the actual HTML heading.
The component also accepts native `div` props and a ref; the `div` `title` prop is excluded.

## Accessibility and keyboard

Choose `level` based on the previous heading: right after `PageHeader` (`h1`) you usually
need `level={2}`; the default, h3, fits a section nested in another section.
Do not change the level to get smaller text: use `size`. `right` has no
special keyboard handling — nested controls must be accessible on their own.
See the [SectionHeader source](../../../src/components/navigation/SectionHeader.tsx).

## Good examples

- `level={2}` under `PageHeader`, then `level={3}` in a card.
- `right` with a link, a small `Button` or neutral metadata.
- `title` with an icon and text as a ReactNode without a nested heading.

## Anti-patterns

- Leaving an h3 right under the h1 only because it is the default.
- Nesting an `<h2>` in `title` and getting a heading inside a heading.
- Using `SectionHeader` as a page-level layout component.

## Related sources and Storybook

- `src/components/navigation/SectionHeader.tsx`
- `src/components/navigation/SectionHeader.stories.tsx`

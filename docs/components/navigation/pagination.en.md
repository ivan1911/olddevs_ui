---
component: Pagination
exports: [Pagination, pageRange]
category: navigation
status: stable
source: src/components/navigation/Pagination.tsx
story: src/components/navigation/Pagination.stories.tsx
sourceHash: 3202869626c7
---

# Pagination

## Summary for AI

`Pagination` is controlled pagination for a collection that is already split into pages.
It takes a 1-based `page`, calls `onChange` with a 1-based number and does not
render when `pageCount <= 1`. `pageRange` is a pure helper that applies the same
rule for which page numbers to show.

## When to use

- Server-side or local results with a known number of pages.
- You need to move to the adjacent, first or last page and to have a compact range of numbers around the current one.

## When not to use

- For an infinite feed or "Load more".
- For navigating the steps of a form, use `Stepper`.
- Do not show pagination when pageCount is unknown or is always 1.

## Minimal example

```tsx
<Pagination page={page} pageCount={result.pageCount} onChange={setPage} />
```

## Public API

`page`, `pageCount` and `onChange` are required. `siblings` sets the number of neighbors
to the left and right of the current page and defaults to 1. `className` and `aria-label` are available;
the default nav name is "Pages". If an invalid `page` is passed in, the component clamps
the current number to the range from 1 to `pageCount`, and `onChange` receives the number of the neighboring page, computed from the clamped `page`.
`pageRange(page, pageCount, siblings)` returns an array `(number | "gap")[]`; it always
keeps the first and last pages and never hides exactly one page
behind an ellipsis.

## Accessibility and keyboard

This is a `nav` with ordinary buttons: Tab moves through every available action.
The current page has `aria-current="page"`; prev/next have accessible names and are
disabled at the bounds. The ellipsis is hidden from screen readers and not clickable.
See the [Pagination source](../../../src/components/navigation/Pagination.tsx).

## Good examples

- Reset `page` to 1 when the application changes a filter.
- Pass `siblings={2}` for a long list that should show more neighboring pages.
- Use `pageRange` only for a custom presentation with the same rules.

## Anti-patterns

- A 0-based `page` or `onChange`.
- Clickable ellipses that reveal nothing.
- Rendering pagination for a single page.

## Related sources and Storybook

- `src/components/navigation/Pagination.tsx`
- `src/components/navigation/Pagination.stories.tsx`

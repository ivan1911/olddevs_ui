---
component: Chip
exports: [Chip]
category: actions
status: stable
source: src/components/actions/Chip.tsx
story: src/components/actions/Chip.stories.tsx
---

# Chip

## Summary for AI

`Chip` is a compact filter button. Its `selected` is controlled state and is announced through `aria-pressed`; the component does not store the selection itself.

## When to use

- You need a short filter, an action tag or a toggleable category.
- You need an optional counter next to a short label.

## When not to use

- For an entity's status, use `StatusBadge`; for a plain numeric marker, use `Badge`.
- For several related options, use `ToggleGroup` or `Segmented`.
- Do not use `Chip` for a decorative tag with no action: it is a button.

## Minimal example

```tsx
<Chip selected={filters.includes("ready")} onClick={() => toggleFilter("ready")} count={12}>
  Ready
</Chip>
```

## Public API

- `selected` defaults to `false`; `tone` colors only the selected chip.
- `size`: `sm` or `md`; `count={0}` is shown, `null` and `undefined` are not.
- `iconOnly` hides the visible label but keeps it for the screen reader; `mobileIconOnly` hides the label only on screens narrower than 640 pixels (the `sm` breakpoint).
- `type="button"` by default; native `button` attributes are passed to the element.

## Accessibility and semantics

- Always pass `children` for the icon-only and mobile-only variants: it is the button's name.
- Do not use color as the only signal — the state is conveyed by `aria-pressed`.
- See `src/components/actions/Chip.tsx`, `src/components/actions/Chip.stories.tsx`.

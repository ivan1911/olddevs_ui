---
component: Breadcrumbs
exports: [Breadcrumbs]
category: navigation
status: stable
source: src/components/navigation/Breadcrumbs.tsx
story: src/components/navigation/Breadcrumbs.stories.tsx
sourceHash: 7f0b528fbe8c
---

# Breadcrumbs

## Summary for AI

`Breadcrumbs` shows the path to the current page. Pass the chain of crumbs as `items`;
the last visible item becomes the current page, not a link. A long
path collapses automatically into the first crumb, an ellipsis and the last two;
a chain of three crumbs or fewer never collapses, whatever `maxItems` is.

## When to use

- A deep hierarchy where the user benefits from getting back to a parent quickly.
- Every path level of the page already has its own URL.

## When not to use

- For a linear wizard, use `Stepper`.
- For short top-level navigation, use links or `Tabs`.
- Do not use it as the only name of the current page: a page heading is needed.

## Minimal example

```tsx
<Breadcrumbs
  items={[
    { label: "Library", href: "/library" },
    { label: "Collections", href: "/collections" },
    { label: "Sunsets" },
  ]}
/>
```

## Public API

`items` is required: a `Crumb` has a `label` and an optional `href`. Usually the
last item has no `href`; even if one is passed, the last visible crumb
is still not rendered as a link. `maxItems` is 4 by default; `className`
and `aria-label` are passed to the container. Without `aria-label` the name comes from the message
catalog (`breadcrumbs.label`) — see [i18n](../../i18n.md).

## Accessibility and keyboard

The component creates a `nav` with an ordered list; the current crumb has
`aria-current="page"`. The ellipsis is not a link and is hidden from screen readers.
Links remain ordinary keyboard-focusable links. See the
[Breadcrumbs source](../../../src/components/navigation/Breadcrumbs.tsx).

## Good examples

- Give every ancestor an `href` and the current item only a `label`.
- Lower `maxItems` when the header is narrow (this does not collapse a chain of three crumbs or fewer).
- Use short labels that stay clear when truncated.

## Anti-patterns

- Linking the last crumb to the current URL.
- Making the ellipsis a button when the hidden levels cannot be expanded.
- Passing an empty chain instead of not rendering breadcrumbs.

## Related sources and Storybook

- `src/components/navigation/Breadcrumbs.tsx`
- `src/components/navigation/Breadcrumbs.stories.tsx`

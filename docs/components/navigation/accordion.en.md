---
component: Accordion
exports: [Accordion, AccordionItem]
category: navigation
status: stable
source: src/components/navigation/Accordion.tsx
story: src/components/navigation/Accordion.stories.tsx
sourceHash: 9dc1af0da5f0
---

# Accordion

## Summary for AI

`Accordion` is a set of expandable sections built on react-aria. State and keys
are inherited from `DisclosureGroupProps`; `multiple={false}` by default keeps
one section open. Create every section through `AccordionItem` with
a unique `id`.

## When to use

- A long page with self-contained sections that are read one at a time.
- An FAQ, settings or details, when closed blocks save vertical space.
- Comparing several sections at once — with `multiple`.

## When not to use

- For navigation between panels of one context, use `Tabs`.
- For mandatory steps of a process, use `Stepper`.
- Do not use it for a single permanent section: a plain heading is clearer.

## Minimal example

```tsx
<Accordion expandedKeys={expanded} onExpandedChange={setExpanded}>
  <AccordionItem id="delivery" title="Delivery">
    Delivery terms
  </AccordionItem>
  <AccordionItem id="payment" title="Payment">
    Payment methods
  </AccordionItem>
</Accordion>
```

## Public API

`Accordion` accepts `multiple`, `className`, `children` and the rest of react-aria's
`DisclosureGroupProps`, including controlled/uncontrolled keys. Do not
pass `allowsMultipleExpanded`: the component's public prop is `multiple`.
`AccordionItem` requires `id` and `title`; it also accepts `disabled`, `className`,
`children`. `id` is used in `expandedKeys`, so it must stay stable across re-renders.

## Accessibility and keyboard

React Aria creates the trigger button, `aria-expanded`, the association with the panel, and hides
collapsed content from screen readers. The trigger sits inside a heading, so
a screen reader finds the section when navigating by heading. Do not render a second interactive control
in `title`; put it in the panel. See the
[Accordion source](../../../src/components/navigation/Accordion.tsx).

## Good examples

- The default `multiple={false}` for sequential reading.
- `multiple` for comparing specifications.
- A disabled item instead of a section removed without explanation: it shows that the section is unavailable.

## Anti-patterns

- Passing a plain `div` instead of `AccordionItem`.
- Using an unstable array index as `id` in a mutable list.
- Expanding all sections by default when they are not being compared.

## Related sources and Storybook

- `src/components/navigation/Accordion.tsx`
- `src/components/navigation/Accordion.stories.tsx`

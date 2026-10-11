---
component: Tabs
exports: [Tabs]
category: navigation
status: stable
source: src/components/navigation/Tabs.tsx
story: src/components/navigation/Tabs.stories.tsx
sourceHash: cc11d7b9705a
---

# Tabs

## Summary for AI

`Tabs` is a controlled-only tab strip; the component renders only the tablist, not the
panels. The consumer stores `value`, applies `onChange` and must render the
active panel with `id={`${value}-panel`}` and `role="tabpanel"`.

## When to use

- Several peer, instantly switchable views of one context.
- Vertical settings/sidebar navigation or a horizontal scrolling strip.
- The active tab state already belongs to the URL or the consuming component.

## When not to use

- For a step-by-step process, use `Stepper`; for independent collapsible blocks,
  `Accordion`; for switching between format modes, `Segmented`.
- Do not use tabs if the content of all sections must be visible at once.
- Do not expect an uncontrolled `defaultValue`: there is none.

## Minimal example

```tsx
<Tabs items={items} value={tab} onChange={setTab} />
<div id={`${tab}-panel`} role="tabpanel">{panels[tab]}</div>
```

## Public API

`items` is an array of `{ id, label, icon? }`; `value` and `onChange` are required.
`orientation` is `horizontal` (the default) or `vertical`, and `className` styles the
container. To change orientation with the screen width, choose `orientation` on the
consumer side. The item id is used to build `aria-controls`, so it must be valid
as an HTML id and unique within this tablist.

## Accessibility and keyboard

The active tab has `tabIndex=0` and the rest `-1`: Tab enters only the
active one, and roving focus uses the arrow keys. A horizontal strip moves with
`←/→`, a vertical one with `↑/↓`; Home/End go to the ends, and the ends do not wrap.
Selection follows focus (automatic activation). Only the active tab gets
`aria-controls`, because the consumer may not render inactive panels.
See the [Tabs source](../../../src/components/navigation/Tabs.tsx).

## Good examples

- A settings sidebar: `orientation="vertical"` and a separate `tabpanel`.
- A horizontal strip with short labels that allows overflow-x.
- Icons only as a complement to readable labels.

## Anti-patterns

- Rendering a tablist without a corresponding active panel.
- Passing a `value` id that is not in `items`.
- Adding a separate Enter for activation: an arrow key already switches tabs.

## Related sources and Storybook

- `src/components/navigation/Tabs.tsx`
- `src/components/navigation/Tabs.stories.tsx`

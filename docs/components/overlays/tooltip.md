---
component: Tooltip
exports: [Tooltip, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger, HelpTooltip]
category: overlays
status: stable
source: src/components/overlays/Tooltip.tsx
story: src/components/overlays/Tooltip.stories.tsx
---

# Tooltip and HelpTooltip

## Summary for AI

`Tooltip` adds a short explanation to a single element on hover and focus. It
does not replace a visible label, an instruction or a confirmation.
`TooltipProvider` is placed once at the app root. For the ordinary case, use the
`Tooltip` wrapper; the primitives `TooltipRoot`, `TooltipTrigger` and
`TooltipContent` are needed when you want Radix's compound markup. `HelpTooltip`
is a ready-made popover opened by a click on a help icon.

## When to use

- To label an icon-only button or to explain an unfamiliar term.
- To give a short optional clarification that is not needed to complete the task.
- `HelpTooltip` — for a standard help icon next to a field or a setting.

## When not to use

- Do not hide a required instruction, an error or the only name of an action:
  they must be visible or programmatically tied to the control.
- Use `Popover` for complex interactive content and `Alert` for a status message.
  Use `HoverCard` for a preview with markup (an avatar, a title, a couple of
  lines) on hover over a link or a name.
- Do not create a `TooltipProvider` for every button.

## Minimal example

```tsx
<Tooltip content="Delete the selection">
  <Button iconOnly aria-label="Delete" icon={<DeleteIcon />} />
</Tooltip>
```

## Public API

`Tooltip` accepts `content`, a single `children: ReactElement`, `side`, `align`
and `delayDuration`. An empty `content` returns the child without a
wrapper. The child must accept a `ref`, because it becomes the trigger.
`TooltipContent` accepts the Radix `Content` props; its `sideOffset` is 6 by
default. `TooltipProvider`, `TooltipRoot` and `TooltipTrigger` export the Radix
primitives for the compound API.

## Accessibility and keyboard

The tooltip opens on focus too, not only on hover. An icon-only trigger must still
have its own `aria-label`: a tooltip is not a reliable accessible name for a
button. Put one provider at the root so that the shared delay and the transition
between tooltips work consistently. See
[the Tooltip source](../../../src/components/overlays/Tooltip.tsx) and
[HelpTooltip](../../../src/components/overlays/HelpTooltip.tsx).

## Good examples

- A delete icon with an `aria-label` and a clarifying tooltip.
- `content={condition ? text : undefined}` without branching the DOM by hand.
- `HelpTooltip` next to an unclear parameter, but not instead of its `label`.

## Anti-patterns

- A tooltip on a non-focusable `span` as the only way to read the action.
- Multi-paragraph text, buttons or a form inside a tooltip.
- A nested provider in a library component.

## Related sources and Storybook

- `src/components/overlays/Tooltip.tsx`, `src/components/overlays/HelpTooltip.tsx`
- `src/components/overlays/Tooltip.stories.tsx`

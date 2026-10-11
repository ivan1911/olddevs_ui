---
component: Popover
exports: [Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger]
category: overlays
status: stable
source: src/components/overlays/Popover.tsx
story: src/components/overlays/Popover.stories.tsx
sourceHash: 15a34733d106
---

# Popover

## Summary for AI

`Popover` is a compound primitive for a panel attached to an element. It does not
know its content: the calling code sets the trigger, the content and, if needed,
the anchor. Use it as the basis for a dropdown, a calendar or a compact panel,
not as a standalone dialog.

## When to use

- The content must be positioned relative to a button or a separate anchor.
- You need a portal, closing on Escape and correct positioning near the screen edge.
- The content is arbitrary markup for which there is no ready `Select` or `Menu`.

## When not to use

- For a semantic list of actions, use `Menu`.
- Use `Tooltip` for text on hover/focus, `HoverCard` for a preview with markup on
  hover over a link or a name, and `Dialog` for a blocking dialog.
- Do not use it for content that must always be present in the page's DOM as part
  of the layout.

## Minimal example

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button>Filters</Button>
  </PopoverTrigger>
  <PopoverContent>
    <FilterForm />
  </PopoverContent>
</Popover>
```

## Public API

`Popover` is the Radix `Root` and accepts its controlled and uncontrolled props.
`PopoverTrigger`, `PopoverAnchor` and `PopoverClose` are the matching Radix
primitives; the trigger usually gets `asChild` to keep the `Button` semantics.
Always render the content through `PopoverContent`, not the bare Radix `Content`:
`PopoverContent` creates a portal, has `align="start"` and `sideOffset={4}` by default, and
accepts the rest of the Radix props (`side`, `align`, `onOpenAutoFocus`, etc.).

## Accessibility and keyboard

Focus behavior, Escape and positioning are delegated to Radix. The content sits in
a portal on a layer above modal dialogs, so do not add local `z-index` patches
without a reason. The trigger must be an accessible interactive element; do
not turn an arbitrary `div` into a trigger without a role, focus and a name.

## Good examples

- A filter button + a form in `PopoverContent`.
- A separate `PopoverAnchor` when the panel is anchored to something other than the trigger.
- `side="bottom" align="end"` for a panel at the right edge of the button.

## Anti-patterns

- `<PopoverContent>` without a `Popover`/trigger as a permanent layer.
- Duplicating `Portal` or wrapping a `Popover` in `ModalOverlay`.
- A list of commands with implicit navigation instead of `Menu`.

## Related sources and Storybook

- `src/components/overlays/Popover.tsx`
- `src/components/overlays/Popover.stories.tsx`

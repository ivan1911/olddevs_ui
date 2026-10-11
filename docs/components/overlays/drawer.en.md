---
component: Drawer
exports: [Drawer]
category: overlays
status: stable
source: src/components/overlays/Drawer.tsx
story: src/components/overlays/Drawer.stories.tsx
sourceHash: baed0ac7c97c
---

# Drawer

## Summary for AI

`Drawer` is a modal panel that slides in from the right, the left or the bottom.
Choose it when the context of the main page should stay visible but the task
needs more room than a popover. Modality, the portal, the focus trap and focus
return are already implemented on Radix.

## When to use

- Viewing or editing an entity without a full navigation to a new page.
- A panel with scrollable content and a pinned action `footer`.
- A side panel on desktop: on a narrow screen it automatically becomes a bottom
  one, so it does not clip the content.

## When not to use

- Use `ConfirmDialog` for a short question and `Dialog` for an ordinary compact form.
- Use `Popover` for a dropdown anchored to a button, a calendar or a small list.
- Do not use it as permanent, non-modal sidebar navigation.

## Minimal example

```tsx
<Drawer open={open} onClose={close} title="Edit" footer={<Button onClick={save}>Save</Button>}>
  <FormField label="Name">
    <TextControl />
  </FormField>
</Drawer>
```

## Public API

`open`, `onClose` and `title` are required. `subtitle` adds an explanation; `side`
accepts `right` (the default), `left` or `bottom`; `size` accepts `sm`, `md` (the
default) or `lg`. For the side variants the size means width; for the bottom one, height. `footer`
always stays at the bottom, while `children` scroll separately. `closeLabel`,
`className` and `zIndex` are available for tuning; a single `zIndex` applies to
both the scrim and the panel.

## Accessibility and keyboard

The title is the dialog's name; `ModalHeader` creates the close button. Radix
keeps focus inside the drawer, closes it on Escape, blocks the background and
returns focus to the element that opened it. Do not add `useScrollLock`.
See [the Drawer source](../../../src/components/overlays/Drawer.tsx).

**Escape closes the topmost overlay (since 3.5.0).** When a menu, a dropdown list or a
tooltip is open inside the drawer, the first Escape closes it rather than the
drawer; before that, one press closed both — along with an unsaved form. The
analysis is in
ADR-0041.

**Items of a react-aria menu and list inside a drawer can be chosen with the mouse.**
Radix's modal layer turns off pointer events on `<body>`, while the `Menu` panel
and the `Combobox` list sit in a portal beneath it; the kit gives pointer events
back to such an overlay with a rule in `@olddevs/ui/styles.css`. Before this fix
an item could be chosen only with the keyboard. A click on an item
does not close the drawer.

## Good examples

- `side="right"` for editing a record, with a `footer` holding cancel and save.
- `side="bottom"` for a panel that works well on a mobile screen.
- `zIndex="z-100"` when the drawer must sit above the app's own layer.

## Anti-patterns

- Duplicating the footer inside `children`: it scrolls away.
- Setting a fixed width on a side drawer through `className` without checking the mobile screen.
- Using a drawer without a title or with an empty one.

## Related sources and Storybook

- `src/components/overlays/Drawer.tsx`
- `src/components/overlays/Drawer.stories.tsx`

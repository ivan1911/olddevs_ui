---
component: Dialog
exports: [Dialog, ModalHeader, ModalOverlay]
category: overlays
status: stable
source: src/components/overlays/Dialog.tsx
story: src/components/overlays/Dialog.stories.tsx
---

# Dialog, ModalHeader and ModalOverlay

## Summary for AI

Use `Dialog` for a modal dialog with a known title: it provides modality, an
accessible name, a focus trap, a portal and focus return. `ModalHeader` is only a
ready-made header. `ModalOverlay` is only a dimmed scrim; it does not make its
content a dialog and must not replace `Dialog` for forms or confirmations.

## When to use

- `Dialog` — a form, a view or another blocking dialog with `open` and `onClose`.
- `ModalHeader` — a header for a non-standard overlay that already sets the role,
  the name and focus management on its own.
- `ModalOverlay` — a scrim for content that is not announced as a dialog and
  handles its own accessibility; pass `onClose` and, if needed, `escape={false}`.

## When not to use

- For a question that needs an explicit decision, use `ConfirmDialog`, not a
  `Dialog` with two hand-built buttons.
- For a sliding panel, use `Drawer`.
- Use `Popover` for a small panel anchored to a trigger and `Tooltip` for an explanation.
- Do not wrap `Dialog` in `ModalOverlay` and do not add `useScrollLock`: Radix
  already manages modality and scrolling.

## Minimal example

```tsx
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  title="New collection"
  className="w-full max-w-[420px]"
>
  <form>{/* fields and actions */}</form>
</Dialog>
```

## Public API

`Dialog` requires `open`, `onClose` and `title`. `title` can be a `ReactNode` and
becomes the accessible name. `subtitle`, `icon`, `closeLabel` (the accessible name of the close button, "Close" by default), `className`, `overlayClassName`,
`overlayStyle`, `contentStyle`, `zIndex` and `align` tune the presentation.
`header={false}` leaves a hidden `Dialog.Title`, so `title` is still required.
`role` accepts `dialog` (the default) or `alertdialog`.

`describedBy` is the `id` of the node that serves as the dialog's description:
the text a screen reader reads after the name. It is not `subtitle` — that one is
visible on screen and lives in the header. For `role="alertdialog"` the ARIA
Authoring Practices Guide (APG) requires a description: a confirmation that announces only a name and
a button forces people to confirm blind. `ConfirmDialog` points to its own
`message`.

**An identifier, not text: a lesson from a defect analysis.** Before 3.7.0
the prop was called `description`, accepted a `ReactNode` and rendered it as a
hidden copy, so the text ended up in the document twice: a link inside it created
an invisible extra tab stop, and a component with its own `id` created a duplicate
ID. The description must point to the same node that is displayed on screen. If
the text is only for screen readers, put it in `children` under `sr-only` and
refer to it here.

`loading` is one shared submitting state: the close button disappears, and Escape
and a click outside the dialog do not close it. `initialFocusRef` sets the initial focus;
use it, for example, for a safe form field, instead of calling `focus()` from an
effect in your own code. `onEscapeKeyDown` is an additional handler for the dialog's
internal state; it does not replace `onClose`.

`ModalHeader` accepts `title`, optional `subtitle`, `icon`, `onClose`,
`closeLabel`, `titleId`, `titleComponent` and `className`. The close button
is rendered only when `onClose` is passed. `ModalOverlay` accepts `onClose`, `zIndex`, `align`,
`backdrop`, `blur`, `escape`, `className` and `children`; it closes on a click on
the scrim and, by default, on Escape.

## Accessibility and keyboard

`Dialog` is based on Radix: focus stays in the modal layer, returns to the
element that opened it on close, and nested Radix dialogs close one at a time, one per press of
Escape. While a react-aria menu or list is open, the first Escape press is handled
by that menu or list and does not close the parent dialog. Such a menu or list inside the dialog
also works with the mouse: Radix turns off pointer events on `<body>`, and the kit
returns them to the react-aria overlay with a rule in `@olddevs/ui/styles.css`
— before that an item could be chosen only with the keyboard. `ModalHeader`
takes the accessible name of the close button from `closeLabel` (by default
"Close").

`ModalOverlay` does not provide `role="dialog"`, `aria-modal`, a focus trap or a
scroll lock. If it is still used for an interactive dialog, the consumer must
add these properties itself. See [the Dialog source](../../../src/components/overlays/Dialog.tsx),
[ModalHeader](../../../src/components/overlays/ModalHeader.tsx) and
[ModalOverlay](../../../src/components/overlays/ModalOverlay.tsx).

## Good examples

- A form dialog: `Dialog` with a `title`, a `FormField` and a footer in `children`.
- Non-standard geometry: `Dialog header={false}` with its own content, but not
  with a custom role.
- A plain preview scrim: `ModalOverlay`, if the preview is not announced to
  the user as a modal dialog.

## Anti-patterns

- `role="dialog"` on `ModalOverlay` without a name and a focus trap.
- Three separate flags to disable the close button, Escape and click-away instead of `loading`.
- Putting block markup such as a footer in `title`, or leaving the dialog without a meaningful name.

## Related sources and Storybook

- `src/components/overlays/Dialog.tsx`, `src/components/overlays/ModalHeader.tsx`, `src/components/overlays/ModalOverlay.tsx`
- `src/components/overlays/Dialog.stories.tsx`

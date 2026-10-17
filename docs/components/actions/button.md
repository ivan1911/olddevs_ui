---
component: Button
exports: [Button]
category: actions
status: stable
source: src/components/actions/Button.tsx
story: src/components/actions/Button.stories.tsx
---

# Button

## Summary for AI

`Button` runs an action. For navigation, use a real link through `asChild`, not `onClick` with routing. It defaults to `type="button"`, so inside a form it never submits the form by accident.

## When to use

- The user has to perform an action: save, open a dialog, delete, retry a request.
- You need the shared set of `variant`, `tone`, `size`, `disabled` and focus indication.
- The action is navigation: pass a single link as `children` together with `asChild`.

## When not to use

- To pick one mode, use `Segmented`; for an independent set of filters, use `ToggleGroup`.
- To toggle a boolean state with the switch role, use `Toggle`.
- For a link that does not need to look like a button, use `Link`.

## Minimal example

```tsx
<Button tone="accent" variant="solid" onClick={save}>
  Save
</Button>

<Button asChild variant="soft">
  <a href="/campaigns">To campaigns</a>
</Button>
```

## Public API

- `variant`, `tone`, `size` set the look; the defaults are `soft`, `neutral`, `md`.
- There are four size steps: `xs`, `sm`, `md`, `lg`. `xs` is 20 pixels and
  exists for an icon button in a list row: `sm` is 30 with 20 for the
  content, and a 32 row stretches to 42. `xs` is not meant to have a label, so
  use it with `iconOnly`. The hit area of `xs` is still 24×24: a pseudo-element
  extends it, because 20×20 fails WCAG 2.5.8, and enlarging the button itself
  would bring the stretched row back.
- `icon` adds an icon; with `iconOnly` the label is not rendered. An icon-only button must have an accessible name through `aria-label` or `title`. The icon itself is not a hit target (`pointer-events: none`): otherwise the `event.target` of a click on the icon is the `<svg>`, not the button, and anyone who inspects the click target gets it wrong. A real-world example is an `EditableList` row with an action: react-aria checks the target without walking up the ancestors, and a click on the icon triggered both the button and the row action.
- `selected` sets `aria-pressed`; it is only for a pressed **button**, and a link (`asChild`) does not get it.
- `loading` means a submission is in progress: an indicator takes the icon slot, the button cannot be pressed, and the state is announced through `aria-busy`. There is no need to add `disabled`: it is applied automatically. A button without an icon gets the slot for the duration of the submission, and the label shifts; if a button can enter `loading`, give it an icon from the start. The indicator is decorative and is not part of the button's accessible name.
- `asChild` passes the styles, props and ref to the single child element. For a link, `disabled` becomes `aria-disabled`, turns off pointer events and takes the child out of the tab order (`tabIndex={-1}`) — even if the child set `tabIndex` itself: the component decides this itself, because otherwise a disabled link remained reachable from the keyboard. `selected` is not passed on, because `aria-pressed` is not allowed on a link.

## Accessibility and semantics

- A regular button is activated with Space and Enter; a link rendered through `asChild` is activated with Enter, as a link should be.
- Do not nest interactive elements in `children`.
- Source of the contract: `src/components/actions/Button.tsx`; scenarios — `src/components/actions/Button.stories.tsx` and `tests/button-aschild.test.tsx`.

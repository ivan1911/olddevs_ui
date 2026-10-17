# Accessibility: a mandatory contract

Accessibility is part of a component's public behavior. A violation cannot be
made up for by visual design, TypeScript or a passing build.

## Name

- Every interactive control gets an accessible name from a visible label,
  descendant text or a precise `aria-label`.
- A placeholder is not a label: it disappears once the user types.
- `iconOnly` does not mean "nameless". The label may be visually hidden, but
  it must stay in the accessibility tree.
- Do not use `display: none` for text that has to name a control; use
  `VisuallyHidden` or the component's documented implementation.
- A hidden label is `sr-only`, not `hidden` and not dropped children. That is
  how `Chip.iconOnly`, `Chip.mobileIconOnly` and `Segmented.mobileIconOnly`
  work: the node stays in the tree and stays the button's name, so such a
  segment needs no `tooltip`.
- A tooltip must not repeat the control's name. Radix puts
  `aria-describedby` on the trigger, and a tooltip that repeats the word the
  control is already named with is read twice. In `SwatchGroup.tooltips` the
  trigger is the option's wrapper, not the radio itself: Radix attaches
  `aria-describedby` to the wrapper, and the radio does not inherit it from an
  ancestor.

## Semantics

- A link stays an `<a href>`; do not replace it with a button with `onClick`
  for navigation.
- A button performs an action and is usually `type="button"` outside a form.
- Use `Button asChild` for a link that looks like a button: it keeps the link
  semantics.
- Do not nest an interactive element inside another interactive element.

## Focus and keyboard

- A visible focus indicator is mandatory; do not hide it with
  `overflow: hidden` if that clips the ring.
- An overlay returns focus to its trigger after closing. Initial focus and
  Escape are defined on the page of the specific overlay.
- Nested overlays close layer by layer: Escape must not close the parent together
  with the child layer.
- Do not imitate keyboard behavior with `div` handlers when a documented native
  or ARIA component exists.

## Contrast and states

`tone` expresses meaning but is not the only channel: text, icon, shape and the
accessible name must keep the meaning. Check the disabled, selected, loading and
error states, not just the default one.

## Motion

The kit honors the system setting `prefers-reduced-motion: reduce` without any
action from the consumer: moving animations lose the movement and still make
the element appear; the rotation of disclosure chevrons becomes instant.

There are two exceptions, and both are loading indicators: `Spinner` and an
indeterminate `Progress` keep moving. Here the motion is the message,
and a stopped indicator reads as broken. Formally this is allowed: WCAG 2.2
criterion 2.3.3 is level AAA, and essential motion is exempt from the rule.

What you need to do: **do not add your own motion that bypasses the kit's
tokens**. An animation defined as a literal in your code (`animation: spin 1s`,
`animate-[…]`) does not obey the system setting; you have to turn it off
yourself. How to do it is in
[Theming and tokens](theming.md#motion); the full decision is
ADR-0043.

## Evidence

Behavior pages link to Storybook and tests. When you change a component, run
the related unit tests, then the full `npm test`; for the showcase surface also
run `npm run test:a11y` and the visual/interaction checks when the change
touches them.

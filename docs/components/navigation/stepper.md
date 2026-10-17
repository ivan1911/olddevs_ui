---
component: Stepper
exports: [Stepper]
category: navigation
status: stable
source: src/components/navigation/Stepper.tsx
story: src/components/navigation/Stepper.stories.tsx
---

# Stepper

## Summary for AI

`Stepper` shows the order of a wizard's steps; the parent sets the current index (controlled). It does not
control moving forward, validation or showing the form panels. If you pass
`onStepClick`, only steps already completed become buttons for going back.

## When to use

- A linear wizard, import, checkout or onboarding with a known number of steps.
- You need to show the current position and allow going back to a completed step.
- A small screen needs `orientation="vertical"`.

## When not to use

- For peer sections with no order, use `Tabs`.
- For collapsible details, use `Accordion`.
- Do not use it instead of pagination: a step is not a page of results.

## Minimal example

```tsx
<Stepper
  steps={[
    { id: "source", label: "Source" },
    { id: "review", label: "Review" },
  ]}
  current={currentStep}
  onStepClick={setCurrentStep}
/>
```

## Public API

`steps` is an array of `{ id, label, hint? }`, `current` is a 0-based index. The optional
`onStepClick(index)` allows going back only to `index < current`; future steps and
the current step do not become clickable. Without the callback no step is
clickable. `orientation` is `horizontal` (the default) or `vertical`; `className`
and `aria-label` are available (the default is "Steps").

## Accessibility and keyboard

The component uses a `nav` and an ordered list, so a screen reader knows
the order and number of steps. The current item has `aria-current="step"`; a completed
step with a callback is a real button and reachable by Tab. The circle with the number or
checkmark is hidden from assistive technology; the meaning comes from the list and two
mechanisms. The current step has `aria-current="step"`. Completed and not-yet-started
steps have visually hidden text from the message catalog (`stepper.state`):
"completed" and "not started" in the default English catalog.
See the [Stepper source](../../../src/components/navigation/Stepper.tsx).

## Good examples

- Do not pass `onStepClick` for an irreversible payment or import.
- Pass a short `hint` for extra context under the label.
- Keep `current` in sync with the form displayed in the parent.

## Anti-patterns

- Passing a 1-based current.
- Treating `onStepClick` as permission to jump to a future unfilled form.
- Using a changing array index instead of a stable `Step.id`.

## Related sources and Storybook

- `src/components/navigation/Stepper.tsx`
- `src/components/navigation/Stepper.stories.tsx`

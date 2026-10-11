---
component: Timeline
exports: [Timeline]
category: content
status: stable
source: src/components/content/Timeline.tsx
story: src/components/content/Timeline.stories.tsx
sourceHash: ce8736050ae0
---

# Timeline

## Summary for AI

`Timeline` is a list of process steps: what has already happened and how it ended. Each step has its own state, and any of them can fail.

## When to use

- When you need to monitor a running or finished process: a task pipeline, a publication history, import steps.
- When a step can end in failure and this must be shown next to it, not as an overall status at the top.

## When not to use

- For a multi-screen wizard — that is `Stepper`: it has a linear `current`, the steps ahead have not happened yet and cannot fail, and a click leads back.
- For a single state of an object — that is `StatusBadge`.
- For a message about the failure of the whole operation — that is `Alert` or `ErrorState`.

The difference from `Stepper` is not stylistic, and it is the reason the task-step pipeline in the source app did not move to `Stepper` and stayed hand-written:

|              | `Stepper`                              | `Timeline`                       |
| ------------ | -------------------------------------- | -------------------------------- |
| state        | one for the whole timeline (`current`) | its own for each step            |
| step failure | cannot be expressed                    | `status: "failed"`               |
| interactive  | yes, a click on a completed step       | no, it only displays the process |

## Minimal example

```tsx
import { Timeline } from "@olddevs/ui";

<Timeline
  aria-label="Task steps"
  items={steps.map((s) => ({
    id: s.id,
    label: s.step_name,
    status: s.status,
    statusLabel: STATUS_LABEL[s.status],
    details: s.details,
  }))}
/>;
```

## Public API

| Prop         | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| `items`      | An array of steps. If empty, the component renders nothing. |
| `aria-label` | The accessible name of the timeline.                        |
| `className`  | Wrapper classes.                                            |

A step: `id`, `label`, `status` (`pending` · `running` · `success` · `failed`), optional `statusLabel`, `details`, `time`.

**The state label is a prop, not derived from `status`.** The words "done" and "error" belong to the domain: an import task and a payment word them differently. The "status → label" mapping lives with the consumer, next to the domain — the same as with `StatusBadge`.

## Accessibility

The markup is an ordered list (`ol`): steps go in order, and a screen reader must announce both the order and the total count. A set of `div` elements announces neither. The running step is marked `aria-current="step"`; the dots and connecting lines are decorative and hidden.

## Colors

The colors come from the tone vocabulary (`TONE_TOKENS`) and are not defined anew: "error" means the same color here, in `Alert`, in `StatusBadge` and on the delete button. `pending` is deliberately neutral and muted — a step that has not started yet is not an event.

## Related sources and Storybook

- Source: `src/components/content/Timeline.tsx`
- Stories: `src/components/content/Timeline.stories.tsx`
- Tests: `tests/timeline.test.tsx`

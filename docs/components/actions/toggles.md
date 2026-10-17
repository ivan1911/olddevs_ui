---
component: Toggle and selection controls
exports: [Toggle, Segmented, ToggleGroup, ButtonGroup]
category: actions
status: stable
source: src/components/actions/Toggle.tsx
story: src/components/actions/Toggle.stories.tsx
---

# Toggle, Segmented, ToggleGroup and ButtonGroup

## Summary for AI

Choose the component by what the state means:

- `Toggle` is for one boolean property;
- `Segmented` is for exactly one mode;
- `ToggleGroup` is for zero or more independent choices;
- `ButtonGroup` is only a visual group of ordinary actions.

## When to use

- `Toggle`: turn a setting on/off; `checked`, `onCheckedChange` and a name — `label` or visible text in `children` — are required.
- `Segmented`: there is always exactly one mode, for example "list / grid".
- `ToggleGroup`: filters or settings where an empty set is allowed; `value` is an array of keys.
- `ButtonGroup`: join adjacent `Button` components without changing their semantics.

## When not to use

- Do not use `Segmented` for multiple selection or when users must be able to clear the last choice — use `ToggleGroup`.
- Do not use `ToggleGroup` as a radio group with a mandatory answer — use `RadioGroup`.
- Do not use `ButtonGroup` to represent a selection: it does not own selection state.

## Minimal example

```tsx
<Toggle checked={digest} onCheckedChange={setDigest} description="A summary of activity every Monday">Weekly digest</Toggle>

<Segmented value={view} onChange={setView} options={[{ value: "list", label: "List" }, { value: "grid", label: "Grid" }]} />

<ToggleGroup value={statuses} onChange={setStatuses} aria-label="Statuses" options={[{ id: "new", label: "New" }]} />
```

## Public API

- `Toggle` renders `button role="switch"`; `disabled` is supported. A name is required, and there is exactly one source: `label` — an accessible name with no visible text — or visible text in `children`. Both at once is not allowed: a screen reader would announce a different name than the one on screen. In development, a console warning flags this. The type does not forbid it, so that `extends ToggleProps` and `Omit<ToggleProps, …>` keep compiling for the consumer.
- **Visible text and a description.** `<Toggle checked={…} onCheckedChange={…} description="A summary of activity every Monday">Weekly digest</Toggle>` renders a setting row: a title and an optional description on the left, the track on the right. The text is a real `<label for>` pointing at the button, so a click on the title or the description toggles (not when disabled), and the label becomes the accessible name (`aria-labelledby`). The description is linked to the switch through `aria-describedby` and is merged with the `FormField` description and any `aria-describedby` you pass, not replacing them. `description` without a label is not accepted — there is nothing to attach it to.
- In the row form `className` applies to the whole row (width, margins), in the bare form — to the track. Other attributes (`id`, `data-*`, `ref`, `aria-*`) go to the button in both forms. The track sits on the right, the text on the left — a "switch on the left" layout has not been asked for yet, and you can still build it next to a bare `Toggle`.
- The track of a `Toggle` that is on is outlined with an `accent-strong` border: the `accent` fill against the background falls short of 3:1 (WCAG 1.4.11), so the border provides the required contrast. A checked `Checkbox` uses the same technique.
- A passed `onClick` is called _before_ the toggle and does not cancel it: a consumer's handler does not override the component's own behavior. To cancel the toggle deliberately, call `event.preventDefault()`. The role and `aria-checked` are not overridden by spread props.
- `Segmented.options` holds `value`, `label`, `icon`, `tooltip`, `disabled`; for a segment without a label, `tooltip` is required as the accessible name.
- `Segmented` wraps segments onto a second row when they do not fit the available width. There is no prop for this and there will not be — see the analysis below.
- `Segmented.mobileIconOnly` hides the labels on screens narrower than 640 pixels, leaving the icons; the label stays the button's accessible name. See the analysis below.
- `ToggleGroup.selectionMode` is `multiple` (the default) or `single`; in `single`, zero selected is allowed. An `option` with only an icon requires `aria-label`.
- `ToggleGroup` inside a vertical `Toolbar` stacks into a column on its own: the axis comes from the toolbar through the react-aria context, and the component has no prop of its own.
- `ButtonGroup.orientation` is `horizontal` or `vertical`; `aria-label` adds `role="group"`.

## Wrapping segments

A segment does not shrink: the button has `shrink-0` and `whitespace-nowrap`, and
this is deliberate — a squeezed tab label reads worse than a wrapped one. So when
the set does not fit the width, the container has exactly two outcomes: wrap the
excess onto a second row or run off the edge; the kit wraps.

It is not controlled by a boolean prop. A `Segmented` that does not fit and does
not wrap is useless: running off the edge means horizontal scrolling, that is, a
violation of WCAG 1.4.10, and we have not met a consumer who specifically needs
the overflow. A prop here would read as "broken by default, fix it with a prop",
and every later consumer would rediscover the defect — on a narrow screen and
already in production.

Wrapping depends on the available width, not on a breakpoint: a `Segmented` may
also sit in a narrow column on a wide screen. It works inside any parent — block,
`flex`, `grid`.

The gap is set per axis: 2 pixels between segments, 4 between rows. A single
`gap` for both axes would put the rows the same 2 pixels apart, and the two
rows would read as a clumped grid instead of one control.

The keyboard order when wrapping matches the visual one: left to right, then the
second row. This is the second reason to prefer wrapping over scrolling — with
scrolling, Tab moves focus to a button outside the visible part, and the browser
scrolls it into view by itself, jerking the content sideways.

## Icon only on a narrow screen (`mobileIconOnly`)

On screens narrower than 640 pixels the segment label is hidden and the icon
stays:

```tsx
<Segmented value={list} onChange={setList} mobileIconOnly options={lists} />
```

Height is the criterion: five segments with an icon and a label at a width of 375
take two rows — 68 pixels instead of the 36 this mode needs. Segment wrapping (it
came earlier and has not gone anywhere) removes horizontal scrolling but not
height: over 500 pixels of content do not fit into 327 pixels of width, so a
second row remains. In this mode there is one row.

**The label is hidden, not removed.** The node stays in the accessibility tree
and serves as the button's accessible name — `sr-only sm:not-sr-only sm:inline`, the
same technique and the same _one_ node as in `Chip`. This is why the mode lives in
the kit: hiding a label correctly takes one line of classes, but there are three
ways to hide it incorrectly (`hidden`, `display: none`, dropped `children`), and
each leaves a row of nameless buttons that only an audit will reveal.

**`tooltip` is not needed in this mode.** The requirement "a segment without a
label must have a tooltip" applies to a genuine absence of a label
(`label: ""`); here the label exists, it just is not visible. A tooltip would not
show on a touch device anyway. The kit used to refuse such a mode for exactly
this reason: a tooltip would be invisible on touch. The refusal was lifted because
it depended on an implementation that removed the label.

**The mode is a property of the whole `Segmented`, not of a segment.** A row where
some tabs have words and some do not would change width on switching, and the
buttons would jump under the finger. The one exception is a segment _without_ an
icon: its label stays visible, otherwise the button would be empty. This is a
safeguard against a set where an icon was forgotten.

**The threshold is not exposed.** It is the same 640 as `Chip.mobileIconOnly`;
two consumers with different thresholds would diverge in behavior for no reason.
The threshold is taken from the viewport width, not the parent's: a `Segmented` in a
narrow column on a wide monitor keeps its labels.

**The padding is reduced along with the label** — `px-2` instead of `px-3`. Around a
single icon the button comes out 32 by 28 instead of 40 by 28: almost a square,
like `Button iconOnly`. The height does not change, so the hit area keeps its
height.

The product objection — five bare icons read worse than five words — still
stands, which is why the mode is a prop and not the default.

## Accessibility and semantics

- `Toggle` uses `aria-checked`, the other components use `aria-pressed` or React Aria behavior.
- A bare `Toggle` with no visible text is named only through `label`; do not build the text next to it by hand (a `<span>` beside the button): it will not become the name and will not react to a click. `children` exists for that.
- For a segment without a label, the `tooltip` sets the accessible name.
- Sources: `src/components/actions/Toggle.tsx`, `src/components/actions/Segmented.tsx`, `src/components/actions/ToggleGroup.tsx`, `src/components/actions/ButtonGroup.tsx`; the stories `Toggle.stories.tsx`, `Segmented.stories.tsx`, `ToggleGroup.stories.tsx`, `ButtonGroup.stories.tsx`.

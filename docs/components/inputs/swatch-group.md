---
component: SwatchGroup
exports: [SwatchGroup, SwatchOption]
category: inputs
status: stable
source: src/components/inputs/SwatchGroup.tsx
story: src/components/inputs/SwatchGroup.stories.tsx
---

# SwatchGroup

## Summary for AI

Picking one value from a closed set, where an option is shown as a **color
swatch**, not as text. The fill comes as a hue of the label palette (`LabelHue`),
the option name as a separate `name` field: the fill is for the eyes, the name
for the ears.

## When to use

- A project color, a label hue, a calendar color — anywhere the value is a key
  from a closed set and has to be shown as a color.
- There are few options and they are compared by eye, laid out in a grid.

## When not to use

- If you need an **arbitrary** color, use `ColorPicker` (a separate entry point
  `@olddevs/ui/color`). It deliberately produces a color outside the token system;
  here it is the opposite — a key that the theme resolves to a color.
- If the options are named in words, not by color, use `RadioGroup`.
- To choose a mode rather than a value, use `Segmented`.
- If there are dozens of values and people search them rather than compare, use `Select`.

## Minimal example

```tsx
import { SwatchGroup, LABEL_HUES } from "@olddevs/ui";

const [color, setColor] = useState<string>("teal");

<SwatchGroup
  label="Project color"
  value={color}
  onChange={setColor}
  options={[
    { value: "none", name: "No color" },
    ...LABEL_HUES.map((hue) => ({ value: hue, hue, name: NAMES[hue] })),
  ]}
/>;
```

## Props

| Prop       | Default | Purpose                                                                         |
| ---------- | ------- | ------------------------------------------------------------------------------- |
| `value`    | —       | The selected value. No `null`: the set is closed and non-empty by construction. |
| `onChange` | —       | The new value. Applied at once — there is nothing in a set to confirm.          |
| `label`    | —       | The question the set answers. **Required.**                                     |
| `options`  | —       | The options: `value`, `hue`, `name`, `disabled`.                                |
| `columns`  | `6`     | How many swatches in a row. Up Arrow and Down Arrow move by columns.            |
| `tooltips` | —       | Show the option name as a tooltip on hover and focus.                           |
| `disabled` | —       | Disables the whole set.                                                         |

## The fill is a hue, not a class and not a color string

`hue` is a name from the label palette (`LABEL_HUES`, eight hues, released in 3.12.0).
The component does not accept a ready-made class from the consumer, and this is not
strictness for its own sake:

- a class would mean a color outside the tokens — it would not survive a theme
  change, and one assembled at runtime (`` `bg-label-${hue}` ``) would not get into
  the CSS at all: Tailwind scans the sources as text;
- a color string would introduce a second palette next to the one already released.

**If the hue is not set, the swatch is empty: an outline with no fill.** This is how
the "no color" option is built: the absence of color is as much an answer to the
set's question as any hue, and it needs no separate support.

## Selection is a ring, not a second color

The selected swatch gets a neutral ring inside (`fg-0`), not an accent one. The
reason is practical: the accent is configured by the brand, and an accent ring
around a swatch of the same hue would not read at all — this defect is why
the component exists: in a consumer's app the selected option was highlighted in blue
next to a teal swatch, and the two colors clashed.

The ring changes the **shape** of the option, not only its color: telling "selected"
from "not selected" by saturation alone is not possible.

The focus ring is the accent one and sits outside the swatch, so the two indicators do
not merge: on a selected option in focus both are visible.

## The hue name as a tooltip (`tooltips`)

By default the option name is audible but not visible: a label next to nine circles
would turn the grid into a list. A sighted person then had no way to learn the name —
not every eye tells "amber" from "red" in a 24-pixel circle. `tooltips` shows the same
word as a tooltip: on hover and on keyboard focus.

```tsx
<TooltipProvider>
  <SwatchGroup label="Project color" value={color} onChange={setColor} options={OPTIONS} tooltips />
</TooltipProvider>
```

**The provider is required, and that is why the tooltip is not on by default.**
`TooltipProvider` is placed once at the app root (it also sets the delay and the
grouping of tooltips); without it Radix throws on the very first option. The set
was released before the tooltip and is already in use in consumer apps without a provider —
a default of "on" would have crashed them on a patch update.

**The text is the same `name`; there is no second field for the tooltip.** Two
sources of the name would diverge at the first translation.

**A prop on the group, not on the option**: the set must behave uniformly, and a
tooltip on three swatches of nine would look like a bug. On a disabled option
the tooltip still appears: it does not explain "why not", but "what color is this" is a
legitimate question about an unavailable option too.

**For a screen reader, the option is still named once.** Radix sets `aria-describedby` on its
trigger, and on the radio button itself that would duplicate the name, which is already
the button's accessible name, and the screen reader would read "Amber Amber". So the trigger
is a wrapper around the option: the description goes to it, and a description is
not inherited from an ancestor. The same wrapper solves a second problem —
`RadioButton` does not forward `onFocus` and `onBlur`, and a tooltip on it
would work with the mouse only, which means it would be missing for the people who need
it more.

**There is no tooltip on touch.** That is a property of the gesture, not of this
implementation: on a phone the hue name stays available to a screen reader only.

## Keyboard

| Key            | What it does                                                            |
| -------------- | ----------------------------------------------------------------------- |
| `Tab`          | Moves focus **to the selected** option; Tab also leaves the set         |
| `←` / `→`      | Moves along the row; at the edge of a row, moves to the neighboring row |
| `↑` / `↓`      | Moves along the column in steps of `columns`; the edges do not wrap     |
| `Home` / `End` | Moves to the first and last **available** option                        |
| `Space`        | Selects the option under focus                                          |
| `Esc`          | Dismisses the tooltip shown by `tooltips`, without taking focus away    |

The horizontal arrow keys are handled by the react-aria radio group itself — linearly,
in markup order, and in a row that is exactly what is needed. The vertical ones are
computed by the component: for linear navigation "down" would mean "next", that is,
the neighboring column rather than the option below the current one. The handler runs
in the capture phase and stops the event — react-aria listens lower in the tree
and would have moved the selection first.

**`columns` is a number, not `auto-fill`.** The arrow keys move along columns, so the
component must know their count; with `auto-fill` it could learn it only by
measuring, and the keyboard would silently change with the container width.

## Accessibility

- The set has the `radiogroup` role and an option has `radio`; the role itself
  announces selection, so no live region is needed.
- The set name is required (`label`); the option name is the required `name` field.
  Without it nine identical circles cannot be told apart by ear at all, and the
  fill is not a name: it cannot be read.
- By default, only the screen reader announces the option name: to the eye, the swatch
  itself names the option. With `tooltips` the name is also shown in a tooltip.
- Color is not the only cue for the selection — see above.

## Anti-patterns

- Putting the same thing in `name` as in `hue`: the name is translated, the fill is not.
- Building this choice on `RadioGroup` with a colored circle inside: an option ends
  up with two circles in a row, and the grid reads as visual noise.
- Pulling in `ColorPicker` to choose from nine options: it is about an arbitrary
  color and, as a separate entry point, weighs as much as the whole rest of the kit.
- Introducing an "empty value" with a prop: the "no color" option is an ordinary
  option of the set.

## Related sources and tests

- Source: `src/components/inputs/SwatchGroup.tsx`
- Hue palette: `LABEL_HUES`, `LABEL_BG_CLASS` — [`docs/palette.md`](../../palette.md)
- Tests: `tests/swatch-group.test.tsx`; browser — `tests-visual/interactions.spec.ts`
- Showcase: `src/components/inputs/SwatchGroup.stories.tsx`

---
component: Slider controls
exports: [Slider, RangeSlider]
category: inputs
status: stable
source: src/components/inputs/Slider.tsx
story: src/components/inputs/Slider.stories.tsx
---

# Slider and RangeSlider

## Summary for AI

`Slider` sets one number, `RangeSlider` sets the bounds `[min, max]`. These are controlled React Aria controls with keyboard support. `Slider` can be horizontal (the default) or vertical; `RangeSlider` only horizontal.

## When to use

- The value is naturally perceived as a position on a scale: volume, opacity, a numeric filter.
- For a range you need two ends and, if necessary, a minimum gap `minGap`.
- Use a vertical `Slider` when the value reads as a level: volume, gain, fill. Several such sliders side by side form a control panel.

## When not to use

- For precise input of a value without a visual scale, use `NumberInput`.
- For one of several discrete text options, use `Select`/`RadioGroup`.
- Do not put a vertical `Slider` in a form to save width: in a column of fields a horizontal one fits in with its neighbors, while a vertical one looks like a layout mistake.
- There is no vertical `RangeSlider`; its `orientation` is rejected at the type level.

## Minimal example

```tsx
<Slider label="Opacity" value={opacity} onChange={setOpacity} minValue={0} maxValue={100} />
<RangeSlider label="Price" value={price} onChange={setPrice} minValue={0} maxValue={1000} minGap={50} />
<Slider label="Level" orientation="vertical" value={level} onChange={setLevel} formatValue={(v) => `${v}%`} />
```

## Public API

- The props inherit from React Aria Slider: `value`/`defaultValue`, `onChange`, `minValue`, `maxValue`, `step`, `isDisabled`.
- `label` names the control; `valuePosition` is `side` (the default) or `none`; `formatValue` formats the value for screen readers.
- `Slider.orientation` is `horizontal` (the default) or `vertical`. `RangeSlider` has no such prop.
- `RangeSlider.minGap` prevents a range smaller than the specified gap. If the initial values already violate `minGap`, on the next change the component moves the end the user did not touch; the one under the finger stays in place.
- **With `minGap`, keep `RangeSlider` controlled** (`value` + `onChange`). In an uncontrolled one the clamped pair goes only to `onChange`, while the internal react-aria state stays unclamped: on the screen the ends can end up closer than `minGap` even though the correct value was passed to `onChange`. The kit cannot fix this on its side — the library holds that state.

## Vertical Slider

- The range grows from the bottom edge: "more" on a vertical scale is higher.
- The height is set by the root: `h-48` by default; set a custom height through `className` (`className="h-64"`). Without a height a vertical track has nothing to stretch into.
- The label and the value sit above the track, as on the horizontal one; `valuePosition` and `formatValue` work the same. The slider width follows the width of the header (the label and the value above the track), not the full width of the container.
- Why `RangeSlider` has no vertical orientation: the range geometry between two ends along the height is not implemented, and a prop that compiles and does nothing is worse than a missing one. If it is needed, it is a separate task.

## Accessibility and keyboard

- React Aria implements pointer/touch, arrow keys (one step at a time), Shift for a large step and Home/End for the bounds.
- The mouse wheel and the touchpad over the slider move the value by a step: up increases, down decreases (on a horizontal one a sideways scroll to the right also increases). In `RangeSlider` the end nearest to the cursor moves, taking `minGap` into account. At the edge of the scale the wheel event goes to the page, so that scrolling does not "stick" on the slider; with `isDisabled` the slider ignores the wheel entirely.
- On a vertical one the thumb announces `aria-orientation="vertical"`; Up Arrow increases the value, Down Arrow decreases it.
- With `isDisabled` the slider is dimmed as a whole — label, value, track and thumb — like the other kit fields; it cannot be dragged or focused.
- Do not hide the value unless there is another clear display next to it.
- See `src/components/inputs/Slider.tsx`, `src/components/inputs/Slider.stories.tsx`, `tests/slider.test.tsx`.

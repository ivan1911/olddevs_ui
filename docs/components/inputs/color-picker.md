---
component: ColorPicker
exports: [ColorPicker]
category: inputs
status: stable
source: src/components/inputs/ColorPicker.tsx
story: src/components/inputs/ColorPicker.stories.tsx
---

# ColorPicker

## Summary for AI

`ColorPicker` picks an arbitrary color: a saturation area, a hue strip, a format field and optional presets. **It lives in its own entry point `@olddevs/ui/color`, not in the barrel.** The value is a string, not an object.

```tsx
import { ColorPicker } from "@olddevs/ui/color";
```

## When to use

- The user names their own color: a label, a status, a tenant's brand color, a category highlight.
- The value goes into data and comes back from there as a string.

## Minimal example

The import is **not from the root** — that is the main feature of the component:

```tsx
import { ColorPicker } from "@olddevs/ui/color";

<ColorPicker value={brand} onChange={setBrand} label="Brand color" />;
```

## When not to use

- The choice is from a fixed set — that is `Select` or `ToggleGroup` with swatches.
- The color is set by the theme — use a token, not a picker.

## Why a separate entry point

The color subsystem of `react-aria-components` costs **61 kB gzip**: it is seven
components the kit used nowhere else. For comparison: the whole rest of the kit
fits in 62 kB.

The kit's own budget does not see this: in `npm run size` react-aria is declared
external together with the kit's other third-party libraries, and the consumer fixture page
does not import color. A gate that is green whatever the decision checks nothing.

A separate entry point makes 61 kB visible in the import line itself. The kit
has a precedent for the same reason: the locale catalogs live as
`@olddevs/ui/locales/ru`, "so they are not pulled into the bundle without an
import". The decision and the numbers are in
ADR-0038.

A consequence accepted on purpose: `import * as ui from "@olddevs/ui"` does not
give you color, and you need a second import. That is the point of the decision.

## Public API

- `value` and `onChange` take a **string**: `#4f7df3`, `rgb(...)`, `hsl(...)`. The library's `Color` object is not exposed: it would drag the react-aria type into the consumer's state and signatures.
- `label` is required — it is the name of the control. It is always on the button, including when `children` replace its content: otherwise an icon in place of a label would leave the button nameless.
- `outputFormat`: `hex` (default), `rgb`, `hsl` — the format of the **string in `onChange`**. The input field always stays hexadecimal, and the prop name says so: `rgb` and `hsl` are three channel fields, that is, a different control, not a different format of the same one. So the field label is also always `HEX`: labeling it "HSL" when it accepts hex would be lying to the user right on the screen.
- `presets` — a row of presets. **There is no default on purpose**: a set of "brand" colors is the consumer's domain, and whoever knows which of the theme tokens apply to their entity should be the one to put them here. An unrecognized preset is **skipped**; it does not crash the render — see below.
- `children` replace the trigger content when a swatch with a label is not enough.
- `disabled` keeps the panel from opening.

## An unrecognized preset is skipped, an unrecognized value is not

The asymmetry is deliberate. The consumer stores the **value** and passes it on,
so a string in `value` that is not recognized becomes black (the reason is in the
next section), and the kit does not step in.

A **preset** is decoration. On a string it does not recognize, the library
**throws**, and in the render phase at that, so it takes down the whole consumer
subtree; a component must not fall over because of decoration. And what breaks is
not an exotic case: `rebeccapurple` is a legal CSS color that the library does not
accept, and keeping a brand palette as names is natural. Presets that are
not recognized are not rendered; if none is recognized, there is no row at
all.

## An unrecognized value becomes black

This is react-aria behavior, and the kit does not intercept it: replacing the
consumer's value silently is the same as silently repairing it. It is worth knowing the
consequence: the very first move of the slider passes black to `onChange`, that is,
it replaces the unrecognized value with a recognized one. Checking the string
is the consumer's job, since the consumer is the one who built it.

## A wrapper over `react-aria-components`

The kit does not do color math itself. Color space conversions, string parsing, accessible shade descriptions for the
screen reader and the keyboard handling of the two-dimensional area — all of this
is already in `react-aria-components` (generally available since 1.4.0). The component
adds only the token vocabulary on top and the layout.

## The component produces a color outside the token system

This is its purpose, not an oversight. Everything else in the kit takes color from
the theme; here the user names their own — and the result by design follows
neither the theme nor the brand.

This also means the kit does **not** check the contrast of the chosen color, and
cannot, because it does not know what the color will end up on. Responsibility for legibility stays with the consumer.

"Custom color…" in
[`RichTextEditor`](./rich-text-editor.md#custom-color) takes on this responsibility:
`ColorPicker` sits in a popover, and next to it the contrast of the chosen color against the Editor
background of the current theme is computed and a warning is shown (4.5:1). The
Editor loads it lazily — the react-aria color subsystem stays out of the
`@olddevs/ui/editor` entry point.

## Keyboard

- The trigger is a regular button: Enter and Space open the panel, Escape closes it and returns focus.
- The two-dimensional saturation and brightness area is one control with two axes: arrow keys move along both; `Home` and `End` jump to the ends of the current axis.
- The hue strip and the format field are separate tab stops; the row of presets is traversed with arrow keys as a single group.
- All of the above comes from react-aria together with the accessible shade descriptions; the kit writes no keyboard handling of its own here.

## Accessibility and semantics

- The controls of the saturation area and the hue strip are described in the "Keyboard" section; roles, bounds and keyboard handling come from react-aria.
- The library itself localizes the color channel names and the accessible shade descriptions — the kit adds no message catalog keys of its own for them.
- The label of the presets row comes from the message catalog (`colorPicker.presets`).
- See `src/color.ts`, `src/components/inputs/ColorPicker.tsx`, `src/components/inputs/ColorPicker.stories.tsx`, `tests/color-picker.test.tsx`.

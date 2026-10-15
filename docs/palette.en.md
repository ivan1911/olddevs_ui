---
sourceHash: 7c62be811b78
---

# Palette

This page shows the kit's color values: which palette primitives (labels aside) are declared and which role
each of them is assigned to in each theme. The contract of names and layers is described in
[Themes, tokens and brands](theming.md) — here there are only numbers.

The source of truth is [`styles.css`](../styles.css). The tables below were copied from it
by hand, so there is one rule: **if you change a token, edit the file and bring the page
in line in the same change.** A table that has drifted is worse than no
table.

## How to read

A color goes through three steps, and at each it has its own name:

```
--od-blue-6  →  --accent-strong  →  text-accent-strong
  primitive          role              Tailwind class
```

A component writes a class, the class refers to a role, the role takes a primitive. The theme changes
only the middle step: `--accent-strong` in the light theme points to `--od-blue-2`
instead of `--od-blue-6`, while the class and the value of the primitive itself stay the same.

## Layer 1 — primitives

### Neutrals

Three scales, one per theme. The step number increases with lightness: 1 is the darkest, 12 is the
lightest. The direction of use is **opposite** for the dark scales and the light one:
in `slate` and `navy` the lower steps are backgrounds and the upper ones are
text; in `cloud` it is the other way round: one is ink, twelve is white paper.

| Step | `--od-slate-*` (dark) | `--od-cloud-*` (light) | `--od-navy-*` (dim) |
| ---- | --------------------- | ---------------------- | ------------------- |
| 1    | `#26272d`             | `#17212b`              | `#15202b`           |
| 2    | `#2e2f36`             | `#45515f`              | `#1e2732`           |
| 3    | `#363740`             | `#545f6e`              | `#253341`           |
| 4    | `#3c3d46`             | `#636e7a`              | `#2d3a44`           |
| 5    | `#41424c`             | `#9aa6b2`              | `#2f3e4f`           |
| 6    | `#494a55`             | `#d9e2ec`              | `#38444d`           |
| 7    | `#4d4e59`             | `#e3ebf4`              | `#3a4d5f`           |
| 8    | `#5a5c66`             | `#e7edf3`              | `#3f5066`           |
| 9    | `#aeb0b9`             | `#edf2f7`              | `#9faab2`           |
| 10   | `#afb0b7`             | `#f4f7fa`              | `#9babb8`           |
| 11   | `#dadce4`             | `#f8fafc`              | `#afb8c1`           |
| 12   | `#f4f5f8`             | `#ffffff`              | `#f7f9f9`           |

The fourth, short scale is **ink** `--od-ink-*`, a neutral dark gray without the
blue tint of `cloud`: the background of the inverse surface in the light theme.

| Step | `--od-ink-*` | Role                                 |
| ---- | ------------ | ------------------------------------ |
| 1    | `#1f1f1f`    | `--surface-inverse` in light         |
| 2    | `#333333`    | `--surface-inverse-hover` in light   |
| 3    | `#4a4a4a`    | `--surface-inverse-pressed` in light |

### Tones

The "Used by" column is the only way to see why a color scale has exactly this many
steps: each one exists for a specific role in a specific theme, and there are no spare ones.

| Primitive       | Value     | Used by                                                          |
| --------------- | --------- | ---------------------------------------------------------------- |
| `--od-blue-1`   | `#1767c2` | `--accent-hover` in light                                        |
| `--od-blue-2`   | `#1c6cc6` | `--accent-strong` in light                                       |
| `--od-blue-3`   | `#1e76da` | `--accent` in all themes                                         |
| `--od-blue-4`   | `#1f7ae0` | base of the alpha variants of `--accent-soft` and `--focus-ring` |
| `--od-blue-5`   | `#3290f4` | `--accent-hover` in dark and dim                                 |
| `--od-blue-6`   | `#7fc1ff` | `--accent-strong` in dark and dim                                |
| `--od-blue-7`   | `#e8f1ff` | `--accent-soft` in light                                         |
| `--od-green-1`  | `#17724c` | `--success-strong` in light                                      |
| `--od-green-2`  | `#1f9d68` | `--success` in light                                             |
| `--od-green-3`  | `#3fb47f` | `--success` in dark and dim                                      |
| `--od-green-4`  | `#7ad1a9` | `--success-strong` in dark and dim                               |
| `--od-amber-1`  | `#895a0d` | `--warning-strong` in light                                      |
| `--od-amber-2`  | `#c98512` | `--warning` and `--rating-star` in light                         |
| `--od-amber-3`  | `#f0b341` | `--warning` and `--rating-star` in dark and dim                  |
| `--od-amber-4`  | `#f2bf5f` | `--warning-strong` in dark and dim                               |
| `--od-red-1`    | `#b82d2d` | `--danger-strong` in light                                       |
| `--od-red-2`    | `#da3c2b` | `--danger` in dark and dim                                       |
| `--od-red-3`    | `#d14343` | `--danger` in light                                              |
| `--od-red-4`    | `#e0594b` | base of the semi-transparent `--danger-soft` in dark and dim     |
| `--od-red-5`    | `#eea8a0` | `--danger-strong` in dark and dim                                |
| `--od-lime-1`   | `#3f6212` | `--draft-strong` in light                                        |
| `--od-lime-2`   | `#4d7c0f` | `--draft` in light                                               |
| `--od-lime-3`   | `#a3e635` | `--draft` in dark and dim                                        |
| `--od-lime-4`   | `#d9f99d` | `--draft-strong` in dark and dim                                 |
| `--od-violet-1` | `#5947e0` | `--accent-hover` with `data-accent="violet"`                     |
| `--od-violet-2` | `#5744e9` | `--accent-strong` of the same accent in light                    |
| `--od-violet-3` | `#6d5df0` | `--accent` with `data-accent="violet"`                           |
| `--od-violet-4` | `#b8b2f8` | `--accent-strong` of the same accent in the dark themes          |
| `--od-indigo-1` | `#4f7be8` | `--accent-alt` in light                                          |
| `--od-indigo-2` | `#7d63ef` | `--accent-alt` in dark and dim                                   |

Violet is the kit's second accent, indigo is the extra `accent-alt` tone;
lime is used for `draft`, the indicator of unsaved changes, and is a separate tone
on purpose. The hue was chosen to sit in the free gap on the color wheel — 57° from the validation
amber and 70° from the success green; the details are in the comment at `--draft` in
`styles.css`.

### Semi-transparent primitives

The alpha is baked into the value instead of being computed with `color-mix`: the contrast gate
parses literal color values and would go blind on computed expressions exactly on the
tokens it was written for.

| Primitive           | Value                       | Used by                               |
| ------------------- | --------------------------- | ------------------------------------- |
| `--od-blue-4-a16`   | `rgba(31, 122, 224, 0.16)`  | `--accent-soft` in dark and dim       |
| `--od-blue-4-a18`   | `rgba(31, 122, 224, 0.18)`  | `--focus-ring` in light               |
| `--od-blue-4-a20`   | `rgba(31, 122, 224, 0.2)`   | `--focus-ring` in dark and dim        |
| `--od-blue-4-a35`   | `rgba(31, 122, 224, 0.35)`  | `--selection-light`                   |
| `--od-blue-5-a45`   | `rgba(50, 144, 244, 0.45)`  | `--selection-dark`                    |
| `--od-green-2-a12`  | `rgba(31, 157, 104, 0.12)`  | `--success-soft` in light             |
| `--od-green-3-a12`  | `rgba(63, 180, 127, 0.12)`  | `--success-soft` in dark and dim      |
| `--od-amber-2-a14`  | `rgba(201, 133, 18, 0.14)`  | `--warning-soft` in light             |
| `--od-amber-3-a13`  | `rgba(240, 179, 65, 0.13)`  | `--warning-soft` in dark and dim      |
| `--od-red-3-a12`    | `rgba(209, 67, 67, 0.12)`   | `--danger-soft` in light              |
| `--od-red-4-a12`    | `rgba(224, 89, 75, 0.12)`   | `--danger-soft` in dark and dim       |
| `--od-lime-2-a10`   | `rgba(77, 124, 15, 0.1)`    | `--draft-soft` in light               |
| `--od-lime-3-a14`   | `rgba(163, 230, 53, 0.14)`  | `--draft-soft` in dark and dim        |
| `--od-violet-3-a14` | `rgba(109, 93, 240, 0.14)`  | `--accent-soft` of the violet accent  |
| `--od-violet-3-a20` | `rgba(109, 93, 240, 0.2)`   | `--focus-ring` of the violet accent   |
| `--od-violet-3-a32` | `rgba(109, 93, 240, 0.32)`  | `--selection-light` of the violet one |
| `--od-violet-4-a30` | `rgba(184, 178, 248, 0.3)`  | `--selection-dark` of the violet one  |
| `--od-indigo-1-a14` | `rgba(79, 123, 232, 0.14)`  | `--accent-alt-soft` in light          |
| `--od-indigo-2-a14` | `rgba(125, 99, 239, 0.14)`  | `--accent-alt-soft` in dark and dim   |
| `--od-slate-1-a72`  | `rgba(38, 39, 45, 0.72)`    | `--topbar-bg` in dark                 |
| `--od-cloud-10-a84` | `rgba(244, 247, 250, 0.84)` | `--topbar-bg` in light                |
| `--od-navy-1-a72`   | `rgba(21, 32, 43, 0.72)`    | `--topbar-bg` in dim                  |
| `--od-scrim-dark`   | `rgba(6, 7, 9, 0.78)`       | `--overlay-scrim` in dark and dim     |
| `--od-scrim-light`  | `rgba(236, 242, 248, 0.78)` | `--overlay-scrim` in light            |

## Layer 2 — roles by theme

`dark` is the default; `light` and `dim` override the base block. Where it says
"= dark", the theme does **not** override the role: dim changes only surfaces,
text, borders, shadows and `--topbar-bg`, and takes tones and accent from the dark theme.

### Surfaces

| Token                   | dark                | light                | dim                |
| ----------------------- | ------------------- | -------------------- | ------------------ |
| `--surface-app`         | `slate-1` `#26272d` | `cloud-10` `#f4f7fa` | `navy-1` `#15202b` |
| `--surface-panel`       | `slate-2` `#2e2f36` | `cloud-12` `#ffffff` | `navy-2` `#1e2732` |
| `--surface-panel-hover` | `slate-3` `#363740` | `cloud-9` `#edf2f7`  | `navy-3` `#253341` |
| `--surface-elevated`    | `slate-5` `#41424c` | `cloud-11` `#f8fafc` | `navy-5` `#2f3e4f` |
| `--surface-contrast`    | `slate-7` `#4d4e59` | `cloud-7` `#e3ebf4`  | `navy-7` `#3a4d5f` |

### Inverse surface

A pill that has to differ from everything around it by sign, not by step
of brightness: the Editor's Bubble menu (`toolbar="bubble"`), which sits directly on the
Document. Light in the dark themes, dark in the light one. It has the utilities
`bg-surface-inverse`, `bg-surface-inverse-hover`, `bg-surface-inverse-pressed`,
`text-text-on-inverse`, `outline-accent-on-inverse`.

| Token                       | dark                 | light                | dim    |
| --------------------------- | -------------------- | -------------------- | ------ |
| `--surface-inverse`         | `cloud-11` `#f8fafc` | `ink-1` `#1f1f1f`    | = dark |
| `--surface-inverse-hover`   | `cloud-8` `#e7edf3`  | `ink-2` `#333333`    | = dark |
| `--surface-inverse-pressed` | `cloud-6` `#d9e2ec`  | `ink-3` `#4a4a4a`    | = dark |
| `--text-on-inverse`         | `cloud-1` `#17212b`  | `cloud-12` `#ffffff` | = dark |
| `--accent-on-inverse`       | `blue-2` `#1c6cc6`   | `blue-6` `#7fc1ff`   | = dark |

- **Text and icons** hold at least 8.8:1 on all three backgrounds of the pill (at rest,
  hovered, pressed), well above the required 4.5 for text and 3 for icons.
- **`--accent-on-inverse` is the focus outline** on the pill: the `--accent-strong`
  of the opposite theme (the pill in a dark theme is light, and it needs a dark
  blue). So the accent axis and the brand change it as a mirror image of
  `--accent-strong` — see "Accent and brand axes". Measured at no less than 4.0:1 (the gate
  threshold is 3:1) on any of the three backgrounds of the pill.
- **A separate group, not `--surface-contrast`.** That one is a step of the ordinary scale
  of backgrounds (`bg-4`) and differs from the `panel` surface by one step; over text, one step merges with the
  Document.
- Menus and popovers opened from such a pill stay on the ordinary popover
  surface: the inversion belongs to the pill, not to everything opened from it.

The pairs are checked by `npm run contrast` in all themes, accents and brands.

### Text

| Token               | dark                 | light                | dim                 |
| ------------------- | -------------------- | -------------------- | ------------------- |
| `--text-primary`    | `slate-12` `#f4f5f8` | `cloud-1` `#17212b`  | `navy-12` `#f7f9f9` |
| `--text-secondary`  | `slate-11` `#dadce4` | `cloud-2` `#45515f`  | `navy-11` `#afb8c1` |
| `--text-muted`      | `slate-9` `#aeb0b9`  | `cloud-3` `#545f6e`  | `navy-9` `#9faab2`  |
| `--text-muted-2`    | `slate-10` `#afb0b7` | `cloud-4` `#636e7a`  | `navy-10` `#9babb8` |
| `--text-disabled`   | `slate-8` `#5a5c66`  | `cloud-5` `#9aa6b2`  | `navy-8` `#3f5066`  |
| `--text-on-accent`  | `cloud-12` `#ffffff` | `cloud-12` `#ffffff` | = dark              |
| `--text-on-warning` | `cloud-1` `#17212b`  | = dark               | = dark              |
| `--text-on-success` | `cloud-1` `#17212b`  | = dark               | = dark              |

The text scale keeps three levels of contrast in each theme: `secondary` ≥ 7.5,
`muted` ≥ 6.0, `muted-2` ≥ 4.5 against the worst of the backgrounds. The lowest level is the WCAG AA
level for text; the upper two are set well above what AA requires, only so that the levels stay
distinguishable.

`--text-on-warning` and `--text-on-success` are declared once and are not overridden by
themes: white on a yellow fill has a contrast of 1.87 where 4.5 is required, and
picking a different hue does not fix it, so these two tones have dark text.

### Borders

| Token              | dark                | light               | dim                |
| ------------------ | ------------------- | ------------------- | ------------------ |
| `--border-default` | `slate-6` `#494a55` | `cloud-6` `#d9e2ec` | `navy-6` `#38444d` |
| `--border-soft`    | `slate-4` `#3c3d46` | `cloud-8` `#e7edf3` | `navy-4` `#2d3a44` |

### Accent

| Token               | dark                                | light                               | dim    |
| ------------------- | ----------------------------------- | ----------------------------------- | ------ |
| `--accent`          | `blue-3` `#1e76da`                  | `blue-3` `#1e76da`                  | = dark |
| `--accent-hover`    | `blue-5` `#3290f4`                  | `blue-1` `#1767c2`                  | = dark |
| `--accent-soft`     | `blue-4-a16` `rgba(31,122,224,.16)` | `blue-7` `#e8f1ff`                  | = dark |
| `--accent-strong`   | `blue-6` `#7fc1ff`                  | `blue-2` `#1c6cc6`                  | = dark |
| `--focus-ring`      | `blue-4-a20` `rgba(31,122,224,.2)`  | `blue-4-a18` `rgba(31,122,224,.18)` | = dark |
| `--selection`       | `--selection-dark`                  | `--selection-light`                 | = dark |
| `--selection-dark`  | `blue-5-a45` `rgba(50,144,244,.45)` | `blue-5-a45` `rgba(50,144,244,.45)` | = dark |
| `--selection-light` | `blue-4-a35` `rgba(31,122,224,.35)` | `blue-4-a35` `rgba(31,122,224,.35)` | = dark |
| `--accent-alt`      | `indigo-2` `#7d63ef`                | `indigo-1` `#4f7be8`                | = dark |
| `--accent-alt-soft` | `indigo-2-a14`                      | `indigo-1-a14`                      | = dark |

### State tones

Each tone has two tokens, because it has two incompatible roles: `--<tone>` is
the fill under contrasting text (darker), `--<tone>-strong` is the same tone as
text, border and indicator on a background (lighter in the dark themes, darker in the light one).

| Token              | dark                | light               | dim    |
| ------------------ | ------------------- | ------------------- | ------ |
| `--success`        | `green-3` `#3fb47f` | `green-2` `#1f9d68` | = dark |
| `--success-soft`   | `green-3-a12`       | `green-2-a12`       | = dark |
| `--success-strong` | `green-4` `#7ad1a9` | `green-1` `#17724c` | = dark |
| `--warning`        | `amber-3` `#f0b341` | `amber-2` `#c98512` | = dark |
| `--warning-soft`   | `amber-3-a13`       | `amber-2-a14`       | = dark |
| `--warning-strong` | `amber-4` `#f2bf5f` | `amber-1` `#895a0d` | = dark |
| `--rating-star`    | `amber-3` `#f0b341` | `amber-2` `#c98512` | = dark |
| `--danger`         | `red-2` `#da3c2b`   | `red-3` `#d14343`   | = dark |
| `--danger-soft`    | `red-4-a12`         | `red-3-a12`         | = dark |
| `--danger-strong`  | `red-5` `#eea8a0`   | `red-1` `#b82d2d`   | = dark |
| `--draft`          | `lime-3` `#a3e635`  | `lime-2` `#4d7c0f`  | = dark |
| `--draft-soft`     | `lime-3-a14`        | `lime-2-a10`        | = dark |
| `--draft-strong`   | `lime-4` `#d9f99d`  | `lime-1` `#3f6212`  | = dark |

## Layer 3 — component tokens

| Token             | dark          | light          | dim          |
| ----------------- | ------------- | -------------- | ------------ |
| `--overlay-scrim` | `scrim-dark`  | `scrim-light`  | = dark       |
| `--topbar-bg`     | `slate-1-a72` | `cloud-10-a84` | `navy-1-a72` |

The nine Editor marker tokens `--marker-<name>` and `--marker-text` are in the [marker table](#маркер-редактора)
below: the value is per theme, and the selector is `[data-theme]` of any element, not `:root`.

`--rating-star` is a layer 2 role, not a component token: it is declared next to
`--warning` but as a separate token, because the color is the same today and
editing the warning must not recolor ratings. The other three layer 3 tokens —
`--modal-shadow`, `--sidenav-w` and `--sidenav-w-collapsed` — carry no color; their values are in
[theming.md](theming.md).

## User labels

A closed set of eight hues for what a person colors themselves: a project,
a tag, a category. `blue`, `violet`, `teal`, `green`, `amber`, `red`, `pink`,
`steel` — the `--label-<hue>` tokens and the utilities `bg-label-<hue>`,
`text-label-<hue>`, `border-label-<hue>`.

**These are not tones.** A tone describes meaning: `danger` means "the action is destructive".
A label means exactly what the person put into it. The semantic tones cannot be borrowed
for labels: a dot in the `danger` color next to a project would read as an error, and the
tone would stop meaning what it means. That is why labels have their own primitive steps,
offset from the tones — even where "green" and
"red" were requested when the set was created.

**Names by hue, not by purpose.** The name is stored in the consumer's database as the color
key and survives value changes; `label-1` will mean nothing
to anyone in six months.

**Independent of both accent and brand.** Both blocks (accent and brand) override only
`--accent*`, while labels reference the primitives directly. When switching the accent from blue to
violet, the user must not find that all their projects changed
color.

**The contrast threshold is the non-text one, 3:1.** A label is a graphic indicator, not text
(WCAG 1.4.11). Text _inside_ the fill is not expected: eight hues
readable under text in all three themes would require a set twice as large, and text
next to it solves the same task. All eight are checked by `npm run contrast` in
all three themes — the `Foundations/Label colours` showcase page shows the whole set.

`LABEL_HUES` (the order and composition of the set), `LABEL_BG_CLASS` and
`LABEL_TEXT_CLASS` are exported by the kit. Lookup maps rather than string concatenation such as `bg-label-${hue}`: Tailwind scans
sources as text, and a class assembled at runtime silently does not make it into the CSS.

Color selection is built on the existing `ColorPicker` — the set does not need its own
component.

## Editor marker

Nine `--marker-<name>` tokens of the component layer: the fill of the marker in
`RichTextEditor` and `RichTextView`. The color names, as in
Notion, are not tones: `yellow` does not mean "warning". All nine are chosen in the
"Marker color" grid. The three bright ones are the same in all themes
(primitives `--od-marker-yellow`, `-green`, `-pink`), and the text on them is dark:
`--marker-text` (`--od-marker-text`). The six earlier Notion colors have
their own primitives: `--od-marker-<name>-d` (dark, muted) and `--od-marker-<name>-l`
(pastel), and the text on them is the theme's main text.

| Token             | `light` (`-l`) | `dark` and `dim` (`-d`) |
| ----------------- | -------------- | ----------------------- |
| `--marker-yellow` | `#ffea80`      | `#ffea80`               |
| `--marker-green`  | `#aaff80`      | `#aaff80`               |
| `--marker-pink`   | `#ff80bf`      | `#ff80bf`               |
| `--marker-blue`   | `#d3e5ef`      | `#28456c`               |
| `--marker-gray`   | `#e3e2e0`      | `#5a5a5a`               |
| `--marker-brown`  | `#eee0da`      | `#603b2c`               |
| `--marker-orange` | `#fadec9`      | `#854c1d`               |
| `--marker-purple` | `#e8deee`      | `#492f64`               |
| `--marker-red`    | `#ffe2dd`      | `#6e3630`               |
| `--marker-text`   | `#1a1a1a`      | `#1a1a1a`               |

Dim has no values of its own: the dark fills suit both dark themes.
**The selector is `[data-theme]` of any element**, not `:root[data-theme]`, and the tokens have no
`@theme` bridge: this way a nested wrapper with a different theme gets its own
values (`theming.md`); the bright three and `--marker-text` do not depend on the theme.
The dark text holds 4.5:1 on the bright three in all themes (14.4 on yellow and green, 7.5 on
pink), and the main text `fg-0` holds it on the six readable markers (the worst is `orange`, 6.32, in
`dark`): `npm run contrast` checks this. The markers depend on neither the accent nor the brand. Saved marker
names from the previous palette (`accent`, `success`, …) are converted to the nearest color —
see the table in the [Editor documentation](components/inputs/rich-text-editor.md#цвет-маркер-и-выравнивание).

## Accent and brand axes

When a brand is set, it overrides the whole accent axis: both blocks have the same
specificity, and the brand comes later in the file.

| Token                 | `data-accent="violet"` | `data-brand="teal"` |
| --------------------- | ---------------------- | ------------------- |
| `--accent`            | `violet-3` `#6d5df0`   | `teal-2` `#0f766e`  |
| `--accent-hover`      | `violet-1` `#5947e0`   | `teal-1` `#115e59`  |
| `--accent-soft`       | `violet-3-a14`         | `teal-3-a16`        |
| `--accent-strong`     | `violet-4` `#b8b2f8`   | `teal-4` `#5eead4`  |
| `--focus-ring`        | `violet-3-a20`         | `teal-3-a20`        |
| `--selection-dark`    | `violet-4-a30`         | `teal-3-a35`        |
| `--selection-light`   | `violet-3-a32`         | `teal-2-a30`        |
| `--accent-on-inverse` | `violet-2` `#5744e9`   | `teal-1` `#115e59`  |

In the light theme `--accent-strong` takes its own value for both — `violet-2`
`#5744e9` and `teal-1` `#115e59`: the token is read **on** a background, and a light background
needs a dark hue instead of a light one. `--accent-on-inverse` is the mirror image:
in the light theme the pill is dark, and it takes a light hue — `violet-4`
`#b8b2f8` and `teal-4` `#5eead4`. In the light theme, both set `--selection` to their own
`--selection-light`: the accent and brand block comes after the light theme, so the
paired block brings back the light selection.

**Selection** (`--selection`) is the fill of selected text:
the global `::selection` and the Editor's `--rte-selection` role. The difference from the
background is 1.7–2.0:1 in the dark themes and 1.5–1.6:1 in the light one, at the level of the selection in
VS Code and macOS; 3:1 is not the goal, because in a dark theme such a fill no longer
holds 4.5:1 for light text on top of it. `--selection-light` is the light variant in
any app theme: the Editor's Paper (`surface="paper"`) takes it.
`--selection-dark` is the dark mirror in any theme: the Editor's
Source mode field takes it, dark in the light theme too; the dark themes assign
it to `--selection`.

The `teal` brand primitives are declared inside its own block and are not part of the shared
palette: `#115e59`, `#0f766e`, `#14b8a6`, `#5eead4` plus four semi-transparent variants —
`rgba(20, 184, 166, 0.16)`, `rgba(20, 184, 166, 0.2)`, `rgba(20, 184, 166, 0.35)`
and `rgba(15, 118, 110, 0.3)`. It is a sample
to copy — how to set up your own brand is described in
[theming.md](theming.md#как-завести-бренд).

## Compatibility aliases

Components get their colors through them: the Tailwind classes refer to these names.

| Alias                         | Role                                           |
| ----------------------------- | ---------------------------------------------- |
| `--bg-0` … `--bg-4`           | `--surface-app` … `--surface-contrast`         |
| `--fg-0` … `--fg-4`           | `--text-primary` … `--text-disabled`           |
| `--line`, `--line-soft`       | `--border-default`, `--border-soft`            |
| `--tg`, `--tg-2`, `--tg-soft` | `--accent`, `--accent-strong`, `--accent-soft` |
| `--ok`, `--ok-soft`           | `--success`, `--success-soft`                  |
| `--warn`, `--warn-soft`       | `--warning`, `--warning-soft`                  |
| `--err`, `--err-soft`         | `--danger`, `--danger-soft`                    |
| `--purple`, `--purple-soft`   | `--accent-alt`, `--accent-alt-soft`            |

You do not need to add new ones: the full names are the target vocabulary, and the aliases are kept for
consumer code and will be removed once no consumer code uses them.

## What's next

- [Themes, tokens and brands](theming.md) — layers, rules and how to add a brand.
- [Accessibility](accessibility.md) — the requirements the contrast gate enforces.

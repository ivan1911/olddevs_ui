# Themes, tokens and brands

This page answers three questions: how the kit's colors are built, which of them you can
override in your own app, and how to set up your own brand.

The source of the values is [`styles.css`](../styles.css). This page describes the contract: names,
layers and rules. Values change in the file, not here.

## Four layers

| Layer         | What it is                                             | Names                                     | Consumer edits                   |
| ------------- | ------------------------------------------------------ | ----------------------------------------- | -------------------------------- |
| 1. Primitives | Palette: a color as a value, with no role or theme     | `--od-<family>-<step>`                    | **no**                           |
| 2. Semantics  | Role: what is painted with what                        | `--surface-*`, `--text-*`, `--accent*` …  | yes, carefully                   |
| 3. Component  | How one component family differs from the general rule | closed list below                         | yes                              |
| 4. Brand      | The `[data-brand="…"]` block on top of layers 2 and 3  | the brand's primitives + role assignments | **yes, this is the entry point** |

Reading rule: **a lower layer does not know about a higher one**. `--od-slate-1` does not know that
it is the app background; `--surface-app` knows that. A component knows neither —
it writes the class `bg-bg-0`, backed by the `@theme` bridge.

### Layer 1 — primitives

Three neutral scales, one per theme (`slate` for dark, `cloud` for light,
`navy` for dim), and seven color scales. Within a scale the step number increases with lightness:
1 is the darkest, 12 the lightest.

Three scales instead of one is not duplication: each theme's neutrals are tuned
by hand for its own background, and reducing them to one scale would mean recoloring two
themes out of three.

**You do not need to override primitives in your app, and doing so is not supported.** `--od-blue-3`
belongs to the kit's palette; editing it would affect everything built on it, including
themes you did not think about. The place to make changes is layer 4.

Semi-transparent primitives are named `--od-<family>-<base step>-a<alpha>`
(`--od-blue-4-a16` is the fourth step of blue with alpha 0.16) and **bake the alpha into
the value** instead of computing it with `color-mix`. The reason is practical:
`scripts/contrast.mjs` parses `var(--x)` and literal color values, but not computed
expressions. If the kit computed `*-soft` with `color-mix`, the contrast gate would go blind on exactly
the tokens it was written for.

### Layer 2 — semantics

Roles: surfaces (`--surface-app`, `--surface-panel`, …), text
(`--text-primary` … `--text-disabled`), borders, tone roles:
`accent`, `success`, `warning`, `danger`, and `draft`, which is outside the tone vocabulary.
The shadows `--shadow-1` and `--shadow-2` also live here — the system-level elevation scale.

Each tone has two tokens, because it has two incompatible roles: `--<tone>`
is the fill under contrasting text (darker), `--<tone>-strong` is the same tone as
text, border and indicator on a background (lighter in the dark themes). One value cannot
cover both; details and numbers are in the comments of `styles.css`.

**Inverse surface** is a separate group of roles for a pill
that sits directly on the Document and has to differ from it by polarity, not by a single
step: the Editor's Bubble menu. `--surface-inverse` (the background),
`--surface-inverse-hover` and `--surface-inverse-pressed` (hover and press),
`--text-on-inverse` (text and icons) are light in `dark` and `dim`, and dark in
`light`. The focus outline on it is `--accent-on-inverse`: it is the `--accent-strong`
of the opposite theme, so accent and brand set it as a mirror image. Values
and contrast pairs — [palette.md](palette.md#inverse-surface).

The aliases `--bg-0…4`, `--fg-0…4`, `--line`, `--tg`, `--ok`, `--warn`, `--err` are
a compatibility layer. Components get their colors through them, via Tailwind classes
(`bg-bg-1`, `text-fg-2`). You do not need to add new ones.

### Layer 3 — component tokens

The list is **closed**. A component token is added when a component family has a real
reason to differ from the semantics, not "just in case"; a token with no reader is
not added at all.

| Token                   | Who reads it                                                |
| ----------------------- | ----------------------------------------------------------- |
| `--overlay-scrim`       | `Dialog`, `Drawer`, `CommandPalette`, `ModalOverlay`        |
| `--modal-shadow`        | `Dialog`                                                    |
| `--topbar-bg`           | `SelectionBar` when stuck, `TopBar`                         |
| `--sidenav-w`           | `SideNav`, the `AppShell` grid — expanded width             |
| `--sidenav-w-collapsed` | the same in collapsed mode                                  |
| `--marker-<name>`       | the highlight of `RichTextEditor` and `RichTextView` — nine |
| `--marker-text`         | dark text on any highlight, one for all themes              |

**`--marker-<name>` is nine Editor highlight tokens** (`gray`, `brown`, `orange`,
`yellow`, `green`, `blue`, `purple`, `pink`, `red`). Three of them
(`yellow`, `green`, `pink`) are bright and **the same in all themes**; they are declared once, in the
`:root, [data-theme]` block, with no per-theme counterpart. The six earlier ones ("readable", they are not in the Toolbar
menu) have a per-theme value: pastel in `light`, a muted dark in
`dark` and `dim`. The text on a highlight is dark — the `--marker-text` token. What sets them apart from
the other tokens of this layer is the **selector**: they are declared on `[data-theme="…"]` of any
element, not on `:root[data-theme="…"]`, and are read as a variable directly
(`bg-(--marker-yellow)`), without the `@theme` bridge. So in a nested wrapper with a
different theme the highlight takes the value of the nearest theme. The bridge is declared on the root, and
`var()` in it is resolved there — a nested theme would not work through it.
The dark `--marker-text` holds 4.5:1 on the bright three in all themes, and the main text holds it on the six readable highlights (`npm run contrast`).

`--topbar-bg` is named by role, not by its reader: it is the
semi-transparent background of the header.

**Sidebar widths are variables, not props.** The value is needed by both the
sidebar and the shell grid, and the mobile layout is switched by CSS, not by
JavaScript: a number passed as a prop into two components is a re-render for something
CSS can read on its own. The widths do not depend on the theme and are not
repeated in the theme blocks. It is enough to change them in one place:

```css
:root {
  --sidenav-w: 280px;
}
```

**`--topbar-h` is not on this list: it is not a token but a measurement.** It has
no default value that would make sense, and it does not belong in the theme layers.
It is published by whoever owns the header: since 2.1.0 that is the kit's `TopBar`
(ADR-0019), and for an
app with its own header it is still the app itself
(ADR-0016). The kit
reads it through `useStickyOffset`.

**The bottom edge works the same way: `--bottombar-h`.** It is published by the
`bottomBar` slot of `AppShell` (the name is the `bottomBarHeightVar` prop), and read
by `ContextualSaveBar` and `Toaster`, which stick to the bottom. At `md` and wider the
bar is hidden and the value is `0px`; without the slot the variable does not exist and
readers take the `0px` fallback. It is a measurement too, not a token: it has no default
value.

## Type scale

Text size comes from a scale of seven steps. A step is a "font size / line height" pair
declared in [`styles.css`](../styles.css) as `--text-<step>` and
`--text-<step>--line-height`; Tailwind turns it into a `text-<step>` class.

| Class          | Size / line | Where it is used                               |
| -------------- | ----------- | ---------------------------------------------- |
| `text-caption` | 11 / 16     | field labels, uppercase                        |
| `text-xs`      | 12 / 16     | counters, hints                                |
| `text-sm`      | 13 / 20     | the kit's working size: button and item labels |
| `text-md`      | 14 / 20     | body text                                      |
| `text-lg`      | 16 / 24     | subheadings                                    |
| `text-xl`      | 20 / 28     | section headings                               |
| `text-2xl`     | 26 / 32     | page heading                                   |

**Every step sets its line height.** Without it, the height is derived from the inherited
`1.5` multiplier and comes out fractional, so neighboring controls drift apart in height by
fractions of a pixel.

**The scale overrides three of Tailwind's default steps rather than adding to them:**

| Class      | Tailwind | Kit     | Shift |
| ---------- | -------- | ------- | ----- |
| `text-sm`  | 14 / 20  | 13 / 20 | −1 px |
| `text-lg`  | 18 / 28  | 16 / 24 | −2 px |
| `text-2xl` | 24 / 32  | 26 / 32 | +2 px |

`text-caption` and `text-md` are the kit's own steps: Tailwind has `text-base` where the kit has
`text-md`. The kit's scale starts lower than Tailwind's default one because the working size here is
13 pixels.

**For your app this is a silent change.** `styles.css` is imported into your app's CSS, so the
override applies to your own classes too: once you import `styles.css`, `text-sm` in your markup becomes
13 pixels instead of 14, `text-lg` becomes 16 instead of 18, and `text-2xl` becomes 26 instead of 24.
Neither the build nor the types will notice. `text-md` gives you the old 14 pixels; for any other size that must
stay as it was, set the value as a literal (`text-[18px]`). Do not override `--text-sm`, `--text-lg` or
`--text-2xl` to restore Tailwind's sizes: the kit's components rely on them too.

Not every component takes its size from the scale. Some set it as a literal (`text-[13px]`,
`text-[11px]`), and overriding `--text-*` does not change such a size. The kit's new components use the
steps.

## Motion

### Scale: four steps and three curves

Duration and curve come from the scale and are not invented. Both scales are closed:
a fifth step is an ADR discussion, not a line in `styles.css`
(ADR-0047).

| Step                  | Value | When                             |
| --------------------- | ----- | -------------------------------- |
| `--duration-fast`     | 100ms | hover, press, chevron, checkbox  |
| `--duration-base`     | 150ms | tooltip, anchored panel, menu    |
| `--duration-moderate` | 250ms | dialog, drawer, scrim, expansion |
| `--duration-slow`     | 400ms | large movement across the screen |

| Curve             | Value                        | When                         |
| ----------------- | ---------------------------- | ---------------------------- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | movement within the screen   |
| `--ease-enter`    | `cubic-bezier(0, 0, 0.2, 1)` | enter: decelerate into place |
| `--ease-exit`     | `cubic-bezier(0.4, 0, 1, 1)` | exit: accelerate away        |

Names describe the role, not the value: `duration-fast`, not `duration-100`. A step
is written as a class — `duration-moderate`, `ease-enter`; Tailwind creates the curves from the
theme itself, and the steps are declared in `styles.css` through `@utility`.

**Name a duration only where it differs from the default.**
Tailwind's default transition is switched to the scale:

```css
--default-transition-duration: var(--duration-base);
--default-transition-timing-function: var(--ease-standard);
```

So `transition-colors` without a duration class already runs 150ms on the
`standard` curve, and `transition-colors duration-base` has a redundant word. This is also the
pace lever for the consumer: by overriding a step in your app, you shift all the kit's
transitions that do not name a duration explicitly.

```css
:root {
  --duration-base: 120ms; /* dense admin UI: the whole kit becomes snappier */
}
```

The live scale is in the showcase, the `Foundations/Motion` section.

### Animations

The kit's animations are declared as `--animate-*` tokens in the same `@theme` as the colors.
The token is the only place where an animation has a duration and a curve; components
do not have them. The tables below list the tokens that the kit's components read.

| Token                              | Who reads it                        |
| ---------------------------------- | ----------------------------------- |
| `--animate-fadein`                 | dialog scrims, menu list, `Select`  |
| `--animate-sheetin`                | `Dialog`, `ModalOverlay`            |
| `--animate-popoverIn`              | `Popover`                           |
| `--animate-tooltipIn`              | `Tooltip`                           |
| `--animate-shimmer`                | `.skeleton`                         |
| `--animate-progress-indeterminate` | `Progress` when it is indeterminate |
| `--animate-spin`                   | `Spinner`                           |

**Overlay exits have their own tokens, shorter than the entrance.** The `-in` / `-out` pair is readable
at a glance, and the exit step is one lower: closing should not feel
slower than opening.

| Token                  | Who reads it                        | Step           |
| ---------------------- | ----------------------------------- | -------------- |
| `--animate-fadeout`    | dialog scrims, menus, `ContextMenu` | `base` → 150ms |
| `--animate-rowout`     | `EditableList` row exit             | `base` → 150ms |
| `--animate-sheetout`   | `Dialog`                            | 150ms          |
| `--animate-tooltipOut` | `Tooltip`                           | 100ms          |
| `--animate-popoverOut` | `Popover`                           | 100ms          |

An exit is set by **a token, not by `opacity-0`**: a transition to zero without a duration
is not an exit but the same instant disappearance written longer, and the `reduce` gate
does not see such a declaration.

The `-in` / `-out` pairing is a convention, not a gate rule: `imgFadeIn` has no exit
and should not, and `shimmer`, `spin` and `pulse` are loops, not transitions.

**`ModalOverlay` has no exit.** It has no `open` prop: the consumer mounts the scrim
conditionally, and by the time it closes the node is no longer in the tree. The details are in
the component's own file.

**Under `prefers-reduced-motion: reduce` the kit turns off its own motion automatically.** The tokens
are overridden in one block at the end of `styles.css`: moving keyframes
are replaced with `fadeOnly` — the same duration and curve, but opacity only.
The movement is removed, but the element still appears: `animation: none` would cause a jolt
instead of calm.

Two tokens are not turned off — `--animate-progress-indeterminate` and `--animate-spin`.
Both say "work is in progress", and when stopped they read as broken, not as
still. Details — ADR-0043.

Color transitions (`transition-colors`, `transition-shadow`, `transition-opacity`)
are not turned off: the rule is about movement, and a color change moves nothing.
Moving transitions — the rotation of chevrons in `Accordion`, `Table` and `TreeView` —
are turned off individually, where they are used, with the `motion-reduce:` variant: they are backed by hard-coded
Tailwind values, not a kit variable.

**The boundary with the app.** The kit turns off only the kit's tokens and classes.
There is no global reset like `*, ::before, ::after { animation-duration: 0.01ms
!important }` in the package and there will not be: it would turn off the animations of the app and of third-party
libraries on the same page, and there would be no way to undo it. You turn off your app's animations yourself, with
the same technique:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --my-slide-in: none;
  }
}
```

A custom `--animate-*` token that you create on top of the kit must get a pair in the `reduce`
block; otherwise `tests/motion.test.ts` fails the kit's build, but not yours, and enforcing this
in your app is up to you.

## Themes and accents

Two independent axes on `<html>`:

```html
<html data-theme="light" data-accent="violet"></html>
```

`data-theme` is `dark` (the default, the attribute can be omitted), `light`, `dim`.
`data-accent` is `blue` (the default), `violet`.

The axes are independent except in exactly one place: `--accent-strong` is read
**on** a background, and the light theme needs a dark accent instead of a light one. That is why the
file has the paired block `:root[data-theme="light"][data-accent="violet"]` — it is more
specific and comes after both.

## How to add a brand

A brand is **one block of CSS**. No component is edited; if
you had to edit a component, something is being expected of the brand that the token layer does not
express, and that is a separate conversation.

The order is exactly this, checked on `teal`, which ships in the package as a sample:

**1. Declare the brand's primitives inside the brand's block.** Do not override the kit's
`--od-*`.

```css
:root[data-brand="acme"] {
  --od-acme-1: #7a2e0e;
  --od-acme-2: #9a3412;
  --od-acme-3: #f97316;
  --od-acme-4: #fdba74;
  --od-acme-3-a16: rgba(249, 115, 22, 0.16);
  --od-acme-3-a20: rgba(249, 115, 22, 0.2);
  --od-acme-3-a35: rgba(249, 115, 22, 0.35);
  --od-acme-2-a30: rgba(154, 52, 18, 0.3);

  /* 2. Assign them to roles. */
  --accent: var(--od-acme-2);
  --accent-hover: var(--od-acme-1);
  --accent-soft: var(--od-acme-3-a16);
  --accent-strong: var(--od-acme-4);
  --focus-ring: var(--od-acme-3-a20);
  /* Focus outline on the inverse pill: a dark step — the pill is light in the dark themes. */
  --accent-on-inverse: var(--od-acme-1);
  /* Text selection: a light step for a dark background and a variant for a light one.
     `--selection-dark` is also taken by the Editor's HTML field, dark in any theme. */
  --selection-dark: var(--od-acme-3-a35);
  --selection: var(--selection-dark);
  --selection-light: var(--od-acme-2-a30);
}
```

**3. Check the light theme separately.** `--accent-strong` is read on a background,
and the light theme almost certainly needs its own step; `--accent-on-inverse` is
the opposite, light: the Bubble menu pill is dark in the light theme. `--selection`
returns to the light variant only here: the brand block comes after the light theme
in the file and would override it with the dark one.

```css
:root[data-theme="light"][data-brand="acme"] {
  --accent-strong: var(--od-acme-1);
  --accent-on-inverse: var(--od-acme-4);
  --selection: var(--selection-light);
}
```

**4. Put the blocks at the end of the file — after the accent blocks.** This is not a matter of style: the rule
has a real effect: `:root[data-brand]` and `:root[data-accent]` have the same
specificity (0,2,0), and with equal specificity the later one wins.
A brand that is set must override the accent axis entirely, not mix with it.
The paired block with a theme takes two attributes (0,3,0) and comes after the paired theme block
with an accent — for the same reason.

**5. Add the brand to `BRANDS` in `scripts/contrast.mjs` and run `npm run contrast`.**
The script **fails** if a brand is declared in CSS and is not on the list: the gate must
either measure the brand or say it cannot. A brand that does not pass
contrast is a brand that does not exist.

That is how `teal` came about: the first pick gave a contrast of 4.26 where 4.5 is required on
`--accent-soft` over `surface-panel-hover` in the light theme, and the gate showed it.
The example was not tuned after the fact — it went through the same check you are about to.

**6. Turn the brand on at the `<html>` element:**

```html
<html data-theme="light" data-brand="acme"></html>
```

The order and structure of the blocks are enforced by the test
[`tests/token-layers.test.ts`](../tests/token-layers.test.ts): it fails if a
brand block moved above the accent, if a brand overrides a kit primitive, or
sets a role that is not in the base.

## Theme switcher

**The kit has no switcher component and will not have one** — this is a decision, not a gap
(ADR-0020). `Segmented` already
provides the needed form, while a button is tied to the storage and layout of a specific
app. The kit provides what really repeats: the axis lists,
theme normalization, a function that applies a theme and the early-apply script — see
[api/utilities.md](api/utilities.md).

Theme labels are **app strings**, not the kit's catalog: the kit does not translate what
it does not render.

### Shared part

```tsx
import { applyTheme, normalizeTheme, UI_THEMES, type UiTheme } from "@olddevs/ui";
import { ThemeAutoIcon, ThemeDarkIcon, ThemeLightIcon } from "@olddevs/ui/icons";

/**
 * There are two names because in Russian they take different grammatical cases:
 * "Theme: dark" is nominative ("тёмная"), "Switch to dark" is accusative ("тёмную").
 * The English values coincide, but one string for both places breaks in a language
 * with case, and a screen reader reads it aloud wrong.
 */
const THEMES = {
  dark: { name: "dark", target: "dark", icon: <ThemeDarkIcon /> },
  light: { name: "light", target: "light", icon: <ThemeLightIcon /> },
  dim: { name: "dim", target: "dim", icon: <ThemeAutoIcon /> },
} satisfies Record<UiTheme, { name: string; target: string; icon: React.ReactNode }>;

const STORAGE_KEY = "ui-prefs";

function useTheme() {
  const [theme, setTheme] = useState<UiTheme>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      return normalizeTheme(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}").theme);
    } catch {
      return "dark";
    }
  });

  const change = (next: UiTheme) => {
    setTheme(next);
    applyTheme(document.documentElement, { theme: next });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: next }));
  };

  return [theme, change] as const;
}
```

The storage format is the same one `themeInitScript` reads — include it, or the
user will see a flash of the wrong theme before hydration.

### Form 1 — explicit choice

Three segments in a row. Use it where there is room: settings, a profile panel.

```tsx
import { Segmented } from "@olddevs/ui";

function ThemePicker() {
  const [theme, setTheme] = useTheme();
  return (
    <Segmented
      value={theme}
      onChange={setTheme}
      options={UI_THEMES.map((value) => ({
        value,
        label: "",
        icon: THEMES[value].icon,
        tooltip: `Theme: ${THEMES[value].name}`,
      }))}
    />
  );
}
```

`label: ""` next to an icon is the standard way to say "icon only"; the segment takes its accessible
name from `tooltip`, and without it the audit fails the run.

### Form 2 — cycling with one button

One button that cycles through the themes. Use it in a header where there is no room.

```tsx
import { Button, Tooltip } from "@olddevs/ui";

function ThemeCycleButton() {
  const [theme, setTheme] = useTheme();
  const next = UI_THEMES[(UI_THEMES.indexOf(theme) + 1) % UI_THEMES.length]!;
  const label = `Theme: ${THEMES[theme].name}. Switch to ${THEMES[next].target}`;

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        iconOnly
        icon={THEMES[theme].icon}
        aria-label={label}
        onClick={() => setTheme(next)}
      />
    </Tooltip>
  );
}
```

**The label must name both the current state and the next step** — and this is not a
matter of style. Without the current one, a screen reader announces the button with no state: exactly the
defect the switcher in the source app had before it was
rewritten. Without the next step in the label, users cannot guess it, because in a cycle of **three**
states it cannot be derived from the icon — with two it could, and naming just one of the two
would be enough.

The same text goes into the tooltip: a sighted user faces the same task
as a screen reader user.

## What not to do

- **Override the kit's primitives.** See layer 1.
- **Color a component without going through a token.** A literal color in markup survives neither a
  theme change nor a brand, and does not reach the contrast gate.
- **Add a custom token "for the future".** Layer 3 is closed on purpose.
- **Put the brand block above the accent.** It will work every other time — where the
  accent is not set.
- **Compute `*-soft` with `color-mix`.** The contrast gate will stop seeing them.
- **Define an animation as a literal instead of through `var(--animate-*)`.** A rule that does not read
  `var(--animate-*)` does not obey the `prefers-reduced-motion` block — it simply
  keeps running.

## What's next

- [Setting up the package](getting-started.md) — `@import` and `@source` on the consumer side.
- [Conventions](conventions.md) — the prop vocabulary and the boundaries of the public API.

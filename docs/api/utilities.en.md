---
category: api
status: stable
source: src/index.ts
sourceHash: 255c163bdc7a
---

# Shared API: utilities, tokens, constants and types

## Summary for AI

`@olddevs/ui` exports several programmatic APIs besides components. They are meant for integration with the
components and the shared visual vocabulary. Do not import the internal `src/lib/*` files directly. All public
component exports and their prop types are documented on the pages of the components themselves. The
`@olddevs/ui/icons` export is documented in [icons.md](../icons.md).

## When to use

- `cn`: to merge Tailwind classes, especially when `text-caption` and a text color from the kit's scale appear
  together.
- `useScrollLock`: for your own controlled overlay composition, when it owns the open state and must lock the
  `body` scroll.
- `useMediaQuery`: when the window width decides what is rendered or how it behaves (what to mount, how many
  months to show, whether to collapse `SplitPanel`), not only the look. To show or hide a block by width, use
  a Tailwind class. Details are in [SplitPanel](../components/app-shell/split-panel.md).
- `Size`, `Tone`, `Variant`, `TONE_TOKENS` and `variantClasses`: when you create a new design-system primitive
  with the same semantic axes.
- Period helpers: for a relative period in the URL and its conversion to dates. Time helpers: for `HH:MM` input
  in date and time controls.
- The theme registry: for a theme switcher and for applying the saved theme early. Take the axis lists from
  there. Do not rewrite them as constants in your own code.

## When not to use

- Do not create a second `body` scroll-lock counter in the app. Unrelated counters break nested overlays. Use
  the one `useScrollLock` from the package.
- Do not build Tailwind classes dynamically, for example `text-${tone}`. Use literal tokens or
  `variantClasses`. Class names built at runtime do not make it into the CSS build.
- Do not pass an invalid string from the URL straight to `resolvePeriod`. First narrow it with
  `isRelativePeriod`.
- Do not use `maskTime` as the final validation. The mask works during input, and normalization works after it.

## Shared variants

The source of the shared exports is `src/index.ts`. Their implementations are in `src/lib/cn.ts`,
`src/hooks/useScrollLock.ts`, `src/hooks/useMediaQuery.ts`, `src/lib/variants.ts`, `src/lib/period.ts` and
`src/lib/time.ts`.

| Export                               | Purpose                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cn(...inputs)`                      | `clsx` plus a configured Tailwind merge. The last conflicting class wins, and `text-caption` does not conflict with `text-fg-*`.                                           |
| `useScrollLock(isLocked)`            | Locks the scroll of `body`, compensates for the scrollbar width and counts nested locks at the module level. Releases the lock on unmount.                                 |
| `useMediaQuery(query, serverValue?)` | Returns whether the media query matches now, and re-renders the component when it changes. Before hydration, and without `matchMedia`, it returns `serverValue` (`false`). |
| `Size`                               | The shared scale `sm \| md \| lg`. A specific component may support a subset of it.                                                                                        |
| `Tone`                               | The semantic color `neutral \| accent \| success \| warning \| danger`, not a shade name.                                                                                  |
| `Variant`                            | The visual treatment `solid \| soft \| outline \| ghost`.                                                                                                                  |
| `Numeric`                            | The digit style: `tabular` gives digits of equal width. An axis of the `Text` and `Heading` components, not a separate utility.                                            |
| `ToneAtoms`                          | The type of a set of ready Tailwind classes for one `Tone`.                                                                                                                |
| `TONE_TOKENS`                        | The map `Tone → ToneAtoms`. Use it instead of copying token strings.                                                                                                       |
| `variantClasses(variant, tone)`      | Ready classes for a variant and tone pair, for your own primitive.                                                                                                         |
| `INVALID_BORDER_CLASS`               | The ready class for the border of an invalid field.                                                                                                                        |

## Periods

| Export                                     | Purpose and limits                                                                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RELATIVE_PERIODS`, `RelativePeriod`       | The allowed relative values: `7d`, `30d`, `90d`, `180d`, `365d`, `thisMonth`, `lastMonth`, `thisYear`.                                                                                                    |
| `isRelativePeriod(value)`                  | A runtime type guard for an external string, including one from the URL.                                                                                                                                  |
| `resolvePeriod(period, timeZone?, now?)`   | Returns the inclusive ISO bounds of a `DateRange`. Uses the local time zone by default. `now` is needed mainly for deterministic tests.                                                                   |
| `DateRange`                                | A pair `{ start, end }` in ISO `YYYY-MM-DD`. Both bounds are inclusive.                                                                                                                                   |
| `periodLength(range)`                      | The number of days, inclusive, computed in UTC. A range that was reversed by hand gives at least one day. An unparseable bound gives `0`, which means "nothing to count".                                 |
| `formatPeriodLength(range, messages?)`     | The label for the period length, from the message catalog: `14 дней` or `14 days`. Without `messages`, the English fallback is used. With an unparseable bound, it returns an empty string, not `0 дней`. |
| `PeriodPreset`, `periodPresets(messages?)` | A type and a function that builds a short set of standard presets for the UI, with labels from the message catalog. Without `messages`, the labels are in English.                                        |
| `DEFAULT_PERIOD_PRESETS`                   | `@deprecated` since 2.0.0: an immutable set of presets with English labels. It does not know the locale. Use `periodPresets(messages)`. It is removed in the next major version.                          |

```ts
const rawPeriod = searchParams.get("period");
const period = rawPeriod && isRelativePeriod(rawPeriod) ? rawPeriod : "30d";
const range = resolvePeriod(period, "Europe/Moscow");
```

## Time

| Export                            | Purpose                                                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maskTime(value)`                 | Keeps up to four digits and adds `:` after the first two: `2130 → 21:30`. Apply it on every input.                                                                    |
| `normalizeTime(value, fallback?)` | Takes partial input and returns an `HH:MM` value within valid bounds. Empty input returns `fallback`, which defaults to `00:00`. Apply it when the input is complete. |
| `formatDate(isoDate, locale?)`    | Formats an ISO day from `DatePicker` for display. Documented together with [DatePicker](../components/date-time/date-picker.md).                                      |
| `upcomingSlots(step, now)`        | Builds the nearest time slots. Documented together with [TimePicker](../components/date-time/time-picker.md).                                                         |

## Input masks

These are pure functions of the mask engine. They are exported apart from the component, because you may need
to prepare a value before you send it, or check whether it is filled in, without a field on the screen.

| Export                  | Purpose                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `formatMask(raw, mask)` | Lays out a raw value over the mask. The tail of the mask is not shown in advance.    |
| `unmask(display, mask)` | Gets the raw value by position. A literal digit from the mask does not leak into it. |
| `maskCapacity(mask)`    | How many value characters the mask holds: `+7 (999) 999-99-99` → 10.                 |

Mask tokens: `9` is a digit, `a` is a letter, `*` is a digit or a letter. Anything else is a literal. There is
no escaping. Details are in [MaskedInput](../components/inputs/masked-input.md).

## Themes

The registry of theme axes and the contract for applying them. The kit has **no** theme switcher component.
`Segmented` already gives the right shape, and a button depends on the storage and the markup of a specific
app. The reasoning is in ADR-0020. The ready code for two variants of a switcher is in
[the recipe in theming.md](../theming.md#переключатель-темы).

| Export                                                | Purpose                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `UI_THEMES`, `UI_ACCENTS`, `UI_BRANDS`                | The three theme axes as lists. A test checks them against `styles.css`, so they cannot drift apart silently.                   |
| `normalizeTheme`, `normalizeAccent`, `normalizeBrand` | Turn any value into a valid one. They accept `unknown`. A typical source is storage.                                           |
| `applyTheme(root, prefs)`                             | Sets all three axes on the element. If an axis is not passed, it returns to its default instead of keeping the previous value. |
| `themeInitScript({ storageKey })`                     | A **string** of JS for applying the theme early, before the first render.                                                      |
| `DEFAULT_THEME_PREFS`                                 | The state in which no overlay is set: `dark` / `blue` / `base`.                                                                |

`base` **removes** `data-brand` instead of writing `data-brand="base"`. There is no CSS block with that name,
and a leftover attribute would look like a working overlay.

### Applying the theme early

Without early theme application, the user sees a flash of the wrong theme between the first render and
hydration. The kit returns a **string** and does not run code. The consumer's framework knows where to insert
it, not the design system.

```jsx
import Script from "next/script";
import { themeInitScript } from "@olddevs/ui";

<Script
  id="theme-init"
  strategy="beforeInteractive"
  dangerouslySetInnerHTML={{ __html: themeInitScript({ storageKey: "ui-prefs" }) }}
/>;
```

The storage format is a JSON object `{ theme, accent, brand }` under this key. The consumer writes it
(`applyTheme` does not save anything), and the script reads it. Any field can be missing or hold a wrong value.
Normalization still runs, and broken JSON does not break the page.

## Table state

`useTableState` describes the shape of the `DataTable` state and the links between its parts. The hook **stores
nothing outside React** and subscribes to nothing. The kit provides the shape, and the consumer owns it
(ADR-0023).

| Export          | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `useTableState` | `{ state, set, reset }`. One update function instead of ten handlers. See below. |
| `TableState`    | Sorting, the page and its size, selection, expansion, filters, columns, density. |
| `TableFilter`   | An applied filter: `id`, `field`, `value`, and optional `label` and `to`.        |

### Invariants the hook exists to keep

- changing **filters, sorting or the page size resets the page** to the first one. Otherwise the user looks at
  page four while the filtered rows number ten, and reads the empty space as "nothing found";
- **selection is not reset.** The reverse looks tidier, but it breaks a bulk action exactly when that action is
  needed most;
- density and column visibility do **not** touch the page. A filter narrows the filtered rows, not the look;
- an explicit `page` in the same call cancels the reset. This is how the state is restored from the address,
  in full and in one go.

The update goes through one function because the invariants must hold no matter what changed. Split into
separate handlers, they would drift apart.

### Moving to the URL

| Export                 | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `tableStateToParams`   | State to `URLSearchParams`. Defaults are not written.                      |
| `tableStateFromParams` | `URLSearchParams` to part of the state. Junk input does not break parsing. |
| `DEFAULT_TABLE_STATE`  | Defaults, except density: the provider sets it.                            |

The functions are **pure and have no `"use client"`**. URL parsing is needed on the server too, because in
Next.js the state is restored from `searchParams` before rendering. Applying them to the URL is the app's job.
Routers differ in how they write parameters (`replace` or `push`, array encoding, `basePath`). A kit that tried
to guess them would get it wrong silently.

```tsx
const { state, set } = useTableState(tableStateFromParams(searchParams));

// after a change, write it back the way your router supports
router.replace(`?${tableStateToParams(state)}`);
```

**Selection and expansion are not kept in the URL**, although the original spec included selection in the table
state. There are two reasons. The list of keys has no length limit. And a link with a selection, opened the next
day, marks records that no longer exist. Selection is session state, not URL state.

The restored state is passed to the hook as a whole, in one `set` call. The invariant "narrowing the filtered rows
resets the page" is cancelled by an explicit page in the same call. Otherwise a link would always open the first
page.

### A filter token has its own `id`

A filter has its own `id`, not a pair of "field + value" and not a label. Two filters on one field give tokens
that look the same, and you cannot tell which of the two to remove. A label, however, is localized and truncated.

The model has no operators on purpose. Without `to`, the token means equality. With `to`, it means the range
`value…to`, where either bound may be an empty string ("from 50", "up to 100"). The presence of the `to` key
carries the difference, so check it with `!== undefined` (ADR-0063). `contains` and `in` can be added when they
are needed. In the URL, `to` is the fifth part of the token. Links with three and four parts are read as before.
For how to build a range in the UI, see [FilterBar](../components/table/filter-bar.md).

## Constants, classes and public types: where they are documented

These are public exports, but not standalone components. The page of the compound component they belong to describes them,
so that AI does not treat a class as a general-purpose API:

| Exports                                                                                                                                       | Documentation                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `MENU_PANEL_CLASS`, `MENU_ITEM_CLASS`, `MENU_ITEM_ICON_CLASS`, `MENU_ITEM_SHORTCUT_CLASS`, `MENU_SECTION_LABEL_CLASS`, `MENU_SEPARATOR_CLASS` | [Menu](../components/overlays/menu.md)                        |
| `NAV_BUTTON_CLASS`, `WEEKDAY_CELL_CLASS`                                                                                                      | [Calendar](../components/date-time/calendar.md)               |
| `pageRange`                                                                                                                                   | [Pagination](../components/navigation/pagination.md)          |
| `maskTime`, `normalizeTime`                                                                                                                   | [DateTimePicker](../components/date-time/date-time-picker.md) |
| `formatDate`                                                                                                                                  | [DatePicker](../components/date-time/date-picker.md)          |
| `upcomingSlots`                                                                                                                               | [TimePicker](../components/date-time/time-picker.md)          |

Each `*Props` type and each component-specific type exported with a component (for example `TableProps`,
`CommandItem`, `SelectItem`, `KeyboardSelection` or `DrawerSide`) stays part of that component's public API. It
is described on the page of its compound component. The [component catalog](../components/index.md) links the public exports
to the compound component pages. `src/index.ts` is the final source for all exports.

## Related sources and checks

- Public surface: `src/index.ts`.
- Implementations: `src/lib/cn.ts`, `src/hooks/useScrollLock.ts`, `src/hooks/useMediaQuery.ts`,
  `src/lib/variants.ts`, `src/lib/period.ts`, `src/lib/time.ts`, `src/lib/themes.ts`, `src/lib/table-state.ts`,
  `src/hooks/useTableState.ts`.
- `maskTime` and `normalizeTime` are also used in `src/components/date-time/DateTimePicker.tsx`.

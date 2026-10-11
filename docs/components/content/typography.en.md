---
component: Typography
exports: [Text, Heading, Link]
category: content
status: stable
source: src/components/content/Text.tsx, src/components/content/Heading.tsx, src/components/content/Link.tsx
story: src/components/content/Text.stories.tsx, src/components/content/Heading.stories.tsx, src/components/content/Link.stories.tsx
sourceHash: 16bb83df1a1d
---

# Typography: `Text`, `Heading`, `Link`

## Summary for AI

Use `Heading` for document structure, `Text` for paragraphs and auxiliary
lines, `Link` for navigation. Do not replace them with a `div` and hand-written
Tailwind classes: these components already carry semantics, the visual scale and
accessibility.

## When to use

- `Heading` — when the text starts a logical section. Always set `level`; it is
  the level in the outline, not a way to pick a size.
- `Text` — for text that is not a heading: a paragraph, caption, description,
  or a secondary or auxiliary message.
- `Link` — for navigating to a URL or a route. For an action without
  navigation, use `Button`.
- `numeric="tabular"` on `Text` and `Heading` — when a number changes in place
  or sits in a column: a timer, counter, countdown, summary. With proportional
  digits, a line with the same number of characters changes width and makes its
  neighbors on the same row jump.

## When not to use

- Do not choose `Heading` just for a large font: keep the right level and pass
  `size` if needed.
- Do not use `Text level` as a heading level: on `Text` it only sets how muted
  the color is. For a heading, use `Heading`.
- Do not use `Link` to mutate data, open a dialog or submit a form; that is a
  button action.
- Do not use `Link external` instead of `target="_blank"`: the first adds an
  icon but does not change how the link opens.
- Do not set `numeric="tabular"` on all text: equal-width digits are wider
  than proportional ones and read worse in an ordinary paragraph. The `numeric` prop is
  for places where digits are compared with each other or change in place.
- Do not use `numeric` instead of `font-mono` when you need a monospaced font
  (code, a hash): the prop only changes the digit width; the typeface stays
  unchanged.

`font-mono` is the system monospace stack (`ui-monospace`, SF Mono, Menlo,
Consolas, Liberation Mono): the kit does not load its own font files. The
consumer sets a custom code font with the `--font-code` variable — the same
way as `--font-inter` for the main one (for example, `variable: "--font-code"`
in `next/font`).

## Minimal examples

```tsx
import { Heading, Link, Text } from "@olddevs/ui";

<Heading level={2}>Schedule</Heading>
<Text level={2}>Choose a publication time.</Text>
<Text as="span" size="sm" tone="danger">Save failed</Text>
<Link href="/campaigns">Back to campaigns</Link>
<Text as="span" numeric="tabular">12:00</Text>
```

```tsx
<Link external href="https://example.com" target="_blank">
  External documentation
</Link>
```

## Public API

### `Text`

| Prop       | Purpose and constraints                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| `size`     | Step `caption`, `xs`, `sm`, `md` (default) or `lg`. This is size, not semantics.                            |
| `level`    | Muting `1`–`3`; `1` by default. Applies only with `tone="neutral"`.                                         |
| `tone`     | Semantic color; with a non-neutral tone it replaces the color from `level` instead of mixing with it.       |
| `weight`   | `regular` (default), `medium` or `bold`.                                                                    |
| `numeric`  | `tabular` — equal-width digits. No default: ordinary text keeps proportional digits.                        |
| `truncate` | `true` — one line with an ellipsis; a positive number — that many lines. `0` is safely treated as one line. |
| `as`       | `p` (default), `span` or `div`; changes only the HTML tag, not the look.                                    |

### `Heading`

| Prop      | Purpose and constraints                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `level`   | Required logical level `1`–`4`; by default renders the matching `h1`…`h4`. Do not skip levels in the page structure.       |
| `size`    | Font size `md`, `lg`, `xl`, `2xl`, independent of the level. If not set, it comes from `level`.                            |
| `as`      | An explicit tag `h1`…`h6` when the place in the markup needs a different tag; the level itself and its size do not change. |
| `numeric` | `tabular` — equal-width digits, the same axis as on `Text`: for a large summary number that is recalculated in place.      |

### `Link`

| Prop              | Purpose and constraints                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `variant`         | `inline` (default, always underlined), `standalone` or `quiet`. Use `inline` inside text; `quiet` — for secondary navigation.                                                                                                                                                                                                                 |
| `tone`            | Semantic tone; `accent` by default. On `quiet` the tone shows on hover.                                                                                                                                                                                                                                                                       |
| `external`        | Adds an external-link icon hidden from screen readers; does not set `target`.                                                                                                                                                                                                                                                                 |
| `as`              | A tag or a router component, for example `next/link`. Props keep the type of the chosen component.                                                                                                                                                                                                                                            |
| `target="_blank"` | The component adds `rel="noopener noreferrer"` if no `rel` is passed, and a hidden note about the new tab.                                                                                                                                                                                                                                    |
| `href`            | Executable schemes are dropped: the link is rendered without an `href`. These are `javascript:`, `vbscript:` and executable `data:` types (`text/html`, `application/xhtml+xml`, `image/svg+xml`). Everything else passes as is — including the app's own schemes (`slack://`) and non-executable `data:` (an image, a CSV under `download`). |

## Accessibility and semantics

- `Heading level` builds the accessible outline. The visual size must not force
  you to change the semantic level.
- The `Link inline` variant is always underlined: color is not the only cue that
  text inside a paragraph is a link.
- On `Link target="_blank"`, the accessible name is extended with a note about
  the new tab. The component keeps a `rel` you pass.
- Do not substitute `VisuallyHidden` for visible text: hidden text supplements an
  element that is already clear, but does not make up for a missing clear
  label.

## Anti-patterns

```tsx
// Bad: h4 chosen for a small font size after an h2.
<Heading level={4}>Filters</Heading>

// Good: the structure stays h3, the size is separate.
<Heading level={3} size="md">Filters</Heading>

// Bad: a utility put on a semantic element, bypassing the scale.
<Text as="span">
  <time dateTime={`PT${seconds}S`} className="tabular-nums">{formatDuration(seconds)}</time>
</Text>

// Good: the axis is on the component, `time` stays clean — the property is inherited.
<Text as="span" numeric="tabular">
  <time dateTime={`PT${seconds}S`}>{formatDuration(seconds)}</time>
</Text>

// Bad: a link runs an action.
<Link onClick={deleteCampaign}>Delete</Link>

// Good: an action is a button.
<Button tone="danger" onPress={deleteCampaign}>Delete</Button>
```

## Related sources and Storybook

- Sources: `src/components/content/Text.tsx`, `src/components/content/Heading.tsx`,
  `src/components/content/Link.tsx`.
- Stories: `src/components/content/Text.stories.tsx`, `src/components/content/Heading.stories.tsx`,
  `src/components/content/Link.stories.tsx`.
- Contracts are tested in `tests/typography.test.tsx` and `tests/link.test.tsx`.

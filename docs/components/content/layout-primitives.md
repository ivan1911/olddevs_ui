---
component: LayoutPrimitives
exports: [Separator, ScrollArea, AspectRatio, Kbd]
category: content
status: stable
source: src/components/content/Separator.tsx, src/components/content/ScrollArea.tsx, src/components/content/AspectRatio.tsx, src/components/content/Kbd.tsx
story: src/components/content/Separator.stories.tsx, src/components/content/ScrollArea.stories.tsx, src/components/content/AspectRatio.stories.tsx, src/components/content/Kbd.stories.tsx
---

# Layout primitives: `Separator`, `ScrollArea`, `AspectRatio`, `Kbd`

## Summary for AI

These are low-level building blocks, not a full layout system. A grid of equal
columns comes from [`Grid`](grid.md); the package still does not export `Stack`
and `Inline` — the screen's context sets a stack or a row with a gap. Use the
primitives here only for a semantic boundary, scrolling, a fixed aspect ratio
and key labels.

## When to use

- `Separator` — for a semantic boundary between groups; horizontal or vertical.
- `ScrollArea` — for a self-contained fragment with native scrolling,
  for example a list of filters.
- `AspectRatio` — for a preview container with a ratio such as `16 / 9`, `1` or
  `9 / 16`.
- `Kbd` — for a text label for a key or key combination that the user presses.

## When not to use

- Do not place a `Separator` just for decoration: it announces the `separator`
  role, and a screen reader reports a boundary between groups. For decoration,
  hide the line from the accessibility tree.
- Do not give `ScrollArea` a region role without a name: pass `label` only to a
  self-contained section that needs a name.
- Do not pass `AspectRatio ratio="16:9"`: the API takes the number `16 / 9`.
- Do not render a shortcut as a plain `span`; the semantic `Kbd` exists for it.
- The overview of all the shortcuts on a screen is not a scattering of `Kbd` elements in
  arbitrary markup, but `ShortcutsHelp` ([page](../overlays/shortcuts-help.md)).

## Minimal example

```tsx
import { AspectRatio, Kbd, ScrollArea, Separator } from "@olddevs/ui";

<ScrollArea label="Sections" className="h-48">
  <SectionList />
</ScrollArea>
<Separator spacing="md" />
<AspectRatio ratio={16 / 9}><DocumentPreview /></AspectRatio>
<span>Open search <Kbd>⌘</Kbd><Kbd>K</Kbd></span>
```

## Public API

### `Separator`

| Prop          | Default      | Meaning                                                                                                     |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `orientation` | `horizontal` | A horizontal or vertical line. Inside a `Toolbar` without its own value, it runs across the toolbar's axis. |
| `spacing`     | `none`       | Outer margins `none`, `sm`, `md`; if the parent layout sets the distance, leave `none`.                     |

### `ScrollArea`

| Prop             | Default    | Meaning                                                                                                                        |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `orientation`    | `vertical` | `vertical` turns on vertical native scrolling, `horizontal` turns on horizontal.                                               |
| `label`          | —          | The accessible name of a self-contained area. When present, the component sets `role="region"`.                                |
| `div` attributes | —          | In particular, limit the height or width through `className`; the component does not make an area scrollable without overflow. |

### `AspectRatio`

| Prop    | Default  | Meaning                                                                          |
| ------- | -------- | -------------------------------------------------------------------------------- |
| `ratio` | `16 / 9` | A numeric CSS `aspect-ratio`; compute the fraction with a JavaScript expression. |

### `Kbd`

| Prop   | Default | Meaning                                                                 |
| ------ | ------- | ----------------------------------------------------------------------- |
| `size` | `sm`    | `sm` — inside a menu, `md` — in a standalone keyboard shortcuts dialog. |

`Kbd` renders the Apple modifier symbols (`⌘ ⌥ ⇧ ⌃`) in a string label in a
proportional font and everything else in a monospace one. The kit's monospace
stack has no `⇧` symbol: the fallback glyph came out thin next to `⌘` and the
letter. The label text does not change because of this; a label passed as markup
rather than a string stays as it is. The shortcut on `Menu` and `ContextMenu`
items renders these symbols the same way.

## Accessibility

- `Separator` uses the semantic react-aria separator; the vertical version gets
  `aria-orientation="vertical"`.
- `ScrollArea` is always keyboard-accessible (`tabIndex=0`); otherwise
  scrollable content cannot be reached without a mouse.
- `Kbd` renders the HTML `kbd` tag, so it marks user input, not just monospace
  text.

## Related sources and Storybook

- Sources: `src/components/content/Separator.tsx`, `src/components/content/ScrollArea.tsx`,
  `src/components/content/AspectRatio.tsx`, `src/components/content/Kbd.tsx`.
- Stories: `src/components/content/Separator.stories.tsx`, `src/components/content/ScrollArea.stories.tsx`, `src/components/content/AspectRatio.stories.tsx`, `src/components/content/Kbd.stories.tsx`.
- The scrolling semantics and focus are tested in `tests/wave7-layout.test.tsx`.

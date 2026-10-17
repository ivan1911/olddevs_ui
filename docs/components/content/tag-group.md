---
component: TagGroup
exports: [TagGroup, Tag, TagGroupProps, TagProps, TagKey]
category: content
status: stable
source: src/components/content/TagGroup.tsx
story: src/components/content/TagGroup.stories.tsx
---

# TagGroup and Tag

## Summary for AI

A set of tags **for display**: post categories, projects, labels. A tag can be
given a palette hue (`hue` — a dot next to the label), turned into a link (`href`)
and made removable through a single handler (`onRemove`). It is built on `TagGroup` from
`react-aria-components`: arrow keys between tags, Delete and Backspace, and focus
after removal all come from it. There is no selection.

## When to use

- To show the categories, projects or labels of a post next to its content.
- A tag is a link to the list of posts in that category.
- An edit form where the user removes tags and another element adds them.
- A hue from the tag palette (`LABEL_HUES`) is needed next to the label.

## When not to use

- The tag is chosen or toggled, like a filter — that is `Chip` or `Segmented`.
  `selectionMode` is intentionally not passed through on `TagGroup`.
- The tag expresses the state of an object (active, error, draft) — that is
  `StatusBadge` or `Badge`: with a tag the meaning is supplied by a person, with a
  status by the system.
- The user types new tags as text — that is `TagInput`. They share the tag's look.
- You only need a color swatch with no label — that is `SwatchGroup`.

## Minimal example

```tsx
import { Tag, TagGroup } from "@olddevs/ui";

<TagGroup label="Categories">
  <Tag id="design" hue="teal">
    Design
  </Tag>
  <Tag id="docs" href="/posts?category=docs">
    Documentation
  </Tag>
</TagGroup>;
```

Removal and an empty group:

```tsx
const [tags, setTags] = useState(["design", "docs"]);

<TagGroup
  aria-label="Post categories"
  onRemove={(keys) => setTags((current) => current.filter((tag) => !keys.has(tag)))}
  empty="No categories"
>
  {tags.map((tag) => (
    <Tag key={tag} id={tag}>
      {NAMES[tag]}
    </Tag>
  ))}
</TagGroup>;
```

## Public API

`TagGroup`:

| Prop              | Default | Purpose                                                                                                                                                                                                                                                                      |
| ----------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`           | —       | The visible label of the group. **The name comes from exactly one source**: `label`, `aria-label` or `aria-labelledby` — TypeScript does not accept a group without a name (including one with `label` equal to `undefined`, `null` or `false`) or with two sources at once. |
| `aria-label`      | —       | The group's name without a visible label.                                                                                                                                                                                                                                    |
| `aria-labelledby` | —       | A name taken from a heading elsewhere on the page — the heading's `id`.                                                                                                                                                                                                      |
| `onRemove`        | —       | `(keys: Set<TagKey>) => void`. When set, tags have remove buttons and Delete/Backspace work.                                                                                                                                                                                 |
| `empty`           | —       | What to show when there are no tags. Without it an empty group looks like a failure.                                                                                                                                                                                         |
| `className`       | —       | The root class; `ref` goes to the group's root.                                                                                                                                                                                                                              |

`Tag`:

| Prop        | Default | Purpose                                                                                |
| ----------- | ------- | -------------------------------------------------------------------------------------- |
| `id`        | —       | The tag's key: `onRemove` receives it. Set it for removable sets.                      |
| `hue`       | —       | A hue from `LABEL_HUES`: a dot next to the label. If not set, there is no dot.         |
| `href`      | —       | The tag becomes a link. Also `target` and `rel`.                                       |
| `textValue` | —       | The tag's text for its name. Required if the content is neither a string nor a number. |
| `children`  | —       | The tag's label.                                                                       |

Tags wrap to a new line one whole tag at a time. The group does not store state
(the set of tags): the consumer removes a tag by re-rendering the group.

## The hue is a dot next to the label

`hue` renders a 10-pixel circle to the left of the label. There is no fill under
the text, and this is a decision of the tag palette: eight hues that are
readable under text in all three themes would require twice as many colors, and
the consumer's request explicitly allowed the "dot and label side by side"
pair. A fill class from outside is not accepted — the hue is taken from a closed
vocabulary.

The dot is invisible to the screen reader (`aria-hidden`): a hue does not replace
a word. The meaning of the tag is carried by its text — otherwise a person with a
color vision deficiency could not tell tags apart.

## A tag as a link

`href` makes the tag a link: Enter and a click open the URL. react-aria does
not render an `<a>` — it stores the URL in `data-href` and opens it on press,
so that the tag stays a row of the group with arrow keys and removal. The trade-off: there is
no "Open in a new tab" context menu. For client-side routing, wrap the app in
`RouterProvider` from `react-aria-components`.

## Accessibility and keyboard

| Key                    | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `←` / `→`              | Move between tags                             |
| `Delete` / `Backspace` | Remove the focused tag (if `onRemove` is set) |
| `Enter`                | Opens the link of a tag with `href`           |

- After removal, focus stays in the group, on a neighboring tag.
- The group's role is `grid`, the tags' is `row`; the group's name is required. A
  visible label together with `aria-label` is forbidden by the type: the
  attribute would override the on-screen text, and a screen reader would announce a different
  group name
  ([naming rule](../../conventions.md#accessible-name)).
- **The remove button's name comes from the message catalog, with the tag's
  label inside** (`Remove: Design`; the key is `tagGroup.remove`). The label
  is written into the string because word order depends on the language; that is
  why the button has an empty `aria-labelledby` — otherwise react-aria would
  append the tag's label a second time.
- The remove button is a react-aria `Button` with `slot="remove"`, not a
  `<button>`: the behavior comes through react-aria's context.

## Anti-patterns

- Filling the tag with the hue color under the text: contrast in the three themes
  is not guaranteed.
- Making tags selectable: `Chip` and `Segmented` are for that.
- Passing non-text content without `textValue`: the tag and its remove button have
  no name.
- Conveying meaning by hue ("red means error"): palette hues are not tones, and
  status is `StatusBadge`.
- Building the remove button by hand: Delete/Backspace and focus return are lost.

## Related sources and tests

- Source: `src/components/content/TagGroup.tsx`; the shared tag look is in
  `src/lib/tag.ts` (`TagInput` uses it too)
- Hue palette: `LABEL_HUES`, `LABEL_BG_CLASS` — [`docs/palette.md`](../../palette.md)
- Tests: `tests/tag-group.test.tsx`
- Showcase: `src/components/content/TagGroup.stories.tsx`
- Neighbors: [TagInput](../inputs/tag-input.md), [SwatchGroup](../inputs/swatch-group.md), [Chip](../actions/chip.md)

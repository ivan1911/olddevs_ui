---
component: MediaCard
exports: [MediaCard]
category: content
status: stable
source: src/components/content/MediaCard.tsx
story: src/components/content/MediaCard.stories.tsx
sourceHash: 456beacc1187
---

# MediaCard

## Summary for AI

An image tile: a preview in a set aspect ratio, actions over it, badges and
selection. Domain-specific behavior — favorites, duplicates, navigation — stays outside, in
slots.

## When to use

- A grid or feed of previews: images, documents, covers.
- You need to select tiles and act on the selection.
- You need badges over the preview: a status, a mark, a duration.

## When not to use

- For a content block without a picture — that is `Card`. The boundary follows
  what matters most: for a tile it is the preview, for a card — the content.
- For a list row with a thumbnail — that is `UploadQueue` or a custom row: a
  tile takes a column, not a row.
- For a single image without actions — that is `Image` in `AspectRatio`.

## Minimal example

```tsx
import { MediaCard, Image } from "@olddevs/ui";

<MediaCard
  preview={<Image src={url} alt="" className="h-full w-full" />}
  ratio={16 / 9}
  title="photo-0042.png"
  selected={selected}
  onSelectedChange={setSelected}
/>;
```

## Props

| Prop               | Default                  | Purpose                                                                                                                             |
| ------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `preview`          | —                        | The preview. Usually `Image`.                                                                                                       |
| `ratio`            | `1`                      | The aspect ratio as a number: `16 / 9`, `1`, `9 / 16`.                                                                              |
| `title`            | —                        | The title under the preview.                                                                                                        |
| `subtitle`         | —                        | The second line, already formatted.                                                                                                 |
| `badges`           | —                        | Badges over the preview.                                                                                                            |
| `actions`          | —                        | Actions over the preview.                                                                                                           |
| `selected`         | —                        | The tile is selected.                                                                                                               |
| `onSelectedChange` | —                        | Toggle the selection. Without it there is no selection axis. Not passed inside `VirtualGrid` — there the grid manages selection.    |
| `selectLabel`      | from the message catalog | A custom label for the select button; the default (`mediaCard.select`) is "Select" without a provider, "Выбрать" with `locales/ru`. |

## The selection axis is turned on explicitly

Without `onSelectedChange` there is no selection button in the markup, without
`selected` there is no border. A tile with every axis at once would add buttons
and borders to the markup that do nothing: this is the kit's general rule for
axes. `selected` alone, without a handler, only displays a selection that the
grid controls: that is how the card is used in `VirtualGrid` (below).

**Selection is announced as a state, not as a border.** `aria-pressed` tells a
screen reader whether the tile is selected; the border is a signal for the eyes,
and a person who cannot see it would not learn about the selection at all.

The button label does **not repeat** the state: `aria-pressed` is already
announced, and "Selected, deselect" would be announced twice.

### Inside `VirtualGrid`, selection belongs to the grid

`onSelectedChange` is **not passed** here: the card would get its own axis next to
the grid's, and the two selections would drift apart.

In the grid, the axis is turned on in the grid itself — with the `selectionMode`
prop, see
[VirtualGrid](virtual-grid.md#выбор--у-сетки-а-не-у-ячейки). The card gets
`selected`: it renders the border and keeps the actions panel open, and the grid toggles the
selection. The selection checkbox is `<Checkbox slot="selection" />` in `actions`: the
grid wires it to its axis itself.

```tsx
<VirtualGrid selectionMode="multiple" selectedKeys={keys} onSelectionChange={setKeys}>
  {/* cell content */}
  <MediaCard
    preview={preview}
    title={name}
    selected={keys.has(id)}
    actions={<Checkbox slot="selection" label={`Select ${name}`} />}
  />
</VirtualGrid>
```

Before 3.47.0 the card rendered the border only with its own axis, and a selected tile in
the grid had no visible indicator at all.

Before 3.1.0 the documentation advised the opposite. The advice could not be
followed — the analysis is in the [CHANGELOG](../../../CHANGELOG.md) and on the
grid page.

## Actions are reachable from the keyboard

The actions panel is **always in the markup**; it is hidden only with opacity,
and it appears on hover, when focus is inside it, when the tile is selected, and
always on devices without hover (`hover: none`).

A panel that is `display: none` and shown only on `:hover` is unreachable for the
keyboard altogether: it cannot be used.

## Domain-specific behavior stays outside

The generalization was modeled on the source app's card, 212
lines. Favorites, duplicates, long press and navigation on the tile
did not make it into the kit: nodes come in here (`badges`, `actions`), and what
they mean is known to the app
(ADR-0027).

The preview is built on the existing `Image` and `AspectRatio`: the tile implements
no loading, fallback or skeleton of its own.

## Anti-patterns

- Marking selection with a border alone.
- Hiding actions so that the keyboard cannot reach them.
- Adding an `isFavorite` prop: that is the consumer's `badges` or `actions`.

## Related sources and tests

- Source: `src/components/content/MediaCard.tsx`
- Tests: `tests/media-card.test.tsx`
- Showcase: `src/components/content/MediaCard.stories.tsx`

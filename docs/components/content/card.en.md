---
component: Card
exports: [Card]
category: content
status: stable
source: src/components/content/Card.tsx
story: src/components/content/Card.stories.tsx
sourceHash: 13efde973162
---

# Card

## Summary for AI

`Card` is a visual panel with a background, border, shadow, inner padding and
rounded corners. It does not set structure or a heading: set the heading and structure with
nested components (`Heading`, `Text`) at the screen level. If the card is clickable, use
`asChild` with a real button or link inside, not a `div` with `onClick`.

## When to use

- For a self-contained block of data, settings, a metric or a list item that
  needs to stand apart from the background.
- When one of the two sizes is enough: `md` for a regular panel,
  `sm` for a compact one.

## When not to use

- Do not put `onClick` on the card itself without `asChild`: you get a `div`
  that the keyboard cannot reach and that a screen reader does not announce as
  clickable. For a clickable card, use `asChild`.
- Do not create props for arbitrary `padding` and `radius`; only the two sizes
  `size="sm" | "md"` are available.
- Do not use it for a loading placeholder; use `Skeleton` for that, not a
  panel with content.

## Minimal example

```tsx
import { Card, Heading, Text } from "@olddevs/ui";

<Card>
  <Heading level={3}>Publication</Heading>
  <Text level={2}>Scheduled for 6:00 PM</Text>
</Card>;
```

## Public API

`CardProps` accepts the standard `div` attributes, including `className`, and
three props of its own:

| Prop          | Default | Meaning                                                                                                                                                  |
| ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`        | `md`    | `sm` sets compact padding and corner radius; `md` sets a regular panel. Size and radius change together.                                                 |
| `asChild`     | `false` | Apply the card's look to its only child (`button`, `a`, `next/link`) and turn on the clickable styling: cursor, border highlight, focus ring.            |
| `interactive` | `false` | A container card with a stretched link inside: cursor, border highlight, positioning context (`position: relative`) and a focus ring driven by the link. |

`asChild` turns on not only the slot but also the styling of a clickable
element: cursor, border highlight on hover and the focus ring. Otherwise every
consumer would have to add it by hand — the very divergence the card exists to
eliminate. A container card without `asChild` stays an ordinary container: no cursor and no highlight.

```tsx
<Card asChild size="md">
  <button type="button" onClick={open}>
    <Heading level={3}>Cityscapes</Heading>
    <Text level={3}>142 photos</Text>
  </button>
</Card>
```

The choice between `button` and `a` is the same as for `Button`: going to
another screen is a link (it can be opened in a new tab, its URL copied), an
action that does not leave the screen is a button.

If the card has a secondary action inside — a "More" menu, an "Add to favorites" button —
`asChild` does not fit: you cannot nest a button in a button. Then use
`interactive` plus a stretched link:

```tsx
<Card interactive>
  <a href={href} className="after:absolute after:inset-0">
    Cityscapes
  </a>
  <div className="relative z-10">
    <MenuTrigger>…</MenuTrigger>
  </div>
</Card>
```

The focus ring outlines the card only when the link itself has focus: focus on
the menu would outline the whole card and promise a click in the wrong place.

## Accessibility and composition

Without `asChild`, `Card` gets neither a role nor focus: if the panel is a
separate region, set the semantics with nested markup, for example `Heading`
for the title.

With `asChild`, the role, focus and keyboard belong to the child, and the
card's accessible name is its content. A consequence: you cannot nest a button
inside a clickable card — nested interactivity is unreachable from the
keyboard. Put the actions menu next to the card, not inside its button.

## Anti-patterns

```tsx
// Bad: a div becomes a pseudo-button without a keyboard contract.
<Card onClick={openCampaign}>…</Card>

// Good: interactivity belongs to the link, and the card hands it its look.
<Card asChild>
  <Link href={`/campaigns/${id}`} variant="standalone">
    …
  </Link>
</Card>
```

## Related sources and Storybook

- Source: `src/components/content/Card.tsx`.
- Story: `src/components/content/Card.stories.tsx`.

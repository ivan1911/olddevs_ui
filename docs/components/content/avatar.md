---
component: Avatar
exports: [Avatar, AvatarGroup]
category: content
status: stable
source: src/components/content/Avatar.tsx, src/components/content/AvatarGroup.tsx
story: src/components/content/Avatar.stories.tsx, src/components/content/AvatarGroup.stories.tsx
---

# Avatar and AvatarGroup

## Summary for AI

`Avatar` shows a photo from `src` or, if there is none or it failed to load,
initials and a stable gradient computed from the name. `AvatarGroup` shows
participants compactly (strings or `{ name, src? }`) and announces the whole list
under a single accessible name. It represents a person or participants; it is
not a status badge or a profile button.

## When to use

- `Avatar` — to represent a user compactly: with a photo from `src` or with
  initials alone.
- `AvatarGroup` — when it matters that there is a group and it is fine to show only the
  first few participants with a `+N` remainder; for example, the participants of a campaign.
  Photos are passed as `{ name, src }` objects.
- The photo on `Avatar` was added "for the future" (ADR-0048): there was no
  requesting screen at release, and the API was modeled on comparable kits: in all twelve kits
  compared, the avatar has a photo that falls back to initials. Your screen is
  the first to test this API; if it needs a different one, that is not a violation of the contract.

## When not to use

- Do not replace the initials with your own image fallback: the fallback to
  initials when the photo is missing or fails to load is built in, and `Avatar`
  has no separate `fallback`.
- Do not use it for arbitrary images (a logo, a document preview); use
  `Image` instead: the avatar is a fixed-size circle with an accessible name derived from a person's
  name.
- Do not pass partial initials to `AvatarGroup` instead of names: the group's
  accessible name is built from `names`.
- Do not use the group as an interactive list of participants. Selecting or
  opening a profile needs a separate control.

## Minimal example

```tsx
import { Avatar, AvatarGroup } from "@olddevs/ui";

<Avatar name="Anna Smith" />
<Avatar name="Anna Smith" src="/avatars/anna.jpg" />
<AvatarGroup names={["Anna Smith", "John Peterson", "Oliver Cooper"]} />
<AvatarGroup names={[{ name: "Anna Smith", src: "/avatars/anna.jpg" }, "John Peterson"]} />
```

## Public API

### `Avatar`

| Prop                              | Default | Meaning                                                                                                                                                                         |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                            | `"IV"`  | A name or login; the first two characters become the initials, the first character sets the stable hue.                                                                         |
| `size`                            | `md`    | `md` is a compact size for lists and headers; `lg` is a large size for a profile card.                                                                                          |
| `src`                             | —       | Photo URL. While the photo loads, a circle in the name's hue is shown; if it is missing or fails to load, initials appear on the same circle. An empty value counts as missing. |
| `alt`                             | `name`  | The photo's alt text. `""` — decorative (the name is already written next to it). With neither `name` nor `alt` the photo is decorative. No effect without `src`.               |
| `className` and `span` attributes | —       | Passed to the root `span`; `children` is intentionally not supported.                                                                                                           |

### `AvatarGroup`

| Prop         | Default                      | Meaning                                                                        |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------ |
| `names`      | —                            | Required full list: a name string or `{ name, src? }`; the forms can be mixed. |
| `max`        | `3`                          | Number of visible avatars; the remainder is shown as `+N`.                     |
| `size`       | `md`                         | Size of all visible avatars: `md` or `lg`.                                     |
| `aria-label` | all `names`, comma-separated | Overrides the group's single accessible name.                                  |
| `className`  | —                            | Class of the root group.                                                       |

## Photo and fallback to initials

The photo is rendered through the kit's `Image` (ADR-0011): loading and failure are
handled in one place. The background layer with the hue from the name sits on the
circle's root, so the size does not change between "loading", "loaded" and
"failed", and the circle does not flicker: first you see a circle in the name's
color, then the photo or the initials. Once the photo has loaded, the background
layer is removed, so a transparent PNG is not tinted with the name's hue. The
avatar has no `Skeleton`. The photo is fitted with `cover` and is not distorted;
the circle and the `md`/`lg` sizes do not change. Changing `src` after an error
tries the new URL. Without `src`, the markup, appearance and announcement do not change.

## Accessibility

`AvatarGroup` renders as a single `role="img"` with the full list of names. The
inner circles and `+N` are hidden from the screen reader, so it does not read
useless two-letter initials or repeat the name for a photo: the group announces
the list. Do not remove `names` to shorten the display.

A single `Avatar` with a photo is an `img` named from `alt` (by default `name`);
if the photo fails to load, the initials keep the same name. Without `src` the
avatar carries no role, and its text is the initials. Next to a person's written
name, set `alt=""` so the name is not spoken twice.

## Anti-patterns

```tsx
// Bad: the screen reader gets abbreviations, not names.
<AvatarGroup names={["AS", "JP"]} />

// Good: keep names that people can understand.
<AvatarGroup names={["Anna Smith", "John Peterson"]} max={2} />

// Bad: the name is already written next to it, so the photo is announced a second time.
<><Avatar name="Anna Smith" src={url} /> Anna Smith</>

// Good: the photo is decorative.
<><Avatar name="Anna Smith" src={url} alt="" /> Anna Smith</>
```

## Related sources and Storybook

- Sources: `src/components/content/Avatar.tsx`, `src/components/content/AvatarGroup.tsx`.
- Stories: `src/components/content/Avatar.stories.tsx`, `src/components/content/AvatarGroup.stories.tsx`.
- The group's accessible name is tested in `tests/data.test.tsx`; the photo, the fallback to initials and the unchanged markup without `src` — in `tests/avatar.test.tsx`.

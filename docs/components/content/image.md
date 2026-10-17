---
component: Image
exports: [Image]
category: content
status: stable
source: src/components/content/Image.tsx
story: src/components/content/Image.stories.tsx
---

# Image

## Summary for AI

`Image` handles all three states of a picture: loading, loaded and failed to load. It is built on a plain `<img>`; `next/image` is deliberately not used (ADR-0011).

## When to use

- Anywhere the markup would have an `<img>`: tiles, previews, object images, list rows.
- When the URL comes from data and may turn out broken or empty — that is, almost always.

## When not to use

- For an icon — that is `@olddevs/ui/icons`, which has vector icons; pick an icon name by the meaning of the action (see [icons](../../icons.md)).
- For a user's photo — there is `Avatar`: it has `src` and `alt`, a circle of fixed size and a fallback to initials, and the same `Image` handles loading inside it.
- For an empty box that holds future content — that is `AspectRatio` or `Skeleton`.

## Minimal example

```tsx
import { Image } from "@olddevs/ui";

<Image src={document.previewUrl} alt="" ratio={16 / 9} className="w-full rounded-xl" />;
```

## Public API

The component renders a box (`span`) and an image inside it. The box gets the size, corner radius and border; the image gets the fit.

| Prop           | Default | Meaning                                                                                                                 |
| -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src`          | —       | The image URL. `null`, `undefined` and an empty string mean "nothing to show" → fallback.                               |
| `alt`          | —       | Required. `""` is a legitimate value: "the image is decorative".                                                        |
| `fit`          | `cover` | `cover` fills the box, `contain` fits the whole image inside. Has no effect with `sizing="intrinsic"`.                  |
| `sizing`       | `fill`  | `fill` — the size is set by the surrounding layout, `intrinsic` — the image sets the size (below, "Who sets the size"). |
| `ratio`        | —       | The box aspect ratio as a number (`16 / 9`). Without it, the layout sets the height.                                    |
| `fallback`     | icon    | A custom node instead of the icon; `null` leaves an empty box.                                                          |
| `skeleton`     | `true`  | A skeleton under the image while it loads.                                                                              |
| `eager`        | `false` | Turns off lazy loading — for an above-the-fold image.                                                                   |
| `className`    | —       | Box classes: size, corner radius, border.                                                                               |
| `imgClassName` | —       | Classes of the image itself. Rarely needed.                                                                             |
| `imgStyle`     | —       | Inline style of the image itself; needed where the visual element is the image, not the box.                            |

The other `<img>` attributes (including `onLoad`, `onError`, `draggable`, `onDoubleClick`) go to the image; handlers you pass are called together with the internal ones, not instead of them.

There is no separate `radius` prop: the box accepts `className`, and the source app has seven different image radii — a three-step scale would get in the way here. It is the same reason `Skeleton` accepts numbers.

## Who sets the size

`fill` (the default) — the size is set by the surrounding layout: a tile in a grid, an avatar, a preview of fixed height. The image gets `h-full w-full` and fills the box according to `fit`.

`intrinsic` — the image has the size, and the box wraps it. This is how the full-image viewer works: it has no height of its own, only a maximum height, and it must go on the **image**:

```tsx
<Image
  src={photoUrl}
  alt={title}
  sizing="intrinsic"
  eager
  imgClassName="max-h-[45vh] max-w-full rounded-lg"
/>
```

A maximum height on the box (`className`) would crop the image instead of shrinking it. And `fill` in this layout collapses everything to zero: `h-full` is a percentage of a box that has no size. Lazy loading then does not start at all, because there is nothing to show.

There is no skeleton in `intrinsic` mode and there cannot be: before loading, the box wraps nothing. The calling code has to reserve the space for the image.

## States

- **Loading** — the skeleton sits **under** the image, not instead of it: the browser starts loading only when the `<img>` is in the tree.
- **Loaded** — the skeleton is removed.
- **Failed to load** — the image is replaced with the fallback; the state resets when `src` changes, otherwise a node reused by a virtualized grid for a different image would keep the fallback forever.

## Accessibility

`alt` is required, and it is required not for the text but for the choice: `alt=""` is a decision ("the image is decorative"), while a missing attribute is an oversight after which a screen reader reads the file name aloud.

The skeleton is always decorative. The fallback inherits the decision from `alt`: when it is empty, the fallback is decorative; when it is not, the fallback takes the label itself (`role="img"` with the same name) — otherwise a load failure would turn a named object into an empty place that a screen reader does not announce. The failure itself is not announced: it is not an event for the user, but a missing preview.

## Anti-patterns

```tsx
// Bad: custom failure handling on top of a component that already does it.
const [broken, setBroken] = useState(false);
{
  broken ? <Placeholder /> : <Image src={src} alt="" onError={() => setBroken(true)} />;
}

// Good:
<Image src={src} alt="" fallback={<Placeholder />} />;
```

```tsx
// Bad: an above-the-fold image is deferred by the browser and hurts LCP.
<Image src={hero} alt="" />

// Good:
<Image src={hero} alt="" eager />
```

## Related sources and Storybook

- Source: `src/components/content/Image.tsx`
- Stories: `src/components/content/Image.stories.tsx`
- Tests: `tests/image.test.tsx`

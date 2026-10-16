---
component: Carousel
exports: [Carousel, CarouselProps, CarouselSlidesPerView]
category: content
status: stable
source: src/components/content/Carousel.tsx
story: src/components/content/Carousel.stories.tsx
sourceHash: 25011370f63a
---

# Carousel

## Summary for AI

A strip of slides on native scrolling with CSS scroll-snap: the "previous" and
"next" buttons, the mouse wheel, the trackpad, swipe and the arrow keys all move
it; after a gesture the slide settles exactly in place. The region name is
required — exactly one of `aria-label` and `aria-labelledby`. The number of
slides in view is `slidesPerView` (a number or an object keyed by the kit's
breakpoints), and the current slide is `index` / `defaultIndex` / `onIndexChange`.
Slides never change on their own: no autoplay, no infinite strip.

## When to use

- A gallery, a selection or a set of cards that should fill one row of the
  screen instead of growing downward: previews, recommendations, onboarding steps.
- You need to show several slides at once and change their number with the screen
  width (`slidesPerView={{ base: 1, md: 2, xl: 4 }}`).
- You need to tie the strip to the rest of the screen: a caption, thumbnails, a
  counter — through `index` and `onIndexChange`.
- A component "for the future" (ADR-0048): there was no requesting screen at release, and
  the API was modeled on comparable kits — shadcn/ui `Carousel`, Mantine `Carousel`,
  Chakra `Carousel`, Ant `Carousel`, Fluent 2 `Carousel`. Your screen is the first
  to test this API: if it needs a different API, that is not a violation of the contract.

## When not to use

- Automatically changing slides, an infinite strip, dot indicators — they do
  not exist and never will: the kit takes on neither a pause button nor the
  accessibility traps of autoplay (motion that cannot be stopped, text that
  cannot be read in time).
- A ready-made lightbox component: there is none and never will be, but a
  viewer that pages through slides in a dialog is assembled from `Dialog` and `Carousel` — see
  ["Viewing with a carousel in a `Dialog`"](#просмотр-каруселью-в-dialog).
- For tabs with a single visible panel, use `Tabs`: they have different
  semantics (`tablist`), not a strip.
- Paged browsing of records with arrow buttons and keys is a separate task (`DetailPager`
  in the candidate registry), not a carousel.
- If a set can reasonably be shown in full as a grid, use `Grid`: hiding half of the content behind
  scrolling is a price paid only when the grid does not fit.
- For a long list of rows, use a `Table` or a list; a horizontal strip is the
  wrong way to present it.

## Minimal example

```tsx
import { Carousel } from "@olddevs/ui";

<Carousel aria-label="Recommendations" slidesPerView={{ base: 1, md: 3 }}>
  <ProductCard id="a" />
  <ProductCard id="b" />
  <ProductCard id="c" />
  <ProductCard id="d" />
</Carousel>;
```

## Public API

| Prop                 | Default | Meaning                                                                                                                   |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------- |
| `aria-label`         | —       | The region name as a string. Exactly one of `aria-label` and `aria-labelledby` is required; both at once is a type error. |
| `aria-labelledby`    | —       | The region name taken from a visible heading above the strip — the heading's `id`.                                        |
| `slidesPerView`      | `1`     | `1`, `2`, `3` or `4` slides in view; an object `{ base, sm, md, lg, xl }` — a separate number starting at each width.     |
| `index`              | —       | The current slide, controlled mode: the leftmost visible one, zero-based.                                                 |
| `defaultIndex`       | `0`     | The initial slide in uncontrolled mode. It is shown without animation.                                                    |
| `onIndexChange`      | —       | `(index: number) => void` — the strip has stopped on a different slide.                                                   |
| `children`           | —       | The slides: each direct child is one slide.                                                                               |
| `section` attributes | —       | `className`, `id` and `data-*` are passed to the region; `ref` goes to the `<section>` (`forwardRef`).                    |

**A slide is a direct child.** A fragment is one child, so slides inside it do not
become separate slides; `null`, `false` and empty strings do not become slides.

**There is no gap between slides.** A slide's width is a fraction of the row, and
a gap would make it depend on the number of slides in view. The space between
cards is the inner padding of the slide's content (`p-2` on the card root).

### The index is the leftmost visible slide

With `slidesPerView={3}` and five slides, indexes 0–2 are reachable: the strip does
not scroll past its end, and the last view holds the slides with indexes 2–4. An index that cannot
be reached (`index={4}` in this example) is replaced by the nearest
reachable one.

### `onIndexChange` fires after scrolling stops

The callback is called when scrolling has stopped (100 ms after the last scroll
event), not on every frame. So in controlled mode, changing `index` externally
does not create an echo: the strip travels to the assigned slide, passes the
intermediate ones silently, and the callback is not called on arrival — the slide
is already the right one.

This is controlled mode in the usual sense: `index` assigns the slide, and the
callback asks the parent to change it. A parent that keeps the old index gets the
strip back on it — smoothly, after scrolling stops. A slide you assigned yourself
(`index`, `defaultIndex`) does not call the callback.

### Buttons and edges

The buttons are the kit's `Button`, icon only; their names come from the message
catalog ("Previous slide", "Next slide"). They are disabled at the edges; if the
whole strip fits in view, both are disabled. A pressed button that becomes
disabled passes focus to its neighbor — a keyboard user does not end up at the
start of the page. If you press several times in a row, each press counts from the slide the strip is
already scrolling to.

### Smoothness and `prefers-reduced-motion`

The buttons scroll with `behavior: "smooth"`, but instantly under
`prefers-reduced-motion: reduce`. The preference is read at the moment of scrolling. Settling
on a slide after a gesture is the browser's built-in snapping, and the browser
itself drives its animation.

## Viewing with a carousel in a `Dialog`

A lightbox is not a component but a composition: `Dialog` supplies the modal surface,
focus and focus return, `Carousel` supplies the paging. It needs no new
exports. Opening a particular slide is handled by the calling code: it remembers the index
and the list of slides at the moment of opening, `Dialog` shows them, and
`Carousel` starts at the right place through `defaultIndex`.

```tsx
import { Carousel, Dialog, Image } from "@olddevs/ui";

const [view, setView] = useState<{ start: number; files: MediaFile[] } | null>(null);
const [index, setIndex] = useState(0);

const open = (start: number) => {
  setIndex(start);
  // The list is frozen on opening: an upload that lands later must not shift
  // the slides under the user's finger.
  setView({ start, files });
};

<Dialog
  open={view !== null}
  onClose={() => setView(null)}
  title={view?.files[index]?.name ?? "Preview"}
  subtitle={view ? `${index + 1} of ${view.files.length}` : undefined}
  className="w-full max-w-[720px]"
>
  {view && (
    <Carousel aria-label="Files" defaultIndex={view.start} onIndexChange={setIndex}>
      {view.files.map((file) => (
        <Image key={file.id} src={file.url} alt={file.name} ratio={16 / 9} fit="contain" />
      ))}
    </Carousel>
  )}
</Dialog>;
```

What matters here:

- **`defaultIndex`, not `index`.** The dialog mounts its content on opening, so
  the strip starts at `view.start` each time, without animation. A controlled
  `index` is needed only if the slide can also be changed from elsewhere (thumbnails,
  buttons in the header).
- **The title and the counter follow `onIndexChange`.** The callback fires after
  the strip stops, not on every frame — the title changes once the slide has
  settled. The dialog's name stays the `title` of `Dialog`, while the slide
  name "N of M" is announced by the strip itself.
- **`{view && …}` inside the dialog.** While `view` is empty there is no strip
  at all: the next opening creates it anew and does not inherit the previous
  scroll position.
- **A slide whose content has its own label.** The image's `alt` is the file
  name: the slide name "N of M" does not replace it.
- Focus: opening the dialog moves focus into it; `Escape` closes the dialog and returns
  focus to where it was opened from. The arrow keys page through the slides when the strip is focused;
  the strip's buttons are separate tab stops.

It is convenient to open the dialog from the `onAction` of a
[`VirtualGrid`](virtual-grid.md): a click or Enter on a cell calls `open`
without selecting it.

## Accessibility

This component follows the WAI-ARIA APG Carousel pattern, without autoplay and so without a pause
button.

- The region is a `<section>` with `aria-roledescription` "carousel" (in the
  Russian locale "карусель") and a name from `aria-label` or `aria-labelledby`.
  Without a name the screen reader announces an unnamed region, which is why the
  type requires the name. The carousel has no `label` prop: in the kit `label` is
  only a visible label
  ([conventions.md](../../conventions.md#доступное-имя)).
- A slide is `role="group"` with `aria-roledescription` "slide" and the name "N of
  M" from the catalog: the screen reader reads "slide, 2 of 5". The
  `aria-roledescription` words are text that screen readers speak, so they live in the message
  catalog and are not an ARIA token.
- Slides outside the view are **not hidden** from the screen reader: without
  autoplay the strip is read in full, and when focus lands on a slide that is out of view, the browser scrolls the strip to
  that slide on its own.
- Keyboard: Tab reaches the "previous" button, the strip and the "next" button; disabled buttons at the edges are skipped. On
  a focused strip, the arrow keys scroll it natively, with snapping. If
  the slides contain links and buttons, Tab through them scrolls the strip to
  that slide.
- The strip gets `tabIndex={0}`: a scrollable block with no place in the tab order
  is the axe violation `scrollable-region-focusable`.
- Give slides meaningful captions ("Photo 2: sunset") through the content — the
  slide name "N of M" does not replace them.
- In RTL, the scrolling and the arrows on the buttons are mirrored.

## Anti-patterns

- Putting interactive forms in slides when they cannot be completed without paging:
  what is hidden past the edge is not visible and cannot be found by eye.
- Setting `slidesPerView` to a number outside the set 1–4 (`slidesPerView={5}`) or
  assembling the width class yourself — the set is closed, and a class for each
  value is written out in the source.
- Building a lightbox not from `Dialog` but on `ModalOverlay` or your own
  scrim: the dialog name, the focus trap and the focus return are lost.
- Changing `index` from a timer to "liven up" the strip: auto-advance is what the
  component deliberately does not do, and the user does not have time to read.
- Deriving the number of slides from `index` when `slidesPerView > 1`: the index
  is the leftmost visible slide, not a "page".

## Related sources and Storybook

- Source: `src/components/content/Carousel.tsx`; the "value per breakpoint →
  classes" map is the internal `src/lib/responsive.ts` (not public API).
- Tests: `tests/carousel.test.tsx` (names, buttons, edges, `onIndexChange`, modes;
  scrolling is stubbed because jsdom does not compute layout); snapping to a
  slide, the gesture and the slide width at breakpoints are checked by hand in
  the showcase in a browser; every width class in the built CSS —
  `tests/class-coverage.test.ts`.
- Story: `src/components/content/Carousel.stories.tsx`. The tier is core
  (ADR-0014): its own accessibility model and its own scrolling behavior.

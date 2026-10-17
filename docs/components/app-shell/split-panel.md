---
component: SplitPanel
exports: [SplitPanel, useMediaQuery]
category: app-shell
status: stable
source: src/components/app-shell/SplitPanel.tsx
story: src/components/app-shell/SplitPanel.stories.tsx
---

# SplitPanel

## Summary for AI

`SplitPanel` lays out two areas separated by a resizable boundary: the content and a details panel. The `position` axis (`side` / `bottom`) changes the layout direction. The size is controlled through `size` + `onSizeChange` or uncontrolled from `defaultSize`; persisting the size between sessions is up to the consumer. On a narrow viewport the panel is collapsed with the `collapsed` prop, and the `useMediaQuery` hook from the same package supplies the width.

## When to use

- A "list on the left, details on the right" screen: the selected row expands next to the list rather than on another page.
- An inspector under a table: a log, diagnostics, a request preview.
- The user needs to decide for themselves which area gets the space.

## When not to use

- The details open over the content and demand attention — that is `Drawer` or `Dialog`.
- The details area is fixed and cannot be resized — that is a plain two-column grid.
- You need an application navigation column — that is `SideNav` inside `AppShell`.

## Minimal example

```tsx
<SplitPanel aria-label="Order details" panel={<OrderDetails id={selected} />}>
  <OrdersTable onSelect={setSelected} />
</SplitPanel>
```

## Public API

- `position`: `side` (the default) — the panel is on the right and the user resizes its width; `bottom` — the panel is at the bottom and the user resizes its height.
- `size` + `onSizeChange` — a controlled size in pixels; `defaultSize` — the initial one when `size` is not passed.
- `onSizeChange` is called **on every frame** of the drag, but only when the value has actually changed: dragging the boundary past a limit clamps to the same number and stays silent. If you write the size to the page URL or to a server, you do not need every frame: throttling or writing on `pointerup` is the consumer's concern.
- `defaultSize` is read **once, on mount**: changing the prop later does not move the starting size, otherwise the panel would jump under the user because of a re-render of the parent. A double click still resets the size to the current value of `defaultSize`.
- `minSize` and `maxSize` are the bounds in pixels. The size is clamped to them both while dragging and when passed as a prop. Narrowing the bounds on the fly corrects the rendered size but does not call `onSizeChange`: an event without a user action would look like the consumer's state being edited against its will. An inverted range (`minSize > maxSize`) breaks nothing — the upper bound is raised to the lower one.
- `collapsed` collapses the panel **without unmounting** its content. Collapsing in the middle of a drag ends the drag: otherwise the state would outlive the vanished handle, and hovering over a new one would move the boundary without a press.
- The component has **no** adaptive mode of its own: on a narrow viewport the panel is collapsed with `collapsed={!wide}`, where `wide` comes from `useMediaQuery` — see "Narrow viewports" below.
- `aria-label` gives the panel a name; without it the panel is not announced as a region.
- `className` goes on the outer container.

## Narrow viewports: `collapsed` and `useMediaQuery`

Two areas side by side need room: on a screen narrower than 1024 px (the `lg` breakpoint) a side panel squeezes the
content. What should replace it is the screen's decision, not the component's: just
one area; the details in a `Drawer` behind a button; the list and the message "one at a
time" (a mail client). A `SplitPanel` prop that collapses the panel at a narrow width
would cover only the first, so the standard path is different: the component already
has `collapsed`, and a public hook supplies the width.

```tsx
import { SplitPanel, useMediaQuery } from "@olddevs/ui";

const wide = useMediaQuery("(min-width: 1024px)"); // Tailwind's `lg` breakpoint

<SplitPanel aria-label="Order details" collapsed={!wide} panel={<OrderDetails id={selected} />}>
  <OrdersTable onSelect={setSelected} />
</SplitPanel>;
```

`useMediaQuery(query, serverValue = false)` returns whether the media query matches
right now and re-renders the component when that changes. The query is a plain CSS
string; the kit's breakpoints are Tailwind 4's defaults: `sm` 640 px, `md` 768 px,
`lg` 1024 px, `xl` 1280 px.

- **What is shown before hydration.** The server does not know the width. The hook
  returns `serverValue`, `false` by default: for a `min-width` query that means
  "narrow", i.e. mobile-first, like Tailwind itself. On the server and in the first
  client frame the panel is collapsed. During hydration React takes the server value
  itself and substitutes the real one right after — **with no mismatch error**, but
  with one re-render: on a wide viewport the panel appears after hydration. If almost
  all users are on wide screens, `useMediaQuery(query, true)` reverses the default (the
  first frame is "wide", and a narrow viewport loses the panel after hydration). The
  choice is the consumer's: the kit does not know which case is more likely.
- **No `matchMedia`** (jsdom, an old browser) — the hook also returns `serverValue`
  and does not throw.
- **It is not a way to lay out a page.** Showing or hiding a block by width is a
  Tailwind class's job (`hidden lg:block`): a class works from the first frame and on
  the server with no re-render
  (ADR-0018). The hook is for
  when the width changes the composition or the behavior: what to mount, whether to
  close a drawer, how many months to show.
- `collapsed` does not unmount the panel's content: a form and the scroll position
  inside survive the "wide ↔ narrow" transition. Focus that was in the panel moves
  into the content on collapse.

Two working patterns:

```tsx
// Details in a drawer: the panel is collapsed, a button opens the drawer on a narrow viewport only.
<SplitPanel collapsed={!wide} panel={details}>{list}</SplitPanel>
<Drawer title="Details" open={drawerOpen && !wide} onClose={() => setDrawerOpen(false)}>{details}</Drawer>

// One area at a time: on a narrow viewport SplitPanel is not mounted at all.
{wide ? <SplitPanel panel={message}>{list}</SplitPanel> : reading ? message : list}
```

## Size lives with the consumer

The panel can remember its size by itself, but only while it is mounted. Persistent storage — the page
URL, the user profile — stays with the consumer: they already keep the state
somewhere, and a second store inside the kit would silently drift from the first. It is the same
split as for table state (ADR-0023).

With a controlled size the component **does not write the value to itself**: it reports an
intent through `onSizeChange` and renders whatever size the consumer passes in `size`. Two
sources of truth would diverge on exactly the frame where the consumer rejects a
value.

## Why the handle is a real slider

react-aria provides no general-purpose resizer: `ColumnResizer` and
`ResizableTableContainer`, which work in `Table`, are tied to the table.
The handle borrows their model — a visible bar plus a hidden `input[type=range]`.

The platform slider brings everything that would otherwise be written by hand and forgotten
piece by piece: the role, announcing the value and bounds, the step, repeat on hold,
screen reader support on a touch screen. A `div` with `role="separator"` and
an arrow-key handler reimplements this at best halfway.

**The slider's value is the panel size, not the boundary coordinate.** That is why the
right arrow always enlarges the panel, even though the boundary moves left: what is dragged
is the size, not the divider.

## Keyboard

- The handle is an ordinary tab stop. The arrow keys change the size in 16 px steps, or by one pixel with `Shift`, and `Home` and `End` jump exactly to the bounds.
- The arrow step lives in the key handler, not in the `step` attribute: the step base of `input[type=range]` is `min`, and `step=16` would allow only the values `min + 16n`. Then `maxSize` could not be reached from the keyboard at all, and the browser would silently round the pixel-precise result of a drag — the announced value would drift from the panel width.
- A double click on the handle returns `defaultSize`. There is no keyboard path to reset: you can set the size you need in two ways, and the second one (the arrow keys, `Home`, `End`) works from the keyboard.
- Pressing the bar moves focus to the slider, so a "drag with the mouse, finish with the arrow keys" workflow works.
- The hit area of the handle is wider than the visible bar: the bar itself is 10 px and the target is 26 px; WCAG 2.5.8 requires at least 24 px.
- While dragging with a pointer, text selection in the neighboring areas is turned off: otherwise moving past the bar highlights half the list.

## Accessibility and semantics

- The handle's name comes from the message catalog: with the panel's name — "Изменить размер: Детали заказа" / Resize: Order details, without it — "Изменить размер панели" / Resize the panel. There can be several handles on screen, and a shared name would not tell them apart.
- The current size is announced through `aria-valuetext` with plural forms from the locale.
- Both areas are scrollable and therefore focusable (`tabindex="0"`): `Tab` does not reach content that scrolls only with a pointer — the axe rule `scrollable-region-focusable`. A collapsed panel drops out of the tab order along with everything else.
- A collapsed panel leaves the accessibility tree: if `Tab` reaches a panel that cannot be seen, focus is lost. Its content stays mounted. If focus was inside the panel at the moment of collapsing, it is moved to the content area (the handle disappears on collapse) — otherwise it would stay on a hidden node and the next `Tab` would start from the top of the page.
- The component does not touch `--topbar-h` (ADR-0016): it takes the area it is given and does not stick to the top.
- See `src/components/app-shell/SplitPanel.tsx`, `src/hooks/useMediaQuery.ts`, `src/components/app-shell/SplitPanel.stories.tsx` (the `Adaptive` story), `tests/split-panel.test.tsx`, `tests/use-media-query.test.tsx`, `tests-visual/interactions.spec.ts`.

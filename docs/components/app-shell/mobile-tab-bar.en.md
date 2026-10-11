---
component: MobileTabBar
exports: [MobileTabBar, MobileTabBarItem]
category: app-shell
status: stable
source: src/components/app-shell/MobileTabBar.tsx
story: src/components/app-shell/MobileTabBar.stories.tsx
sourceHash: 2aa4a3681282
---

# MobileTabBar and MobileTabBarItem

## Summary for AI

`MobileTabBar` is the bottom bar of main sections for a phone: a named `<nav>`
(the default comes from the message catalog) with `MobileTabBarItem` items in a row, equal in width.
It goes in the `bottomBar` slot of `AppShell`, and **it does not duplicate anything that belongs to
the shell**: sticking to the bottom edge of the viewport, hiding at `md` and wider, the inset for the screen
notch and the height all come from the slot. The slot also publishes the height as `--bottombar-h`
so that `ContextualSaveBar` and `Toaster`, which stick to the bottom, sit above the bar.

An item is an icon over a label: `active` sets
`aria-current="page"`, `badge` renders a number or a "something new" dot with text for the
screen reader, and `asChild` renders the item as the consumer's element, such as the router's link: the item's styles,
props and `ref` pass to it. The bar knows nothing about the router: the model is the same as for `NavItem`.

## When to use

- The application's main sections on a phone, up to five items, where switching
  between them must take a single tap.
- As the companion of the side navigation: `SideNav` at `md` and wider, `MobileTabBar` below.

## When not to use

- For tabs inside a page — that is `Tabs`: they do not navigate to another page.
- For side navigation and for more than five items — that is `SideNav`; a sixth item
  on a phone leaves no room for the labels.
- For an action rather than navigation — that is `Button`. A bar item leads to a page, and
  the link role is no accident.
- The kit has no "more" item with a menu and no hiding of the bar on scroll.

## Minimal example

```tsx
import { AppShell, MobileTabBar, MobileTabBarItem } from "@olddevs/ui";
import { DashboardIcon, FolderIcon } from "@olddevs/ui/icons";
import Link from "next/link";

<AppShell
  routeKey={pathname}
  bottomBar={
    <MobileTabBar>
      <MobileTabBarItem
        label="Dashboard"
        icon={<DashboardIcon />}
        active={pathname.startsWith("/dashboard")}
        asChild
      >
        <Link href="/dashboard" />
      </MobileTabBarItem>
      <MobileTabBarItem label="Documents" icon={<FolderIcon />} badge={3} asChild>
        <Link href="/docs" />
      </MobileTabBarItem>
    </MobileTabBar>
  }
>
  <PageContent />
</AppShell>;
```

With `asChild`, the child of `MobileTabBarItem` is passed **empty**: the icon and label
move inside it through `Slottable`. `NavItem` and `Button` work the same way.

## `MobileTabBar` props

| Prop              | Default         | Purpose                                                                                  |
| ----------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `aria-label`      | message catalog | The navigation's accessible name instead of "Разделы" / Sections                         |
| `aria-labelledby` | —               | A name taken from a visible heading — the heading's `id`; not together with `aria-label` |

The name is optional, and the default comes from the message catalog; you can pass one of the two, and the
type does not allow both at once. An empty `aria-label` does not count as a name, and the default is
announced instead. The bar has no `label` prop: in the kit, `label` is only a visible label
([conventions.md](../../conventions.md#доступное-имя)). The other props go
to the `<nav>`, and so does `ref`.

## `MobileTabBarItem` props

| Prop         | Default         | Purpose                                                                                                                                                                                            |
| ------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`      | —               | The label and the accessible name, in full. Required.                                                                                                                                              |
| `icon`       | —               | The icon over the label. Hidden from the screen reader: the label provides the name.                                                                                                               |
| `active`     | `false`         | The current section: `aria-current="page"`, color and a stripe on top.                                                                                                                             |
| `badge`      | —               | A number is a counter (above 99 — "99+"), `true` is a "something new" dot, a string is text in a pill, an element is the consumer's badge as is. `0`, `false` and `""` render nothing.             |
| `badgeLabel` | message catalog | The badge text for the screen reader instead of "3 new" / "Новых: 3" or the string itself. **Required** for the consumer's own element — the type checks it, and in JS a development warning does. |
| `asChild`    | `false`         | Render the item as the consumer's element: `next/link`, the router's `<Link>`; the item's styles, props and `ref` pass to it.                                                                      |

The other props go to the element — including `href` for the case without `asChild`.

## Decisions visible in the API

**The bar knows nothing about `fixed`, `md:hidden` and the screen notch.** The `bottomBar`
slot of `AppShell` provides them, and repeating them in the bar would drift from the shell
silently: the notch inset, for example, would come out doubled. Outside the `bottomBar` slot the bar is
a plain row in the normal flow: the background is exactly its height, and sticking, hiding and
the notch inset are left to the consumer.

**The current section is a prop, not a computation.** The kit knows nothing about the router or
the rules for comparing paths (trailing slash, nested routes, a locale in the prefix);
a mistake shows up not as a crash but as a quietly unhighlighted item
(ADR-0018).
The prop is called `active` — the same as on `NavItem`: one idea in two navigation
items should not have two names. The `aria-current="page"` attribute is derived from
it.

**The badge is standard or the consumer's own.** On an item the badge sits over the icon: its position,
the "99+" cap and the screen reader text are part of the decision, so the standard values
(a number, `true`, a string) are rendered by the kit itself as a `Badge` pill. The visible number
is hidden from the screen reader, and a phrase is read instead: a bare "3" next to a section name tells
nothing, and a dot without text sounds like no badge at all. The phrase comes
from the message catalog with the real number ("237 new" when the screen shows "99+");
a string is read as is; `badgeLabel` sets a different phrase.

The consumer's own element, such as `<Badge tone="success">` or an icon badge, is also accepted, like
`badge` on `NavItem`: it sits in the icon's corner as is. Then `badgeLabel` is
required, and the type checks it: the badge is hidden from the screen reader along with the
icon, and the kit cannot read the contents of the consumer's node on the consumer's behalf: it
may be an image. For a JS consumer who forgot `badgeLabel`, a warning is logged to the console once in
development mode: the badge is visible but not audible
([warning rules](../../conventions.md#предупреждения-в-режиме-разработки)).

**The background is a kit surface token, with no blur.** `backdrop-filter` on
every mobile screen costs a repaint on scroll, and the labels do not need it to stay
readable. In the `bottomBar` slot the background extends below the bar by the notch
height: the slot wrapper adds the notch inset, and a background clipped to the
bar would leave a transparent gap through which the scrolling content shows.
Outside the slot nobody adds the inset, and the background is exactly the bar — otherwise on a
phone with a notch it would cover whatever sits under the bar.

The consumer's sticky wrapper with a notch inset paints that inset itself: the wrapper's background is
`bg-bg-1`, the same token as the background. The slot tells the bar where it is placed
through the shell's internal context: this is decided by the markup from the first frame, including on
the server, and does not affect a bar placed in the `<main>` of the same shell.

**The current item differs by more than color**: an accent color on the label and icon
plus a stripe on top. The weight does not change — otherwise the current item's label
would become wider than its neighbors and truncate sooner.

## Known trade-off: the 11px label truncates sooner than the consumer's

The label is the kit's `text-caption` scale step (11px), truncated with an ellipsis
(`truncate`), and the full label remains the accessible name. A consumer
whose bar predates the kit measured at 360px: with five items an item's column
leaves 50px for the label, and the two Russian labels "Библиотека" and "Расписание" at 11px take
64–65px against 58–59px at 10px. So **the kit's step truncates two labels out of
five** on the most common Android screens, and the consumer keeps its own 10px, outside the scale.

The kit follows its own scale, and there is no separate step for the bar here. Whether one is needed
will be decided by the first adoption: if the truncation turns out to be noticeable, the right move is
first to shorten the labels or the number of items, and only then to add a step
for a single component.

## Accessibility

- A `<nav>` landmark with a name: from the message catalog ("Разделы" / Sections), `aria-label`
  or `aria-labelledby`.
  The main side navigation and the bar are two different landmarks with different names.
- An item is a link; the current one is announced as "current page".
- The icon is hidden from the screen reader, and the name is the full label, even if it
  is truncated on screen.
- The badge is read as a phrase, not a bare number — see above.
- Keyboard — ordinary Tab through the links, a focus ring on the item.

## Requirements for the consumer

**The bar goes in `bottomBar` of `AppShell`.** Sticking, hiding at `md` and the
screen notch come from there; without the shell you have to set them yourself. The bar's
height comes from there too: the slot publishes it as `--bottombar-h`, and `ContextualSaveBar`
and `Toaster` sit above the bar without a hand-tuned `bottom-14` workaround. Outside the shell the
consumer publishes the variable.

**Without `asChild`, an item needs `href`.** The type does not require it — `NavItem` works the same way —
but an `<a>` without `href` is not a link: no role, no place in the tab order,
although `aria-current` and the badge name are still announced. An item without `href` looks functional
but is inaccessible.

**With `asChild`, the item needs a link element inside.** If there is none (forgotten in
JS code), the item does not crash the page but renders its own `<a>` without `href`: the label
is visible, but the item is inaccessible for the same reason as above.

**Without an icon, the badge goes into the label line**, after it: the corner of an empty node
has nothing to anchor to. The label then truncates sooner than the badge.

**No more than five items.** The row is divided equally; a sixth leaves labels
under 50px at 360px, and almost every label truncates.

## Related sources and tests

- Implementation: `src/components/app-shell/MobileTabBar.tsx`.
- Tests: `tests/mobile-tab-bar.test.tsx` — the landmark and its name (message catalog,
  `aria-label`, `aria-labelledby`, empty string), `ref`, `active`, `asChild`,
  the name with a long label, badge text (number, cap, dot, `badgeLabel`,
  zero), the warning for the consumer's own badge without `badgeLabel`, the background in the `bottomBar`
  slot and outside it; the Russian strings are in
  `tests/locale-ru.test.tsx`.
- Stories: `src/components/app-shell/MobileTabBar.stories.tsx` and `WithBottomBar` in
  `src/components/app-shell/AppShell.stories.tsx`.

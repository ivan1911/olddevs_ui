---
component: AppShell
exports: [AppShell]
category: app-shell
status: stable
source: src/components/app-shell/AppShell.tsx
story: src/components/app-shell/AppShell.stories.tsx
sourceHash: 854d2f42944d
---

# AppShell

## Summary for AI

The application shell: navigation on the left, a header on top, content in `<main>`,
an optional right area and a bottom bar. It handles the skip link,
the mobile mode (navigation moves into a `Drawer`) and focus return on route
change. It knows nothing about the router: the `routeKey` prop marks a screen change.

## When to use

- An application page with permanent navigation: an admin panel, an account area, a console.
- Anywhere you need landmarks, a skip link and predictable focus on navigation.

## When not to use

- For a standalone page without navigation — the shell adds nothing there.
- For layout inside a page (two columns, a card grid) — that is plain CSS.
- For a modal scenario — use `Dialog` or `Drawer`.

## Minimal example

```tsx
import { AppShell, NavGroup, NavItem, SideNav, TopBar } from "@olddevs/ui";

<AppShell
  routeKey={pathname}
  sidebar={
    <SideNav>
      <NavGroup label="Work">
        <NavItem label="Dashboard" icon={<DashboardIcon />} active asChild>
          <Link href="/dashboard" />
        </NavItem>
      </NavGroup>
    </SideNav>
  }
  header={<TopBar brand={<Logo />} actions={<UserMenu />} />}
>
  <PageContent />
</AppShell>;
```

## Props

| Prop                 | Default           | Purpose                                                                                                                                                   |
| -------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sidebar`            | —                 | Navigation on the left. On narrow screens it moves into a `Drawer`.                                                                                       |
| `header`             | —                 | The header. Usually `TopBar`.                                                                                                                             |
| `banners`            | —                 | Application-level messages above the header. Usually `Banner`.                                                                                            |
| `aside`              | —                 | The right area. An unnamed slot with no resize handle.                                                                                                    |
| `bottomBar`          | —                 | The bottom bar on narrow screens, usually `MobileTabBar`. The slot handles sticking to the bottom edge of the screen, hiding at `md` and the notch inset. |
| `bottomBarHeightVar` | `"--bottombar-h"` | The name of the variable the slot publishes its height to. `null` switches publishing off.                                                                |
| `routeKey`           | —                 | The route key. When it changes, focus moves to `<main>` and the navigation drawer closes.                                                                 |

## Banners sit above the header and are not sticky

The `banners` slot puts application-level messages in the content column, above
the header. The side navigation still spans the full height: turning the shell
from a row into a column for a node that is often empty costs more than a banner
over the side navigation is worth.

**Banners are not sticky, and that is deliberate.** The header stays at `top: 0`, and
`--topbar-h` keeps meaning exactly its height; the sticky-offset contract
(ADR-0016) and
the header publishing it
(ADR-0019) are
untouched. A sticky stack would need a second offset variable, and everything that
currently computes its offset from `--topbar-h` (`SelectionBar`, the sticky column
headers of `Table`) would have to add the stack's height. The analysis is in
ADR-0027.

A message persists because the banner never leaves the markup,
not because it is always in view: after scrolling a list the user does not see it,
but sees it again on returning to the top.

The slot has no queue: the consumer decides the order and set of banners.

## Decisions visible in the API

**Scrolling stays with the document, not with `<main>`.** The kit's sticky elements,
such as `SelectionBar`, measure their offset from the header height, and
if the content scrolled in its own container, it would sit with a gap of exactly that
height. The
ADR-0016 contract
keeps working without caveats.

**The root is positioned.** On focus the skip link gets `focus:absolute`, and
absolute positioning is resolved against the nearest positioned ancestor: without `relative` on
the root, the link of a nested shell would appear not above that shell but somewhere else on the page.

**Mobile mode switches CSS, not `matchMedia`.** The navigation column is hidden
by a class, and the drawer is shown by a class. `matchMedia` produces the wrong first frame in SSR, and
the user sees a layout jump after hydration.

**`TopBar` gets the button that opens the navigation automatically** — through the shell's context, not
through a slot: the shell receives the header already assembled by the consumer and cannot put
anything into it. Outside `AppShell` the header has no such button.

**If your header is not the kit's, use `useAppShell`.** Without `useAppShell`, navigation below
`md` is unreachable: the column is hidden, nobody can open the drawer,
and there is no warning.

```tsx
import { useAppShell } from "@olddevs/ui";

function OwnHeader() {
  const { openNavigation } = useAppShell();
  return <header>{openNavigation ? <button onClick={openNavigation}>Menu</button> : null}</header>;
}
```

`openNavigation` appears only when `sidebar` is passed to the shell; the check for
its presence is part of the contract, not a guard against `undefined`.

**The right area has no name and no resize handle.** The `aside` slot is just a place
to the right of `<main>`: it cannot be resized. A resize handle comes from a separate
component, [`SplitPanel`](split-panel.md)
(ADR-0018).

**The bottom bar slot provides everything that belongs to the shell:** it sticks the bar to the bottom
edge of the screen, hides it at `md` and wider, reserves its height in the document flow and adds the
`env(safe-area-inset-bottom)` inset for the screen notch. This is why `MobileTabBar`
([page](mobile-tab-bar.md)) carries no `fixed`, `md:hidden` or padding of its own, and
a third-party bar in the slot must not repeat them: the inset would be doubled.

**The slot publishes its height — `--bottombar-h`.** Just as `TopBar` publishes
`--topbar-h`, but for the bottom edge: the shell measures the slot wrapper (with its
border and the screen notch inset) and writes the value to the document root.
Whatever sticks to the bottom edge of the screen computes its offset from this height and sits above
the bar, not under it: `ContextualSaveBar` and `Toaster` read it themselves (the
`offsetVar` prop), and for your own sticky elements use
`bottom: var(--bottombar-h, 0px)`.

At `md` and wider the bar is hidden and the value is
`0px`; without the slot the variable does not exist, and the components that read it use the `0px` fallback,
so nothing changes on a wide screen. The name is set by the `bottomBarHeightVar` prop, for the
same reason `TopBar` has `heightVar`: the kit does not know how many shells the
document holds; `null` switches publishing off.

## Requirements for the consumer

**Always pass `routeKey`.** Without it there is no focus return on navigation, and this is a
**silent degradation**: no error and no warning
appears — focus just stays where it was, and a keyboard user
continues from the middle of the previous page after navigating.

Focus is left alone on page load, including under `StrictMode`, where effects run twice in dev.
On navigation it moves to `<main>` without scrolling to it: the router sets the scroll position,
and a scroll of its own would tuck the top of `<main>` under the sticky header.

**`TooltipProvider` is needed if the navigation collapses** — a requirement of
`NavItem`, see [SideNav](side-nav.md).

## Related sources and tests

- Implementation: `src/components/app-shell/AppShell.tsx`.
- Tests: `tests/app-shell.test.tsx` — landmarks, the skip link as the first
  focusable element, the bottom bar slot with and without the safe area, focus
  return by key (and its absence on first render, including under `StrictMode`; no scroll on navigation), the navigation button in the
  header.
- Story: `src/components/app-shell/AppShell.stories.tsx` — the `AdminEntityList`
  story without local shell primitives.

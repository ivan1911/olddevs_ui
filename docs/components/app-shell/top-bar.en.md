---
component: TopBar
exports: [TopBar]
category: app-shell
status: stable
source: src/components/app-shell/TopBar.tsx
story: src/components/app-shell/TopBar.stories.tsx
sourceHash: 53daaa81276d
---

# TopBar

## Summary for AI

The application header: brand, search and action slots, sticky positioning, a translucent
background on a theme token. It publishes **its own measured height** to a CSS variable
(`--topbar-h` by default), which `useStickyOffset` reads. This is why
`SelectionBar` sits flush under the header without a single line of code from
the consumer.

## When to use

- The application's top bar: brand, global search, notifications, the user menu.
- Inside `AppShell` or on its own — the header does not require the shell.

## When not to use

- For a page title with a description and actions — that is `PageHeader`.
- For actions on selected rows — that is `SelectionBar`; for the title, counter,
  filters and settings of a table — `TableToolbar` (since 2.2.0).
- For a dialog header — that is `ModalHeader`.

## Minimal example

```tsx
import { Avatar, Button, SearchControl, TopBar } from "@olddevs/ui";
import { BellIcon } from "@olddevs/ui/icons";

<TopBar
  brand={<Logo />}
  search={<SearchControl label="Search" value={q} onChange={setQ} />}
  actions={
    <>
      <Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />
      <Avatar name="JD" />
    </>
  }
/>;
```

## Props

| Prop        | Default         | Purpose                                                                |
| ----------- | --------------- | ---------------------------------------------------------------------- |
| `brand`     | —               | The leftmost slot: a logo, the product name.                           |
| `search`    | —               | The central slot. Takes the free space; if absent, the space is empty. |
| `actions`   | —               | Actions on the right: notifications, settings, the user menu.          |
| `children`  | —               | Extra header content: placed after the `actions` slot.                 |
| `heightVar` | `"--topbar-h"`  | The name of the height variable. `null` turns publishing off.          |
| `label`     | message catalog | The header's accessible name.                                          |

## Height contract

The header measures itself with a `ResizeObserver` and writes the height to
`document.documentElement` — where `useStickyOffset` looks for it. An observer,
not a one-off measurement: the height changes with the breakpoint and with the
wrapping of slot content, and the sticky bar under the header has to move
along with it.

**This is not the option "the kit finds and measures the header"** — the one rejected in
ADR-0016.
There the kit would have to recognize an element it does not own by a selector or attribute; here
the component measures itself, and the kit never learns which element in
this application is the header. The analysis is in
ADR-0019.

**A departing header does not remove a value it did not publish.** When it unmounts, it removes
the variable only if the variable is still its own: two headers with the same name replace
each other when navigating between screens, and otherwise the first would remove a value already
published by the second.

**Two headers in one document is a real case** (an application header and the header of
an embedded widget). They would silently overwrite each other's variable: the sticky
bars would shift to the other header's height, and it would show up not as an error but as a broken
layout. So the second header gets a different variable name, or publishing
is turned off:

```tsx
<TopBar heightVar="--widget-topbar-h" />
<TopBar heightVar={null} />
```

**An external header keeps working.** An application with a non-kit header and without `TopBar`
publishes the variable itself, as before 2.1.0 — the ADR-0016 contract is untouched.

## Related sources and tests

- Implementation: `src/components/app-shell/TopBar.tsx`.
- Tests: `tests/top-bar.test.tsx` — the landmark and its name, publishing and removing the
  variable, a custom variable name, turning publishing off.
- In a live browser: `tests-visual/interactions.spec.ts` — the published
  value matches the measured height, and the bar sits flush.
- Story: `src/components/app-shell/TopBar.stories.tsx`.

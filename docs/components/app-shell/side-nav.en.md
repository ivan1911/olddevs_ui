---
component: SideNav
exports: [SideNav, NavGroup, NavItem]
category: app-shell
status: stable
source: src/components/app-shell/SideNav.tsx, src/components/app-shell/NavItem.tsx
story: src/components/app-shell/SideNav.stories.tsx, src/components/app-shell/NavItem.stories.tsx
sourceHash: 7af78e06b543
---

# SideNav, NavGroup and NavItem

## Summary for AI

`SideNav` is the application's side navigation: a named landmark, header and
footer slots, and `NavGroup` sections with `NavItem` items. It holds the collapsed state itself
(`defaultCollapsed`) or hands it to the consumer (`collapsed` + `onCollapsedChange`);
**persisting** it is the consumer's job. `NavItem` knows nothing about the router:
the link target comes from the child element passed with `asChild` (or from `href`), and the current item is set by the
`active` prop. In collapsed mode the labels are visually hidden but remain accessible
names, and section headings are replaced by a divider line.

There is no mobile mode here: below `md`, `AppShell` moves the navigation into a `Drawer`.
`SideNav` itself is just a column, and it can be placed inside a drawer.

## When to use

- The application's main navigation on the left — an admin panel, an account area, a console.
- A single side-menu item (`NavItem`) — in the consumer's own navigation.
- Any list of links where one item is "current" and the items have icons.

## When not to use

- For tabs inside a page — that is `Tabs`.
- For the path to the current page — that is `Breadcrumbs`.
- For an action rather than navigation — that is `Button`. A navigation item leads somewhere, and
  the link role is no accident: users open it in a new tab, copy the link and see its `href`
  in the status bar.

## Minimal example

```tsx
import { NavGroup, NavItem, SideNav } from "@olddevs/ui";
import { DashboardIcon, FolderIcon } from "@olddevs/ui/icons";
import Link from "next/link";

<SideNav header={<Logo />} footer={<CurrentUser />}>
  <NavGroup label="Work">
    <NavItem
      label="Dashboard"
      icon={<DashboardIcon />}
      active={pathname.startsWith("/dashboard")}
      asChild
    >
      <Link href="/dashboard" />
    </NavItem>
    <NavItem label="Documents" icon={<FolderIcon />} asChild>
      <Link href="/docs" />
    </NavItem>
  </NavGroup>
</SideNav>;
```

The child of `NavItem` is passed **empty**: the icon and label move inside it
through `Slottable`. `Button` works the same way.

## `SideNav` props

| Prop                | Default         | Purpose                                                                                  |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `header`            | —               | The header slot: a logo, the product name.                                               |
| `footer`            | —               | The footer slot: the current user block (name, avatar), links.                           |
| `collapsed`         | —               | The collapsed state in controlled mode. If set, the component keeps no state of its own. |
| `defaultCollapsed`  | `false`         | The initial collapsed state in uncontrolled mode.                                        |
| `onCollapsedChange` | —               | Reports an intent to toggle.                                                             |
| `collapsible`       | `true`          | The built-in collapse button in the footer.                                              |
| `label`             | message catalog | The navigation's accessible name.                                                        |

## `NavGroup` props

| Prop    | Default | Purpose                                                                                         |
| ------- | ------- | ----------------------------------------------------------------------------------------------- |
| `label` | —       | The section heading and the group's accessible name. A string, not a `ReactNode`: it is a name. |

## `NavItem` props

| Prop       | Default | Purpose                                                                                                                       |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `label`    | —       | The label and the accessible name. Required.                                                                                  |
| `icon`     | —       | An icon on the left. Hidden from the screen reader: the label provides the name.                                              |
| `active`   | `false` | The current item: `aria-current="page"`, a border and a background.                                                           |
| `badge`    | —       | A counter on the right: `Badge`, a number, a dot. Not rendered in collapsed mode.                                             |
| `shortcut` | —       | A keyboard shortcut slot, usually `Kbd`. Not rendered in collapsed mode.                                                      |
| `asChild`  | `false` | Render the item as the consumer's element: `next/link`, the router's `<Link>`; the item's styles, props and `ref` pass to it. |

The other props go to the element — including `href` for the case without `asChild`.

## Decisions visible in the API

**Active state is a prop, not a computation.** The kit knows neither the router nor
the rules for comparing paths: trailing slash, query, nested routes, a locale in the
prefix — each router has its own. A mistake here shows up not as a crash but as a quietly
unhighlighted item, so that logic stays with the application —
ADR-0018.

**The label is a separate prop, not content.** In collapsed mode it has to be
wrapped, to hide it visually and keep it for the screen reader. With
`asChild` the content belongs to the child, and it cannot be wrapped.

**The collapsed state arrives through context from `SideNav`**, not as a prop on each
item: otherwise the consumer would pass one value to ten places by hand and
one day forget it in one of them.

**A prop's presence makes the mode controlled, not its value.** `collapsed={false}`
means "I control it, it is expanded now", not "there is no control". Confusing these two
cases leaves you with an external button that silently stops working.

**Widths are the `--sidenav-w` and `--sidenav-w-collapsed` tokens, not props.** The `AppShell`
grid needs the same value, and routing it through React would mean
re-rendering for something CSS reads on its own. To change them, see
[theming.md](../../theming.md).

**In the mobile-mode drawer the navigation is always expanded.** When `AppShell` shows
`SideNav` in a `Drawer`, it hides the collapse button and keeps the collapsed state from
taking effect — neither `collapsed` nor `defaultCollapsed`. Collapsed mode exists
for one purpose: to free up width for the page content, and an overlay has no page content next to it.
Removing only the button would be worse: a consumer who keeps the collapsed state
outside the component would get icons in the drawer with no way to expand them.

`onCollapsedChange` is not called in the drawer — the consumer's state belongs
to the column, and the overlay must not change it.

**The kit cannot persist the collapsed state and never will.** `localStorage`, a cookie,
the application's storage — that is up to the consumer; the component only reports
the toggle.

## Requirements for the consumer

**Collapsed navigation must sit inside a `TooltipProvider`** — otherwise Radix
throws on the very first item. The component does not create the provider itself, for
the same reason as `Segmented`: the provider sets the tooltip grouping for the whole
application, and a nested one breaks it. In expanded mode there is no tooltip,
and so no requirement.

## Related sources and tests

- Implementation: `src/components/app-shell/SideNav.tsx`, `src/components/app-shell/NavItem.tsx`.
- Tests: `tests/nav-item.test.tsx` — active state, `asChild`, the accessible name in
  collapsed mode; `tests/side-nav.test.tsx` — the landmark and its name from the message catalog,
  both modes of collapsed-state ownership, the group name with a hidden heading;
  `tests/app-shell.test.tsx` — behavior in the drawer.
- Stories: `src/components/app-shell/SideNav.stories.tsx`,
  `src/components/app-shell/NavItem.stories.tsx`.

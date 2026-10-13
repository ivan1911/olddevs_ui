---
component: MegaMenu
exports: [MegaMenu, MegaMenuCategory, MegaMenuGroup, MegaMenuLink, MegaMenuTrigger, MegaMenuButton]
category: navigation
status: stable
source: src/components/navigation/MegaMenu.tsx
story: src/components/navigation/MegaMenu.stories.tsx
sourceHash: 5e8b721746c0
---

# MegaMenu

## Summary for AI

`MegaMenu` is an Amazon-style store catalog: a category column on the left and, next to the hovered
category, its flyout with columns of links and any content of your own. It is link navigation, not a command
menu: the markup follows the WAI-ARIA Disclosure Navigation pattern (`nav`, buttons with `aria-expanded`, real
`a` elements). Categories are `MegaMenuCategory` (directly or inside your own components, server components
included), columns are `MegaMenuGroup`, links are `MegaMenuLink`. The current section and the current page are
marked with the `active` prop, as on `NavItem`. The same catalog opens as a dropdown overlay from a button: `MegaMenuTrigger` with
`MegaMenuButton` and an unchanged `MegaMenu`.

## When to use

- A catalog with ten or more sections, each with subsections in columns: a store, a marketplace, a help portal.
- The sections should be visible at once and the subsections should appear on hover, without taking the user
  off the page.
- The flyout needs content of its own next to the links: a promo card, an image, a selection.

## When not to use

- For commands on an object ("Rename", "Delete"), use `Menu`: it holds actions, not navigation.
- For application navigation with a current section, use `SideNav`.
- For a deep hierarchy that expands in place, use `TreeView`.
- For two or three links with no subsections, use a plain list of links or `Tabs`.

## Minimal example

```tsx
import { MegaMenu, MegaMenuCategory, MegaMenuGroup, MegaMenuLink } from "@olddevs/ui";

<MegaMenu aria-label="Catalog">
  <MegaMenuCategory id="computers" label="Computers" href="/computers" active>
    <MegaMenuGroup title="Laptops" href="/computers/laptops">
      <MegaMenuLink href="/computers/laptops/gaming">Gaming</MegaMenuLink>
      <MegaMenuLink href="/computers/laptops/ultrabooks" active>
        Ultrabooks
      </MegaMenuLink>
    </MegaMenuGroup>
  </MegaMenuCategory>
  <MegaMenuCategory id="deals" label="Deals of the day" href="/deals" />
</MegaMenu>;
```

## Props

`MegaMenu`:

| Prop                                       | Default   | Meaning                                                                                                           |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- |
| `aria-label`                               | —         | The accessible name of the navigation. Required: on a page with several `nav` elements, the name tells them apart |
| `value` / `defaultValue` / `onValueChange` | `null`    | The open category (its `id`) or `null`, controlled or uncontrolled                                                |
| `showcaseWidth`                            | `"40rem"` | The width of the flyout, shared by all categories so that the catalog does not jump between them                  |
| `className`                                | —         | Classes for the `nav`; the default width of the category column is `w-64`                                         |

`MegaMenuCategory`: `id` is the key for `value`; `label` is the text in the category column and the name of the
flyout; `icon`; `href` or `link` is the address of the whole section; `disabled`; `active` means the current page is in
this section; the children are the content of the flyout. For a category with a flyout, the address becomes a title link at the top of the flyout; for a
category without children, the row in the category column is itself the link. `link` is a router link passed as an
empty element (`link={<Link href="/x" />}`), and the label moves inside it. It is a separate prop rather than
`asChild` because the children of a category are its flyout.

`active` on a category sets `aria-current="true"` and gives the label the accent color, the same one a current
link gets. The mark stays whether or not the flyout is open: the route decides the current section, not hover. The
open category is still marked with a background, so one row can carry both. While no flyout is open, Tab enters the
category column on the current section. Your code decides which section is current, as with `active` on `NavItem`.

Categories don't have to be direct children of `MegaMenu`: you can split them across your own components and render
them from a Next.js server component. Each category reports itself to the column, and the column doesn't inspect its
children by type, because a server component's element arrives on the client with a different type. Before
hydration, while the categories haven't reported themselves yet, every available category is a Tab stop; after
hydration the column is a single stop again.

`MegaMenuGroup`: `title` is the title of the column and the name of its list; `href` or `link` turns the title into
a link (`link` is a router link passed as an empty element, as on a category); the children are `MegaMenuLink`
elements, and each one is placed in its own list item, including those passed in a fragment.

`MegaMenuLink`: the usual `a` props, `icon`, `active` and `asChild`. `active` sets `aria-current="page"` and the
look of the current link. The kit does not work out the current page itself, because every router compares
addresses by its own rules. `asChild` renders the link as a router element:
`<MegaMenuLink asChild><Link href="/x">Label</Link></MegaMenuLink>`. The old name, `current`, works until 5.0 and is
marked `@deprecated`: the kit calls the current navigation item `active`.

## Hover and the flyout

Hovering a category with the mouse opens its flyout at once, with no delay. Exactly one category is highlighted,
the one whose flyout is open: the highlight follows `aria-expanded`, not `:hover`. Hovering a category without a
flyout closes the open one, with the same caveat about aim as below.

The flyout closes 150 ms after the pointer has left both the category column and the flyout, so a brief
excursion past the edge does not reset the catalog. It also closes on a pointer press outside the catalog and when
focus leaves the catalog.

The content of a flyout is mounted only for the open category, so a catalog of a hundred links and images does
not load everything at once. The region itself is always there, hidden: the button's `aria-controls` points to it.

The flyout is a DOM descendant of its category, not a portal. That is why the Tab order runs "category, its
links, then on down the page", and why the flyout sits flush against the category column without any position
calculation. An ancestor with `overflow: hidden` clips it, so put the catalog where there is room beside it.

The flyout sits on the end side of the line: on the right, or on the left in right-to-left writing. If there is
not enough room there and there is enough on the other side, it moves to the other side. The kit measures the side
ahead of time and again when the window is resized, so the arrow key that points "toward the flyout" already
points to where the flyout will appear.

## Touch and narrow screens

Touch has no hover, so the touch itself (`click`) opens a category, without aim. A pointer whose `pointerType` is
"touch" or "pen" neither opens a category on hover nor closes the flyout when it leaves: a pen behaves like a
finger. Touching an open category again neither closes it nor goes anywhere. The flyout closes on a touch outside
the catalog or on Escape.

The mouse behaves as before: hover, aim and closing after 150 ms all remain while the screen is wide.

On a narrow screen, under 640px (the same breakpoint as `Menu` submenus and Editor submenus), there is no room beside
the category column for the flyout: the edge of the window would cut it off on the right. So the catalog works as a
drill-down:

- The category column takes the full width, and category labels wrap instead of being truncated.
- An open category (by touch, click, Enter or Space) replaces the category column with its flyout. The flyout
  starts with a "Back" row that shows the category name. If the category has a link of its own, the link shows the
  name, on the row below, instead of the "Back" row. Below that, the columns of links follow, one under another.
- "Back" returns the category column and puts focus on the category the person came from. Escape inside the flyout
  works like "Back".
- When you drill down, focus moves to "Back": the category button is hidden along with the category column, and focus
  left on it would be lost. In the flyout on a narrow screen, the arrow key toward the category column does
  nothing, because the column is not beside it.
- There is no aim on a narrow screen: hovering with the mouse does not open a category, and moving the mouse away does
  not cancel the drill-down. Replacing the column under the cursor would pull it out from under the person's hand.
- The markup stays on the disclosure pattern: the category button keeps `aria-expanded` and `aria-controls` pointing
  to the region on screen (the button itself is hidden during the drill-down), and the region is named after the
  category.

The "Back" label comes from the message catalog: the key is `megaMenu.back`, with the default "Back"; the Russian
catalog supplies "Назад".

The kit reads the width through `matchMedia`, not through CSS, because the width determines the contents of the
markup (the category column is hidden), not just the look. Before hydration and on the server, the hook reports a wide
screen (ADR-0018): the server does not know the width, and the markup it produces is always the regular one. On a phone,
after hydration, a flyout opened by `defaultValue` is re-rendered once as a drill-down. On a phone the `nav` takes
the full width through the `max-sm:w-full` class; a `w-*` class from `className` applies on a wide screen.

## Aim

On its way from a category to its flyout, the pointer cuts diagonally and brushes against the neighboring
categories. If hover opened them at once, the flyout would change under the person's hand, and the links would be
out of reach. Aim watches where the pointer is heading: while it moves toward the open flyout, a neighboring
category does not take over the hover.

- The direction of the pointer's last step is compared with the wedge from its previous position to the two corners
  of the flyout's near edge: Kamens's triangle from "Where it comes from". A step into the wedge means the pointer
  is aiming.
- One movement off course is forgiven; two in a row are not, and then the category under the pointer opens.
- If the pointer stops for 300 ms, the category under it opens even if it was aiming. The menu does not get stuck.
- When the pointer reaches the flyout, the deferred switch is canceled.
- Clicking a category opens it at once, bypassing aim. The keyboard knows nothing about aim.
- Mouse only, and only on a wide screen: touch and pen open a category at once, and a narrow screen has no aim at all.
- The first hover, while there is no flyout yet, opens the category with no delay at all: there is nothing to aim at.

The model is the same as for react-aria submenus (`Menu` with `SubmenuTrigger`), so that the two menus of the kit
behave alike. There are two differences. The category switch is deferred, not suppressed with `pointer-events: none`
on the category column, since that would lose the highlight under the pointer and the click on a neighboring category.
And the stop time is 300 ms, as in Kamens's plugin (more on it in "Where it comes from"), not a second, as in react-aria: its submenu is short, while the
category column of a catalog gets scrolled through.

## Where it comes from

The technique comes from Amazon. By 2013 the "Shop by Department" menu on amazon.com already worked like this: a
column of departments on the left, a large panel on the right, switching with no delay at all, and yet the pointer
could cut diagonally toward the panel without knocking it away.

**The trap that menus closed with a delay.** If a submenu switches at once, the pointer brushes a neighboring item on
its way there, the submenu changes, and the link you were heading for is gone: a game you can't win. Bootstrap's
dropdowns behaved like this, for example. The usual fix is a delay before switching items, known as menu hysteresis,
as in Khan Academy's own earlier menu. It closes the trap but makes the menu sluggish: every move between items waits
for a timer.

**What Ben Kamens noticed.** The Khan Academy developer saw that Amazon's menu switches instantly and still doesn't
lose the submenu, and worked out why. The menu watches direction, not time: at each pointer position it builds a
triangle with corners at the pointer itself and at the top and bottom corners of the submenu. If the next position is
inside the triangle, the user is heading for the submenu, and items brushed on the way don't take it over. Once the
pointer leaves the triangle, the submenu switches immediately. Kamens published his analysis on 6 March 2013.

![Amazon's menu: the triangle from the pointer to the top and bottom corners of the submenu](https://ui.olddevs.ru/images/mega-menu/amazon-triangle.gif)

_Animation from [Ben Kamens's post](https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown), as
reproduced in the Habr retelling._

**The plugin and the math.** Kamens turned the idea into a jQuery plugin, `jQuery-menu-aim`, and used it in Khan
Academy's new "Learn" menu. Whether a point lies inside a triangle can be checked with cross products, and Sophie
Alpert helped him with that bit of linear algebra, but in the plugin Kamens went with something simpler: comparing
the slopes of lines. A pointer that entered the triangle and stopped still opens the item under it, after 300 ms.
Kamens was happy to admit he had copied Amazon, and suspected the problem had been solved and forgotten many times
before.

**The response.** The next day, 7 March 2013, a retelling titled "The riddle of Amazon's dropdown" appeared on Habr,
and the technique spread across the Russian-speaking web: as of October 2026 the article has more than 550 votes and
two thousand bookmarks. The retelling also notes that the idea isn't new: it had been invented, forgotten and
rediscovered before.

**What came next.** The technique moved into libraries: the "safe polygon" `safePolygon()` in Floating UI, the "grace
area" of submenus in Radix, the "safe triangle" `useSafelyMouseToSubmenu` in react-aria. Submenus shipped in
react-aria as an alpha on 13 February 2024 (v1.1.0) and became stable on 1 May 2024 (v1.2.0). The kit's `MegaMenu`
(2026) checks the wedge with cross products, following react-aria's model, and takes its pause from Kamens: the same
300 ms.

Primary sources:
[Ben Kamens's article](https://bjk5.com/post/44698559168/breaking-down-amazons-mega-dropdown),
[the `jQuery-menu-aim` repository](https://github.com/kamens/jQuery-menu-aim),
[a retelling on Habr, in Russian](https://habr.com/ru/articles/171905/).

## Keyboard and names

- The category column is a single Tab stop. The Up and Down arrows, Home and End move through the categories;
  disabled ones are skipped. When the user comes back with Tab, they land on the category they were on; the first
  time, on the open one, otherwise on the current section (`active`), otherwise on the first one.
- Typing a letter on a category moves focus to the next category whose label starts with it, wrapping around; the
  same letter again moves to the one after. Letters typed in quick succession match the start of a label, and a
  half-second pause clears them. A letter with Ctrl, Cmd or Alt is a keyboard shortcut, and the catalog leaves it alone.
- Enter, Space and the arrow toward the flyout open it and put focus on the first link. On a category that is a
  link, Enter follows it.
- Inside the flyout, plain Tab works. The arrow toward the category column returns focus to the category, and so
  does Escape, which also closes the flyout. Tab past the last link moves on down the page and closes the flyout.
- While the flyout is open, it follows focus moved by arrows and letters the way it follows hover.
- The arrow "toward the flyout" is the one that points to where the flyout sits: in right-to-left writing and at
  the edge of the screen, the arrows swap places.
- A screen reader hears a navigation with the name from `aria-label`, the categories as expand/collapse buttons, the
  flyout as a region named after the category, and a column as a list named after its title.

## Dropdown mode

A catalog in a page header is opened with a "Catalog" button rather than kept on the page. The markup of the
categories is the same as in the embedded mode; only the wrapper changes: put `MegaMenu` into `MegaMenuTrigger`
as the second child, after the `MegaMenuButton`.

```tsx
import {
  MegaMenu,
  MegaMenuButton,
  MegaMenuCategory,
  MegaMenuGroup,
  MegaMenuLink,
  MegaMenuTrigger,
} from "@olddevs/ui";
import { ListIcon } from "@olddevs/ui/icons";

<MegaMenuTrigger>
  <MegaMenuButton icon={<ListIcon size={16} />}>Catalog</MegaMenuButton>
  <MegaMenu aria-label="Catalog">
    <MegaMenuCategory id="computers" label="Computers" href="/computers">
      <MegaMenuGroup title="Laptops">
        <MegaMenuLink href="/computers/laptops/gaming">Gaming</MegaMenuLink>
      </MegaMenuGroup>
    </MegaMenuCategory>
  </MegaMenu>
</MegaMenuTrigger>;
```

`MegaMenuTrigger`: `open`, `defaultOpen` and `onOpenChange` control whether the overlay is open, controlled or
uncontrolled, as with other overlays of the kit. The first child is the button, and all the others go into the
overlay. Children are sorted by position, so you can wrap the button in a component of your own and move `MegaMenu`
into one. `MegaMenuButton` accepts the kit's button look (`variant`, `tone`, `size`, `iconOnly`, `selected`), `icon`,
`disabled`, `aria-label` and `className`; the look is the same as for `MenuButton`.

- **Opening.** Click, Enter, Space and the Down arrow on the button. Hover does not open the catalog: it should not
  jump out at a stray mouse movement.
- **Focus.** On opening, focus goes to the first available category (or, if one is already open through `value` or
  `defaultValue`, to that one), and the flyout stays closed until a category is chosen. After that the category column
  and the flyout work as in the embedded mode.
- **Closing.** Escape on a category, a press outside the catalog, a second click on the button, following any link (a
  category, a column title, a `MegaMenuLink`, router links included) and Tab past the last element.
  The first Escape inside a flyout closes only the flyout and returns focus to its category; the next one closes
  the overlay.
- **Returning focus.** Focus returns to the button on Escape and on a second click. After Tab past the last element,
  focus moves on down the page, past the button; Shift+Tab before the first element returns it to the button. After a
  press outside the catalog, focus stays where the user pressed.
- **Screen reader.** The button is a disclosure with `aria-expanded` and `aria-controls` and no `aria-haspopup`: the
  overlay is neither a menu nor a dialog, but the same navigation with links. The overlay has no `dialog` role.
- **Layers.** The overlay sits on the `popover` layer: above the scrim of an open `Dialog`, below the confirmation.
  Inside a dialog, the first Escape closes the catalog and the next one closes the dialog. If focus is in an open
  flyout, the very first Escape closes only the flyout and returns focus to its category.
- **Narrow screens.** Under 640px the overlay spans the window, minus 8px at each edge, instead of shrinking to the
  longest label: labels wrap, a long one can't push the catalog off screen, and the width stays put when you drill
  into a category. The drill-down, "Back" and Escape work inside the overlay just as in the embedded mode: the first
  Escape in a flyout brings the column back, the next one closes the catalog.
- **Height.** The overlay is no taller than the visible area from the button to the edge of the window. The category
  column and the flyout each scroll within themselves (`overscroll-contain`), not the overlay as a whole: otherwise the
  overlay's frame would clip the flyout, which stands beside the category column. On iOS the height is capped at
  `min(24rem, 60dvh)`, like the `Menu` panel.
- **Appearance.** Smooth, on the kit's motion scale; with `prefers-reduced-motion`, no animation.
- **Server.** The server renders a closed button; the overlay is mounted in a portal after opening.

## Related sources and tests

- Implementation: `src/components/navigation/MegaMenu.tsx`; aim is in `src/components/navigation/useMenuAim.ts`.
- Tests: `tests/mega-menu.test.tsx` covers roles and `aria-controls`, hover and mounting only the open
  flyout, closing with a delay, roving tabindex, Enter, Escape and the arrows, Tab past the last link,
  a category that is a link, a disabled category, `active` and the `current` alias, `asChild` and `link` (on a
  category and on a column), fragments in a column, the current section and the Tab stop, typeahead, categories
  inside your own components, the controlled value, a press outside the catalog and server rendering; `tests/mega-menu-aim.test.tsx` covers aim on mocked geometry and fake
  time, and the flip at the edge; `tests/mega-menu-touch.test.tsx` covers touch and pen, a mocked `matchMedia`,
  the drill-down in place of the category column, "Back" and focus, Escape, labels from the message catalog, the
  drill-down with categories inside your own components and server rendering; the browser test
  `tests-visual/mega-menu.spec.ts` uses a real mouse moving diagonally and down the category column, and checks the
  width of the dropdown on a phone.
- Dropdown mode: `tests/mega-menu-dropdown.test.tsx` covers opening by click and keys with focus on the first
  category, every way of closing and returning focus, Escape in the flyout, `open` / `defaultOpen` / `onOpenChange`, the
  `popover` layer, the order of Escape inside a `Dialog`, the drill-down on a narrow screen and server rendering.
- Story: `src/components/navigation/MegaMenu.stories.tsx`, including `DropdownInTopBar`, a mega menu in a top bar; at phone
  width, `PhoneColumn`, `PhoneDrillDown`, `PhoneDropdown` and `PhoneDropdownDrillDown`.

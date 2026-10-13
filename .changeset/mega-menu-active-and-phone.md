---
"@olddevs/ui": minor
---

`MegaMenu` marks the current section and works better on phones and with server components:

- `MegaMenuCategory` takes `active`: the row gets `aria-current="true"` and the accent color, and with no flyout open, Tab enters the column on that category.
- `MegaMenuLink` takes `active` for the current page, as `NavItem` does. `current` still works and is deprecated until 5.0.
- `MegaMenuGroup` takes `link`, a router link for the column title, like `link` on a category. Links passed in a fragment now each get their own list item.
- Typing a letter in the category column moves focus to the next category that starts with it.
- On screens under 640px the dropdown spans the window instead of shrinking to its longest label, so it no longer changes width when you drill down or gets pushed off screen by a long label.
- Categories rendered from a Next.js server component or wrapped in your own components now work fully: the column has a Tab stop before hydration, and on a narrow screen a `value` that names a category without a flyout no longer blanks the catalog.
- The reference calls the area next to the column the flyout ("Полка" in Russian); the width prop is still `showcaseWidth`.

`Menu` accepts the logical `end top` and `start top` in `placement`, which swap sides in right-to-left writing.

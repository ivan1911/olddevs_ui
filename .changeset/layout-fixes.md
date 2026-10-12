---
"@olddevs/ui": patch
---

`VirtualGrid` cells whose content is `h-full` now fill the whole row instead of collapsing to one line of text.

`Accordion` sections no longer carry 12px of extra height when collapsed.

`AvatarGroup` in size `md` overlaps its circles less, so initials and the "+N" remainder are no longer clipped.

`Select` opens its panel 4px below the whole trigger pill instead of overlapping its bottom edge; the panel now lines up with the pill's left edge rather than the button inside it.

`MobileTabBarItem` badges are pinned to the top-right corner of the icon and grow to the right, so wide badges such as "99+" no longer cover the icon.

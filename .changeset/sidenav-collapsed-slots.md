---
"@olddevs/ui": minor
---

`SideNav` slots now know when the navigation is collapsed. The new `useNavCollapsed()` hook lets `header` and `footer` content switch to an icon-mode layout, such as an avatar without the name and role, and returns `false` outside `SideNav` and in the mobile drawer. The header and footer now clip anything wider than the column, so a slot that doesn't adapt no longer spills over the page content.

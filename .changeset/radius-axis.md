---
"@olddevs/ui": minor
---

Add the `radius` axis: set `data-radius` to `none`, `small`, `medium` (the default) or `large` on `<html>` or on any element to change the corner shape of the whole kit, the Editor included. Without the attribute nothing changes. The theme registry gains `UI_RADII`, `normalizeRadius` and `UiRadius`; `applyTheme` and `themeInitScript` handle the axis, and the storage format gets a `radius` field. New utilities: `rounded-2xs` and `rounded-pill`. Pills (Badge, Chip, Tag, the Toggle track) follow the preset; circles do not.

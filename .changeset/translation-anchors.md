---
"@olddevs/ui": patch
---

The link to "Viewing with a carousel in a `Dialog`" in the English Carousel page leads to the section again: in-page links in a Translation use the Original's anchors (ADR-0062). `docs/**/*.en.md` links are now checked against the Original's heading anchors by `tests/docs-translations.test.ts`, so a Latin anchor fails before the release.

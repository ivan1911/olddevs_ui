---
"@olddevs/ui": minor
---

**The Editor engine moves to Tiptap 3.32.0.** All `@tiptap/*` packages of the install command now take the range `^3.32.0` (was `^3.31.4`); keep them at one version, as before. The command also gains `@tiptap/extension-mathematics` and `katex@0.18.10` for the `mathematics` Tool (ADR-0070): `katex` is pinned because 0.18.11 was published with breaking changes, and the Tiptap extension does not support 0.19 yet.

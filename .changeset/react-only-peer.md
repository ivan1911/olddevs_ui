---
"@olddevs/ui": minor
---

React is now the kit's only peer dependency (ADR-0072). The kit brings every other library itself, so the install command becomes `npm install @olddevs/ui react`.

- **`@internationalized/date`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-slot`, `@radix-ui/react-tooltip`, `clsx`, `lucide-react`, `react-aria-components`, `sonner` and `tailwind-merge` move from `peerDependencies` to `dependencies`, with the same ranges.** Nothing breaks: an app that already lists them keeps working, and it can drop the lines it does not import itself.
- `@olddevs/ui/icons` now exports `LucideProvider`. Import it from there rather than from `lucide-react`: lucide comes with the kit, and a provider from a second copy in your app never reaches the kit's icons. Likewise, import `toast` from `@olddevs/ui`, not from `sonner`.
- An app that uses Radix, `react-aria-components` or `@internationalized/date` directly should keep its range compatible with the kit's. npm no longer stops the install over a mismatch; a mismatch gives the app a second copy, whose layers and contexts the kit's components do not see.

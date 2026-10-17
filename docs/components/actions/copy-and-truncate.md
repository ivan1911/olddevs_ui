---
component: CopyButton and Truncate
exports: [CopyButton, Truncate]
category: actions
status: stable
source: src/components/actions/CopyButton.tsx
story: src/components/actions/CopyButton.stories.tsx
---

# CopyButton and Truncate

## Summary for AI

Two small things that get rewritten in every project: copying a value to the
clipboard with clear feedback, and truncating text with a tooltip showing the
full value.

## When to use

- `CopyButton`: an identifier, a key, a link — something people copy rather than read.
- `Truncate`: a long name in a table column, in a card, in a list.

## When not to use

- Do not use `CopyButton` to copy a selection from the page: that is the browser's job.
- Do not use `Truncate` for text that can wrap: truncation loses content, wrapping
  does not.
- Do not wrap markup in `Truncate`: it takes a **string**, because it shows the
  same value in the tooltip.

## Minimal example

```tsx
import { CopyButton, Truncate } from "@olddevs/ui";

<CopyButton value="ACME-4217" size="sm" variant="ghost" />;

<Truncate>{file.name}</Truncate>;
```

## CopyButton

| Prop         | Default | Purpose                                     |
| ------------ | ------- | ------------------------------------------- |
| `value`      | —       | What to copy.                               |
| `children`   | —       | Label. Without it the button is icon-only.  |
| `resetDelay` | `2000`  | How long to hold the "copied" state, in ms. |
| `onCopy`     | —       | The outcome of the copy: `true` or `false`. |

**The result is announced, not just shown as a different icon.** The checkmark
is a signal for the eyes; a screen reader user who presses the button would
otherwise not know whether it worked. A live region, always mounted, sits next
to it, and the button's name changes along with the state.

**A clipboard failure is an expected outcome.** `navigator.clipboard` is absent
in an insecure context (a page served over `http`), and writing can be blocked by
permission settings. When the copy fails, the button says so instead of crashing
or pretending to succeed, and the value stays available for selecting by hand.

## Truncate

| Prop       | Default | Purpose                          |
| ---------- | ------- | -------------------------------- |
| `children` | —       | The text. A string, not markup.  |
| `lines`    | `1`     | How many lines to show.          |
| `side`     | `top`   | Which side the tooltip opens on. |

**The tooltip appears only on text that is actually truncated.** A tooltip on
text that is not truncated is noise: it repeats what is already visible and teaches
people to ignore it.

Truncation is **measured** (`scrollWidth > clientWidth`, and with `lines` above one also `scrollHeight > clientHeight`), not guessed from the
string length: how many characters fit depends on the container width and the
font. The measurement repeats when the size changes — a table column dragged
with the mouse changes truncation without changing the text.

**The full value is reachable from the keyboard:** truncated text gets
`tabIndex={0}`, and the tooltip opens on focus the same way it does on hover.
Without this the value would be available only to mouse users.

A screen reader reads the whole text without our help: truncation is visual, and
the full string is in the DOM.

`Truncate` requires a `TooltipProvider` at the app root — like any `Tooltip`.

## Anti-patterns

- Changing only the button's icon without announcing the result.
- Assuming that copying always succeeds.
- Attaching a tooltip to all text, whether it is truncated or not.

## Related sources and tests

- Sources: `src/components/actions/CopyButton.tsx`, `src/components/actions/Truncate.tsx`
- Tests: `tests/copy-button.test.tsx`, `tests/truncate.test.tsx`
- Showcase: `src/components/actions/CopyButton.stories.tsx`,
  `src/components/actions/Truncate.stories.tsx`

---
component: Rating
exports: [Rating]
category: inputs
status: stable
source: src/components/inputs/Rating.tsx
story: src/components/inputs/Rating.stories.tsx
---

# Rating

## Summary for AI

`Rating` is a star rating. `value` and `onChange` work with a **number**, not a set of stars. The keyboard model is a radio group: the whole rating is one tab stop. There are no fractional ratings (half stars).

## When to use

- The user gives a rating: the quality of ticket handling, a review, a priority.
- A rating has to be shown: the average score of a card, the result of a check.

## When not to use

- For a "mine" mark, use `FavoriteIcon` in a separate button, not a rating: a favorite is a "mine" mark, a rating is a quantity.
- If the quantity is continuous or the range is wide, use `Slider`.
- If there are only two values, use `Toggle`.

## Minimal example

```tsx
<Rating value={value} onChange={setValue} aria-label="Quality" />
```

## Public API

- `value` and `onChange` work with a number. Without `onChange` the component only shows the rating and does not enter the tab order.
- `max` — how many stars in total, five by default. The value is coerced to an integer of at least one: a scale of zero divisions is not a scale, and the number comes from the consumer's data, so the component must not crash on it.
- The component tolerates a fractional `value` (see below); `NaN` is treated as zero: no stars are filled and the announcement is "Rated 0 out of N".
- `onChange` is **not called** when the value has not changed: an arrow key at the edge and a click on an already selected star stay silent — the handler would read a call without a change as an edit.
- `size`: `sm` for a table row, `md` by default.
- `readOnly` — display without input; `disabled` — an unavailable action. These are **different** states, see below.
- `caption` — a label next to it ("4.2 · 128 ratings"). The kit does not compute it: the average and the number of votes are known to the consumer.
- `aria-label` is required.

## Keyboard — a radio group, not a set of buttons

Arrow keys change the value, `Home` goes to zero, `End` to the maximum, Tab leaves
the group as a whole. Five tab stops for one question is five stops where the
answer is one; hence the `radiogroup` role.

Exactly one star is in the tab order — the selected one, and with a zero rating
the first (roving `tabindex`). Focus follows the value: otherwise the next arrow key
would count from the previous star while the new value has already been announced.

Zero is a legitimate value: the rating can be cleared by decreasing it from one with an arrow key,
and with `Home`.

## `readOnly` and `disabled` are different states

Read-only is **displayed data**: dimming it would hide what is shown on purpose. A
disabled control is an **action unavailable right now**, and it is dimmed. The
first stays bright and leaves the tab order, the second fades.

The role does not change: a disabled rating stays a `radiogroup` and is marked
`aria-disabled`. `role="img"` would be read as a picture, not as an unavailable
action. The role is a property of the control, not of its availability right now.

## There are no fractional ratings — but the component tolerates a fractional value

The `allowHalf` axis was not introduced, yet the type of `value` is a plain
number, and the component accepts a fractional one for the fill: at `4.2` four
stars are filled. So the tab stop is set by the **rounded** value. Without
rounding no star would match, the roving `tabindex` would put the tab stop nowhere, and the
radio group would become unreachable from the keyboard altogether — silently,
without a single red check.

## There are no fractional ratings

Half a star is needed for displaying an average, not for input. Displaying an
average is solved by a label ("4.2 · 128 ratings"), which is more precise than
half a star and does not require explaining what a half-filled star means when it is used for input.

## The star color is its own token

It is the `--rating-star` token of the component layer
(ADR-0040), not
`--warning`. Today they point to the same amber palette primitive, and that is the trap:
changing the warning color would silently repaint all the ratings in the product,
and people would look for the cause in `Rating`.

An unfilled star takes `--fg-3` (`text/muted-2`): it reads as "not selected", not
as "unavailable". The `npm run contrast` gate checks two pairs against the non-text threshold: the filled star
(`--rating-star`) on `--bg-1` and the empty star (`--fg-3`) on `--bg-1`. The row of stars carries the quantity visually.

## Accessibility and semantics

- The group name is **composed** of the consumer's label and the quantity ("Quality Rated 4 out of 5" — `aria-labelledby` joins the parts with a space), and not replaced by one of the two: a quantity without a subject does not answer "of what", and a subject without a quantity does not state the value.
- In an interactive rating each star is a `radio` with its own name "N of M" and its own `aria-checked`; in the display-only mode the whole group is an `img` with the same composite name.
- Color is not the only cue: the number of filled stars and the announced text say the same thing.
- See `src/components/inputs/Rating.tsx`, `src/components/inputs/Rating.stories.tsx`, `tests/rating.test.tsx`.

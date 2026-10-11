---
component: Transfer
exports: [Transfer, TransferItem]
category: inputs
status: stable
source: src/components/inputs/Transfer.tsx
story: src/components/inputs/Transfer.stories.tsx
sourceHash: a447ca595caa
---

# Transfer

## Summary for AI

`Transfer` is a pair of columns with items moved between them: what can be chosen on the left, what is selected on the right. Controlled: `items` is all the items at once, `value` is the keys of those that ended up on the right. The order of `value` matters and is preserved.

## When to use

- Assigning permissions, roles, members, territories — anywhere "what exists" and "what is granted" must be seen side by side.
- There are many selected items and the order of assignment matters.
- The user needs to see what remains unselected, not only what is selected.

## When not to use

- If one value or several are picked from a short list, use `Select` with `multiple`.
- If values are typed as free input, use `TagInput`.
- If the choice follows a hierarchy, use `TreeSelect`.

## Minimal example

```tsx
<Transfer
  items={allPermissions}
  value={granted}
  onChange={setGranted}
  sourceLabel="All permissions"
  targetLabel="Granted to the role"
  searchable
/>
```

## Public API

- `items` is **all** the items at once, regardless of column. One list, not two: two would drift apart at the first edit, and an item forgotten in both or missing from both would show no sign of it. `id` must be unique: the react-aria collection collapses duplicates, and one of the items silently disappears from the screen.
- `value` and `onChange` work with the keys of the right column. The order matters: it is the order of assignment. The kit does not show or count a key that is not in `items`, and does **not drop** it either — it survives the moves untouched. Dropping it would mean silently editing the consumer's value.
- `sourceLabel` / `targetLabel` are the column labels; without them they come from the message catalog.
- `searchable` adds a search field above each list. The button moves **only what is visible**, that is, what the user sees; a selection hidden by the filter does not move.
- `disabled` dims the whole control: both columns and both buttons. It differs from `TransferItem.disabled`, which applies to a single item that is shown but cannot be moved.
- `aria-label` gives the pair of columns a name, and then it is announced as a group. Without a name the group is not announced: an unnamed group is an extra announcement in the screen reader output that is followed by nothing. The same rule applies to `ButtonGroup`.
- `TransferItem.disabled` — the item is shown but can be neither moved nor selected.

## Size ceiling

There is no virtualization: every item gets a DOM node. The measured delay of one
keystroke in the search field is about 16 ms for 200 items, about 56 ms for 1000,
about 187 ms for 3000. Up to a few hundred items the component is comfortable to use; beyond that
you start to notice lag when typing.

Memoization does not help here and was deliberately not added: the render body costs
about a millisecond even at 20,000 items, and everything is spent in
React and in rebuilding the collection. If you need thousands, that is not a prop but
a decision about virtualization.

## Selection and value are different things

The highlight inside a column lives in the component and does not survive a move.
The value — what is in which column — is passed in and out through props. The component
does not mix them: otherwise "highlighted" and "granted" would become one state, and
removing the highlight would be impossible without taking the permission away.

## The counter counts the column, not the filter

The number in the header is the count of everything in the column, regardless of the
search: it answers the question "how many permissions are available in total", and
the filter is only a view of them. It is also part of the list's accessible name —
otherwise the number is on the screen but not in the screen reader output.

## Select all

`Ctrl` / `Cmd` + `A` inside a column is a standard react-aria shortcut, and it yields the
special value "all", not a set of keys. The kit expands it into the keys of its own
column: otherwise the most common scenario — select all and move — would disable
both buttons. Disabled items are not moved: select all does not mean bypassing
the restriction.

## Focus after a move

This is the only decision the component makes itself. After a move the selected items vanish
from the list — together with the one that had focus. react-aria has no handling for
this case: the collection changed, and focus goes to `body`, that is, to the start
of the document.

**The rule: focus follows the items.** It lands on the first moved item, and
all the moved ones become the selection there — so they can be moved back without
selecting again.

Focus is set one frame after the commit, and this is not an optimization: `ListBox`
builds its collection in a separate pass, and right after the commit it does not yet
contain the moved item — but it does contain the one that was in the column
before. Setting focus synchronously landed on exactly that item.

The alternative "leave focus on the button" breaks on the very first full move: the
button dims because there is nothing left to move, and focus is lost anyway.

## A disabled item

It is shown but not moved. Hiding it would misrepresent which permissions exist —
the user would not see that the permission exists at all; moving it would bypass
the restriction. The move button stays disabled if only disabled items are
selected.

## Accessibility and semantics

- Each column is a `listbox` whose name is made of the label and the counter; the items have the `option` role, with multiple selection. The keyboard, typeahead and roles come from the react-aria `ListBox`.
- The move buttons are named by direction ("Move to selected"), not by an arrow: "right" says nothing about the meaning.
- The name of the search field is parameterized by the column label: there are two fields, and "Search" on both does not tell them apart at all.
- An empty column says "Empty", an empty search result — "Nothing found"; both strings are from `common`, the component adds no keys of its own for them.
- See `src/components/inputs/Transfer.tsx`, `src/components/inputs/Transfer.stories.tsx`, `tests/transfer.test.tsx`.

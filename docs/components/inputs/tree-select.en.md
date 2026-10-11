---
component: TreeSelect
exports: [TreeSelect]
category: inputs
status: stable
source: src/components/inputs/TreeSelect.tsx
story: src/components/inputs/TreeSelect.stories.tsx
sourceHash: 992d056f99b6
---

# TreeSelect

## Summary for AI

`TreeSelect` is a field that picks a node of a hierarchy: a [`TreeView`](../navigation/tree-view.md) inside a [`Popover`](../overlays/popover.md). Controlled; `value` is **always an array**, even for a single selection. Checking a branch does not check its descendants.

## When to use

- The value is picked from a tree: a division, a folder, a category, a permissions scope.
- The tree is long and there is no reason to keep it expanded on the screen.

## When not to use

- If there is no hierarchy and the list is flat, use `Select`.
- If the tree is the content of the screen rather than the value of a field, use `TreeView`.
- If the number of levels is fixed and the whole path matters, you need a cascading field; the kit has none, and ADR-0038 explains why.

## Minimal example

```tsx
<TreeSelect
  items={divisions}
  value={value}
  onChange={setValue}
  aria-label="Division"
  defaultExpandedKeys={["company"]}
/>
```

## Public API

- `items` are nodes in the `TreeNode` format; it is the same format as in `TreeView`, not a copy of it. A node encountered a second time during the traversal is not expanded further: a cycle in the data must not turn into a stack overflow.
- `value` and `onChange` always work with an **array of keys**, both with `multiple` and without it.
- `multiple` turns on multiple selection and changes the look of the closed field: chips instead of a label.
- `placeholder` is the text shown in an empty field. Defaults to the text from the message catalog.
- `defaultExpandedKeys` — which nodes are expanded on first render; `expandedKeys` + `onExpandedChange` — controlled expansion. The second is for consumers who expand the tree to the current value or load branches on demand (lazy loading): without it a deeply nested selected node opens on a collapsed tree where nothing points to it.
- `clearable` shows a clear button when something is selected; `clearLabel` sets its accessible name, as in `Select`.
- `disabled` keeps the field from opening and closes one that is already open.
- `aria-label` is required: for an unnamed field a screen reader announces only the value and "button", not what the field is for. `aria-label` becomes part of the field name together with the value, not instead of it.
- A key that is not in `items` is shown **as the key itself**. Hiding it would give a field that says "nothing selected" while reporting a non-empty value to the consumer; dropping it would silently edit the consumer's value.
- With `multiple` no more than three chips are shown; the rest collapse into "+N more": a field that grows by five rows stops being a field. To see exactly what is selected, open the tree.

## Composition, not a second tree

This implements ADR-0024,
which postponed `TreeSelect` until the first screen needed it and described it as a `Tree` inside a `Popover`.
The component adds no node traversal of its own, no keyboard of its own and no
roles of its own — `TreeView` already has all of that. The `treegrid` role inside
the popover comes from there too.

A divergence between two trees would be noticeable only to someone who puts them
side by side. It would be discovered late and at great cost.

## The value is always an array

A union type `Key | Key[]` would make the consumer parse the shape of the value in
every handler. The only gain would be a shorter-looking example.

## Checking a branch does not check descendants

This is a decision, not an oversight. Checking descendants would mean the kit decided
for the consumer whether a "department" includes all its employees — and in access
rights those are exactly opposite policies. `TreeView` keeps the selection by keys,
and expanding a branch into its descendants in the consumer's code is one function over
`items`; inside the kit it would be a decision that cannot be undone.

## Keyboard

- The field is a regular button: Enter and Space open it, Escape closes it and returns focus to the field.
- Inside, the `TreeView` keyboard support applies: arrow keys, `Home`, `End`, typeahead.
- Delete and Backspace on the field clear it when `clearable` is set — shorter than tabbing to the clear button, which is also a tab stop.
- A single selection closes the popover; a multiple one leaves it open: the selection is not finished yet, and every close would force the user to reopen the popover after each node.

## Accessibility and semantics

- The field name is assembled from a hidden label and the content through `aria-labelledby`, not taken from `aria-label` on the button. `aria-label` wins over the content when the name is computed, and the field would be announced as "Division, button" — without a single word about what is selected. For a selection field that is a failure of the main function, and an axe audit does not catch it: the button has a name.
- The clear button is a **sibling** of the trigger, not its descendant; the technique is the same as in `Select`. A button inside a button is `nested-interactive`, and an `aria-hidden` clear button inside drops out of the accessibility tree entirely: a user of assistive technology (AT) does not learn that clearing exists.
- The tree inside the popover gets the same name as the field: otherwise a screen reader would announce "Division" followed by an unnamed tree.
- An empty tree says `common.empty` — "Empty", not `notFound`: the field has no search of its own, and the user has not entered any query that could return "nothing found".
- `aria-haspopup` is declared as `grid`: the popover contains `TreeView`, which renders a `treegrid` with `row` nodes. The declared type must match what is really there.
- See `src/components/inputs/TreeSelect.tsx`, `src/components/inputs/TreeSelect.stories.tsx`, `tests/tree-select.test.tsx`, [TreeView](../navigation/tree-view.md).

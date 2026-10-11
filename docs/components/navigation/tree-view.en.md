---
component: TreeView
exports: [TreeView]
category: navigation
status: stable
source: src/components/navigation/TreeView.tsx
story: src/components/navigation/TreeView.stories.tsx
sourceHash: 8c71d43035a9
---

# TreeView

## Summary for AI

A hierarchy with expansion, selection and keyboard support, built on react-aria's `Tree`.
It stores no state: expanded and selected nodes arrive as sets. The selection
mode is turned on by `selectionMode` — without it there are no checkboxes at all.
The current navigation node (an article tree) is marked with `activeKey` — that is
`aria-current="page"` with no checkboxes and no selection.

## When to use

- A tree of categories, folders, help sections, an organization's structure.
- A list where nesting matters and has to be expanded.
- Navigating a tree of articles, sections, documents: the open page is marked
  with `activeKey`, and `onAction` handles navigation.

## When not to use

- For a flat list with selection, use `Select` or `CheckboxGroup`.
- For picking from a hierarchy in a field — the kit has no such component (`TreeSelect`):
  it is assembled from `TreeView` and `Popover`, and adding it without a requesting
  screen would mean designing blind
  (ADR-0024).

## Minimal example

```tsx
import { TreeView, type TreeNode } from "@olddevs/ui";

const items: TreeNode[] = [
  { id: "nature", label: "Nature", children: [{ id: "forest", label: "Forest" }] },
  { id: "city", label: "City" },
];

const [expanded, setExpanded] = useState<Set<Key>>(new Set(["nature"]));

<TreeView
  items={items}
  aria-label="Categories"
  expandedKeys={expanded}
  onExpandedChange={setExpanded}
/>;
```

## Props

| Prop                  | Default | Purpose                                                                                                                |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `items`               | —       | Nodes: `id`, `label`, optionally `icon`, `children`, `disabled`; `textValue` is required when `label` is not a string. |
| `aria-label`          | —       | The tree's name. Required, checked by the compiler.                                                                    |
| `expandedKeys`        | —       | Expanded nodes. The tree does not store them.                                                                          |
| `onExpandedChange`    | —       | Called with the set of expanded nodes.                                                                                 |
| `defaultExpandedKeys` | —       | Expanded on first render; after that react-aria drives it.                                                             |
| `selectionMode`       | —       | Turns on the selection mode: `single` or `multiple`.                                                                   |
| `selectedKeys`        | —       | Selected nodes.                                                                                                        |
| `onSelectionChange`   | —       | Called with the selection.                                                                                             |
| `disabledKeys`        | —       | Unavailable nodes.                                                                                                     |
| `activeKey`           | —       | The current navigation node: `aria-current="page"` and a backing.                                                      |
| `onAction`            | —       | An action on a node: navigation, opening. It is not selection.                                                         |
| `emptyText`           | —       | What to show when there are no nodes.                                                                                  |

## The role is `treegrid`, not `tree`

That is react-aria's decision, and a sound one: a row holds an expand button and a
checkbox, and a `treeitem` does not expect a second interactive element inside
itself. Nodes have the `row` role with `aria-level`, `aria-expanded`,
`aria-posinset` and `aria-setsize`.

The kit will not override roles by hand: then the keyboard from the behavior layer
would stop matching the markup. In tests nodes are found by
the `row` role — that is not a workaround but an exact reflection of what the screen reader sees.

## No state is kept, and `useTreeData` is not exported

The rule is the same as for `Table`: expanded and selected nodes arrive as sets
(ADR-0023).

The kit does **not** re-export react-aria's `useTreeData`. It is a store, and the kit
does not own state; whoever needs a ready-made one takes it from
`react-aria-components` directly, and then it is their choice, not one imposed by the kit.

## The selection mode is turned on by `selectionMode`

Without it there are neither checkboxes nor `aria-selected` in the markup: a category tree that
users only browse should not drag in a selection column. The same rule as for
`Table`.

`onAction` is not selection: it is navigation or opening a card.

## The current node: `activeKey`

A navigation tree, such as a knowledge base or a structure of sections, shows "you are
here", not a set of checked items. The selection mode does not fit: `selectionMode`
renders a checkbox in every row and sets `aria-selected`, while the current page
is a place, not a choice. Hence a separate prop:

```tsx
<TreeView
  items={articles}
  aria-label="Articles"
  activeKey={articleId}
  onAction={(id) => openArticle(id)}
/>
```

- The node whose key equals `activeKey` gets `aria-current="page"` on its row and a
  `bg-3` backing with a semibold label, like `NavItem` with `active`. If the key is not
  among the nodes or the prop is not set, nothing is marked.
- The tree **does not move "current" by itself**: a click on a leaf calls `onAction`,
  and the consumer passes the new `activeKey` when the route has changed. Like
  selection and expansion, it is a value, not kit state.
- No checkboxes, no `aria-selected`. With `selectionMode` the current node and the
  selection can be kept together — they are two independent sets.
- A node inside a collapsed folder is absent from the markup and has no mark until
  the folder is expanded. Expanding the path to the open article is the consumer's job,
  through `expandedKeys`.

**The name is `activeKey`, not `currentKey` and not `selectedKey`.** In the kit's
vocabulary ([conventions.md](../../conventions.md)) `active` is reserved for one meaning: the
current navigation item, `aria-current="page"`; `selected` is a choice in a set. The
tree holds not items but data addressed by keys, so a boolean `active` on a node does
not fit: following `selectedKeys`, `expandedKeys` and `disabledKeys`, the prop takes a
key. One value, not a set: a navigation has only one current page.

## An action on a folder does not expand it

When `onAction` is set, a click on a folder row calls `onAction` with its key but
**does not expand the folder**. The chevron and the Right Arrow key expand a folder
(the Left Arrow key collapses it): the expand and action gestures are kept apart. This is the
behavior of react-aria's `Tree`, and the kit does not change it. Without `onAction`
a click on a row expands the folder.

If the tree should expand a folder on click, do that in `onAction` itself:
check whether the node has children and update your own `expandedKeys`.

```tsx
onAction={(id) => (isFolder(id) ? toggle(id) : openArticle(id))}
```

## Keyboard and names

Arrow keys, Home, End, type-ahead search and expansion come from the behavior layer
(ADR-0005),
and are not written by hand; they are verified in a live browser.

The expand button's name is only a verb: "Expand" on a collapsed node and "Collapse" on an
expanded one, **without** the node label: react-aria
appends it itself, and "Expand Nature" would be read as "Expand Nature
Nature". The wave 18 review found the same defect in `TagInput` and `FilterBar`.

The level indent comes from the `--tree-item-level` variable, which react-aria
puts on the row: computing the depth in the kit would mean keeping a second copy of
the same number. The indent step is `--tree-indent`.

## Related sources and tests

- Implementation: `src/components/navigation/TreeView.tsx`.
- Tests: `tests/tree-view.test.tsx` — roles and levels, expansion by a set,
  no selection mode without the prop, the button name, a disabled node, the empty state,
  `activeKey` (the mark, changing it with the same `items`, no checkboxes) and the action
  on a folder; the browser test covers arrow keys, focus movement and `activeKey` moving on click.
- Story: `src/components/navigation/TreeView.stories.tsx`.

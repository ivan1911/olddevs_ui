---
component: SortableList
exports: [SortableList, SortableItem, SortableMove]
category: content
status: stable
source: src/components/content/SortableList.tsx
story: src/components/content/SortableList.stories.tsx
---

# SortableList

## Summary for AI

A list whose order the user sets by dragging. It is built on react-aria's
`useDragAndDrop`: announcements, keyboard and the insertion point come from
there. The component does not store the order. Lists that share a `group`
exchange rows — that is how a board is built: a move arrives in `onMove` of the
receiving list, and the screen holds what each column contains.

## When to use

- The order matters and is set by a person: menu sections, scenario steps,
  priority.
- There are few items and they fit on the screen.
- A board: column lists sharing a `group`, between which a row moves with the
  mouse and from the keyboard.

## When not to use

- For sorting by a column value — that is `Table`: there the order is computed,
  not assigned.
- For hundreds of items: virtualization and dragging together are not verified
  in the kit. A virtualized grid is `VirtualGrid`, and it has no dragging.
- For a tree — that is `TreeView`.

## Minimal example

```tsx
import { SortableList } from "@olddevs/ui";

const [items, setItems] = useState([
  { id: "1", label: "Overview" },
  { id: "2", label: "Campaigns" },
]);

<SortableList
  items={items}
  aria-label="Section order"
  onReorder={(ids) => setItems(ids.map((id) => items.find((i) => i.id === id)!))}
/>;
```

## Props

| Prop         | Default | Purpose                                                         |
| ------------ | ------- | --------------------------------------------------------------- |
| `items`      | —       | Rows: `id`, `label`, `textValue`.                               |
| `onReorder`  | —       | The whole new order — a list of identifiers.                    |
| `aria-label` | —       | **Required.** A nameless list is announced as empty.            |
| `emptyText`  | —       | What to show when there are no rows.                            |
| `group`      | —       | A group of lists that exchange rows.                            |
| `id`         | —       | The list name in the group for `onMove`; not in the DOM.        |
| `onMove`     | —       | Called when a row is brought in from another list of the group. |

## The drag handle is required

Every row has a handle button, and the component itself renders it rather than leaving it to the
consumer. This was established by measurement: without
`<Button slot="drag">`, the row gets `draggable="true"` and can be dragged with
a mouse, **but cannot be picked up from the keyboard at all**. react-aria does
not crash — it writes a warning to the console. So an inaccessible list looks
like a working one.

The handle name is only a verb ("Drag" in the default message catalog, `sortableList.drag`): the library appends the row label
itself, and if we repeated it, we would hear it twice.

## Keyboard

| Key                   | What it does                           |
| --------------------- | -------------------------------------- |
| `→`                   | Moves focus from the row to the handle |
| `Enter` on the handle | Starts the drag                        |
| `↑` / `↓`             | Chooses the insertion point            |
| `Enter`               | Applies                                |
| `Escape`              | Cancels                                |
| `Tab`                 | Goes to another list of the group      |

The react-aria announcement suggests choosing a target with `Tab`. In a single
short list, `Tab` moves focus out of the ring of targets and **cancels** the
drag — verified in a browser; use the arrow keys. In a group, `Tab` goes to the
next list, and `Enter` drops the row there — also verified in a browser.

## There is no live region of its own

react-aria announces the drag by itself and localizes the announcements. With the Russian locale,
a measurement returned these announcements (translated): "Drag started. Press Tab to choose a
target…", "Insert between Overview and Campaigns", "Drag finished".

A live region of our own would duplicate these messages and conflict with them. The
`DragAnnouncer` from the source app is not carried into the kit: it is
written for `@dnd-kit`, which stays silent
(ADR-0028).

For the announcements to come in Russian, `UiProvider` must have `locale` set:
it is what sets up react-aria's `I18nProvider`.

## The order is not stored inside

`onReorder` hands over the **whole new order**, not "what moved where": applying
a ready list is simpler than rebuilding it from an event, and there is nowhere
to go wrong. Responsibilities are split the same way as in table sorting
(ADR-0023).

## Moving between lists

Lists that share a `group` exchange rows: board columns, "available" and
"selected". A list without a group, as before, only reorders its own rows.

```tsx
import { SortableList, type SortableMove } from "@olddevs/ui";

// What the columns contain is one piece of screen state: the row leaves `from`
// and lands in `to` at `index` in a single step.
const move = ({ id, from, to, index }: SortableMove) =>
  setBoard((board) => moveRow(board, id, from, to, index));

{
  columns.map((column) => (
    <SortableList
      key={column.id}
      id={column.id}
      group="board"
      aria-label={column.label}
      items={column.items}
      onReorder={(ids) => reorderIn(column.id, ids)}
      onMove={move}
    />
  ));
}
```

- Only a list with `onMove` takes rows; any list of the group can give them
  away.
- `onMove` is called on the **receiving** list and reports the row `id`, `from`,
  `to` and `index` — the position in the receiving list. Within its own list `onReorder`
  still works.
- The component does not store what the lists contain, just as it does not store
  the order: updating both lists is the screen's job: the board state is a single piece of
  state, so the row must be removed from one list and added to the other in one
  step.
- An empty list takes a row dropped on the list itself — show `emptyText` in it
  so it is clear where to drop.
- Another group does not take the row: each group has its own drag data type.
  The list does not take a file from the desktop either.
- The list `id` is a state key, not an element `id`: it does not reach the DOM
  and does not clash with the page.

## The copy icon in WebKit: a known issue that cannot be fixed here

In Safari and other WebKit builds, at the very start of a drag a system icon meaning "a copy
will be made" — a green circle with a plus — appears for a fraction of a
second. The list cannot copy rows, and nothing is copied: the icon is misleading.

This cannot be fixed on the kit's or the consumer's side. The
component declares the only allowed operation — `getAllowedDropOperations: () =>
["move"]`. Measurements of both engines show that the declaration is applied:
`effectAllowed` is written and read back as `move`, and react-aria additionally
writes `dropEffect: move` on every `dragover` — 24 writes per drag, and both engines
accept them. Chromium honors it: the target sees `move`, the drag ends with `move`,
there is no icon.

WebKit loses the declaration at the drag-session level and hands the target
`all` — [bug 178058](https://bugs.webkit.org/show_bug.cgi?id=178058), known
since 2017. `all` includes copying, and the operating system shows the "plus"
until the first target overrides it. Hence the flicker: it is the gap between
the platform's default and the first correction.

**The reordering is still correct.** react-aria keeps the real set of operations
in its own variable and intersects it with what the browser returned; this is
its standard workaround for the same bug. Measured in WebKit: five rows before
the drop, five after, and the order changed exactly as in Chromium. The row is
not duplicated.

What does not help (so you need not check it again):

- **a custom drag preview** (`renderDragPreview`). The wrong value is visible in
  the data contract, in the target's `effectAllowed`, not in the picture. The
  preview does not affect the operation mask;
- **not using `text/plain`**. The icon appears on the very first `dragenter` over
  the list itself, before any text field on the page, and in Chromium it is
  absent with the same `text/plain`;
- **removing `getAllowedDropOperations`**. It makes things worse: copying would
  then really be allowed, and the icon would become accurate.

## Anti-patterns

- Hiding the handle "to look cleaner": without it the list is inaccessible from
  the keyboard.
- Adding a live region of your own on top of the react-aria announcements.
- Storing the order inside the component.
- Moving a row between columns with your own menu instead of `group`: a menu is
  fine as a fallback, but not as the only way.
- Updating only the receiving list in `onMove`: the row ends up in two columns
  at once.

## Related sources and tests

- Source: `src/components/content/SortableList.tsx`
- Tests: `tests/sortable-list.test.tsx`; browser —
  `tests-visual/interactions.spec.ts`
- Showcase: `src/components/content/SortableList.stories.tsx`

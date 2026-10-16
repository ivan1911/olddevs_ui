---
component: EditableList
exports: [EditableList, EditableListItem]
category: content
status: stable
source: src/components/content/EditableList.tsx
story: src/components/content/EditableList.stories.tsx
sourceHash: a65823f3c23a
---

# EditableList

## Summary for AI

A list in which rows are edited in place and reordered by dragging, and new ones
are added at the bottom. The component **stores neither** the order nor the
values: drafts live in the fields themselves, and values change only when you
exit edit mode.

## When to use

- A list that a person both edits and extends without leaving it: tasks, a
  checklist, scenario items.
- The order matters and is set by a person, not computed.

## When not to use

- For **only** the order, use `SortableList`: it is simpler, and its row does
  nothing extra.
- If the order is computed from a column value, use `Table` or `DataTable`
  (ADR-0023).
- For nesting, use `TreeView`.
- Hundreds of rows: virtualization and dragging together are not verified in the
  kit
  (ADR-0028).

## Minimal example

```tsx
import { EditableList } from "@olddevs/ui";

const [items, setItems] = useState([
  { id: "1", value: "Approve the estimate" },
  { id: "2", value: "Pay for hosting" },
]);

<EditableList
  items={items}
  aria-label="Tasks"
  editLabel={(item) => `Edit "${item.value}"`}
  onReorder={(ids) => setItems(ids.map((id) => items.find((i) => i.id === id)!))}
  onValueChange={(id, value) =>
    setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
  }
  add={{
    label: "New task",
    placeholder: "What needs to be done?",
    onAdd: (value) => setItems([...items, { id: crypto.randomUUID(), value }]),
  }}
/>;
```

## Props

| Prop            | Default | Purpose                                                                                                                                                                                               |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`         | —       | Rows: `id`, `value`, `textValue`, `disabled`.                                                                                                                                                         |
| `onReorder`     | —       | The whole new order — a list of identifiers.                                                                                                                                                          |
| `onValueChange` | —       | Confirms an edit. Called **only** when the value changed.                                                                                                                                             |
| `editLabel`     | —       | The accessible name of the edit field. **Required**, checked by the compiler.                                                                                                                         |
| `aria-label`    | —       | **Required.** Without a name, a screen reader announces just "list".                                                                                                                                  |
| `add`           | —       | The add row: `label`, `placeholder`, `onAdd`, `pending`, `leading`. `pending` announces the busy state via `aria-busy` and does **not** disable the field; `leading` sets leading columns, see below. |
| `leading`       | —       | A slot to the left of the name: a checkbox, an avatar.                                                                                                                                                |
| `trailing`      | —       | A slot on the right: a status badge, row action buttons.                                                                                                                                              |
| `onRowAction`   | —       | A click on the row and Space on it. The component does not interpret them.                                                                                                                            |
| `divided`       | —       | A hairline between rows.                                                                                                                                                                              |
| `emptyText`     | —       | What to show when the list is empty.                                                                                                                                                                  |

## Why this is a separate component and not a `SortableList` with a field inside

The analysis is in ADR-0045.

A `SortableList` row is a `GridListItem`, and the keyboard belongs to it: arrow keys,
Enter, Space, typeahead by first letters. A field inside the row takes the same
keys for itself. The contract must have a single owner, and composition cannot
give you one.

The second reason is the add row: it is **not a collection item**: it has no key
and no place in the order. Moving focus into it from the last row and back is
behavior that, under composition, is left without an owner.

## Focus handle

The component exposes one imperative handle:

```tsx
const list = useRef<EditableListHandle>(null);

<EditableList ref={list} add={{ label, placeholder, onAdd }} … />;

list.current?.focusAdd();                  // cursor into the add row
list.current?.focusAdd({ select: true });  // and select what is typed
```

It is needed when code outside the list decides where the cursor goes: a command
palette, a "new item" keyboard shortcut, a wizard step "fix this field".

**If there is no add row, the call silently does nothing.** Silently, not with
an exception: the caller comes from a palette and does not want to know the state
of the list; an exception here would force a check at every call site.

**The handle is narrow on purpose.** The `HTMLInputElement` itself is not exposed:
expose it, and the add row's markup becomes a public contract, and the
consumer starts reading `value` and attaching handlers.

**It must not be called on mount.** Autofocus when a screen opens unexpectedly
takes a screen reader user somewhere else. A call on a person's command does not
do this.

No separate prop controls scrolling: `focus()` itself brings the field into view,
and the default behavior is correct here.

## Row separation

By default the rows are held apart by spacing. On a dense list that is not
enough: rows read as one unbroken mass, and the only anchors left are the drag handle
plates.

`divided` puts a hairline `line-soft` between rows. The line goes **between**
rows, not under each one: under the last one it would underline a list that
nobody underlined. The row's rounded corners are removed — under a rounded row a
straight line bends around the corners and stops being straight — and the hover
highlight becomes a full-width stripe, as is usual for a divided list.

The component does not support a bordered background for a row, although that is also
a way to separate rows. That option was considered and rejected: rows styled as
cards read heavier, eight tasks turn into eight cards. No new prop is added for
the future: an API nobody asked for would still have to be maintained
(ADR-0031).

## A row leaving

A row that disappeared from `items` is not removed from the screen in the same
frame: it plays out its exit, and the space under it is freed **in the same
motion**. It uses the `base` step and the `ease-exit` curve, the same ones the kit's
overlays have used to exit since 3.23.

The reasoning is the same as for overlays: disappearing within a single frame
reads as a glitch. For a list row the cost is higher — it does not vanish alone: the
neighbors close up instantly, and everything below jumps with them. A person
marked a task as done, and the list under the cursor jerked, and the
next row ended up under the pointer before they understood which one had gone.

**There is no prop for this and none is planned.** The exit is always on, like
for overlays: a prop of the "animate removal" kind would mean the kit has an
opinion about which lists may have a row vanish with a jerk. The duration and the
curve are not exposed either — they belong to the motion scale
(ADR-0047).

**A leaving row is dead from the first frame.** It has `inert`, which disables
everything at once: it cannot be dragged and does not accept what is dragged,
does not get focus, does not react to a click or `Enter`, and is excluded from
the accessibility tree. Its identifier is not passed to `onReorder`
— for the order it no longer exists. For a blind user the entry disappeared at
the moment of the action, and keeping it in the tree for an extra 150 ms is
pointless.

**Focus moves forward.** If focus was on the leaving row, it goes to the one that
took its place; if there is none, to the previous one; if no list is left, to
the add row. Focus cannot stay on a leaving row: it is `inert`, focus would fall
to `body`, and keyboard navigation would be interrupted every time a task is
completed.

**Several rows leave at once**, without a wave of delays: a bulk action removes
a dozen, and a wave would turn into a noticeable wait while conveying nothing.

**With `prefers-reduced-motion: reduce` the exit stays, the closing up is turned
off.** The fade stays, and the space is freed in one frame: closing up is the
movement of everything below the row, which is what the setting protects
against. Turning the exit off completely is not allowed, for the general reason
given in
ADR-0043:
`animation: none` produces a jerk, not calm.

Two caveats for race conditions in the consumer's code:

- **A returning identifier immediately removes its leaving row** — a collection
  never has two rows with the same `id`. An undo of a removal that arrives within
  the same 150 ms shows the row, not its copy.
- **A drop exactly on the place of a leaving row does nothing.** The drop target
  is a key that is no longer in `items`, and `onReorder` is not called: the order
  does not change instead of changing wrongly.

The exit is **asymmetric**: a row's arrival is not animated. Adding comes from
the add row; the person is looking at it, and motion in the list there would be
noise.

## Alignment of the add row

The add field must start where the row names start. The component reserves the
drag handle's place itself — for a list without `leading` that is enough, and
the field's frame matches the names out of the box.

With a `leading` slot the alignment drifts apart: a checkbox or an avatar shifts the names
to the right, and the field does not follow. The kit cannot know the width of
`leading` — the consumer sets it, and measuring the consumer's markup would mean
reading layout on every render and still missing on the first frame. So the
column is reported by whoever created it: `add.leading`.

```tsx
add={{
  label: "New task",
  onAdd: create,
  // The same checkbox as in the row, but invisible.
  leading: (
    <span className="invisible shrink-0">
      <Checkbox size="sm" checked={false} label="" onCheckedChange={() => {}} />
    </span>
  ),
}}
leading={(item) => <Checkbox size="sm" checked={item.done} … />}
```

**A mirror is more reliable than a spacer sized by eye.** The temptation to put a
`<span className="size-4" />` in place of an `sm` checkbox is understandable, but
such a spacer misses by 8 pixels: the checkbox frame really is 16 pixels, but it
takes 24 — the label wrapper
adds its own padding. An invisible copy of the same control keeps the geometry
itself and does not drift when the control in the kit changes.

**`invisible`, not `opacity-0` and not `aria-hidden` on a live control.**
`visibility: hidden` keeps the whole box but removes the element from both the
tab order and the accessibility tree. A live checkbox in the add row would be a
checkbox of a task that does not exist yet: there is nothing to mark, and it
would take focus.

A fixed-width spacer also works — when the width is known exactly and the control
that takes its place is not the kit's: `<span aria-hidden className="size-6 shrink-0" />`.

## A row is a group: slot content can react to hover and focus

The row sets the Tailwind marker `group`. This is **part of the contract**: the content of `leading` and `trailing` may rely on `group-hover:`
— the kit promises that the marker is on the row and will stay
(ADR-0046).
Removing or renaming it is now possible only with a major.

The full recipe is the `HoverActions` story in the showcase; it is also checked
by a browser test, so that the example here does not break silently.

```tsx
<EditableList
  items={tasks}
  trailing={(item) => (
    <span className="flex items-center gap-1 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100">
      <Button size="xs" iconOnly icon={<TrashIcon />} aria-label={`Delete ${item.value}`} />
    </span>
  )}
  {...rest}
/>
```

**`focus-within:` — on your wrapper, without `group-`.** This is the only
working variant, and it replaces `group-focus-within:` here, which never fired
in the recipe before 3.17.2. The reason: the row is a react-aria component and
carries `data-rac`. The `tailwindcss-react-aria-components` plugin marks such
elements not with a pseudo-class but with an attribute:
`:where([data-rac])[data-focus-within]`. The
row does not set a `data-focus-within` attribute: when focus is inside it, it
sets `data-focused` and `data-focus-visible-within`. The wrapper around the
buttons does not carry `data-rac`, falls into the selector branch for elements
without `data-rac` and works as ordinary CSS.

The recipe deliberately did not rely on `data-focused`: the attribute does not
appear on every way of bringing focus inside the row, and a signal that is
only sometimes present is worse for such a task than no signal.

**Focus styling is required; hover is an addition.** Hover alone
hides the button from the keyboard: focus lands on an invisible element,
and the person presses blindly. If only one utility of the pair is left, it is
`focus-within:`.

**`pointer-fine:` is required.** Where there is no precise pointer, `:hover` either
never happens or sticks after a touch. A button hidden behind hover becomes
unreachable on such a device. Hide only with a precise pointer, and leave it
visible on touch.

The variant is built into Tailwind; you do not need to define it yourself:
verified on a Tailwind 4.3.3 build without a single `@custom-variant` — the rules come
out wrapped in `@media (pointer: fine)`. If they disappear in your build, the
cause is the Tailwind version, not the kit's delivery: Tailwind does not
generate an unknown variant, and the class disappears silently while the build
stays green.

**Your own `group` inside a slot shadows the row.** An unnamed `group-hover:`
responds to the nearest ancestor with the marker, and if that ancestor is yours,
it no longer responds to the row. The kit deliberately does not name the marker
— renaming would break what is promised — so give it a name yourself:
`group/actions` plus `group-hover/actions:`.

The kit does not change the default: slot content is always visible. Hiding
actions is a product decision, and it is made by the consumer, not by a
component prop.

## Keyboard

| Key                        | What it does                                                   |
| -------------------------- | -------------------------------------------------------------- |
| `↑` / `↓`                  | Focus moves along the rows                                     |
| typing letters             | Goes to the row by the start of its name                       |
| `→`                        | Focus from the row to the drag handle                          |
| `Enter` on the drag handle | Starts the move; `↑`/`↓` choose the target, `Enter` applies it |
| `Enter` on the row         | Opens editing; the text is fully selected                      |
| double click               | The same with the mouse                                        |
| `Enter` in the field       | Confirms and returns focus to the row                          |
| `Escape` in the field      | Restores the previous value **and** focus to the row           |
| click elsewhere            | Confirms and does **not** take focus                           |
| `↓` from the last row      | Moves focus to the add row                                     |
| `↑` in the add row         | Returns focus to the last row                                  |
| `Enter` in the add row     | Confirms and **leaves the field open**                         |

While a row is being edited, the drag handle is disabled and the row cannot be
dragged: the arrow keys belong to the caret.

`Enter` is handled by the component only when **the row itself** has focus. On
the drag handle, on a checkbox in `leading` and on buttons in `trailing` it belongs to
them: before 3.10.2 the interception caught it on any descendant of the row, and
a keyboard move never started.

## Mouse

| Element                | What happens                                                |
| ---------------------- | ----------------------------------------------------------- |
| drag handle (six dots) | The "grab" cursor; press and drag to move                   |
| name                   | A double click opens editing; a single click is not handled |
| row                    | A click or Space calls `onRowAction`, if it is set          |

The grab cursor is on the drag handle's **wrapper**, not on the move button
itself. react-aria sets `pointer-events: none` on the button (it is a target for
the keyboard and the screen reader, not for the pointer), and a cursor on it
would never apply. For the same reason the wrapper swallows the click: through
the button turned off for the pointer it reached the row and called
`onRowAction`.

### What the component does not support with the mouse

**The whole row is dragged, not the drag handle, and the name cannot be selected with
the mouse.** Both have one cause: the move is driven by react-aria through the
native `draggable` on the row itself (ADR-0028), and the browser applies the
`user-select: none` rule to `[draggable=true]`. So dragging across the name does
not select it but moves the row; `user-select: text` on the name does not help
while `draggable` is on an ancestor.

There is no way around this without giving up react-aria for the move: the cost
is a custom drag implementation in the kit. Nobody has asked for that
implementation, and the list has behaved this way since 3.10.0, the first
release.

## Three things visible only in a browser

All three were found while building the component, and all fail silently: in
jsdom the react-aria collection behaves differently, and a test would pass on a
broken component.

- **`dependencies={[editingId, leaving]}` on `GridList` is required.** The collection
  caches rows and does not re-render them when external state changes — without it
  editing did not open at all, while the key handler worked fine.
- **Focus is set in a callback ref, not in an effect.** The row content mounts in
  a separate pass, later than the commit: by the time of `useLayoutEffect` the
  field's ref is still empty.
- **Drafts live in the fields themselves.** A draft in state would mean a render
  on every keystroke, and so a remount of the row and a return of the original
  value: what was typed got erased right during typing.

## Accessibility

- The list is react-aria's `GridList`. It provides localized move announcements
  itself; the component has no live region of its own.
- A row with an empty value gets its name from a placeholder label: react-aria
  logs a console warning for an empty `textValue`, and such a row cannot be
  reached by typing first letters.
- The component does **not announce** the appearance of an added row — the row
  comes from the collection as a prop, and the announcement is left to the
  consumer.

## The copy icon in WebKit: a known issue with no fix available

In Safari and other WebKit builds, at the very start of a drag a system icon
meaning "a copy will be made" — a green circle with a plus — appears for a fraction of a
second. The list cannot copy rows, and nothing is copied: the icon lies.

Neither the kit nor the consumer can fix this, and here is why. The
component declares the only allowed operation — `getAllowedDropOperations: () =>
["move"]`. Measurements of both engines show that the declaration is applied:
`effectAllowed` is written and read back as `move`, and react-aria additionally
writes `dropEffect: move` on every `dragover` — 24 writes per drag, and both `effectAllowed` and `dropEffect` are
accepted. Chromium honors it: the target sees `move`, the drag ends with `move`,
there is no icon.

WebKit loses the declaration at the drag-session level and hands the target
`all` — [bug 178058](https://bugs.webkit.org/show_bug.cgi?id=178058), known
since 2017. `all` includes copying, and the operating system shows the "plus"
until the first drop target overrides it. Hence the flicker: it is the gap between
WebKit's default and the first correction.

**The reordering is still correct.** react-aria keeps the real set of operations
in its own variable and intersects it with what the browser returned — this is
its standard workaround for the same bug. Measured in WebKit: five rows before
the drop, five after, and the order changed exactly as in Chromium. The row is
not duplicated.

What does not help, so you do not check again:

- **a custom drag preview** (`renderDragPreview`). The wrong value is visible in
  the data contract — in the target's `effectAllowed` — not in the picture. The
  preview does not affect the operation mask.
- **not setting `text/plain`**. The icon appears on the very first `dragenter` over
  the list itself, before any text field on the page, and in Chromium it is
  absent with the same `text/plain`.
- **removing `getAllowedDropOperations`** makes things worse: copying would
  then really be allowed, and the icon would be telling the truth.

## Anti-patterns

- Storing the order or the values inside the component.
- Opening editing with a single click: then the row has nothing left to open
  details with.
- Hiding the drag handle "to look cleaner": without it the list is inaccessible from
  the keyboard.
- Showing domain state through the component itself — it lives in the slots.

## Related sources and tests

- Source: `src/components/content/EditableList.tsx`
- Decision: ADR-0045
- Tests: `tests/editable-list.test.tsx`; browser —
  `tests-visual/interactions.spec.ts` (keyboard, focus and the row exit)
- Showcase: `src/components/content/EditableList.stories.tsx`

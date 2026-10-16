---
component: SavedViews
exports: [SavedViews]
category: table
status: stable
source: src/components/table/SavedViews.tsx
story: src/components/table/SavedViews.stories.tsx
sourceHash: ea63c1085acc
---

# SavedViews

## Summary for AI

`SavedViews` is a switcher of named state snapshots. The kit shows the list of
views and announces the active one; **where the views are stored, it does not know
and should not know**. The view type is parameterized by the state snapshot
(`SavedView<T>`), not tied to `TableState`.

## When to use

- Above a list, a table or a grid where the user keeps returning to the same sets
  of filters: "Mine", "Drafts", "With errors".
- When the set of views is created by the user, not the developer.

## When not to use

- For toggling a single attribute or a display mode — that is `Segmented`: it has
  a fixed set of modes, not user-defined sets.
- For showing the applied filters with the ability to remove any of them — that is
  `FilterBar`: there filters are removed one at a time, here a whole set is chosen.
- For navigation between sections — that is `Tabs`.

## Minimal example

```tsx
import { SavedViews, type SavedView } from "@olddevs/ui";

const views: SavedView<Filters>[] = [
  { id: "all", name: "All", state: { status: "" } },
  { id: "drafts", name: "Drafts", state: { status: "draft" } },
];

<SavedViews
  views={views}
  activeId={activeId}
  onSelect={(view) => {
    // The state arrives whole: apply it in a single action.
    setActiveId(view.id);
    applyFilters(view.state);
  }}
/>;
```

## `SavedView<T>` — the shape of a view

```ts
interface SavedView<T = unknown> {
  id: string;
  /** The view's name — also its label. */
  name: ReactNode;
  /** A state snapshot. The kit neither reads nor interprets it. */
  state: T;
}
```

The parameter `T` is your state, in whatever form you keep it: a filters object,
`TableState`, a query string. The kit does not read it and hands it
back as is on selection.

## Decisions visible in the API

**The type is parameterized by the state snapshot, not tied to `TableState`.** The type
is the way it is because of the only known consumer: its state lives in the page
URL, and its screen is a grid of cards, not a table. Tying it to `TableState`
would cut that consumer off from a component written for it
(ADR-0033).

**The kit has no storage at all.** The component writes nothing (not to
`localStorage`, not to the page URL, not to the network) and subscribes to nothing.
The choice between the page URL, local storage and a server stays with the app; sharing
views between users is a job for the backend. The model is the same as in
[`useTableState`](../../api/utilities.md): the kit describes the shape, and the
consumer owns it.

This is verified by a test that stubs the storage APIs, not by convention: any
access to `localStorage`, `sessionStorage` or `history` fails the run.

**`onSelect` hands over the whole view in one call, not its identifier.** If the
state goes into the page URL, consecutive writes by key build the URL from the
same copy of the URL parameters in the current render: the last one wins, and the
previous edits are lost. That is exactly what happened to a consumer, who lost the
lower bound of a range when picking a range on top of a preset.

**The active view is announced, not just highlighted.** Each view is a chip
(`Chip`); it carries `aria-pressed`, and color highlighting tells a screen reader
nothing.

**The kit has no notion of "reset".** `activeId={null}` means "there is no active
view". Returning to the default is done with a view that you put into the list
yourself — its state snapshot is your empty state. The kit does not know what is empty
for your app.

**Creating, renaming and deleting a view are up to your app.** They are inseparable from
storage, and there is no storage here.

**An empty list is not rendered at all.** An empty group would announce itself to
a screen reader with nothing inside — the same technique as in `Timeline`.

## Related sources and tests

- Implementation: `src/components/table/SavedViews.tsx`.
- Tests: `tests/saved-views.test.tsx` — announcing the active view, one call with
  the whole state snapshot, the storage guard, an empty list, the group's accessible
  name.
- Related: [`useTableState`](../../api/utilities.md),
  [`FilterBar`](filter-bar.md).

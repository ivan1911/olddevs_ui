---
component: TableToolbar
exports: [TableToolbar, TablePreferences]
category: table
status: stable
source: src/components/table/TableToolbar.tsx, src/components/table/TablePreferences.tsx
story: src/components/table/TableToolbar.stories.tsx
sourceHash: 957697357a68
---

# TableToolbar and TablePreferences

## Summary for AI

`TableToolbar` is the table bar: a title, a counter, actions, a filters slot and a
preferences slot. `TablePreferences` is the content behind the gear button: column
visibility and order, density. Neither stores state: everything comes from above,
usually from `useTableState`.

## When to use

- Above a list that has a title, a counter or actions on the whole list (for example, export).
- It works without `DataTable` too — above a plain `Table`.

## When not to use

- For actions on **selected** rows — that is `SelectionBar`.
- For a page title with a description — that is `PageHeader`.

## Minimal example

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@olddevs/ui";
import { TablePreferences, TableToolbar, useTableState } from "@olddevs/ui";

const { state, set } = useTableState();

<TableToolbar
  title="Documents"
  count={total}
  actions={<Button tone="accent">Upload</Button>}
  preferences={
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" iconOnly icon={<SettingsIcon />} aria-label="Preferences" />
      </PopoverTrigger>
      <PopoverContent className="p-3">
        <TablePreferences
          columns={columns}
          hiddenColumns={state.hiddenColumns}
          onHiddenColumnsChange={(hiddenColumns) => set({ hiddenColumns })}
          columnOrder={state.columnOrder}
          onColumnOrderChange={(columnOrder) => set({ columnOrder })}
          density={state.density}
          onDensityChange={(density) => set({ density })}
        />
      </PopoverContent>
    </Popover>
  }
/>;
```

## Decisions visible in the API

**The bar has no `toolbar` role.** The role requires arrow-key navigation
between its elements, and ARIA does not provide it by itself: by declaring
the role without implementing the behavior, the kit would promise the screen
reader something that is not there.

**The counter is a number, not a ready-made string.** Pluralization is done by the
message catalog per locale; `countLabel` overrides the label when the entity needs
naming ("12 documents"). The same technique as in `SelectionBar`.

**`TablePreferences` is a panel, not a menu.** A menu item is not a container for
buttons: "Up" and "Down" buttons nested in it break the keyboard semantics of a menu,
where the arrow keys belong to the menu itself. The consumer chooses the container —
`Popover`, `Drawer` or `Dialog`.

**The order is changed with buttons, not by dragging.** Dragging without a
keyboard alternative is not accessible at all, and the alternative to it is these
same buttons; providing both for one screen is out of proportion. The button
labels name the column: otherwise a list of ten columns would have ten "Up"
buttons and ten "Down" buttons.

**`PopoverTrigger` requires `asChild`.** Without it Radix renders its own button
around yours, you get a button inside a button, and the audit fails the run as
`nested-interactive` — axe caught this on the very first story.

**The last visible column cannot be hidden.** A table without columns is not a
UI state but a breakage: there is nothing left to hide, and the user cannot
get out of it. The restriction is one-way — a hidden column can always be brought back.

## Related sources and tests

- Implementation: `src/components/table/TableToolbar.tsx`,
  `src/components/table/TablePreferences.tsx`.
- Tests: `tests/table-toolbar.test.tsx` (slots, counter pluralization, no
  `toolbar` role), `tests/table-preferences.test.tsx` (the guard against hiding the last
  column, ordering from the keyboard, density).
- State: [`useTableState`](../../api/utilities.md).

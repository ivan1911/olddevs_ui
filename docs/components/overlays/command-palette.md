---
component: CommandPalette
exports: [CommandPalette]
category: overlays
status: stable
source: src/components/overlays/CommandPalette.tsx
story: src/components/overlays/CommandPalette.stories.tsx
---

# CommandPalette

## Summary for AI

`CommandPalette` is a controlled modal search over the app's actions. Pass
structured `sections` and handle the chosen `id` in `onSelect`; the palette
searches `label` and `keywords` by itself, closes after a choice and does not
register a global shortcut to open itself.

For server results, turn off the palette's own search with the `prefiltered: true`
flag on a section; the query arrives in `onQueryChange`, and `loading` shows
that a response is pending.

## When to use

- Quick search among actions, especially when there are already many commands.
- A table of contents of the available commands: with an empty query you need the full list of sections.
- The actions fall naturally into `CommandSection` groups.

## When not to use

- Use `SearchControl` to filter a list on the screen.
- Use plain links or tabs to navigate between a few static pages.
- Do not expect the component to listen for `⌘K` itself: the app owns that
  shortcut and `open`.

## Minimal example

```tsx
<CommandPalette
  open={open}
  onClose={() => setOpen(false)}
  sections={[{ id: "files", label: "Files", items: [{ id: "upload", label: "Upload" }] }]}
  onSelect={(id) => runCommand(id)}
/>
```

## Public API

`open`, `onClose`, `sections` and `onSelect` are required. Each section has `id`,
`label`, `items` and optionally `prefiltered`; an item requires `id`, `label` and
optionally `shortcut`, `keywords`, `icon`. `placeholder`, `title` and
`notFoundText` set the strings. `emptyBehaviour="all"` (the default) shows all
sections on an empty query; `"hint"` shows `emptyHint` instead, until the first
character is typed.

`onQueryChange(query)` is called with the typed text on every change of the
field, including a click on the clear button and the reset on close. It only
notifies you; it does not control the field: the component owns its value.
Debouncing the query is up to the consumer: how long to wait depends on the cost
of a query, which the kit cannot know.

`loading` signals that a search is under way on the consumer's side: a `Spinner` appears
in place of the search icon, and the empty state shows `loadingText` instead of
`notFoundText` (the default is "Loading"). Results that are already shown are not
hidden.

**The slot for the icon has a fixed size: the layout sets it.** The
search icon is 16 pixels, the `Spinner` is 14, and while the slot took its size from
the icon itself, the field together with the typed text shifted by those two
pixels every time loading was turned on. The palette's search goes to the
server, and a request goes out on every change of the field; the text flickered
in step with the pauses in typing and read not as "loading" but as "the screen is
reloading". Since 3.26.0 the slot has a fixed size, and it is safe to turn
`loading` on for every fetch (the consumer's measurement; a browser
test guards it).

## Server-side search: `prefiltered`

The palette filters the sections it is given by itself. For app actions that is
right: the set is known in advance and sits in memory in full. For server
results it is destructive: they have already been filtered, and by different
rules, and a second pass by substring throws away valid matches.

Take morphology as an example. A `tsvector` search with a Russian dictionary finds
the task "Подписать договор с подрядчиком" for the query "договоры". A local
`contains` will never match such a pair: "договоры" is another form of the word
"договор" in the title, so the substring is not there, and the person sees "nothing
found" where the server found something.
`keywords` cannot work around this at all: no matter how many words you put there,
a substring filter does not become morphological.

`prefiltered: true` on a section turns off local filtering for that section only.
The order of items is kept as passed: whoever searched did the ranking. Sections
of both kinds coexist in one list, and the keyboard works in a `prefiltered`
section exactly the same way: arrow keys, `aria-activedescendant`, choosing with
Enter.

```tsx
const [query, setQuery] = useState("");
const found = useQuery({
  queryKey: ["task-search", query],
  queryFn: () => tasksApi.search(query),
  enabled: query.trim().length >= 2,
});

<CommandPalette
  open={open}
  onClose={close}
  onQueryChange={setQuery}
  loading={found.isFetching}
  sections={[
    { id: "commands", label: "Commands", items: commands },
    { id: "tasks", label: "Tasks", items: taskItems, prefiltered: true },
  ]}
  onSelect={run}
/>;
```

## Accessibility and keyboard

The component combines Radix Dialog and react-aria `Autocomplete`/`ListBox`. The
field gets autofocus, a hidden title gives the dialog its name, and the list gets
the same name. Search respects the locale and ignores case and diacritics;
`keywords` extend the `textValue`. react-aria handles the arrow keys and selection.
After an item is chosen, `onSelect(id)` is called first, then `onClose`.

The busy state is announced by the `Spinner` itself — it has `role="status"` with
a hidden label inside. There is deliberately no separate live region with a count
of results: it would be a second voice saying the same thing, and on locally
filtered commands it would fire on every typed character.

## Good examples

- An empty list (`emptyBehaviour="hint"`) if there are hundreds of actions.
- `prefiltered: true` on a section with server results — together with `loading`.
- `keywords="similar поиск"` on a "Find similar" item: an English name and a Russian synonym.
- `shortcut={["⌘", "K"]}` to show a command the app already has.

## Anti-patterns

- Storing a callback in `CommandItem` instead of a stable `id`.
- Introducing sections with duplicate item `id` values.
- Putting server results into a regular section: the local filter sifts them a
  second time and throws away valid results.
- Making network requests directly from `onQueryChange`, without debouncing: the
  query changes on every character.
- Leaving the palette open after moving on to the action.

## Related sources and Storybook

- `src/components/overlays/CommandPalette.tsx`
- `src/components/overlays/CommandPalette.stories.tsx`

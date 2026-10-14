---
category: api
status: stable
source: src/index.ts
sourceHash: 902814b6f802
---

# Compatibility and migration notes

## Summary for AI

The public contract of `@olddevs/ui` is the entry points from the package `exports`
(`@olddevs/ui`, `/icons`, `/color`, `/editor`, `/editor/schema`, `/editor/highlight`,
`/locales/ru`, `/locales/en`), their runtime exports and the exported TypeScript types. When
this contract changes, a migration note must explain to the consumer
what changed, why, how to replace the old code and in which version this
became relevant.

## When to use

- When removing, renaming or changing the value of a public export/prop.
- When changing a default, accessibility, keyboard behavior or the shape of a
  controlled value: TypeScript may not detect such a migration.
- When replacing one component with another, for example, when the old API goes away in favor of
  an existing family.

## When not to use

- Do not create a migration note for a fix to an internal file that does not
  affect the consumer's entry points, behavior or types.
- Do not declare a change "breaking" just because an internal file or function was
  renamed: first check whether they are part of `src/index.ts`, and the real use cases.
- Do not leave an ambiguous replacement like "use the new Select" without
  a table of the old and new behavior.

## Minimal note template

Add a section to the repository's release notes or CHANGELOG and, if needed,
add a link to the note in this file. Each note contains:

````md
## X.Y.Z — short name

**Status:** breaking change | deprecation | behavior change

### What changed

The exact export, prop or behavior.

### Who is affected

Which imports/consumer scenarios to look for.

### Before → after

```tsx
// old code
// new code
```

### Semantics and accessibility

What changes for the keyboard, focus, accessible name or value shape.

### Action before updating

A concrete check or codemod.
````

## Mandatory procedure for changing the public API

1. Check the change against the file of the relevant entry point (`src/index.ts`, `src/icons.ts`,
   `src/color.ts`, `src/editor/index.ts` and the rest of the package `exports`) and the
   exported type. An internal path is not an alternative to the public API.
2. Update the component page: `Summary for AI`, "When not to use",
   the minimal example, the API table and the accessibility section, if affected.
3. Update the component catalog if a runtime
   component export was added or removed. The full rules are described in the kit repository's
   `AGENTS.md`.
4. Add a migration note or release note with the version and an unambiguous before/after. If
   the replacement can be done in stages, describe the removal date/version and the warning.
5. Add or update a test for the previous boundary and the new contract; for
   interaction, check focus, the keyboard and accessible names.

## 4.5.0 — `handle.openSearch()` → `handle.tool("search")?.open()`

**Status:** deprecation — minor. The method works throughout all 4.x releases and is removed in 5.0 (ADR-0058, item 12.7; ADR-0069).

### What changed

The `RichTextEditor` Handle gets `tool(name)`, a single entry point to a Tool's commands. The `open` command of the
`search` Tool does what `openSearch` does and accepts more: `open({ replace?, query? })`, where `query` sets the
query at once. `handle.openSearch(options)` is marked `@deprecated` and warns once in the console in development.
New commands of built-in Tools go through `handle.tool()`, not through new Handle methods.

### Who is affected

Everyone who calls `ref.current.openSearch(…)`, for example from a "Find" button in the screen header or a "find mentions" link.

### Before → after

```tsx
// before
ref.current?.openSearch({ replace: true });
// after
ref.current?.tool("search")?.open({ replace: true });
```

### Semantics and accessibility

Unchanged: the same panel, the same focus, the same shortcuts. The differences are small: `tool("search")` is `null`
without the `search` Tool in `tools` and before the engine exists, so a call through `?.` does nothing, just as
`openSearch` did; `open` returns a `boolean` (`false` in HTML mode) instead of `void`.

### Action before updating

Nothing is required before 5.0. Search the code for `openSearch(` and replace the call. The development console
warning appears once per session, so it alone will not find every screen with the call.

## 4.0.0 — first public release

**Status:** breaking change — the license and the registry change; the API does not.

### What changed

- The license is MIT (was `UNLICENSED`); third-party licenses are still in `NOTICE`.
- The package is published to npmjs.com, and the source is on GitHub.
- From this release on, versions follow strict semver: breaking changes ship only in a major version, and a
  public API rename goes through a deprecated alias that lives for one major version.
- `CHANGELOG.md` starts with this release.

### Who is affected

Everyone who installed the package from another registry: an `@olddevs:registry=…` line in the project or user
`.npmrc` sends the scope's installs past npmjs.

### Before → after

```ini
# .npmrc — before
@olddevs:registry=https://<previous registry>/
# after: no such line, the package installs from npmjs.com
```

```bash
npm i @olddevs/ui@4
```

### Semantics and accessibility

Unchanged: the code, exports, props, styles and behavior of 4.0.0 are the same as in 3.49.

### Action before upgrading

Remove the binding of the `@olddevs` scope to the previous registry from `.npmrc`, regenerate the lock file and
check that `resolved` for `@olddevs/ui` points to `registry.npmjs.org`.

## 3.48.0 — "Text card": `callouts` → `textCards`

**Status:** breaking change — minor, no alias. The API had one consumer (the source app),
and it replaced the names on its side; the ADR-0058, section 12.2 rule ("first deprecate, then
remove") does not apply here.

### What changed

A "callout" in GitHub and Notion is a note block, while in the kit the name stood for a card under a range
of text. The public names are renamed, and the behavior is unchanged:

- the `callouts` field of `CustomTool` → `textCards`;
- the types `CustomCallout` → `CustomTextCard`, `CustomCalloutRender` → `CustomTextCardRender`,
  `CalloutRange` → `TextCardRange`, `CalloutRangeAt` → `TextCardRangeAt`;
- the message catalog string `editor.calloutShown` → `editor.textCardShown`.

The note of a Wrapper with a tone (`wrapper`, a GitHub alert) is not affected. The 3.37.0 entry below names
the previous names as historical.

### Who is affected

Everyone who describes a custom Tool with the `callouts` field, imports the types above, or overrides the
`calloutShown` string in their own message catalog.

### Before → after

```tsx
// before
const tool: CustomTool = {
  name: "acme_comment",
  engine: [],
  callouts: [{ label, rangeAt, render }],
};
// after
const tool: CustomTool = {
  name: "acme_comment",
  engine: [],
  textCards: [{ label, rangeAt, render }],
};
```

### Action before updating

Search the code and tests for `callouts`, `CustomCallout`, `CalloutRange` and `calloutShown` (ignoring
`-webkit-touch-callout`) and replace them per the table. Validation of the `tools` array names the `textCards` field in
its error messages: update any tests that compare error texts.

## 3.47.0 — `VirtualGrid` on `GridList`: roles `grid`/`row`/`gridcell`

**Status:** behavior change — minor. The props are the same, existing code builds and
works; the DOM roles and the second argument of `onAction` change.

### What changed

The grid is built on react-aria's `GridList`, not `ListBox`
(ADR-0028,
addendum). The grid is `grid` instead of `listbox`, a cell is a `row` with a
`gridcell` inside instead of an `option`. `onAction` now receives a second argument `{ rect }`.
`minItemHeight` now sets a real minimum cell height: before, a cell took the height of its content.

### Who is affected

Consumer tests that find the grid by role: `getByRole("listbox")`,
`getAllByRole("option")`. Assertions on `onAction` that check the exact argument list
(`toHaveBeenCalledWith(id)`). Cells whose content is shorter than `minItemHeight`: such cells
are taller now.

### Before → after

```tsx
// before
screen.getByRole("listbox", { name: "Frames" });
screen.getAllByRole("option");
expect(onAction).toHaveBeenCalledWith("7");
// after
screen.getByRole("grid", { name: "Frames" });
screen.getAllByRole("row");
expect(onAction).toHaveBeenCalledWith("7", expect.objectContaining({ rect: expect.anything() }));
```

### Semantics and accessibility

Keyboard behavior is unchanged: arrow keys move through the grid, Space selects, Enter opens, Shift+F10 opens
the cell menu. New: buttons inside a cell are now valid; inside an `option` they triggered a
`nested-interactive` violation of serious impact. The selection circle is `<Checkbox slot="selection" />` in the cell
content.

### Action before updating

Find `"listbox"` and `"option"` next to `VirtualGrid` in tests and replace them with
`"grid"` and `"row"`; loosen the `onAction` argument checks. Check how cells shorter than
`minItemHeight` look.

## 3.46.0 — The Editor engine is not in the kit manifest

**Status:** behavior change — minor. The API is unchanged; what changes is what
npm installs together with the kit.

### What changed

The 21 Editor engine packages (`@tiptap/*`, `lowlight`, `highlight.js`, `marked`)
were removed from `peerDependencies`, and the `peerDependenciesMeta` field was
deleted. They were optional peer dependencies, but when installed from the previous
registry, npm pulled the engine in for every consumer — even an application that does not
import the Editor.

### Who is affected

Only those who import `@olddevs/ui/editor` and never installed the engine
explicitly: the packages arrived on their own. After the update, the build fails on an unresolvable `@tiptap/…`.
Applications without the Editor need to do nothing — about 60 packages leave their
lock file.

### Action before updating

Install the engine with the command from the "Installation" section of the
[RichTextEditor](../components/inputs/rich-text-editor.md#установка) page. npm no
longer warns about mismatched Tiptap versions: the `^3.31.4` range is given on
the same page.

## 3.37.0 — An Editor open to extension

**Status:** behavior change — a minor under the "Stability" section of the
[Editor extension API](editor-extension.md#стабильность): the saved HTML,
`onChange`, `onUploadImage` and `focus()` do not change, and the previous code builds.
The note is needed because five changes are visible to current consumers
of `@olddevs/ui/editor`, and one requires installing packages with pnpm. The new API
(a custom Tool, the Handle, events, the Status line) requires no action — it is on the
[extension API page](editor-extension.md).

### 1. Two new peer packages

The blockquote and the divider take their Engine part from `@tiptap/extension-blockquote` and
`@tiptap/extension-horizontal-rule` — optional peer dependencies of the
`@olddevs/ui/editor` entry point with the same `^3.31.4` range (since 3.46.0 the engine
packages are no longer in the kit manifest; see the entry above).

**Who is affected.** Only pnpm (strict `node_modules`) and installs with
`--omit=optional`: npm and yarn install both packages as dependencies of
`@tiptap/starter-kit`, and the import resolves.

**Action before updating.**

```bash
pnpm add @tiptap/extension-blockquote @tiptap/extension-horizontal-rule
```

The full command is on the [RichTextEditor](../components/inputs/rich-text-editor.md#установка) page.

### 2. A divider no longer weighs a character in `maxLength`

**What changed.** Before, the counter substituted a space for a leaf node, and
every `<hr>` took one character from the limit. Now the weight of an Atom is the length of its Atom
text (`renderText`): a divider weighs 0, a soft break 1, an image the length of its
caption. The counter matches `getText()` without Block separators.

**Who is affected.** Screens with `maxLength` and dividers in the Document. A Document
with N dividers fits N more characters, and a Document that was previously
"over the limit" by the number of dividers now fits. If the server
checks length against the same limit and counts `<hr>` as a character, it will reject what the
Editor let through.

**Before → after.**

| Document                  | Before       | After        |
| ------------------------- | ------------ | ------------ |
| `<p>abc</p><hr><p>de</p>` | 6 characters | 5 characters |
| `<p>a<br>b</p>`           | 3            | 3            |

**A paste past the limit** cuts the tail by characters, not by positions; an Atom that
did not fit goes away whole, together with everything after it.

**Action before updating.** Check the server-side length validation against the kit's rule:
the Document's text without markup and Block separators, an Atom by the length of its text.
The kit has no server-side counter: the weight of a custom Atom depends on its Engine part.

### 3. Skeleton before Readiness

**What changed.** Before Readiness, the Editor shows a Skeleton: the field frame, the place of the
Toolbar and the Document sanitized by the Schema, as static HTML with no input. Before, this place was an empty
area; now the field height does not jump. On the server and before hydration, the Skeleton is
only the frame, and the Document appears after mounting in the browser. In `full`, the code
block and the table now arrive as a separate chunk, so Readiness comes
after they load, and the Skeleton is visible until then (in it, the code block is shown with its header
and the table with its cells). The `basic` Preset does not load these chunks and is ready at once. The "start" scenario
(the static graph of the subpath with the engine, what `basic` pays) got lighter: 312.3 → 286.6 kB gzip.
The "full" scenario (with all lazy chunks, `full`) weighs 327.7 kB (measured at 3.37.0; the current table is in
["Import size"](../getting-started.md#размер-импорта)).

**Who is affected.**

- Code that accesses `ref.current.editor` or calls `ref.current.focus()`,
  `insertHTML()` right after mounting: in `full` the engine appears later, and before
  Readiness `editor` is `null` and the Handle's methods do nothing and do not throw.
- Consumer tests with `full` that look for `role="textbox"` synchronously right after
  `render`: the editable area appears after the chunks load. The Skeleton has no
  `textbox` role.
- Visual snapshots of pages with the Editor: in place of the empty area there is the frame and the
  Document.

**Before → after.**

```tsx
// before — focus in the mount effect: in `full` the engine is not there yet, the call does nothing
useEffect(() => ref.current?.focus(), []);

// after — the callback reports the moment of Readiness
<RichTextEditor ref={ref} onReady={() => ref.current?.focus()} />;
```

```tsx
// test: wait for the editable area, do not grab it synchronously
expect(await screen.findByRole("textbox")).toBeInTheDocument();
```

**Action before updating.** Find the uses of `ref.current.editor` and the Handle's methods
in mount effects and move them to `onReady`; in tests, replace
`getByRole("textbox")` for an Editor with `full` with `await findByRole`. To have the chunks
arrive with the page, add `modulepreload` for them
([recipe](editor-extension.md#modulepreload-для-ленивых-чанков)).

### 4. Image messages go through the Field notice channel

**What changed.** "Uploading…", "uploaded", an upload refusal, "not an image" and
"files are not accepted" go through the same channel as the new engine command
`showNotice`: one place under the field, a new message replaces the previous one, and an error
(`role="alert"`) stays until the next Author edit. The texts and roles are the same, but the
live region `role="status"` is now present in **every** Editor, not only with the
`image` Tool.

**Who is affected.** Tests that checked for the absence of `role="status"` in an
Editor without `image` or counted live regions on the page, and screens that
rendered their own paste error line next to the field.

**Action before updating.** Look for the region by the message text, not merely by whether
it is present. Replace your own paste and upload error line with the command
`ref.current?.editor?.commands.showNotice({ tone: "error", text })`: otherwise
the error would be announced twice.

### 5. The `Tool` type accepts descriptions of custom Tools

**What changed.** The `Tool` type (a `tools` element) is now `ToolName | CustomTool`;
the name of a built-in Tool is the new type `ToolName`. The previous `Tool` was a string
name.

**Who is affected.** TypeScript code that treated `Tool` as a string:
`tool.startsWith(…)`, the keys of `Record<Tool, …>`, comparison in a `switch`.

**Before → after.**

```ts
// before
import type { Tool } from "@olddevs/ui/editor";
const labels: Record<Tool, string> = { … };

// after
import type { ToolName } from "@olddevs/ui/editor";
const labels: Record<ToolName, string> = { … };
```

**Action before updating.** `tsc` will find such places on its own; replace `Tool` with
`ToolName` in them. Arrays of names for `tools` do not need to change.

### What else is visible — no action needed

- "Unwrap" in the Block handle menu sits in a separate Tool section before
  "Delete": custom Block actions go to the same place.
- New strings in the `editor` namespace of the message catalog: `toolsFailed`, `retry`, `calloutShown`. If you
  pass your own full message catalog, add them; a partial catalog takes the kit's fallback.

## 3.1.0 — selection in `VirtualGrid` moved to the grid

**Status:** deprecation — the old code still builds. But it
also causes an accessibility violation, which is why the note is here and not
only in `CHANGELOG.md`.

### What changed

`VirtualGrid` gained its own selection axis: `selectionMode`, `selectedKeys`,
`onSelectionChange`. Before, the documentation advised enabling selection inside the
cell, on `MediaCard`. That advice is withdrawn.

### Why

A grid cell is an `option` (the grid is built on react-aria's `ListBox`). A selection
button inside an `option` produces a nested interactive element: axe reports this as a
violation of serious impact, and it reproduced on all themes. A label or an
attribute does not fix it; the only fix is to make the cell itself the selectable element.

### How to replace

```tsx
// before — a selection button inside the cell
<VirtualGrid
  items={items.map((it) => ({
    id: it.id,
    textValue: it.name,
    content: (
      <MediaCard
        preview={preview}
        selected={selected[it.id] ?? false}
        onSelectedChange={(next) => setSelected({ ...selected, [it.id]: next })}
      />
    ),
  }))}
  aria-label="Frames"
/>;

// after — the cell is selected, the card only renders the state
const [keys, setKeys] = useState<Selection>(new Set());

<VirtualGrid
  items={items.map((it) => ({
    id: it.id,
    textValue: it.name,
    content: <MediaCard preview={preview} selected={keys === "all" || keys.has(it.id)} />,
  }))}
  aria-label="Frames"
  selectionMode="multiple"
  selectedKeys={keys}
  onSelectionChange={setKeys}
/>;
```

`Selection` and `Key` are `react-aria-components` types, and the package is in
`peerDependencies` anyway. The consumer still holds the set of selected items: the kit provides
the shape, and the state stays with the consumer
(ADR-0023).

Outside the grid, `MediaCard` does not need to change: the card's own selection axis stayed and
produces no violation — there is no `option` around it there.

## 3.0.0 — one state dictionary

**Status:** breaking change. Exactly one thing breaks, in one place: two state
dictionaries are merged into one. The major carries nothing besides this, and that is a decision
(ADR-0031).

### What changed

`UploadState` and `TimelineStatus` described the same entity — the status of a
job — under two names, with two line-for-line identical tone tables. The debt was
found by the 2.5.0 review; it could not be settled with a patch, as both types were part of the public
API.

Now there is one type: **`ProgressStatus`**. The old names are **removed**, no aliases
are left: a `@deprecated` alias in a major is a second dictionary, and eliminating it
was the whole point.

### Who is affected

Everyone who imports `UploadState` or `TimelineStatus`, and everyone who passes
`state` to `UploadQueue` — **including those who do not import the types at all**.
The `UploadQueue` values changed, and in a JavaScript project neither the compiler
nor the linter will catch it.

Find them in your code:

```bash
grep -rn "UploadState\|TimelineStatus" src/
grep -rn "state: *[\"']\(done\|error\)[\"']" src/
```

`Timeline` is affected by nothing except the type name: its values won out.

### Before → after

| Concept     | `TimelineStatus` | `UploadState` | `ProgressStatus` |
| ----------- | ---------------- | ------------- | ---------------- |
| not started | `pending`        | `pending`     | `pending`        |
| in progress | `running`        | `running`     | `running`        |
| success     | `success`        | **`done`**    | **`success`**    |
| failure     | `failed`         | **`error`**   | **`failed`**     |

```tsx
// before
import type { UploadState, TimelineStatus } from "@olddevs/ui";
<UploadQueue items={[{ id: "1", name: "estimate.xlsx", state: "done" }]} />;

// after
import type { ProgressStatus } from "@olddevs/ui";
<UploadQueue items={[{ id: "1", name: "estimate.xlsx", state: "success" }]} />;
```

The `Timeline` values won out: `success` and `failed` describe the **outcome** and
are symmetric to each other. The pair `done` and `error` is not: the first is about
completeness, the second about an event, and together they read as if "completed with
an error" were also a possible state.

The type name is neutral on purpose: `TimelineStatus` on an upload queue would lie —
it has no timeline.

### Semantics and accessibility

Nothing changes for the keyboard, focus and accessible names. The state tones are the same:
the table `pending → neutral`, `running → accent`, success `→ success`,
failure `→ danger` applied in both components before the merge — only
the key names changed.

**An unknown value still does not crash the screen**: it gets the neutral tone.
Both components had this protection before, and now it is described in the dictionary itself and
not repeated twice. Since 3.0.0 tests guard it in both components — before
that, only `Timeline` had a test.

### Action before updating

1. Replace the type imports with `ProgressStatus`.
2. Replace the values `done` → `success` and `error` → `failed` **in the data**, not
   only in the types. If states come from a backend, map them
   in your adapter: the kit does not know domain dictionaries and does not guess.
3. Run the build. In TypeScript the errors will point to every place; in JavaScript
   the only symptom is the tone: a failed file will be rendered
   neutral instead of red.

### What else appeared — no action needed

Everything below is an addition: the old code keeps working with no edits.

**`SavedViews`** — a switcher of named state snapshots. The shape of a view
is parameterized by your state (`SavedView<T>`) and is not tied to
`TableState`; storage, sharing and the URL stay entirely with you. For details, see the
[component page](../components/table/saved-views.md).

**The `FormField` hint and error reach the react-aria families.** For
`Select`, `Combobox`, `DatePicker` and `TagInput`, the description from `FormField` is now tied to
the field through `aria-describedby`. **This is an accessibility fix, and it changes
what is announced:** where a hint was visible on screen but did not reach a screen reader, a
screen reader will now read it. Your tests for the accessible description of these fields
may need updating — before, there was none at all.

`Select`, `DatePicker` and `TagInput` also gained a public `aria-describedby`
prop; your own value does not replace the `FormField` description, but is merged with
it.

**Figma Code Connect** — 16 mirror main components are bound to the kit's components.
This does not affect the consumer: the bindings do not ship in the package.

### What 3.0.0 does not include

No changes besides those described above. These were deliberately **left out** of the major:

- **RTL** — an open question of the spec; `dir` in the provider stays undeclared;
- **peer React 18** — stays `react: ^19`; widening doubles the consumer's CI
  build and is solved separately;
- **chart components** — will not appear: charts stay with the consumer
  (ADR-0032);
- **`Table` virtualization, CSV export, `JsonViewer`, `LogViewer`** — dropped for
  lack of a requesting screen (ADR-0031).

A major breaks the contract once and in one place. Dumping everything accumulated into it
would force even users the state dictionary does not affect to reread their code.

## 2.6.0 — the package is checked on the consumer's side

Nothing breaking: one new component and one new requirement for the consumer's
build. Exactly one action is required — see item 2.

**1. `ContextualSaveBar`.** A bar for unsaved changes: it appears with the first
edit of a form, shows the number of edits and two buttons. Debt carried over from wave 20. How it differs from
`SelectionBar` and `Banner` is described on the
[component page](../components/navigation/contextual-save-bar.md).

**2. `optimizePackageImports` becomes mandatory in Next.js.** One line in the
consumer's configuration:

```js
// next.config.mjs
export default { experimental: { optimizePackageImports: ["@olddevs/ui"] } };
```

Formally this is not a breaking change: the package builds and works without it.
But **the price without it is unacceptable**: a page with one `Button` weighs 408 kB
instead of 117 at a baseline of 102 (measured at the 2.6.0 release), and a server component with two pure
functions and not a single kit component weighs the same. The cause is the client
graph boundary, not the package's packaging: the same `dist` on plain rollup
ships `Button` at 6 kB.
ADR-0029.

Check your configuration when updating. If the app is not on Next.js,
measure the import cost yourself: the kit has not checked this case yet.

**3. A separate `@olddevs/ui/server` entry point did not appear and will not.** Pure
utilities (`cn`, `tableStateToParams`, `formatMask` and others) are imported from the
root and are not pulled into the client graph if you add the line from item 2.

**4. New package checks** do not affect the consumer, but they explain where the numbers
above came from: `npm run check:dist`, `npm run check:consumer`,
`npm run size`, `npm run release:check`. The version and `CHANGELOG.md` are now maintained
with changesets.

**Deliberately postponed:** Figma Code Connect (priority P2 in the specification, only after
the names and axes stabilize); binding the description for the react-aria families (`Select`,
`Combobox`, `DatePicker`, `TagInput`) — they have their own description slots; merging
`UploadState` and `TimelineStatus` — it breaks a public type and waits for a major;
widening the peer to React 18 — it doubles the consumer's CI build.

## 2.5.1 — two fixes after the 2.5.0 review

Nothing breaking; no action is required from the consumer.

**1. `Truncate` once again tracks size changes after the first truncation.** The `Tooltip` wrapper
recreated the node while `ResizeObserver` stayed on the old one: a column
widened after truncation removed neither `tabIndex` nor the tooltip.

**2. `SortableList` does not lose a row on a drop "onto itself".** When the target key
was among the items being moved, the reorder dropped the last item of the
list and passed a corrupted order to the consumer. Now such a drop changes nothing
and is not passed to the consumer. The reorder mechanics are extracted into a pure function and
tested on arrays.

**A debt that was named but not closed:** `UploadState` (`done`/`error`) and
`TimelineStatus` (`success`/`failed`) are two dictionaries for one concept. Merging them into
one breaks the public type released in 2.5.0 and waits for the next major.

## 2.5.0 — data, uploads, notifications

Nothing breaking: everything new is additive, and `AppShell` gained one slot.

**1. Eight new component families.** `Banner`, `UploadQueue`, `NotificationItem` /
`NotificationList` / `NotificationCenter`, `MediaCard`, `SortableList`,
`VirtualGrid`, `CopyButton`, `Truncate`.

**2. `AppShell` gained a `banners` slot** — app-level messages above the
header. Without the prop, the shell's markup stays identical node for node. Banners are not sticky, and
`--topbar-h` still means exactly the header height: the stickiness contract
is not touched.

**3. No new dependencies.** Drag and drop and virtualization are built on
`react-aria-components`, already declared as a peer dependency, and not on `@dnd-kit`
and `@tanstack/react-virtual`, as in the source app's frontend
(ADR-0028).

Two consequences for those migrating from that frontend:

- `SortableList` renders a **drag handle** in every row. Without it,
  react-aria does not allow dragging from the keyboard at all — it only warns in the
  console. The handle is mandatory.
- `VirtualGrid` **scrolls its own container, not the window**. Give the container
  a height: without it, virtualization will not turn on, and the grid will render all cells at once.
  The grid in that frontend is built on `useWindowVirtualizer` and scrolls the page.

**4. New message catalog namespaces:** `banner`, `uploadQueue`,
`notifications`, `mediaCard`, `sortableList`, `copyButton`. The keys are additive —
`PartialUiMessages` is deeply partial, so this does not count as breaking.

**5. Postponed:** `ContextualSaveBar` — to wave 21. `SortableGrid` is not created:
the grid will get drag and drop when a requesting screen appears. Charts,
`JsonViewer`, `LogViewer` — priority P2, taken on for a specific screen.

The scope of the wave is covered in detail in ADR-0027.

## 2.4.0 — the field format is visible and announced

Nothing breaking, but **the look of two released components changed** — read
item 1 even if you updated nothing in the code.

**1. `MaskedInput` and `PhoneInput` show the format right in the field.** An empty
phone field now reads `+7 (___) ___-__-__`, and the mask guide disappears as you
type. Before 2.4.0 nothing communicated the format: an empty field was an empty
rectangle, and a half-filled one broke off at the last digit.

It is on by default, deliberately: the absence of a format was a defect. It is turned off with a prop:

```tsx
<MaskedInput mask="99.99.9999" value={value} onChange={setValue} showMask={false} />
```

Turn it off where the format has already been stated nearby and repeating it in the field is noise:
a short well-known mask in a dense table, a field under a label with an example.

**2. The `FormField` hint and error are announced by a screen reader.** Before, they were
visible only on screen: `FormField` rendered them as a `<div>` without an `id`, and there was
no way to tie them to the field. Now `FormField` generates the `id`, and the kit's fields
pick it up and use it in `aria-describedby`.

No action is required from the consumer. If you described the field with your own node,
the description is **supplemented, not replaced**: the attribute holds a list.

`TextControl` and everything built on it (`MaskedInput`,
`PhoneInput`, `PasswordInput`, `SearchControl`), plus `NumberInput`, pick up the description. The react-aria
families (`Select`, `Combobox`, `DatePicker`, `TagInput`) carry their own description slots
and do not pick up the `FormField` hint yet.

**3. A character that does not fit the mask is announced.** A character that did not fit the mask token
is still dropped, but a live region appears next to the field saying what was
expected here. Exactly one typed character is parsed; a paste is not parsed.
The new message catalog namespace is `maskedInput`; it has two keys, and they
exist in the `ru` locale.

**4. `TextControl` gained an `underlay` slot** — a backing under the value, on the same
line. The mask guide is built on it. The component itself puts `aria-hidden` on the backing and
sets `pointer-events: none` on it: there is nothing to read there.

The rationale for the decisions and the sources are in ADR-0026.

## 2.3.0 — advanced input fields

Nothing breaking: everything new is additive, and `FormField` gained one axis,
which is enabled by passing a prop or a context.

**1. New components:** `PasswordInput`, `FormLayout` with `FieldRow`,
`PinInput`, `InlineEdit`, `TreeView`, `MaskedInput`, `PhoneInput`. New
utilities: `formatMask`, `unmask`, `maskCapacity`, the constant `RU_PHONE_MASK`.

**2. `FormField` supports a side label.** `layout="stack" | "side"`; without the prop
and without `FormLayout` the markup stays identical node for node — a whole-markup test
checks this. The axis lives on the field, not on the layout, because the label is rendered
by `FormField` (ADR-0025). The width of the label column is the variable `--form-label-w`.

**3. `CurrencyInput` will not appear.** It is a `NumberInput` with `formatOptions`:
react-aria formats the currency, parses the input and takes the grouping separators and
the decimal separator from the locale. A separate component would duplicate an existing one:

```tsx
<NumberInput label="Amount" formatOptions={{ style: "currency", currency: "RUB" }} />
```

**4. `TreeSelect` is postponed until a requesting screen appears.** It is assembled from `TreeView` and
`Popover`; creating it without a single screen means designing blind —
exactly what wave 18 paid for by redoing `TablePreferences` from a menu into a
panel. When a screen with a choice from a hierarchy appears, the question will return too.

**5. `PhoneInput` has one fixed format.** The promise of "format from the locale"
is withdrawn: `Intl` does not format phone numbers at all, and proper parsing is
`libphonenumber`, weighing hundreds of kilobytes. The format comes as a prop with the default
`RU_PHONE_MASK`. The component does not parse a number, does not keep a country list and does not
validate.

**6. `PinInput` returns a string, and there are no gaps in it.** The cells are a display of one
value, not N independent ones: deleting a character in the middle shifts the others
left, as in an ordinary text field.

**7. The `TreeView` role is `treegrid`, and the nodes are `row`.** That is how react-aria is built: a
row holds the expand button and a checkbox, and a `treeitem` does not expect a second interactive
element inside itself. If you look for nodes in tests, query them by the
`row` role. The kit does not re-export `useTreeData`: it is a store, and the
kit does not own state.

## 2.2.0 — the product table

Nothing breaking: everything new is additive, and `Table` gained one axis, which
is enabled by passing a prop.

**1. `Table` supports row expansion.** `renderDetail` plus `expandedKeys` /
`onExpandedChange`. Without `renderDetail` the markup stays identical node for node — a test
checks this. Expanded rows are held as a set of keys, like selection: there is no "one
row or several" switch, because the table does not store state and cannot support
such a prop.

**2. `rowLabel` should be passed together with expansion.** Without it, all
expanders have the same name, and a screen reader in button-listing mode reads
twenty identical "Show details".

**3. `UiProvider` accepts `density`.** A default, not a mode: the table and its
gear override it. The prop was promised in 2.0.0 and postponed by ADR-0002 until
something read it; `DataTable` became that reader.

**4. New components:** `DataTable`, `TableToolbar`, `TablePreferences`,
`FilterBar`, `FilterBarAdd`. New utilities: `useTableState`,
`tableStateToParams`, `tableStateFromParams`, `DEFAULT_TABLE_STATE`.

**5. Selection is within a page.** "Select all" marks the `items` that arrived;
the kit does not support selecting the whole result set, and the labels about it do not lie.
If you need selection beyond the page, that is your code, not the kit's.

**6. State is carried into the URL without selection and expansion.** The list of keys
has no length limit, and a link opened the next day would mark records
that no longer exist.

## 2.1.2 — navigation in the mobile-mode drawer

Nothing breaking. `SideNav`, shown by `AppShell` in a `Drawer`, no longer
collapses: there is no collapse button there, and `collapsed` and `defaultCollapsed` have no effect in the
overlay. The icon mode gives width to the page content —
there is nothing next to the drawer to give the width to.

If you keep the collapsed state yourself and it survived a reload, the behavior
changes for the better: before, the drawer opened with icons and no way to expand them.
The column on a wide screen works as before; `onCollapsedChange` is not
called from the drawer.

### Two icons changed their look

`lucide-react` redrew `Calendar` and `CircleCheck` between 1.27 and 1.41 —
in the kit these are `CalendarIcon` and `SuccessIcon`. The peer dependency range
(`^1.27.0`) did not change, which means **this will happen even without updating the kit**: any
consumer whose `lucide-react` resolved to 1.41 will see the new glyphs.

No action is required. The line is here because the look of icons is part of the visual
contract: `icons.ts` decides which glyph represents a meaning, and when the glyph itself
is redrawn, it is useful to know. The export names stay intact — `tests/icons.test.ts`
guards that.

Along the way, `@playwright/test` brought a newer Chromium, and it renders the `<textarea>`
resize handle differently. This does not affect the kit at all: the element is rendered
by the browser. It is mentioned because, together with the icons, it explains all 38
rewritten showcase snapshots.

## 2.1.1 — fixes after the 2.1.0 review

Four defects found by the review right after the release. Nothing breaking.

**1. `TopBar` lost its background** if the consumer passed their own `style`:
the attribute was overwritten entirely, and the sticky header with blur showed the scrolling
content straight through. Now the consumer's `style` supplements the background, and a `background` set
by them overrides it deliberately.

**2. `themeInitScript` did not escape `<`.** A storage key containing `</script>`
closed the inline tag on the spot. There was no exploitable XSS (the key is set by the
developer), but the kit generates code for `dangerouslySetInnerHTML`, and protection
here is on by default.

**3. `useAppShell` became public.** Before, `openNavigation` could be read only by the
kit's `TopBar`, and a consumer with their own header got navigation that **cannot be opened**
below `md`. If you have your own header, use the hook and render the button;
there is an example on the [AppShell](../components/app-shell/app-shell.md) page.

**4. The class coverage gate** now sees the shell components. Along the way, the dead
`group` class on `NavItem` is removed — it has no `group-*` variants.

## 2.1.0 — the app shell

**Nothing breaking.** The wave only adds: `AppShell`, `SideNav`, `NavGroup`,
`NavItem`, `TopBar`, the theme registry and two width tokens. Existing code
keeps working with no edits.

What to know when upgrading.

**1. `--topbar-h` can now be published by the kit.** Before, only the app declared the
variable. If you put the kit's `TopBar` next to your own header,
both will start writing to the same variable. Separate them: `heightVar="--my-topbar-h"`
or `heightVar={null}` on the one that should not publish. An app without the kit's
`TopBar` is not affected at all.

**2. You can stop duplicating the theme lists in your own code.** `UI_THEMES`,
`UI_ACCENTS`, `UI_BRANDS`, `normalizeTheme`, `applyTheme` and
`themeInitScript` now come from the kit. Replace your own constants like
`["light","dark","dim"]` with them: they can no longer diverge from `styles.css` —
a test guards that.

**3. The kit does not provide and will not provide a theme switcher component.** Ready-made code for both
variants is in the [recipe](../theming.md#переключатель-темы). The decision and its reasons are in
ADR-0020.

**4. Sidebar widths are tokens, not props.** `--sidenav-w` (240px) and
`--sidenav-w-collapsed` (72px). They change in one place; see
[theming.md](../theming.md).

**5. The `NavigationIcon` icon** is added to `@olddevs/ui/icons` — the header's
"hamburger".

## Pre-release check

- Check that the component page and the component catalog are updated according to `AGENTS.md`.
- `npm run typecheck`, `npm test`, `npm run format:check` — the API and examples do not
  diverge from the package.
- For changed interaction — Storybook and a targeted a11y/interaction test.

## Related sources

- The root entry point of the package: `src/index.ts`.
- Icons: `src/icons.ts`.
- The catalog of component pages: `docs/components/index.md`.

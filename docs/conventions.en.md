---
sourceHash: 502667bd31f1
---

# General conventions for `@olddevs/ui`

## Public contract

The public API is the runtime exports from [`src/index.ts`](../src/index.ts), the types, the entry points
described in the documentation, and `styles.css`. The sources in `src/components/` prove the behavior, but they
are not an import path that consumers may use.

## Semantic prop vocabulary

Unless a specific page says otherwise, primitives use three independent axes:

| Prop      | Values                                              | Question it answers          |
| --------- | --------------------------------------------------- | ---------------------------- |
| `size`    | `sm`, `md`, `lg`                                    | How large is the element?    |
| `tone`    | `neutral`, `accent`, `success`, `warning`, `danger` | What does the state mean?    |
| `variant` | `solid`, `soft`, `outline`, `ghost`                 | How prominent is this value? |

States are named positively: `selected`, `disabled`, `loading`. A native ARIA state may use its own correct name,
for example `checked` on a switch. Do not create alternatives such as `kind`, `status` or negative boolean props
without a separate public decision. `active` already has one meaning, see below.

Props outside the three axes repeat across several components. One concept, one name: a second component with the
same meaning takes the name from here, and does not invent its own.

| Prop         | Meaning                                                                                     | Where                                 |
| ------------ | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| `appearance` | The form of a variant: the markup changes, not the prominence of the tone                   | `RadioGroup`, `CheckboxGroup`         |
| `active`     | The current navigation item: `aria-current="page"`                                          | `NavItem`, `MobileTabBarItem`         |
| `activeKey`  | The same for a data collection: the key of the current node, `aria-current="page"`          | `TreeView`                            |
| `level`      | Heading level, `2`–`4`: the component renders a real `<h2>`–`<h4>`                          | `SectionHeader`, `NotificationCenter` |
| `kind`       | The kind of **data**, not of an element: what value the field describes and how to enter it | `FilterField` (ADR-0063)              |

- **`kind` on `FilterField` is a public decision (ADR-0063), not a workaround for the axis.**
  `FilterField` describes a data field, not a UI element: `"values"`, `"number-range"` and `"date-range"` say
  what value the field holds and what input sets it. It is not a presentation (`variant`) or a variant form
  (`appearance`): a description of data has no tone and no markup. Components that draw an element still do not
  get `kind`.
- **`appearance`, not `variant`.** `variant` is the axis for how a tone is presented, with a closed set
  `solid|soft|outline|ghost` across the whole kit. `appearance="card"` changes the form of the variant itself:
  the border, the indicator and the description inside the label. Under `variant`, such a value would give the
  axis a second meaning: `variant="card"` on one component would sit next to `variant="soft"` on another.
- **`active`, not `selected`.** `selected` is a choice in a set (`aria-selected`, `aria-checked`): the user
  changes it. The current section is `aria-current`: the route sets it, and the item stays a link. `active` has
  no other values, and it does not become a synonym for `selected`. Where there are no item elements but keyed
  data (`TreeView`), the same concept is called `activeKey`, after `selectedKeys` and `expandedKeys`: one value
  instead of a set.
- **`level`, not `headingLevel`.** The level depends on where the component is placed, and the consumer knows
  that. `SectionHeader` already had a prop called `level`. A second name for the same concept would silently
  drift from it.

## Accessible name

The rule comes from `Toolbar`, `Carousel`, `MobileTabBar` and `TagGroup`. Before it, these components handled the
required name in different ways: in one, `label` was shown on screen, and in another it went into an attribute.

- **`label` is only a visible caption.** A prop with this name draws text on screen. A name that is not drawn is
  set with its own ARIA attribute.
- **Without a visible caption, use exactly one of `aria-label` and `aria-labelledby`.** The type is
  [`AccessibleName`](../src/lib/accessible-name.ts), a union with `never`: TypeScript rejects a call with no name
  and a call with both. Two sources of one name drift apart silently when you edit.
- **A name with a default from the catalog** uses `Partial<AccessibleName>`: you can pass nothing, but not both
  (`MobileTabBar`). The default is announced even when an empty string is passed.
- **Visible caption or attribute:** `{ label; "aria-label"?: never;
"aria-labelledby"?: never } | ({ label?: never } & AccessibleName)` (`TagGroup`). A caption together with an
  attribute is not allowed: the attribute would override the visible text, and a screen reader would give the
  component a different name than the one on screen.
- The test locks the shape with `@ts-expect-error`: for "no name" and for "both at once".

Components released before this rule use `label` as the name string without a visible caption (`SideNav`,
`TopBar`, `FilterBar`, `ScrollArea` and others). Renaming it there is a breaking change and a separate decision.
A new component follows the rule.

## Empty value

An empty string is neither a caption nor a name. The rule and its history are in
[`src/lib/empty.ts`](../src/lib/empty.ts). For a prop of type `string`, write the fallback with `||`, not `??`.
For `ReactNode`, use `hasContent`, not `!= null`. `??` and `!= null` let `""` through: the component renders an
empty node, stays without a name, or labels a button "Удалить: ". Each such branch is covered by a test with an
empty string.

## What the tests check

A test renders the component as a consumer does (Testing Library and user-event), and checks what can be observed:
roles, names, ARIA attributes, focus, handler calls and text. Internal state and hooks are not tested.

**A class is tested only when it is the observable contract that jsdom would not otherwise see**: jsdom does not
compute the cascade, the layout or `env()`. Examples are the tone from the dictionary (`TONE_TOKENS`,
`CHOICE_CARD_SELECTED_BORDER`), the slide width and column count from the component dictionary, and the bar
background inside and outside the slot (`BACKDROP_CLASS` of `MobileTabBar`). Take the expected value **from the
dictionary, not as a literal**: a literal checks that nobody touched the string, while the dictionary checks that
the component picked the right cell.

Arbitrary layout classes (`h-7`, `rounded-full`, `ring-bg-1`) are not locked by a test. Visual snapshots guard
them, and [`tests/class-coverage.test.ts`](../tests/class-coverage.test.ts) checks through a matrix that each
class reaches the CSS. If such a class has an observable effect (a description inside the label, a node in the
DOM, an attribute), test the effect.

## State management

Components mostly take the value and the callback from the consumer. The consumer is the only owner of domain
state, the request, the route and validation. On a component page, always state:

- the shape of the value and of the empty value (`null`, an array, a string, and so on);
- controlled props and the callback;
- allowed state transitions;
- the behavior of disabled and loading;
- the integration with a native form, if there is one.

Do not infer the API from how a story looks: check the type and the source.

## How to read a component page

Every page must contain:

1. A short answer for AI and the limits of use.
2. The closest alternatives and what not to do.
3. A minimal working example with the correct import.
4. An explanation of the public props, states and events.
5. Accessibility, the keyboard, focus and the boundary with forms.
6. Anti-patterns, special cases and links to the source and Storybook.

## Source layout

A component folder in `src/components/<category>/` matches its page folder in `docs/components/<category>/`.
There are eight categories (`actions`, `inputs`, `date-time`, `overlays`, `navigation`, `content`, `table`,
`app-shell`). There are no files at the root of `src/components/`. Inside a category, files are flat: an internal
part lives next to its owner. When a component changes its category, its page changes with it.

In `src/editor/`, only the entry points stay at the root: `RichTextEditor`, `RichTextView` and their stories.
Everything else is in subfolders: `core/` holds the engine and the Tool registry, `ui/` holds the shared glue code,
`styles/` holds the styling, `hooks/` holds the hooks, and `features/<feature>/` holds the node, commands, Tool and
UI of one feature.

`index.ts` files are not allowed in categories, layers or features: imports go directly to the file. Barrel files
are allowed only as entry points of the package. `tests/structure.test.ts` checks the layout.

## Changing the API

When you add or change a runtime export, update its page, its entry in the catalog and the registry in the same
change set. A breaking change also needs an entry in `docs/api/migration-notes.md` with the action for the
consumer. Do not hide a change behind behavior that looks similar.

## User-visible strings

Every label that a user sees or hears goes through the message catalog: `prop ?? messages.family.key`. The prop
stays: it is a targeted override, not the only way.

A string literal in JSX or in a prop default fails `npm test`
([`tests/i18n-gate.test.ts`](../tests/i18n-gate.test.ts)). The exceptions are an explicit list, with the reason
given in the gate itself (three reasons are described below), not a regexp.

To add a key, see [i18n.md](i18n.md).

## Language: what is in Russian, what is in English

The boundary follows the audience, not the file type: this is the decision in ADR-0034.

| In Russian: the kit explains to itself | In English: the kit shows to the outside                    |
| -------------------------------------- | ----------------------------------------------------------- |
| Comments in the sources                | Showcase: sections, story names, demo content, `aria-label` |
| This documentation and the ADRs        | Tests: names, fixtures, data                                |
| Text in the Figma mockups              | Script output to the console                                |

Comments stay in Russian on purpose, and the i18n gate does not check them. A Russian comment above an English
story is normal, not unfinished work.

Russian is legitimate in tests where it is the **subject** of the check: the plural and case forms and the catalog
words live in `tests/locale-ru.test.tsx`. In other tests, the expected values come from the English fallback.

The gate's allowlist covers **three reasons, not three files**: the keyboard layout as input data (`Keyboard.tsx`
and its test), the Russian catalog (`locales/ru.ts`), and a Russian word as the subject of a check
(`locale-ru.test.tsx`, plus the `SortableList` scenario in `tests-visual/interactions.spec.ts`, where react-aria
localizes the announcements itself). A fourth reason is a case for review, not a reason to change the number.

## Showcase story names

Section and story names are in Latin script. They make up the story `id`, and the `id` gives the name of the
snapshot file and its address in `tests-visual`. Renaming costs a baseline regeneration, so pick the name once.

A component's section is its category: the folder of its page in the Reference and of its source (ADR-0060). The
story `src/components/overlays/Dialog.stories.tsx` is named `Overlays/Dialog`. Editor stories take their section
from the folder of their own page: `Inputs/RichTextEditor`, `Content/RichTextView`.

| Section          | What is inside                                              |
| ---------------- | ----------------------------------------------------------- |
| `Actions/`       | Actions and feedback: `Actions/Button`, `Actions/Alert`     |
| `Inputs/`        | Fields and choice: `Inputs/Select`, `Inputs/RichTextEditor` |
| `Date and time/` | Calendars and date and time pickers                         |
| `Overlays/`      | Dialogs, drawers, popovers, menus, tooltips                 |
| `Navigation/`    | Tabs, breadcrumbs, page and section headers                 |
| `Content/`       | Typography, cards, data, states, layout                     |
| `Table/`         | The data table and its panels                               |
| `App shell/`     | App shell: `AppShell`, `SideNav`, `TopBar`                  |
| `Foundations/`   | Basics: icons, motion                                       |
| `Screens/`       | Assembled screens                                           |

**Dictionary of repeated names.** A name that appears a second time must be added here. Otherwise the same case
gets two different names in two files, and they drift apart silently.

| Name              | When                                                   |
| ----------------- | ------------------------------------------------------ |
| `Playground`      | The main story with controls                           |
| `Matrix`          | All variants side by side; captured by the visual test |
| `Empty`           | Empty state                                            |
| `Disabled`        | Disabled state                                         |
| `WithError`       | Validation error                                       |
| `WithAction`      | With an action button                                  |
| `WithSelection`   | With a selection                                       |
| `Sizes`           | Size scale                                             |
| `Horizontal`      | Horizontal layout                                      |
| `Compact`         | Dense layout                                           |
| `SizesAndStates`  | Sizes and states side by side                          |
| `Collapsed`       | Collapsed navigation state                             |
| `Submitting`      | The form is being submitted                            |
| `InForm`          | The component inside a form                            |
| `AsPage`          | Full-screen variant                                    |
| `WithoutTitle`    | Without a title                                        |
| `States`          | A set of states side by side                           |
| `Filled`          | The field is completely filled                         |
| `Open`            | An expanded list or calendar                           |
| `Tones`           | Tone scale                                             |
| `WithLabel`       | With a visible label                                   |
| `Cards`           | Choice variants shown as cards (`appearance="card"`)   |
| `CardsHorizontal` | Choice cards in a row                                  |
| `CardsStates`     | States of choice cards side by side                    |
| `CardsTones`      | Tone scale of choice cards                             |
| `Controlled`      | Controlled mode: the story holds the value             |
| `Wrapping`        | Wrapping at a narrow width                             |
| `Vertical`        | Vertical layout                                        |
| `Badges`          | All kinds of badge side by side                        |

Single-word names describe the **case**, not translate a word: a story about how a component differs from its
neighbors is called `VersusNeighbours`, not a transliteration of a Russian heading.

**Snapshot width is set by a story tag.** The visual test takes a snapshot of a story at 1280×900. A story that
shows a narrow screen sets the tag `tags: ["viewport-phone"]` on itself, and it is captured at 375×812 with an
emulated screen cutout at the bottom (34px). It is a tag, not a parameter: the spec reads stories from
`storybook-static/index.json`, which has no parameters. The first such story is `AppShell` → `WithBottomBar`: at
1280px the slot hides the bar.

**A lazy chunk that loads after the story is shown is also set by a tag.** The snapshot waits for two identical
frames in a row. While a chunk is in transit, the screen does not change, and the snapshot takes a story that is
not fully loaded for a finished one. A story part of which arrives as a lazy chunk after it is shown sets the tag
`tags: ["network-idle"]`: the snapshot and the axe audit wait for the network to be quiet. The first such stories
are `RichTextEditor` → `TextCardOpen` and `TextCardRussian`: the chunk of the Text card is requested only after the
engine reaches Readiness.

**A story name must not match the name of the imported component.** A story about `Separator` in
`Separator.stories.tsx` must not be called `Separator`: the export shadows the import, and `tsc` fails with
`cannot be used as a JSX component`. It fails only where the component is used as JSX. Hence the names
`Separators`, `Scrolling`, `HiddenContent`, `BasicTable`.

## Warnings in development mode

The first such warning is on `NotificationItem`, which gets both `onAction` and `actions`. The rules come from it,
and they are written here so the next author does not invent their own.

**When to warn.** Only when a contract is broken that **types catch but a consumer in JS does not**, and the
component silently picks one reading of it (mutually exclusive props, where one of them is ignored). Do not warn
about style, non-optimal use, deprecation (for that, use `migration-notes.md`), or what React or `react-aria`
already catches itself. A violation after which the component cannot work is not a warning but an exception (like
`HoverCardContent` outside `HoverCard`).

**How.**

- Through [`devWarn(message)`](../src/lib/dev-warn.ts), not a bare `console.warn`. The helper shows the message
  **once** (the key is the text) and **does not write in production**. The call sits in the render body, so
  showing once is required: a list row renders hundreds of times, and `StrictMode` calls the render twice.
- The text is **in English**, because it is output to the consumer's console (ADR-0034). It does not go into the
  message catalog, because it is not an interface string. The text names the component, the value that was
  passed, the value that won, and how to fix it. Keep changing data out of it: the deduplication key is the text
  itself.
- The mode is read as `process.env.NODE_ENV !== "production"` inside `try/catch`, on every call. The package
  ships as plain `tsc` output, and the value is not baked into `dist`. The consumer's build sets it (Vite, Next,
  webpack) and removes the dead branch in production. Without a bundler, `process` is not defined: a reference to
  it throws a `ReferenceError`, and the helper stays silent. The check `typeof process !== "undefined"` does not
  work: the bundler does not replace it, so in a Vite browser build the warning would never fire.
- Test: `vi.spyOn(console, "warn")`, `resetDevWarnings()` in `beforeEach` (the "already shown" state lives at
  module level), and four cases: it warns in development, it warns once, it stays silent in production
  (`vi.stubEnv`), and it stays silent on a correct call.

**An error instead of a warning: `devError(message, cause?)`.** Use it when a violation breaks the whole component
but not the page: the Tool set of `RichTextEditor` is built incorrectly, the loader of the Extensions failed,
`rangeAt` of the Text card threw an exception. The field shows the author a catalog string on its own, and the
cause goes to the developer through `console.error`, with the same rules as `devWarn`: in development, once per
text, in English.

- The text starts with the component name (`RichTextEditor: …`), because the console is shared by the whole page.
  A Tool name or an entry name in the text is allowed: it comes from the Tool's description and does not change
  from call to call.
- A caught exception goes in as the second argument (`cause`), not in the text. Its message would make every error
  new for the once-per-text key. The console also shows the stack for an `Error` object.
- The test follows the same pattern with `vi.spyOn(console, "error")`: an error in development with the exception
  as a separate argument, once; silence in production (`vi.stubEnv`); and silence on a correct call
  (`tests/rich-text-editor-dev-errors.test.tsx`).

## `readOnly` and `disabled` are separate axes, not shades of one

The rule comes from `Rating` (wave 25). It is written here because the next author would not find it in one
component's docstring, and a second `readOnly` in the kit would then mean something of its own.

- **`readOnly` is data on display.** The value is visible, and it cannot be changed. Such a value must not be
  dimmed: that would hide what is shown on purpose. The control leaves the tab order, but stays at full strength.
- **`disabled` is an action that is unavailable right now.** It is dimmed, because dimming is the signal that it
  is unavailable.

**The role does not change.** A disabled control stays what it was and is marked with `aria-disabled`. Swapping the
role (for example, to `img`) would be read as a picture, not as an unavailable action. The role is a property of
the control, not of its availability right now.

## Editor glossary

The Editor terms moved to the kit's shared [glossary](glossary.md#редактор).

---
component: ShortcutsHelp
exports: [ShortcutsHelp, ShortcutGroup, ShortcutItem, ShortcutsHelpProps]
category: overlays
status: stable
source: src/components/overlays/ShortcutsHelp.tsx
story: src/components/overlays/ShortcutsHelp.stories.tsx
sourceHash: ab935ac387f6
---

# ShortcutsHelp

## Summary for AI

A modal dialog with a list of keyboard shortcuts, built on `Dialog`. Props: `open`,
`onOpenChange`, `title` (by default "Keyboard shortcuts" from the message catalog)
and `groups` — an array of groups `{ id, label, items }`, where an item is
`{ keys, description }`. Each key is rendered with its own `Kbd`. A group is
announced as a named group (`role="group"`), not as a heading. The kit **does not
register global shortcuts**: which key opens the list and which shortcuts exist at
all is up to the app.

## When to use

- A screen with keyboard navigation: the user must find out what to press without
  reading the docs. The model is the "Keyboard shortcuts" dialog at GitHub,
  Linear and Atlassian.
- There are more than a few shortcuts, and it is convenient to lay them out in sections.

## When not to use

- A shortcut next to a single menu item is a `Kbd` inside the item; in
  `CommandPalette` the shortcut lives in the `shortcut` property. A whole dialog for
  one key is excessive.
- Editing shortcuts, binding shortcuts and searching the list are not the
  component's job: it only shows a list. That is a separate settings screen.
- Do not confuse it with `Keyboard`: that is the name of the **on-screen
  keyboard** for entering text ([`Keyboard` page](../content/keyboard.md)), not a way to render
  "Ctrl+K". A shortcut is assembled from `Kbd`.
- A list that must not cover the page is a help panel in a `Drawer` or a separate
  page; `ShortcutsHelp` is modal and covers the background.

## Minimal example

```tsx
import { Button, ShortcutsHelp, type ShortcutGroup } from "@olddevs/ui";

const groups: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: [
      { keys: ["Ctrl", "K"], description: "Open search" },
      { keys: ["G", "H"], description: "Go to home" },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [{ keys: ["Esc"], description: "Close the dialog" }],
  },
];

const [open, setOpen] = useState(false);

<>
  <Button onClick={() => setOpen(true)}>Keyboard shortcuts</Button>
  <ShortcutsHelp open={open} onOpenChange={setOpen} groups={groups} />
</>;
```

## Opening with "?": a consumer recipe

The kit installs no global handlers, and that is a decision, not an omission: the
key that opens the list fires in input fields and over other dialogs, and only
the app knows what to do in those cases. The handler is yours to write; three
things in it are required (see the `OpenWithQuestionMark` story for working code):

```tsx
useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    // The character, not the position: "?" sits on different keys (Shift+/ on a
    // Latin layout, Shift+7 on a Russian one), and the user presses the character itself.
    if (event.key !== "?" || event.isComposing || event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
    ) {
      return; // in an input field a question mark is just a character
    }
    event.preventDefault();
    setOpen(true);
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}, []);
```

1. **Check the character for "?" and the position for letters.** The user looks for
   the question mark on the keyboard, and on a Russian layout it sits on Shift+7 —
   `event.key` returns "?" on both layouts. Check letter shortcuts ("G, H") by
   `event.code` (`KeyG`): if you compare characters, they stop working on another
   layout.
2. **Do nothing in input fields**, otherwise a question mark cannot be typed.
3. **Do not react to** shortcuts with `Ctrl`, `Alt` and `Meta`, auto-repeat and
   input through an IME (input method editor, `isComposing`).

If the list must also open over an already open dialog, that is also the app's
decision: the kit's `Dialog` keeps an Escape stack, and Escape closes the top one.

## Public API

### `ShortcutsHelp`

| Prop           | Default                                         | Meaning                                                                                                            |
| -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `open`         | —                                               | Whether the dialog is shown. The consumer owns the state.                                                          |
| `onOpenChange` | —                                               | Called when the dialog requests a state change: the close button, Escape and a click outside call it with `false`. |
| `title`        | "Keyboard shortcuts" (from the message catalog) | The dialog's title and its accessible name. `ReactNode`.                                                           |
| `groups`       | —                                               | Groups of shortcuts. A group with no items is not rendered or announced.                                           |

### `ShortcutGroup` and `ShortcutItem`

| Property           | Meaning                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `group.id`         | A stable React list key; it does not reach the markup as an `id` (for `aria-labelledby` the kit uses the group index). |
| `group.label`      | The group's label, `ReactNode`.                                                                                        |
| `group.items`      | The group's items.                                                                                                     |
| `item.keys`        | Keys in order: `["Ctrl", "K"]`. Each one is its own `Kbd`; a merged "Ctrl+K" is not parsed.                            |
| `item.description` | What the shortcut does, `ReactNode`.                                                                                   |

The default strings are `shortcutsHelp.title`, `shortcutsHelp.list` (the name of
the scroll area) and `shortcutsHelp.keySeparator` (the word read aloud between
keys) in the `ru` and `en` message catalogs.
Other strings — `title`, `label` and `description` — come in as props: the kit does
not know the shortcuts and their names.

## Behavior and accessibility

- The dialog is `role="dialog"` named by its title; the focus trap, Escape, a
  click outside and focus return to the element that opened it come from
  `Dialog`. After closing, focus returns to the button that opened the list; if
  the list was opened by a keyboard shortcut, to the element that was focused.
- **A group is a named group, not a heading.** `role="group"` with
  `aria-labelledby` pointing at the label — as in `NotificationList`. The heading
  level depends on where the dialog ends up, and the kit cannot know it; the
  only heading in the dialog is its name.
- **An item is a list item** (`ul`/`li`): "description, then the shortcut". A
  list was chosen over `dl`: "term — definition" pairs are announced
  inconsistently (some screen readers name neither the number of pairs nor their
  boundaries), while a list is read everywhere — "list, 3 items".
- **The word "plus" is read between the keys.** Each key is a `<kbd>`, and the visible "+"
  between them is removed from the accessibility tree (`aria-hidden`), with a word
  from the message catalog read in its place: "Ctrl plus K". The "+" sign is voiced
  according to the user's settings (NVDA skips it at the default punctuation
  level), and without the word "plus", "Ctrl K" would sound like two keys in a row. A
  single key gets no separator.
- In `CommandPalette` an item's shortcut is entirely `aria-hidden` — it is a shortcut hint
  next to an item that can be chosen anyway. Here the shortcut is the dialog's
  only content, and hiding it would hand a screen reader an empty keyboard shortcuts dialog.
- **Scrolling inside the dialog.** The list sits in a `ScrollArea` no taller than
  70% of the screen height and no taller than 32rem: the header with the close
  button stays in place. The area is a Tab stop with a separate name ("Shortcuts" /
  "Сочетания клавиш", key `shortcutsHelp.list`), and it is scrolled with the arrow
  keys and `PageDown`.
- Key names are text that you pass. A word ("Ctrl", "Shift") is read everywhere;
  screen readers voice a glyph ("⌘", "⇧") differently, and if your app shows a shortcut only as a glyph, label it with a word in
  `description`.

## Anti-patterns

- Expecting the component to open itself on "?" or another shortcut: it does not
  listen to the keyboard.
- Passing a shortcut as one string: `keys: ["Ctrl+K"]`. That is one `Kbd` with
  long text and no word to read aloud.
- Putting interactive elements in `description`: the list is a reference, not a menu.
- Storing domain shortcuts and their names in the kit — they belong to the app.
- Adding `h3` headings inside groups by hand: the groups already have a name.

## Related sources and Storybook

- Source: `src/components/overlays/ShortcutsHelp.tsx`; the key is `src/components/content/Kbd.tsx`,
  the dialog is `src/components/overlays/Dialog.tsx`.
- Tests: `tests/shortcuts-help.test.tsx`.
- Showcase: `src/components/overlays/ShortcutsHelp.stories.tsx` (`Playground`,
  `OpenWithQuestionMark`, `LongList`, `CustomTitle`). Level: periphery
  (ADR-0014): no snapshots. Opening, Escape, focus return and scrolling were
  checked by hand on the built showcase.

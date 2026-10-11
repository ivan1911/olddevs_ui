---
sourceHash: 93cc57b25c0e
---

# How to choose a component

Choose by the meaning of the action and by the state, not by the shape that is easier to build.
If the rule below does not fit, open the component catalog and the page of the closest candidate
before writing JSX.

| Task                                                    | Use                                   | Do not use instead                                             | Reason                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pick a value from a known finite set                    | `Select`                              | `Combobox`                                                     | `Select` does not allow a new value; search only filters the set.                                                                                           |
| Enter a value with a list of options or allow a new one | `Combobox`                            | `Select`                                                       | `Combobox` supports free input when the contract allows it.                                                                                                 |
| Pick exactly one mode                                   | `Segmented`                           | `ToggleGroup`                                                  | A mode always has a value; an empty state is not allowed.                                                                                                   |
| Turn on zero, one or several independent conditions     | `ToggleGroup`                         | `Segmented`                                                    | An empty set is legitimate for filters and settings.                                                                                                        |
| Confirm a deletion or another dangerous action          | `ConfirmDialog`                       | `Dialog`                                                       | `alertdialog`, an explicit destructive action and a safe initial focus point.                                                                               |
| Show ordinary modal content or a form                   | `Dialog`                              | `ConfirmDialog`                                                | An ordinary dialog must not pretend to be a critical confirmation.                                                                                          |
| Show a screen's shortcut reference                      | `ShortcutsHelp`                       | `Dialog` with `Kbd` / `Keyboard` elements scattered through it | Named groups and the spoken form of a shortcut ("Ctrl plus K") are already in the component; `Keyboard` is an on-screen keyboard for input, not a shortcut. |
| Show a short result of a completed operation            | `toast` + `Toaster`                   | `Alert`                                                        | A toast is temporary and does not take permanent space on the page.                                                                                         |
| Show a persistent important message in context          | `Alert`                               | `toast`                                                        | The user must see the message for as long as it is relevant.                                                                                                |
| Show an entity's status                                 | `StatusBadge`                         | `Badge`                                                        | Status is a closed semantic set; its tone conveys the meaning.                                                                                              |
| Show a count                                            | `Badge`                               | `StatusBadge`                                                  | A counter says "how many", not the entity's lifecycle.                                                                                                      |
| Navigate to a URL                                       | `Link` or `Button asChild` with `<a>` | `Button onClick`                                               | A real link lets users open it in a new tab and copy its URL, and keeps the correct role.                                                                   |
| Give an additional short explanation                    | `Tooltip` / `HelpTooltip`             | hidden text without a name                                     | A tooltip does not replace a label and the main content.                                                                                                    |
| Show an entity preview on hover over a link or name     | `HoverCard`                           | `Tooltip` / `Popover`                                          | A card with rich content opens on hover and keyboard focus; it is absent on touch devices, so everything important must be available without it.            |
| Report the state of the whole app                       | `Banner`                              | `Alert`                                                        | `Alert` describes the state of one area of the page; a banner survives navigation.                                                                          |
| Show what happened to the selected files                | `UploadQueue`                         | `FileDropzone`                                                 | The dropzone provides files, the queue shows what became of them.                                                                                           |
| Show a feed of events that occurred                     | `NotificationList`                    | `Timeline`                                                     | In a feed, time sets the order and there are actions; in `Timeline`, the order is set by the process.                                                       |
| Show a tile with a preview and actions                  | `MediaCard`                           | `Card`                                                         | For a tile the main things are a proportionally scaled preview, an overlay and selection.                                                                   |
| Let the user set the order                              | `SortableList`                        | `Table` with sorting                                           | In a table the order is computed; here it is assigned by a person.                                                                                          |
| Show hundreds of previews                               | `VirtualGrid`                         | a plain CSS grid                                               | Only the visible cells live in the DOM; the consumer sets the container height.                                                                             |
| Copy a value to the clipboard                           | `CopyButton`                          | a hand-built button with an icon                               | The result is announced, and a clipboard failure is shown rather than swallowed.                                                                            |
| Truncate long text                                      | `Truncate`                            | `text-overflow` by hand                                        | The tooltip appears only when the text is actually truncated and is keyboard-accessible.                                                                    |

## The minimal component rule

Do not create a new local primitive while the semantics you need already exist in
`@olddevs/ui`. But do not move domain data into the package: for example, the status vocabulary,
the texts of a specific product and the page layout belong to the consumer.

## If there is no component

1. Check the [component catalog](components/index.md) and the public icon exports.
2. Build a domain composition from existing primitives if it is only
   the layout or text of a specific screen.
3. Propose a new primitive only when the semantics, API and
   accessibility requirements repeat, not just because one CSS combination does.

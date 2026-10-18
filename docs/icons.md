---
entrypoint: "@olddevs/ui/icons"
source: src/icons.ts
status: stable
---

# Icons `@olddevs/ui/icons`

## Summary for AI

Import icons only from `@olddevs/ui/icons`, choosing the name by the meaning of the action
or entity: `DeleteIcon`, not a shape such as `Trash`. The vocabulary's geometry
comes from `lucide-react`; the package vocabulary fixes one system-wide meaning.

## When to use

- When the UI already has a commonly understood meaning: close, delete, search,
  settings, error, success, switch theme, and so on.
- When you need one consistent symbol for one action across all screens.
- With `Button` for an icon without text: be sure to give the button itself an accessible
  name (`aria-label`) and make the icon decorative with `aria-hidden`.

## When not to use

- Do not import icons from `lucide-react` under their shape names (`Trash`) for a meaning
  the vocabulary already has. Otherwise a later change of metaphor will not be
  centralized.
- Do not pick an icon by a similar outline: `CheckIcon` means a checked
  item, `SuccessIcon` a successful result; `DeleteIcon` means delete,
  `CloseIcon` means close.
- Do not rely on an icon as the only label of an unfamiliar action.
  Add visible text, a tooltip or an accessible name suited to the context.

## Minimal example

```tsx
import { Button } from "@olddevs/ui";
import { DeleteIcon, SearchIcon } from "@olddevs/ui/icons";

<Button aria-label="Delete campaign" tone="danger" variant="ghost">
  <DeleteIcon aria-hidden />
</Button>
<SearchIcon aria-hidden size={16} />
```

## Entry point contract

- The public entry point is `@olddevs/ui/icons`; do not import `src/icons.ts` or
  `lucide-react` through the package's internal paths.
- Vocabulary names end in `Icon`; a test guarantees that every name
  resolves to a component of the installed `lucide-react` version.
- Size, stroke width and color are not fixed by the vocabulary. The consumer sets them
  through Lucide props or `LucideProvider`. Import the provider from this same entry point,
  not from `lucide-react`: lucide comes with the kit, and a provider from a second copy in
  your app never reaches the kit's icons (ADR-0072).
- The `IconProps` type is also exported — it is `LucideProps` from `lucide-react`.

## Semantic differences

| Meaning needed                      | Use                                             | Do not substitute              |
| ----------------------------------- | ----------------------------------------------- | ------------------------------ |
| Close a panel, dialog or tag        | `CloseIcon`                                     | `DeleteIcon`                   |
| Delete an entity                    | `DeleteIcon`                                    | `CloseIcon`                    |
| Checked checkbox or choice          | `CheckIcon`                                     | `SuccessIcon`                  |
| Successful outcome of an operation  | `SuccessIcon`                                   | `CheckIcon`                    |
| Report an error                     | `ErrorIcon`                                     | `WarningIcon`                  |
| Find visually similar               | `FindSimilarIcon`                               | the generic `SearchIcon`       |
| External link                       | `ExternalLinkIcon`                              | `LinkIcon`                     |
| Sign out of the account             | `LogoutIcon`                                    | `CloseIcon`                    |
| List of records                     | `ListIcon`                                      | `NavigationIcon`               |
| A goal being pursued                | `TargetIcon`                                    | `PlayIcon`                     |
| Pause the countdown                 | `PauseIcon`                                     | `CloseIcon`                    |
| Started work (a status flag)        | `FirstStepIcon`                                 | `PlayIcon`                     |
| Health as a task topic              | `HealthIcon`                                    | `FavoriteIcon`                 |
| A letter as a task topic            | `MailIcon`                                      | `SendIcon`                     |
| A trip as a task topic              | `TripIcon`                                      | `SendIcon`                     |
| Reading as a task topic             | `ReadingIcon`                                   | `LibraryIcon`                  |
| A meeting as a task topic           | `MeetingIcon`                                   | `ProfileIcon`, `CalendarIcon`  |
| Development as a task topic         | `CodeIcon`                                      | `AutomationIcon`               |
| A due date to meet                  | `DeadlineIcon`                                  | `CalendarIcon`, `BellIcon`     |
| Repeats according to a rule         | `RecurringIcon`                                 | `RefreshIcon`                  |
| Help, reference                     | `HelpIcon`                                      | `InfoIcon`                     |
| Tip                                 | `TipIcon`                                       | `InfoIcon`                     |
| Back through history                | `BackIcon`                                      | `ChevronLeftIcon`              |
| Home, the app root                  | `HomeIcon`                                      | `DashboardIcon`                |
| Sort                                | `SortIcon`                                      | `SelectIcon`                   |
| Undo an action                      | `UndoIcon`                                      | `RefreshIcon`                  |
| Redo what was undone                | `RedoIcon`                                      | `RecurringIcon`                |
| Adjust the view                     | `AdjustIcon`                                    | `SettingsIcon`, `FilterIcon`   |
| Share                               | `ShareIcon`                                     | `SendIcon`, `UploadIcon`       |
| Attachment                          | `AttachmentIcon`                                | `LinkIcon`                     |
| Locked, read-only                   | `LockIcon`                                      | `SecurityIcon`                 |
| Team, members                       | `TeamIcon`                                      | `ProfileIcon`, `MeetingIcon`   |
| Time in general                     | `TimeIcon`                                      | `DeadlineIcon`                 |
| Flag a problem                      | `FlagIcon`                                      | `FirstStepIcon`                |
| Forbidden                           | `BlockedIcon`                                   | `ErrorIcon`                    |
| Inline code (a Mark in text)        | `InlineCodeIcon`                                | `CodeIcon`, `CodeBlockIcon`    |
| The Document's source HTML          | `SourceIcon`                                    | `CodeBlockIcon`, `CodeIcon`    |
| Bulleted list in text               | `ListIcon`                                      | `TaskListIcon`                 |
| Task list                           | `TaskListIcon`                                  | `ListIcon`, `SuccessIcon`      |
| Horizontal rule between Blocks      | `DividerIcon`                                   | `MinusIcon`                    |
| Clear formatting                    | `ClearFormattingIcon`                           | `DeleteIcon`                   |
| Text color                          | `TextColorIcon`                                 | `PaletteIcon`                  |
| Highlight (colored fill)            | `HighlightIcon`                                 | `TextColorIcon`                |
| Plain paragraph, "just text"        | `ParagraphIcon`                                 | `HeadingIcon`                  |
| Heading of level 1–4                | `Heading1Icon` … `Heading4Icon`                 | `HeadingIcon`                  |
| "Text" in the Block type menu       | `TextIcon`                                      | `ParagraphIcon`, `HeadingIcon` |
| Insert a row above / below          | `InsertRowAboveIcon`, `InsertRowBelowIcon`      | `AddIcon`                      |
| Insert a column left / right        | `InsertColumnLeftIcon`, `InsertColumnRightIcon` | `ColumnsIcon`                  |
| Merge table cells                   | `MergeCellsIcon`                                | `TableIcon`                    |
| Split a merged cell                 | `SplitCellIcon`                                 | `TableIcon`                    |
| First row is headings               | `HeaderRowIcon`                                 | `TableIcon`                    |
| Emoji (symbol grid)                 | `EmojiIcon`                                     | —                              |
| Vertical "more": the Block menu     | `MoreVerticalIcon`                              | `MoreIcon`, `DragHandleIcon`   |
| Duplicate next to the original      | `DuplicateIcon`                                 | `CopyIcon`                     |
| Arrow up / down                     | `ArrowUpIcon`, `ArrowDownIcon`                  | `ChevronUpIcon`, `SortIcon`    |
| A Column layout of the Document     | `ColumnLayoutIcon`                              | `ColumnsIcon`                  |
| Wrapper: a group of Blocks          | `WrapperIcon`                                   | `ColumnLayoutIcon`             |
| Remove the Wrapper, keep the Blocks | `UnwrapIcon`                                    | `DeleteIcon`                   |
| Details Block of the Editor         | `DetailsIcon`                                   | `ChevronDownIcon`              |
| Select Blocks whole in the Editor   | `BlockSelectIcon`                               | `SelectIcon`                   |
| Editor formula, inline and block    | `FormulaIcon`, `BlockFormulaIcon`               | `CodeIcon`                     |
| Show invisible characters           | `InvisibleCharactersIcon`                       | `ParagraphIcon`                |
| Footnote in the Editor              | `FootnoteIcon`                                  | `SuperscriptIcon`              |
| Video by link in the Editor         | `VideoIcon`                                     | `PlayIcon`                     |

## Subject topics

Since 3.21.0 the vocabulary has a section that describes not the interface but **what a task
is about**: `CodeIcon`, `GameIcon`, `PurchaseIcon`, `HealthIcon`, `CallIcon`, `MailIcon`,
`MeetingIcon`, `TripIcon`, `PaymentIcon`, `ReadingIcon`.

The section was created not for one product but because the alternative is worse: without it
every consumer picks the "call" icon anew, and half a year later it looks different in two
apps of the same kit. The section grows by request.
There is no "no topic" value in the vocabulary: the absence of a topic is the absence of a value, not
an eleventh icon.

Place them **next to text, not instead of it**: the topic of a task cannot be unambiguously inferred from
the picture, and `aria-hidden` is mandatory here — the label carries the accessible name. All ten were checked as a
column at 16 pixels (`MeetingIcon` with its new
glyph — again, in 3.29.0): any icons can be told apart
one at a time, and it is the column that is checked.

The full list is intentionally not duplicated in the documentation: the authoritative and
versioned list is [src/icons.ts](../src/icons.ts), grouped by
navigation, settings, actions, chevrons, states, files and communication, people and
access, time and place, data view, subject topics, text formatting and theme.

## Baseline set and requests

Since 3.29.0 the vocabulary has a **baseline set**: meanings found in the icon sets of
almost all major systems (Material Symbols, Carbon, Atlassian, Polaris, Fluent,
Primer). These are navigation (`BackIcon`, `HomeIcon`, `SidebarIcon`), editing
(`UndoIcon`, `PasteIcon`, `SortIcon`), files and communication (`AttachmentIcon`,
`CommentIcon`), people and access (`TeamIcon`, `LockIcon`, `LoginIcon`), time,
place and data view. The decision and the selection criterion are in ADR-0049.

Anything the vocabulary lacks is still added **by request**: with a screen and
a comparison with similar existing icons. Taking "something similar" from `lucide-react` bypassing the
vocabulary is not allowed — the meaning would stop being shared.

Together with the baseline set, three earlier icons were brought in line with most systems;
the names did not change: `HiddenIcon` is a crossed-out eye, `TagIcon` is a price tag,
`MeetingIcon` is a handshake (`Users` now belongs to `TeamIcon`). And `HelpTooltip`
now renders `HelpIcon` by default instead of `InfoIcon`. `DragIcon` is deprecated: it is the same
glyph as `DragHandleIcon`, and it will be removed in 4.0.0.

## Text formatting

The section was added at the request of the `RichTextEditor` Toolbar: `HeadingIcon`,
`BoldIcon`, `ItalicIcon`, `UnderlineIcon`, `StrikethroughIcon`, `InlineCodeIcon`,
`CodeBlockIcon`, `SuperscriptIcon`, `SubscriptIcon`, `ClearFormattingIcon`,
`OrderedListIcon`, `TaskListIcon`, `QuoteIcon`, `DividerIcon`; color, highlight and
alignment added `TextColorIcon`, `HighlightIcon`,
`AlignLeftIcon`, `AlignCenterIcon`, `AlignRightIcon`, `AlignJustifyIcon`. Existing meanings
are not repeated: a bulleted list is `ListIcon`, undo and redo
are `UndoIcon` and `RedoIcon`.

Text color (`TextColorIcon`, a letter with a bar) and highlight (`HighlightIcon`,
a highlighter) are different actions: the first colors the letters, the second puts color under
them. `PaletteIcon` is the choice of a color scheme, not a text color. `AlignJustifyIcon`
is not used in the Editor Toolbar ("justify" is absent in v1), but the meaning is in the vocabulary
for the consumer.

Two distinctions are worth keeping in mind. Inline code (`InlineCodeIcon`, `< >`) is
not `CodeIcon` (`</>`): that one is the subject topic "development", not an action on
text. A task list (`TaskListIcon`) is a list with checkmarks; `ListIcon` deliberately
has no checkboxes, so that a list of records does not read as "done".

The only visible label on the Toolbar buttons is the icon; the button's name
comes from `aria-label`, and the keyboard shortcut is shown by a tooltip.

The Slash menu added `ParagraphIcon` (¶) — the "Turn into
paragraph" item. `HeadingIcon` does not fit it: that one is a heading in general, with no
level. The "+" button of the Slash menu reuses the existing `AddIcon`.

The Block type menu "¶" (under ADR-0049) added
`Heading1Icon`–`Heading4Icon` (a heading with the level digit) and `TextIcon` (the letter
"T", the "Text" item). `HeadingIcon` remains the icon of a heading without a level: the items of the
Slash menu need it that way. `TextIcon` does not repeat `ParagraphIcon`: that one is
the "paragraph" pilcrow in the Slash menu, and this one is "Text" in the Block type menu. The "¶" button
on the Toolbar shows the icon of the current type: the icon of its menu item,
`CodeBlockIcon` in a code Block, or the pilcrow `ParagraphIcon` when there is no text
Block under the caret (an image is selected).

The table added seven names: `InsertRowAboveIcon`,
`InsertRowBelowIcon`, `InsertColumnLeftIcon`, `InsertColumnRightIcon` —
inserting a row and a column, each side with its own glyph (a bar with an arrow on the
matching side) — `MergeCellsIcon` and `SplitCellIcon` for merging cells, and
`HeaderRowIcon` (a frame with a highlighted top bar). The rest of the "Table" menu reuses
existing meanings: inserting a table is `TableIcon`, deleting
a row, column and table is `DeleteIcon`, sorting is `SortAscendingIcon` and
`SortDescendingIcon`, column alignment is `AlignLeftIcon`,
`AlignCenterIcon`, `AlignRightIcon`.

The Block handle added four names: `MoreVerticalIcon` — "⋮", the button of the Block's action menu (not `MoreIcon`: that one is in a row of buttons; not `DragHandleIcon`: this handle is not dragged), `ArrowUpIcon` and `ArrowDownIcon` — named by shape, as ADR-0049 requires for a bare arrow — and `DuplicateIcon` (a copy next to the original; not `CopyIcon` — that one is about the clipboard). "Add", "Format" and "Delete" in its menu reuse the existing `AddIcon`, `ParagraphIcon` and `DeleteIcon`.

Emoji added `EmojiIcon` — a smiley face, the button of the emoji grid in the Toolbar. The name is by the meaning "emoji", not by the glyph: a face elsewhere would mean mood or rating, and that would be a different decision under ADR-0049.

Source mode added `SourceIcon` — a sheet with `</>` (`FileCode`), the "HTML" button of the Toolbar: the source code of the whole Document. `CodeBlockIcon` already means a code Block inside a Document, and `CodeIcon` the subject topic "development"; a third meaning is not attached to them (ADR-0049).

Column layout added `ColumnLayoutIcon` — two columns, the "Layout" item of the Slash menu. `ColumnsIcon` with three columns already means "choosing the columns of a data table", and a second meaning is not attached to it (ADR-0049): the Column layout has its own glyph.

Wrapper added the pair `WrapperIcon` and `UnwrapIcon` — lucide's `Group` and `Ungroup`: a frame with dashed corners around two Blocks and the same Blocks without a frame. The icons sit at the "Wrapper" item of the Slash menu and the "Remove Wrapper" item in the Block handle menu. This is not `ColumnLayoutIcon`: columns put Blocks side by side, while a Wrapper groups them without changing their order. `DeleteIcon` does not fit removal: only the container is deleted, not the content.

The Details Block added `DetailsIcon` — lucide's `ListCollapse`: a list with collapse arrows, the "Collapsible block" item of the Slash menu. The dictionary had no fitting name: `ChevronDownIcon` is a step and nesting, `CollapseIcon` is collapsing a window, while here it is a whole Block with a title and hidden content. Removing the Block uses the already taken `UnwrapIcon` (ADR-0049).

Formulas added the pair `FormulaIcon` and `BlockFormulaIcon` — lucide's `Sigma` and `SquareSigma`: the sigma is the "Formula" item of the Slash menu, the sigma in a frame is "Block formula". `CodeIcon` does not fit: it means the subject theme "development", while a sigma reads as math (ADR-0049).

Invisible characters added `InvisibleCharactersIcon` — lucide's `PilcrowRight`: a pilcrow with an arrow, the "Invisible characters" item of the "…" menu on the Editor's fixed Toolbar. This is not `ParagraphIcon`: that one is a plain pilcrow, "an ordinary paragraph", and sits on the same Toolbar in the "¶" menu; the arrow tells the display toggle from a Block type.

Footnotes added `FootnoteIcon` — lucide's `Asterisk`, the oldest mark of a note at the foot of the text: the "Footnote" item of the Editor's Slash menu and "…" menu. This is not `SuperscriptIcon`: that one is the Mark, while a footnote is a reference with a text of its own in the list at the end of the Document (ADR-0076).

Video added `VideoIcon` — lucide's `SquarePlay`: a square with a play triangle, the "Video" item of the Editor's Insert menu (the `youtube` and `twitch` Tools). This is not `PlayIcon`: that one is a start button, and the player placeholder's own "Play" button (the `autoload: false` option) carries exactly that icon (ADR-0049).

Block selection added `BlockSelectIcon` — lucide's `SquareDashed`: a dashed frame, the "Select" item of the Block handle menu. This is not `SelectIcon`: those are the up-down chevrons of a select field, and the frame matches how the Editor highlights selected Blocks (ADR-0049).

The first iteration of the table made do with two icons for four directions
(`AddRowIcon`, `AddColumnIcon`) and an icon for the separate "Table
actions" button (`TableEditIcon`). With the "Table" menu the button went away, and the direction
is now conveyed by the icon itself; the three names were replaced before release and did not stay in the vocabulary.

## Two dates on a record, not one

`CalendarIcon` means a date in general — and that is enough while a record has one date.
When there are two and they are orthogonal ("when it becomes relevant" and "when it is due"),
one icon would mark identically the very things that need to be told apart. That is why a due date
now has its own name — `DeadlineIcon`, an hourglass. A calendar silhouette does not
fit it: at 14 pixels it reads as "date", and in a neighboring column with
`CalendarIcon` the difference disappears.

Next to it is `RecurringIcon` — "repeats according to a rule". It is a property of the record itself,
not an action: the circular arrows of `RefreshIcon` in the interface mean
"refresh what you see", and one icon for both meanings would make the second unavailable to all
consumers.

Neither describes a state: being overdue is a computed state, and it
gets a badge with a word, not an icon.

## Accessibility

An icon alone is almost never enough to name an action. If it is decorative
next to text, pass `aria-hidden`. If it is the only content of a button, the name
must be on `Button` and not derived from the SVG shape.

## Related sources and tests

- Source: `src/icons.ts`.
- Export compatibility and the `*Icon` convention are checked by `tests/icons.test.ts`.

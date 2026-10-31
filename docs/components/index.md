# Component catalog

The catalog lists the kit's components by group: each has a link to its page, its
exports and a note on what the component is and what it is for. Related
components (for example, the different kinds of switches) are described on one
page.

## Actions and feedback

- [Button](actions/button.md): `Button` — a button that runs an action: save, submit, open a dialog
- [Chip](actions/chip.md): `Chip` — a compact filter button that can be switched on and off
- [SplitButton](actions/split-button.md): `SplitButton` — a button with a primary action and, next to it, a dropdown of other options
- [Toolbar](actions/toolbar.md): `Toolbar` — a bar of buttons and switches, for example above a canvas or an input field; you move through it with the arrow keys
- [Toggles](actions/toggles.md): `Toggle`, `Segmented`, `ToggleGroup`, `ButtonGroup` —
  switches: turn one setting on or off, pick one mode out of several, mark several
  independent options, put ordinary buttons into a row
- [Feedback](actions/feedback.md): `Alert`, `Banner`, `Progress`, `Spinner`, `Toaster`,
  `toast`, `StatusBadge` — messages and indicators: an inline notice or an app-wide
  one, a toast, a progress bar, a loading indicator, a colored
  status label
- [CopyButton and Truncate](actions/copy-and-truncate.md): `CopyButton`, `Truncate` —
  a "Copy" button with confirmation and truncation of long text with a tooltip
  showing the full value

## Input fields

- [PromptInput](inputs/prompt-input.md): `PromptInput` — a controlled message draft with Enter/Shift+Enter/IME handling, Send and consumer action slots

- [TextControl](inputs/text-control.md): `TextControl` — the base text field: a single line or multi-line text, with an icon and a placeholder inside; the other input fields are built on it
- [RichTextEditor](inputs/rich-text-editor.md): `RichTextEditor`, the `useRichTextEditorState` and `useRichTextToolState` hooks, the `tool` and `defineTool` helpers, the `RICH_TEXT_PRESETS` Presets, a custom Tool (`CustomTool`) — a rich text editor: headings, lists, links, inline formatting (bold, italic, color). Suitable for long articles and descriptions, and the value is stored as HTML. A separate entry point `@olddevs/ui/editor`; the consumer installs the Tiptap engine with the command from that page
- [Editor extension API](../api/editor-extension.md) — a reference for those who extend the Editor with custom Tools, buttons and Loaders: what can be plugged in and what will not change between versions
- [NumberInput](inputs/number-input.md): `NumberInput` — a number field with "increase" and "decrease" buttons, bounds and formatting; an empty field yields `null`, not zero
- [Choice controls](inputs/choice-controls.md): `Checkbox`, `CheckboxGroup`, `Radio`, `RadioGroup` — checkboxes and radio buttons: mark several independent options or choose exactly one from a set
- [Select](inputs/select.md): `Select` — a dropdown list: choose a value only from a predefined set; a new one cannot be created
- [Combobox](inputs/combobox.md): `Combobox` — a field with a list of options as you type: you can pick from the list or enter your own value that is not in the list
- [TagInput](inputs/tag-input.md): `TagInput` — a field where the user types several short tag values, separating them with Enter or a comma
- [Transfer](inputs/transfer.md): `Transfer` — two columns, "available" and "selected", with items moved between them; for choosing many values from a large list
- [TreeSelect](inputs/tree-select.md): `TreeSelect` — a dropdown field for choosing a node from a hierarchy: a department in an org chart, a category in a catalog
- [ColorPicker](inputs/color-picker.md): `ColorPicker` — choose any color: a palette, a hue strip and a color code input; a separate entry point `@olddevs/ui/color`
- [SwatchGroup](inputs/swatch-group.md): `SwatchGroup` — choose one option from a set of color swatches, for example tags or categories; only shades from the kit's palette can be chosen, not any color
- [Rating](inputs/rating.md): `Rating` — a star rating: the user assigns a score to a review, a product or a piece of content
- [Slider](inputs/slider.md): `Slider`, `RangeSlider` — a scale with a draggable thumb: `Slider` picks one number, `RangeSlider` sets the lower and upper bounds of a range
- [SearchControl](inputs/search-control.md): `SearchControl` — a search field with a magnifier and a clear button; it does not run the query; it only collects the string for your search
- [FileDropzone](inputs/file-dropzone.md): `FileDropzone` — an area where users drag files or pick them with a button; it checks type and size and explains a rejection, but uploads nothing itself
- [UploadQueue](inputs/upload-queue.md): `UploadQueue` — a list of files being uploaded, with the state of each (waiting, uploading, ready, error) and actions: retry, cancel, remove
- [PasswordInput](inputs/password-input.md): `PasswordInput` — a password field with a "show" button and a warning that Caps Lock is on
- [MaskedInput](inputs/masked-input.md): `MaskedInput`, `formatMask`, `unmask`, `maskCapacity` — a field that inserts separators according to a pattern as you type: a date, a document number, an account number
- [PhoneInput](inputs/phone-input.md): `PhoneInput`, `RU_PHONE_MASK` — a phone field with a ready-made Russian mask; for another format, use `MaskedInput`
- [PinInput](inputs/pin-input.md): `PinInput` — a confirmation code input, one digit per cell; a code pasted from an SMS is split across the cells automatically
- [InlineEdit](inputs/inline-edit.md): `InlineEdit` — a value that is changed right in place: a click turns it into a field, Enter confirms, Escape cancels
- [Form](inputs/form.md): `Form`, `FormField` — a form with a shared submit action: it is locked while the request runs; `FormField` ties a field to its label, hint and error
- [FormLayout](inputs/form-layout.md): `FormLayout`, `FieldRow` — a layout for form fields: one or two columns, labels on top or on the left; it neither validates nor submits anything

## Date and time

- [Calendar](date-time/calendar.md): `Calendar`, `NAV_BUTTON_CLASS`,
  `WEEKDAY_CELL_CLASS` — a month grid for picking one date, without a field or a dropdown: for your own layout, it is usually simpler to use `DatePicker`
- [RangeCalendar](date-time/range-calendar.md): `RangeCalendar` — a grid of one or two months for picking a date range, without a field or presets: for your own layout, it is usually simpler to use `DateRangePicker`
- [DatePicker](date-time/date-picker.md): `DatePicker`, `formatDate` — a single-date picker field: a click opens a calendar, the value is stored as a `YYYY-MM-DD` string
- [DateRangePicker](date-time/date-range-picker.md): `DateRangePicker` — a date range picker field with quick options like "7 days" and a clear button, for example for a filter or a report
- [DateTimePicker](date-time/date-time-picker.md): `DateTimePicker`,
  `maskTime`, `normalizeTime` — a pair of fields for a date and a time together, for example a publication deadline or an event start; the date and the time are stored separately
- [TimePicker](date-time/time-picker.md): `TimePicker`, `upcomingSlots` — an `HH:MM` time field: you can type an exact time or pick from a list of the nearest slots

## Overlays

- [Dialog](overlays/dialog.md): `Dialog`, `ModalHeader`, `ModalOverlay` —
  a modal dialog over the page for a form or a preview: while it is open, the
  rest of the screen cannot be used
- [ConfirmDialog](overlays/confirm-dialog.md): `ConfirmDialog` — a short dialog with an "are you sure?" question before a deletion or another irreversible action; for forms, use `Dialog`
- [ShortcutsHelp](overlays/shortcuts-help.md): `ShortcutsHelp` — a dialog with a list of the
  app's keyboard shortcuts, arranged by section
- [Drawer](overlays/drawer.md): `Drawer` — a panel that slides in from the side or the bottom over the page: in it
  you can view or edit a record without leaving the screen
- [Popover](overlays/popover.md): `Popover`, `PopoverAnchor`, `PopoverClose`,
  `PopoverContent`, `PopoverTrigger` — a small panel with any content that
  opens next to a button on click; the foundation for dropdown panels and calendars
- [HoverCard](overlays/hover-card.md): `HoverCard`, `HoverCardContent`,
  `HoverCardTrigger` — a card with details that appears when you hover over a name
  or a link: an avatar, a job title, the start of a document
- [Tooltip](overlays/tooltip.md): `Tooltip`, `TooltipContent`,
  `TooltipProvider`, `TooltipRoot`, `TooltipTrigger`, `HelpTooltip` — a short
  short text that appears on hover or focus, for example a label for an icon button;
  `HelpTooltip` is a ready-made "?" icon with an explanation for a field
- [Menu](overlays/menu.md): `Menu`, `MenuButton`, `MenuItem`, `MenuSection`,
  `MenuSeparator`, `MenuTrigger`, `SubmenuTrigger` — a dropdown list of commands that opens when you click
  a button, for example "Rename" and "Delete"; to choose a value in a field, use `Select`
- [Context menu](overlays/context-menu.md): `ContextMenu`,
  `ContextMenuCheckboxItem`, `ContextMenuContent`, `ContextMenuItem`,
  `ContextMenuLabel`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`,
  `ContextMenuSeparator`, `ContextMenuSub`,
  `ContextMenuSubContent`, `ContextMenuSubTrigger`, `ContextMenuTrigger` — a command menu that opens
  on a right click over a file, a table row or a card
- [Command palette](overlays/command-palette.md): `CommandPalette` — a quick search dialog
  over the app's commands: the user types a few letters and immediately runs the action they need

## Table

Ready-made components for entity lists, built on top of the low-level `Table`.

- [DataTable](table/data-table.md): `DataTable` — a ready-made table for a list of entities: column and density settings, loading and error states, a bar with filters and actions above the table
- [Table toolbar](table/toolbar.md): `TableToolbar`, `TablePreferences` — a bar above a table with a title, a counter and actions, plus a settings menu: which columns to show, in what order and how densely
- [FilterBar](table/filter-bar.md): `FilterBar`, `FilterBarAdd` — a row of applied filters, each of which can be removed, and a button to add a new one; for lists where there are several filters and the set changes
- [SavedViews](table/saved-views.md): `SavedViews` — a switcher of saved filter sets such as "Mine" or "Drafts", which the user creates and returns to with one click

## App shell

Components built from primitives: the page frame, its navigation and header.

- [AppShell](app-shell/app-shell.md): `AppShell`, `useAppShell` — the frame of an app page: side navigation on the left, a header on top, content in the middle; it handles the mobile mode, focus on screen change and the "skip to content" link on its own
- [SideNav](app-shell/side-nav.md): `SideNav`, `NavGroup`, `NavItem`, `useNavCollapsed` — the app's side menu: sections with link items, the current item highlighted; the menu can be collapsed to icons
- [MobileTabBar](app-shell/mobile-tab-bar.md): `MobileTabBar`, `MobileTabBarItem` — a bottom bar with the main sections for a phone (up to five items): navigation in one tap; on a wide screen it is replaced by `SideNav`
- [TopBar](app-shell/top-bar.md): `TopBar` — the app header with a logo, search and actions (notifications, profile); different from `PageHeader`, which sets the title of the page itself
- [SplitPanel](app-shell/split-panel.md): `SplitPanel`, `useMediaQuery` — two areas side by side or one above the other with a divider the user drags: for example, a list and the details of the selected row

## Navigation

- [Tabs](navigation/tabs.md): `Tabs` — a tab list for switching between peer views of one screen; you render the content panel yourself
- [Accordion](navigation/accordion.md): `Accordion`, `AccordionItem` — a list of sections that expand and collapse on a click: an FAQ, settings, a long page of self-contained sections
- [Breadcrumbs](navigation/breadcrumbs.md): `Breadcrumbs` — a chain of links "Section / Subsection / Page" that shows where the user is and lets them go back up a level
- [Pagination](navigation/pagination.md): `Pagination`, `pageRange` — a page switcher for long results: numbers, adjacent pages, jumping to the first and last; `pageRange` calculates which numbers to show
- [Stepper](navigation/stepper.md): `Stepper` — a step indicator for a wizard, an import or a checkout: shows the current step and lets you go back to a completed one
- [MegaMenu](navigation/mega-menu.md): `MegaMenu`, `MegaMenuCategory`, `MegaMenuGroup`, `MegaMenuLink`, `MegaMenuTrigger`, `MegaMenuButton` — an Amazon-style store catalog: a column of categories with a flyout of link columns next to the hovered one; the pointer can cut diagonally across to the flyout without a neighboring category taking over; the same markup also opens as a dropdown overlay from a "Catalog" button
- [TreeView](navigation/tree-view.md): `TreeView` — a tree with expandable branches for categories, folders and sections; nodes can be selected, including with checkboxes
- [Selection bar](navigation/selection-bar.md): `SelectionBar`, `useStickyOffset` — a bar above a list or a grid where several objects are selected: shows "12 selected", bulk action buttons and a clear-selection button
- [Contextual save bar](navigation/contextual-save-bar.md): `ContextualSaveBar` — a bar at the bottom of the viewport that appears after the first edit of a form and offers to save or discard unsaved changes
- [Page header](navigation/page-header.md): `PageHeader` — the page header: the main title, an explanation under it and primary actions like "Create" or "Upload"; one per page
- [Section header](navigation/section-header.md): `SectionHeader` — a title for a block inside a page or a card, with a counter, a link or a small button on the right; for the title of the page itself there is `PageHeader`

## Content

- [ChatMessage](content/chat-message.md): `ChatMessage` — one user or assistant message with accessible metadata, body and action slots
- [ChatTranscript](content/chat-transcript.md): `ChatTranscript` — a reading viewport that follows growth, pauses for manual reading and returns explicitly to the latest message

- [Typography](content/typography.md): `Text`, `Heading`, `Link` — page text: headings of the right level, paragraphs and captions, links that navigate to a URL
- [Card](content/card.md): `Card` — a panel with a background, a border and padding that sets a self-contained block apart from the page background; you put the content into it yourself
- [Image](content/image.md): `Image` — a picture that shows a loading state, and a placeholder if the URL is empty or the file fails to load
- [Timeline](content/timeline.md): `Timeline` — a sequence of process steps where each step has its own outcome and any of them can fail: a task pipeline, a publication history
- [CodeView](content/code-view.md): `CodeView` — a read-only block of code or data that can be copied whole: an API response, a config, a webhook body; highlighting comes from the `highlightCodeNodes` helper in `@olddevs/ui/editor/highlight`
- [Notifications](content/notifications.md): `NotificationItem`, `NotificationList`, `NotificationCenter` — a notification feed in a popover or on a page: what happened, when, whether it has been read; unlike `toast`, it stays on screen
- [MediaCard](content/media-card.md): `MediaCard` — a tile with a preview, with badges and buttons overlaid on it; the tile can be selected among other tiles: frames, documents, covers
- [SortableList](content/sortable-list.md): `SortableList` — a short list the user reorders by dragging: menu sections, scenario steps, priorities; lists sharing a `group` can exchange rows, which is how a kanban board is built
- [EditableList](content/editable-list.md): `EditableList` — a list whose rows can be edited in place and reordered by dragging, and which can be added to at the bottom: a checklist, tasks; if you only need the order, `SortableList` is enough
- [RichTextView](content/rich-text-view.md): `RichTextView` — displays ready-made rich text from the Editor without the Editor itself; a separate entry point `@olddevs/ui/editor`, suitable for a server component
- [RichTextToc](content/rich-text-toc.md): `RichTextToc` — the table of contents of a long Document next to the View or a `readOnly` Editor: a strip of strokes at the edge of the text, a list of headings on hover, a click goes to the heading; the `@olddevs/ui/editor` entry point
- [VirtualGrid](content/virtual-grid.md): `VirtualGrid` — a grid of hundreds or thousands of previews that renders only the visible cells and lets you select them; for a dozen cards `Grid` is enough
- [Avatar](content/avatar.md): `Avatar`, `AvatarGroup` — a round image of a person: a photo or, if there is none, initials; `AvatarGroup` shows several participants with a "+N" overflow count
- [Data display](content/data-display.md): `Badge`, `Stat`, `DescriptionList`, `Table` — four ways to show data: a counter or a label, a key metric with an explanation, "property and value" pairs, a table of records of the same kind
- [Empty and loading](content/empty-and-loading.md): `EmptyState`, `ErrorState`, `Skeleton` — three states of a screen without data: a placeholder for an empty result, a failure message with a retry, a gray placeholder layout while the data loads
- [Layout primitives](content/layout-primitives.md): `Separator`, `ScrollArea`, `AspectRatio`, `Kbd` — small layout elements: a divider, a scrollable block, an area with fixed proportions, a marker for a keyboard key in text
- [Grid](content/grid.md): `Grid` — a grid of equal columns whose count changes with the screen width: pricing cards, metric tiles; for hundreds of items you need `VirtualGrid`
- [TagGroup](content/tag-group.md): `TagGroup`, `Tag` — a set of tags shown next to a record: categories, projects, statuses; a tag can be colored, removable or a link, but not selectable
- [Carousel](content/carousel.md): `Carousel` — a horizontal row of slides that you flip through with buttons, swipes and arrow keys, so that a selection takes one row: a gallery, recommendations
- [Keyboard and hidden text](content/keyboard.md): `Keyboard`, `VisuallyHidden` — an on-screen keyboard for entering into an existing field by touch or mouse, and text that is hidden on screen but available to a screen reader

`@olddevs/ui/icons` and exports from `lib/`/`hooks/` are not components. Their
description is in [icons.md](../icons.md) and
[`api/utilities.md`](../api/utilities.md).

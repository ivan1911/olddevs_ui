/**
 * Semantic icon vocabulary of the design system.
 *
 * WHAT THIS IS AND WHY IT IS A SEPARATE FILE, NOT JUST `import { X } from "lucide-react"`
 * AT EVERY CALL SITE:
 *
 * We rent the icon geometry from lucide, but the design-system decision lives not in the SVG
 * paths and not in the glyph shapes, it lives in the vocabulary: "deleting is a bin, not a cross;
 * AI is `WandSparkles`; finding similar items is `ScanSearch`". That decision belongs to the
 * design system, so it must live in one place, not be scattered across fifty consumer
 * files.
 *
 * This gives three consequences:
 *
 * 1. Replacing the whole visual language (moving from lucide to Phosphor, or drawing our own)
 *    is an edit to one file, not a fork of the components.
 * 2. A point replacement ("the cog is not liked, I want another one") is one line here, and it
 *    propagates to every call site at once.
 * 3. The consumer does not decide again which icon marks deletion. That is why names are semantic
 *    (`DeleteIcon`), not geometric (`Trash2Icon`), wherever meaning matters more than shape.
 *
 * STYLE (size, stroke width, color) is not set here. It is the job of the consumer's
 * `LucideProvider`. The split is intentional: the vocabulary answers "what", the provider answers
 * "how". The consumer takes the provider from here too, not from `lucide-react` (ADR-0072): lucide
 * ships with the kit, and if the application had a second copy, the provider would silently fail
 * to reach the vocabulary's icons.
 *
 * NAMES ARE CHECKED AGAINST THE INSTALLED PACKAGE, NOT AGAINST THE DOCS OR THE CHANGELOG.
 * Verified: `pending-cw` is listed in the lucide 1.27.0 release notes, but there is no `PendingCw`
 * export in the published package. `tests/icons.test.ts` guards this.
 *
 * ONLY CANONICAL NAMES, NOT ALIASES. In the installed package, `Trash2`, `Filter`, `Home` and
 * `History` are just second names for a glyph (`Trash`, `Funnel`, `House`, `RotateCcwClock`), and
 * aliases are dropped in lucide's major versions. Sometimes an alias points somewhere you do not
 * expect: `BarChart` is `ChartNoAxesColumnIncreasing`, not `ChartColumn`. The canonical name is the
 * component's `displayName`.
 *
 * Since 3.29.0 the vocabulary has a base set: meanings that appear in the icon sets of almost all
 * major systems (ADR-0049). Everything else is added on request, as before.
 */

export {
  // ── Navigation and sections ────────────────────────────────────────────
  LayoutDashboard as DashboardIcon,
  LibraryBig as LibraryIcon,
  Search as SearchIcon,
  Calendar as CalendarIcon,
  Folder as FolderIcon,
  /**
   * A list of records: a list of tasks, to-dos or items.
   *
   * It differs from `FolderIcon` and `LibraryIcon` in meaning: those are about storage and
   * nesting, this one is about the list itself.
   *
   * The "several horizontal lines" glyph was already in the set: it is `NavigationIcon`, the
   * hamburger. A second meaning is not assigned to it, because in a row of tabs it would read as "menu".
   *
   * Bullets, not checkboxes (`ListTodo` in lucide): a tick inside the icon reads as "done" and
   * conflicts with `SuccessIcon`, which usually stands next to it in such a row.
   *
   * It is also the bulleted list in the Editor's Toolbar: the meaning is the same, "a list with
   * bullets", and the vocabulary does not add a second name for this glyph (ADR-0049).
   */
  List as ListIcon,
  /**
   * A target to aim for: a bullseye.
   *
   * Naming by the glyph is a rare exception in this vocabulary, and it is deliberate. The meaning
   * of a target does not belong to the kit: for one consumer it is "available now", for another a
   * plan or precision. Naming it after one of these meanings would close it off for the rest.
   *
   * Not `PlayIcon` ("start") and not `FavoriteIcon` ("mine"): both are taken, and both mean a
   * person's choice, not a property of the record itself.
   */
  Target as TargetIcon,
  Settings as SettingsIcon,
  Bell as BellIcon,
  /** Open navigation on a narrow screen: the header's hamburger. */
  Menu as NavigationIcon,
  /** Home, the root of the app. Not `DashboardIcon`: that one is a summary section, not the root. */
  House as HomeIcon,
  /** Back in history or up one level. Not `ChevronLeftIcon`: a chevron is a step, "previous". */
  ArrowLeft as BackIcon,
  /** Forward, go to. The pair of `BackIcon`; not `ChevronRightIcon`, which is about a step and nesting. */
  ArrowRight as ForwardIcon,
  /** Show or hide the sidebar. Not `NavigationIcon`: the hamburger opens navigation on a narrow screen. */
  PanelLeft as SidebarIcon,
  /** Campaigns section. */
  Ad as CampaignIcon,
  /** Telegram channel as the recipient of a publication. */
  Megaphone as ChannelIcon,

  // ── Settings sections ──────────────────────────────────────────────────
  /** User profile. */
  User as ProfileIcon,
  /** Appearance: theme, accent, density. */
  Contrast as AppearanceIcon,
  /** AI and automation. */
  Cpu as AutomationIcon,
  /** External integrations. */
  Plug as IntegrationIcon,
  /** Storage and API. */
  Database as StorageIcon,
  /** Security and access. */
  Shield as SecurityIcon,

  // ── Actions ────────────────────────────────────────────────────────────
  Upload as UploadIcon,
  Download as DownloadIcon,
  Funnel as FilterIcon,
  Ellipsis as MoreIcon,
  /** Drag handle: a sortable list's row is grabbed by it. */
  GripVertical as DragHandleIcon,
  Pencil as EditIcon,
  Check as CheckIcon,
  /**
   * A checkbox's third state: "partially selected".
   *
   * Not `CheckIcon` at another angle, and not a custom drawing: the vocabulary must name this state
   * as a separate meaning, otherwise its look could only be changed by editing `Checkbox` itself.
   */
  Minus as MinusIcon,
  /** Close. The most frequent action on the front end. */
  X as CloseIcon,
  Plus as AddIcon,
  /**
   * Start playback or a countdown: a real transport action.
   *
   * A button only. As a "started" mark in history, `PlayIcon` has stopped being one: `FirstStepIcon`
   * is set up for that. A consumer already misread two plays with different meanings in one row,
   * taking a history entry for a button.
   *
   * Resuming after a pause is this icon too: that is exactly the meaning it is set up for.
   */
  Play as PlayIcon,
  /**
   * Pause playback or a countdown.
   *
   * The pair of `PlayIcon` and the second half of the transport. There is no "stop" icon beside it,
   * and none is set up: ending something is an action with consequences, so it is labeled with a
   * word, not a metaphor.
   */
  Pause as PauseIcon,
  Copy as CopyIcon,
  /** Copy in bulk: it was called `copy2` in the old set. */
  Files as CopyManyIcon,
  ClipboardPaste as PasteIcon,
  Trash as DeleteIcon,
  /** Undo an action. `Undo2`, not the `Undo` arc: an arc with an arrow is `RefreshIcon`. */
  Undo2 as UndoIcon,
  /** Redo what was undone. Not `RecurringIcon`: that one is "repeats on a schedule", a property of the record. */
  Redo2 as RedoIcon,
  /** Share. Nodes, not a box with an arrow (`Share`): that one conflicts with `UploadIcon`. */
  Share2 as ShareIcon,
  /** Pin: a column, a record, a view. Not `FavoriteIcon`, which is about "mine", not about a place. */
  Pin as PinIcon,
  /** Adjust this view. Not `SettingsIcon` (the settings section) and not `FilterIcon` (narrow the data). */
  SlidersHorizontal as AdjustIcon,
  /** Sort. Arrows, not chevrons: up-down chevrons are `SelectIcon`. */
  ArrowUpDown as SortIcon,
  ArrowUpNarrowWide as SortAscendingIcon,
  ArrowDownWideNarrow as SortDescendingIcon,
  /** Zoom. The third magnifier after `SearchIcon` and `FindSimilarIcon`: do not place them side by side without a label. */
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Printer as PrintIcon,
  Link as LinkIcon,
  /** The link leads outside, beyond the app. The icon of `Link external`. */
  ExternalLink as ExternalLinkIcon,
  Send as SendIcon,
  RefreshCw as RefreshIcon,
  Archive as ArchiveIcon,
  /** Remove from the archive or a collection. */
  ArchiveX as ArchiveRemoveIcon,
  /** "Find similar": semantic search by image. */
  ScanSearch as FindSimilarIcon,
  Maximize2 as ExpandIcon,
  Minimize2 as CollapseIcon,
  /**
   * Sign out of the account.
   *
   * A doorway with an arrow pointing outward. Neither part reads on its own: a bare arrow means
   * "forward", a doorway without an arrow means "enter". The name follows the action, not the
   * glyph (`DoorIcon`): an action icon's glyph may change, the action does not.
   *
   * `CloseIcon` here is not a stand-in but the worst of misses: in a menu a cross means "close the
   * menu", which is the exact opposite. The person expects the menu to collapse and gets signed out.
   */
  LogOut as LogoutIcon,

  // ── Chevrons ───────────────────────────────────────────────────────────
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ChevronsRight as ChevronDoubleRightIcon,
  ChevronsLeft as ChevronDoubleLeftIcon,
  /** Trigger of a dropdown list. */
  ChevronsUpDown as SelectIcon,

  // ── States and markers ─────────────────────────────────────────────────
  Eye as VisibleIcon,
  EyeOff as HiddenIcon,
  /** Label, tag: a price tag. The system's hash sign is called "hashtag", which is a different meaning. */
  Tag as TagIcon,
  TriangleAlert as WarningIcon,
  Image as ImageIcon,
  /** Explanation, information. A circle with an "i". */
  Info as InfoIcon,
  /** Help: a circle with a "?". Not `InfoIcon`: help and the system's information are kept apart. */
  CircleQuestionMark as HelpIcon,
  /** Advice, a hint. Not `InfoIcon`, which is a neutral explanation. */
  Lightbulb as TipIcon,
  /** Flag a problem, report it. Not for starting work: that is `FirstStepIcon`. */
  Flag as FlagIcon,
  /** Forbidden. Not `ErrorIcon` (it failed) and not `LockIcon` (locked, but available with a key). */
  Ban as BlockedIcon,
  /**
   * Success: in a message, not in a checkbox.
   *
   * A separate meaning from `CheckIcon`: that one means "marked", this one means "it worked".
   * Merging them would mean the look of one could not be changed without changing the other.
   */
  CircleCheck as SuccessIcon,
  /** Error: something that failed and needs attention. */
  CircleAlert as ErrorIcon,
  /**
   * A deadline by which something must be done: a record's deadline.
   *
   * WHY A SEPARATE NAME WHEN `CalendarIcon` EXISTS. The vocabulary had exactly one date, and it
   * meant "a date in general". But a record can have two, and they are orthogonal: "when it becomes
   * relevant" and "when it is on fire". One glyph for both would mark identically exactly what the
   * product was set up to tell apart (Nextable request).
   *
   * An hourglass, not a second calendar: a calendar silhouette at 14 pixels reads as "date", and in
   * a neighboring column with `CalendarIcon` the difference between them vanishes. The hourglass
   * silhouette is vertical and resembles nothing else in the vocabulary.
   *
   * The other neighbors were rejected, each with its own meaning: `TargetIcon` is a target to aim
   * for; `BellIcon` is a reminder; `WarningIcon` is overdue, a computed state rather than a field;
   * `Clock` and `ClockAlert` read as "time in general" and "alarm"; `FlagTriangleRight` at 14 pixels
   * turns into a play triangle, the same trap that is why the start-of-work mark is `FirstStepIcon`.
   */
  Hourglass as DeadlineIcon,
  /**
   * Repeats on a schedule: the record comes back by itself.
   *
   * Not `RefreshIcon`, and the difference is not in the glyph but in the meaning. Circular arrows in
   * an interface mean reload: "refresh what you see". Repetition means a property of the record
   * itself. One glyph for both would close the second meaning for every consumer, the same fork on
   * which the vocabulary already separated `CheckIcon` and `SuccessIcon`.
   *
   * `Repeat`, not `RotateCw` and not `IterationCw`: the first is a rectangular loop of two arrows,
   * the repeat sign from media players, and next to the round `RefreshIcon` it is distinguishable
   * even at 14 pixels. The other two are arcs with an arrow, that is, "undo" and "redo the action".
   */
  Repeat as RecurringIcon,
  /**
   * Started work: the first step is done.
   *
   * This is a mark, not a button: a history entry saying that the matter has moved forward.
   * Previously `PlayIcon` stood here, and the product owner read it as a transport button and asked
   * to "pause it" by clicking the mark. Once pause sits in the same row, two play glyphs would be
   * indistinguishable in meaning.
   *
   * Footprints, not a flag: in trackers a flag means "problem, blocked" (that is how Jira shows it),
   * and a mark about starting work would read as an alarm. `FlagTriangleRight` was rejected for its
   * glyph: in a row at 14 pixels it is exactly a play triangle, which would repeat the very mistake
   * the icon exists to avoid. `Hourglass` means waiting, not starting; `CircleDot` in a row reads as
   * a toggle; `Timer` conflicts with the progress bar's own timer.
   *
   * Named by the meaning, not the glyph: footprints may change, "first step" does not.
   */
  Footprints as FirstStepIcon,
  /**
   * Drag handle.
   *
   * @deprecated The same glyph as `DragHandleIcon`: use that one instead. Will be removed in 4.0.0.
   */
  GripVertical as DragIcon,
  Layers as LayersIcon,
  Palette as PaletteIcon,
  Keyboard as KeyboardIcon,
  /** Confirm input, or submit a search from the on-screen keyboard. */
  CornerDownLeft as EnterIcon,
  /** Switch the input language and layout. */
  Earth as LanguageIcon,
  Heart as FavoriteIcon,
  /** Star rating. It differs from a favorite in meaning: a favorite is a "mine" mark, a rating is a
      magnitude (ADR-0040). */
  Star as RatingStarIcon,
  Sparkle as SparkleIcon,
  Sparkles as SparklesIcon,
  /** AI text generation. */
  WandSparkles as AiIcon,

  // ── Files and communication ────────────────────────────────────────────
  /** Attachment: an attached file. Not `LinkIcon`, which is a link. */
  Paperclip as AttachmentIcon,
  /** File, document. Not `FolderIcon`, which is a container. */
  File as FileIcon,
  FolderOpen as FolderOpenIcon,
  /** Comment, discussion. A square speech bubble: a round one at 14 px blends with `InfoIcon`. */
  MessageSquare as CommentIcon,
  /** Mention (@). Not `MailIcon`, which is a letter as a business subject. */
  AtSign as MentionIcon,
  BellOff as NotificationsOffIcon,

  // ── People and access ──────────────────────────────────────────────────
  /** Team, members. Not `ProfileIcon`: one person is a profile. */
  Users as TeamIcon,
  UserPlus as AddUserIcon,
  /** Sign in to the account. The pair of `LogoutIcon`; not `EnterIcon`, which is the Enter key. */
  LogIn as LoginIcon,
  /** Locked, read-only, private. Not `SecurityIcon`: the shield is the settings section. */
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  KeyRound as KeyIcon,

  // ── Time and place ─────────────────────────────────────────────────────
  /** Time in general. Not `DeadlineIcon` (a deadline) and not `HistoryIcon` (a clock with an arrow, the past). */
  Clock as TimeIcon,
  /** Change history. Not `UndoIcon` or `RefreshIcon`: those are actions, not a log. */
  RotateCcwClock as HistoryIcon,
  /** Place, address. Not `TripIcon` (a trip as a business subject) and not `PinIcon` (pin). */
  MapPin as LocationIcon,

  // ── Data view ──────────────────────────────────────────────────────────
  Table as TableIcon,
  /** Table column selection. Not `AdjustIcon`: that one adjusts the whole view. */
  Columns3 as ColumnsIcon,
  /** Analytics, chart. Not `DashboardIcon`, which is a summary section. */
  ChartColumn as ChartIcon,

  // ── Subject-matter topics ──────────────────────────────────────────────
  //
  // WHY A PRODUCT-NEUTRAL VOCABULARY HAS TOPICS FROM THE DOMAIN. The other sections describe the
  // interface: navigation, actions, states. These ten describe what the task is about, and this is
  // the first such section.
  //
  // It was introduced not for the sake of one consumer, but because the alternative is worse. A
  // consumer needs a "call" icon in a list row. There is no such topic in the vocabulary, and by the
  // set's rule one cannot take "something similar" from lucide outside the vocabulary. So either the
  // topic lives here as one decision, or each product chooses it anew, and within half a year the
  // "call" glyph is drawn differently in two apps of one kit.
  //
  // The set is closed and is extended by request, like everything else here. The value "no topic"
  // is not added to the vocabulary: the absence of a topic is an absence of a value, not an eleventh
  // icon.
  //
  // All ten are checked in a column at 16 pixels, the size at which they stand in a list row. Any of
  // them passes on its own; the column is what catches the problems.
  /**
   * Development, code.
   *
   * The canonical lucide name is `CodeXml`. `Code2`, the name under which the glyph is known, has been
   * an alias for it since 1.41.0, and the vocabulary has no use for it: aliases from the set are
   * dropped in majors, and we check against the installed package.
   *
   * Not `AutomationIcon` (the processor): that one is about AI and automation, not about working with
   * code.
   */
  CodeXml as CodeIcon,
  /** Game. `Gamepad2`, not `Gamepad`: the second one is left over from the set's previous geometry. */
  Gamepad2 as GameIcon,
  /** Purchase: a shopping cart. */
  ShoppingCart as PurchaseIcon,
  /**
   * Health: a doctor's visit, medication, well-being.
   *
   * A heart with a pulse, and the pulse is the only thing that tells this icon apart from
   * `FavoriteIcon` at 16 pixels. The difference is semantic and significant: a favorite is a person's
   * choice, health is a subject of business. Do not place them in one column without a label.
   */
  HeartPulse as HealthIcon,
  /**
   * Call.
   *
   * `Phone`, not `PhoneCall`: the latter has diverging arcs beside the handset, which blur into noise
   * at 16 pixels and add no meaning.
   */
  Phone as CallIcon,
  /** A letter as a subject of business. Not `SendIcon`, which is the send action. */
  Mail as MailIcon,
  /**
   * Meeting: a handshake.
   *
   * Until 3.29.0 `Users` stood here, but it was taken by "team" (`TeamIcon`). This meaning exists in
   * all major systems, and a meeting has no commonly accepted glyph, so it yielded (ADR-0049).
   *
   * Not `CalendarIcon`: in the kit the calendar is taken by "scheduled for later", and on one screen
   * that would be one glyph with two meanings.
   */
  Handshake as MeetingIcon,
  /**
   * Trip: an airplane.
   *
   * Its silhouette resembles `SendIcon`, the paper plane of send. Better not to place them side by side:
   * the meanings differ, a business subject versus an action.
   */
  Plane as TripIcon,
  /** Payment: a wallet. Not `StorageIcon` (a database), which is about storage. */
  Wallet as PaymentIcon,
  /** Reading. Not `LibraryIcon`: that one is a storage section, a shelf, not reading. */
  BookOpen as ReadingIcon,

  // ── Text formatting ────────────────────────────────────────────────────
  //
  // Additions on request, as ADR-0049 requires: the request came from the `RichTextEditor` Toolbar
  // (ADR-0050). The glyphs are the canonical lucide names. Meanings already taken are not duplicated:
  // the bulleted list is `ListIcon`, undo and redo are `UndoIcon` and `RedoIcon`.
  /** A heading in general, without a level: the heading items of the Slash menu. The level is `Heading1Icon`…`Heading4Icon`. */
  Heading as HeadingIcon,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  /**
   * Inline code: a label inside a paragraph. Not `CodeIcon`, which is the Development topic (`</>`),
   * and next to it this one would read as a repeat of it.
   */
  Code as InlineCodeIcon,
  /**
   * Text color: a letter with a bar under it, in the Editor's Toolbar. Not `PaletteIcon`: a palette is
   * a color scheme choice, while here the text itself is colored.
   */
  Baseline as TextColorIcon,
  /** Highlighter: highlight text with a colored background. Not `TextColorIcon`, which colors the letters; this one colors the background behind them. */
  Highlighter as HighlightIcon,
  /** Block alignment: to an edge or to the center. The four meanings are four glyphs, not one shared glyph. */
  AlignLeft as AlignLeftIcon,
  AlignCenter as AlignCenterIcon,
  AlignRight as AlignRightIcon,
  /** Justified. The Editor's Toolbar has none (uneven word spacing), but the meaning is there for the consumer. */
  AlignJustify as AlignJustifyIcon,
  /** Code block. Not `InlineCodeIcon`: that one is a label inside a line, this one is a separate Block in a frame. */
  SquareCode as CodeBlockIcon,
  /**
   * The Document's source HTML: the Editor's HTML-mode button, a sheet with `</>`, "the code of the
   * whole document". Not `CodeBlockIcon`, which is a code Block inside a Document; not `CodeIcon`,
   * which is the Development topic.
   */
  FileCode as SourceIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  /** Clear the formatting of the selection. Not `DeleteIcon`: the text stays, the marks go away. */
  RemoveFormatting as ClearFormattingIcon,
  ListOrdered as OrderedListIcon,
  /**
   * Checklist: items with checkboxes. The tick inside is exactly its meaning, which is why it is
   * separate from `ListIcon`, where checkboxes were rejected.
   */
  ListTodo as TaskListIcon,
  /** Quote. */
  Quote as QuoteIcon,
  /** Separator between Blocks. Not `MinusIcon`, which is the checkbox's third state. */
  SeparatorHorizontal as DividerIcon,
  /**
   * A plain paragraph: the "Turn into" item of the Slash menu. Not `HeadingIcon`, which is the Block
   * type in general; this one is specifically "plain text".
   */
  Pilcrow as ParagraphIcon,
  /*
    The Editor's "¶" menu (per ADR-0049): the Block-type items have their own icons. The heading in
    general is still `HeadingIcon`; an icon with a digit is the level itself.
  */
  /** First-level heading. Not `HeadingIcon`, which is the Block type in general, without a level. */
  Heading1 as Heading1Icon,
  /** Second-level heading. */
  Heading2 as Heading2Icon,
  /** Third-level heading. */
  Heading3 as Heading3Icon,
  /** Fourth-level heading. */
  Heading4 as Heading4Icon,
  /**
   * Plain text: the "Text" item of the Block-type menu. Not `ParagraphIcon`, which is the pilcrow,
   * the "paragraph" in the Slash menu; and not `HeadingIcon`, because a heading is another type.
   */
  Type as TextIcon,
  /*
    A table in a document. Insert is the already taken `TableIcon`; deleting a row, a column or the
    table is `DeleteIcon`; sorting is `SortAscendingIcon` and `SortDescendingIcon`; column alignment
    is `AlignLeftIcon` and its siblings. The insertion direction is drawn by the icon itself: lucide
    has a separate one for each side.
  */
  /** Insert a table row above. Not `AddIcon`, which is "create" in general. */
  BetweenHorizontalStart as InsertRowAboveIcon,
  /** Insert a table row below. */
  BetweenHorizontalEnd as InsertRowBelowIcon,
  /** Insert a table column to the left. Not `ColumnsIcon`, which is the data table's column selection. */
  BetweenVerticalStart as InsertColumnLeftIcon,
  /** Insert a table column to the right. */
  BetweenVerticalEnd as InsertColumnRightIcon,
  /** Merge the selected table cells into one. */
  TableCellsMerge as MergeCellsIcon,
  /** Split a merged cell back. */
  TableCellsSplit as SplitCellIcon,
  /** First row: column headers. Not `TableIcon`, which is the whole table. */
  PanelTop as HeaderRowIcon,
  /**
   * Emoji: a smiling face, the emoji grid button in the Editor's Toolbar.
   * Named by the meaning "emoji", not by the glyph: a face in another place would mean mood or
   * rating, which is a different decision (ADR-0049). Not a bare `Smile`: the vocabulary names the
   * meaning, not the shape.
   */
  Smile as EmojiIcon,
  /*
    The Editor's Block handle (per ADR-0049): the "⋮" button on a Block and the items of its menu.
    Add, format and delete take the already taken `AddIcon`, `ParagraphIcon` and `DeleteIcon`.
  */
  /**
   * "More" in a column: the actions menu of a row or a Block. Not `MoreIcon`, which is in a row of
   * buttons; not `DragHandleIcon`: this handle is not dragged, it is pressed.
   */
  EllipsisVertical as MoreVerticalIcon,
  /** Arrow up. Named by shape (ADR-0049, item 3): move up, scroll, sort. */
  ArrowUp as ArrowUpIcon,
  /** Arrow down, the pair of `ArrowUpIcon`. */
  ArrowDown as ArrowDownIcon,
  /** Duplicate: a copy next to the original. Not `CopyIcon`, which is for the clipboard. */
  CopyPlus as DuplicateIcon,
  /**
   * A Document's layout in columns: the Editor's Column layout Block.
   * Not `ColumnsIcon`, which is a data table's column selection, another meaning on another glyph
   * (ADR-0049).
   */
  Columns2 as ColumnLayoutIcon,
  /**
   * Wrapper: the Block that gathers a group of Blocks in the Editor, a frame with dashed corners
   * around two Blocks. Not `ColumnLayoutIcon`: columns place Blocks side by side, while a Wrapper
   * groups them without changing their order (ADR-0049).
   */
  Group as WrapperIcon,
  /**
   * Unwrap: the Blocks stay, the Wrapper's frame is gone. The pair of `WrapperIcon`, as in lucide;
   * not `DeleteIcon`, because what is removed is not the content, only the container.
   */
  Ungroup as UnwrapIcon,
  /**
   * The Editor's collapsible Block (Details): a list with collapse arrows.
   * Not `ChevronDownIcon` or `CollapseIcon`: a chevron is a step and nesting, `CollapseIcon` collapses
   * a window; here it is a whole Block with a title and hidden content.
   * It is the icon of the "Collapsible block" item in the Slash menu; to unwrap the Block, use `UnwrapIcon`.
   */
  ListCollapse as DetailsIcon,
  /**
   * Video in the Editor (the `youtube` and `twitch` Tools): a square with a "play" triangle, the
   * "Video" item of the Slash menu. Not `PlayIcon`: that one is a launch button, and it is exactly
   * that button inside the player itself.
   */
  SquarePlay as VideoIcon,
  /**
   * The inline formula of the Editor (Mathematics): sigma, the "Formula" item of the Slash menu.
   * Not `CodeIcon`: that one is the Development topic, while sigma reads as mathematics. The block
   * formula is `BlockFormulaIcon`.
   */
  Sigma as FormulaIcon,
  /**
   * The Editor's block formula: sigma in a framed row, the "Block formula" item of the Slash menu.
   * The pair of `FormulaIcon`: the frame sets a formula-Block apart from a formula inside a line of text.
   */
  SquareSigma as BlockFormulaIcon,
  /**
   * Show invisible characters in the Editor: a pilcrow with an arrow, the "Invisible characters" item
   * of the "…" menu of the fixed Toolbar. Not `ParagraphIcon`: that one already means "plain paragraph"
   * and appears in the same Toolbar, in the "¶" menu on the left; the arrow tells the show toggle apart
   * from a Block type.
   */
  PilcrowRight as InvisibleCharactersIcon,
  /**
   * A footnote in the Editor: the asterisk, the oldest mark of a note at the foot of the text. The
   * "Footnote" item of the Slash menu and of the "…" menu. Not `SuperscriptIcon`: that one is the Mark,
   * and a footnote is a reference with its own text in the list at the end of the Document.
   */
  Asterisk as FootnoteIcon,

  // ── Theme and grid density ─────────────────────────────────────────────
  Sun as ThemeLightIcon,
  Moon as ThemeDarkIcon,
  SunMoon as ThemeAutoIcon,
  Monitor as DesktopIcon,
  Smartphone as MobileIcon,
  Grid2x2 as GridSparseIcon,
  Grid3x3 as GridDenseIcon,
} from "lucide-react";

export { LucideProvider } from "lucide-react";
export type { LucideProps as IconProps } from "lucide-react";

/**
 * The kit's message catalog: the type and the shape of a value.
 *
 * A namespace per component family. Strings that appear in several families live in
 * `common` and are not duplicated. The rule is simple: if a label means the same thing
 * in two places, it has one key.
 *
 * THE SHAPE OF A VALUE. A plain message is a string. A parameterized one is a function
 * `(vars) => string`, not an ICU template. Of the roughly ninety strings in the kit, nine
 * are parameterized and three of those need plural forms, and pulling an ICU parser into
 * the consumer's bundle for them is out of proportion. The cost of the decision is stated
 * openly: a locale file stops being data and becomes code, so it is not handed to an
 * external TMS as is. See ADR-0002.
 *
 * Plural forms live INSIDE the locale file and are handled with `Intl.PluralRules`: the
 * locale knows the rules, not the component. A component that counts word endings is a
 * component that speaks only one language.
 */

/** Labels shared by several families. They must not be duplicated across families. */
export interface CommonMessages {
  /** Close button: `Alert`, `ModalHeader`, `Dialog`, `Keyboard`. */
  close: string;
  /** Clearing the value: `Select`, `DateRangePicker`, `SearchControl`. */
  clear: string;
  /** The search found nothing: `Select`, `Combobox`, `CommandPalette`. */
  notFound: string;
  /** There is no data at all, unlike `notFound`, where there is a query. */
  empty: string;
  /** Loading in progress: `Spinner`. */
  loading: string;
  /** Placeholder of the search field. */
  searchPlaceholder: string;
}

export interface UiMessages {
  common: CommonMessages;

  alert: {
    /**
     * Its own label, not `common.close`: on a message, the close button closes THIS
     * message, and the screen reader must say so. Generalizing it to "Close" would lose
     * the specificity of the name, which is exactly what the label is for.
     */
    close: string;
  };

  banner: {
    /**
     * Its own label, not `common.close`: the banner closes an APP-LEVEL MESSAGE, and
     * "Close" next to the close button of a header or a dialog would sound the same for
     * different things. The same reason as for `alert.close`.
     */
    close: string;
  };

  breadcrumbs: {
    label: string;
    /** Hint on the collapsed items. */
    collapsed: (vars: { count: number }) => string;
  };

  combobox: {
    /** Label of the button that expands the list of suggestions. */
    showSuggestions: string;
  };

  commandPalette: {
    title: string;
    placeholder: string;
    /** Hint shown for an empty query. */
    emptyHint: string;
  };

  confirmDialog: {
    confirm: string;
    cancel: string;
    /** Label of the type-to-confirm field (`typeToConfirm`): what exactly must be typed. */
    typeToConfirm: (vars: { text: string }) => string;
    /** Hint under this field: the rule the typed text is checked against. */
    typeToConfirmHint: string;
  };

  datePicker: {
    placeholder: string;
  };

  dateRangePicker: {
    placeholder: string;
  };

  errorState: {
    title: string;
  };

  fileDropzone: {
    label: string;
    browse: string;
    /** Rejection reason: the file is over the limit. The size is already formatted. */
    tooLarge: (vars: { size: string }) => string;
    /** Rejection reason: several files arrived, but only one is accepted. */
    singleFileOnly: string;
    /** Rejection reason: folders are not accepted. */
    foldersNotAccepted: string;
    /** Rejection reason: the file type does not match `accept`. */
    wrongType: string;
    /** Rejection reason: the file could not be read. */
    unreadable: string;
    /** Substituted for the name when the item has none: it is a folder. */
    folderName: string;
  };

  filterBar: {
    /** Accessible name of the set of applied filters. */
    label: string;
    /**
     * The name of the remove button WITHOUT the filter's label.
     *
     * react-aria itself appends its tag's label to the button's name (`aria-labelledby`
     * on the button and on the tag), and "Remove filter Section: Contracts" became
     * "…Section: Contracts Section: Contracts". The screen reader reads the filter anyway,
     * because the library adds it.
     */
    remove: string;
    clear: string;
    /** The add-filter button and the labels of its fields. */
    add: string;
    field: string;
    value: string;
    apply: string;
    /**
     * Range (ADR-0063): the labels of the two input fields and three forms of the token
     * label. The token is built as "Field: <form>": "Amount: 50–100", "Amount: from 50",
     * "Date: until March 12". The bounds arrive already formatted for the `UiProvider` locale.
     */
    fromField: string;
    toField: string;
    rangeBetween: (vars: { from: string; to: string }) => string;
    rangeFrom: (vars: { from: string }) => string;
    rangeTo: (vars: { to: string }) => string;
  };

  maskedInput: {
    /**
     * The character did not match the mask.
     *
     * It says what was expected, not "invalid input": a user who hears the second knows
     * exactly as much as before the announcement. The reference USWDS implementation
     * failed the WCAG 3.3.3 test on this: a rejected input was not announced there at all.
     */
    rejected: (vars: { expected: "digit" | "letter" | "any" }) => string;
    /** The mask is filled completely: there is no room for a new character. */
    full: string;
    /**
     * The pasted value is longer than the mask, and its tail did not fit into the field.
     *
     * Kept separate from `full`, because this is a DIFFERENT rejection: there the field had
     * no room from the start, while here part of the value was accepted and part was dropped.
     * It must not be silent, because truncation gives a plausible result: `89161234567` under
     * a phone mask turns into `+7 (891) 612-34-56`, that is, another person's number, and
     * neither the component nor the eye notices it.
     */
    truncated: (vars: { count: number }) => string;
  };

  inlineEdit: {
    /**
     * The tail of the value button's accessible name: "Daily digest, edit".
     *
     * The name is built from the CONTENT, not set by `aria-label`: the value must be in the
     * name, otherwise the screen reader announces "edit title" and never reads what is
     * there now.
     */
    edit: string;
    /** Label of the empty value on the button. */
    empty: string;
  };

  keyboard: {
    /** The whole widget's name; the layout is data, not a translation. */
    label: (vars: { layout: KeyboardLayoutName }) => string;
    close: string;
    /** Label of the drag handle. */
    move: string;
    switchLayout: string;
    switchLayoutTo: (vars: { layout: KeyboardLayoutName }) => string;
    showSymbols: string;
    showLetters: (vars: { layout: KeyboardLayoutName }) => string;
    showPrimarySymbols: string;
    showExtraSymbols: string;
    backspace: string;
    space: string;
    submit: string;
    /** Names of the character keys: they are spoken but not drawn. */
    keyComma: string;
    keyPeriod: string;
    keyLess: string;
    keyGreater: string;
    keySemicolon: string;
    keyColon: string;
  };

  link: {
    /** Screen reader only: the link opens in a new tab. */
    opensInNewTab: string;
  };

  numberInput: {
    decrement: (vars: { label: string }) => string;
    increment: (vars: { label: string }) => string;
  };

  nav: {
    /** Accessible name of the sidebar's `<nav>`. */
    label: string;
    /**
     * Labels of the collapse button. Two, not one with a substitution: the button names an
     * ACTION, and "collapse" and "expand" are different actions, not one action with a
     * parameter.
     */
    collapse: string;
    expand: string;
  };

  mobileTabBar: {
    /** Accessible name of the bottom section bar's `<nav>`. */
    label: string;
    /**
     * Text of the "has something new" dot for the screen reader.
     *
     * The dot is a signal for the eye and carries no text in the markup: without this
     * string, an item with a dot sounds the same as one without it.
     */
    new: string;
    /**
     * The name of an item's numeric counter: a bare "3" next to the section's name says
     * nothing. It is the real number, not the "99+" shown on screen.
     */
    newCount: (vars: { count: number }) => string;
  };

  pagination: {
    label: string;
    previous: string;
    next: string;
  };

  passwordInput: {
    /**
     * The label of the show button is ONE for both states.
     *
     * The state is announced by `aria-pressed`, not by the label: a toggle button whose name
     * and state both change is read twice and contradictorily ("Hide password, pressed").
     * The APG rule: the name stays constant, the flag changes.
     */
    toggle: string;
    /** Warning that Caps Lock is on. */
    capsLock: string;
  };

  pinInput: {
    /** The name of one code field: without it the screen reader reads N unnamed fields. */
    digit: (vars: { index: number; total: number }) => string;
  };

  searchControl: {
    clear: string;
    openKeyboard: string;
  };

  selectionBar: {
    label: string;
    clearSelection: string;
    /** With plural forms: 1 selected, 2 selected, 5 selected. */
    count: (vars: { count: number }) => string;
  };

  shell: {
    /**
     * The first focusable link on the page: it skips the navigation and goes to `<main>`.
     * It is visible only on focus, but this is NOT sr-only text: a keyboard user without
     * a screen reader sees it with their eyes.
     */
    skipToContent: string;
    /** Button that opens the navigation as a drawer on narrow screens. */
    openNavigation: string;
  };

  spinner: {
    label: string;
  };

  stepper: {
    label: string;
    /**
     * The state of a step for speech: passed or upcoming.
     *
     * The state used to be expressed ONLY by the circle with a number or a checkmark, and
     * that is marked `aria-hidden`. The screen reader read the wizard as five identical
     * items, and which steps were already filled in and which were still upcoming was not
     * reported at all.
     *
     * The CURRENT step is NOT here: it is announced by `aria-current="step"`, and a string
     * of its own would produce "current step, current step, Payment".
     */
    state: (vars: { state: "done" | "upcoming" }) => string;
  };

  table: {
    empty: string;
    selectAll: string;
    selectRow: string;
    /** Accessible name of the expander column: without it the column is unnamed. */
    expandColumn: string;
    /**
     * Labels of the expand button. Two, because these are different actions.
     *
     * They take the row's name: the same "Show details" on twenty rows gives the screen
     * reader twenty identical names in button-list mode. The name is optional: it comes
     * from `rowLabel`, and a table may not have one. The branching lives in the locale file,
     * as the plural forms do.
     */
    expandRow: (vars: { row?: string }) => string;
    collapseRow: (vars: { row?: string }) => string;
  };

  tablePreferences: {
    columns: string;
    density: string;
    comfortable: string;
    compact: string;
    /** The order buttons name the column: otherwise they are indistinguishable. */
    moveUp: (vars: { column: string }) => string;
    moveDown: (vars: { column: string }) => string;
  };

  tableToolbar: {
    /** Total number of records. With plural forms: 1 record, 2 records, 5 records. */
    total: (vars: { count: number }) => string;
    /** Accessible name of the table settings button. */
    preferences: string;
  };

  tagInput: {
    /**
     * The name of the remove button WITHOUT the tag's name.
     *
     * react-aria itself appends its tag's label to the button's name, and "Remove tag alpha"
     * became "…alpha alpha". Found in the wave-18 review by computing the accessible name;
     * the same defect was in `FilterBar`.
     */
    remove: string;
    add: string;
    addTo: (vars: { label: string }) => string;
  };

  tagGroup: {
    /**
     * The name of the delete button INCLUDES the label inside it ("Delete: Design").
     *
     * Unlike `tagInput.remove`, the label is written into THIS string and not appended by
     * react-aria: the order of words belongs to the language, and "Delete: X" is not built
     * as "verb plus name" everywhere. That is why react-aria's `aria-labelledby` is turned
     * off on the button, otherwise the name would be read twice.
     */
    remove: (vars: { label: string }) => string;
  };

  copyButton: {
    /** Normal state of the button. */
    copy: string;
    /** Succeeded. It is announced, not just shown as an icon change. */
    copied: string;
    /**
     * Failed.
     *
     * A failed copy is a legitimate outcome: in an insecure context `navigator.clipboard`
     * is absent altogether, and writing may be forbidden by permissions. Staying silent
     * about it would show the user a button that does nothing.
     */
    failed: string;
  };

  mediaCard: {
    /**
     * Label of the select button. The state is NOT part of it: it is announced by
     * `aria-pressed`, and "Selected, deselect" would be read twice.
     */
    select: string;
  };

  notifications: {
    /** Accessible name of the events list. */
    label: string;
    /**
     * The word next to an unread event.
     *
     * The dot and the background are signals for the eye. Without this string, a person
     * who cannot see them would not tell a new event from an old one at all.
     */
    unread: string;
    /** Name of the unread counter: a bare "3" says nothing. */
    unreadCount: (vars: { count: number }) => string;
  };

  editableList: {
    /**
     * The name of the drag handle is ONLY a verb.
     *
     * Its own, not shared with `sortableList`: two components sharing one key break
     * silently as soon as one of them needs a different label.
     */
    drag: string;
    /**
     * What to show instead of an empty row title.
     *
     * A row with an empty value is not a data error: the edit could have been confirmed
     * with an empty value. There is nothing to show, but the row must stay visible and
     * editable, otherwise there would be no way to fix it.
     */
    emptyValue: string;
  };

  sortableList: {
    /**
     * The name of the drag handle is ONLY a verb.
     *
     * react-aria appends the row's label itself ("Drag Report for March"). Repeating it
     * here would give it twice, the same lesson as with the buttons inside `TagGroup`
     * in review 2.1.0.
     */
    drag: string;
  };

  contextualSaveBar: {
    /** Accessible name of the bar. */
    label: string;
    /** Default when the number of edits is not passed. */
    unsaved: string;
    /** The same, with a number: the locale handles the plurals, not the component. */
    changes: (vars: { count: number }) => string;
    save: string;
    cancel: string;
    /** Save in progress: it is announced, not just shown on the button. */
    saving: string;
  };

  savedViews: {
    /** Accessible name of the view switcher group. */
    label: string;
  };

  uploadQueue: {
    /** Accessible name of the queue list. */
    label: string;
    /**
     * The queue summary for the screen reader: a partial success is otherwise visible
     * only to the eyes.
     *
     * The locale file handles the plurals through `Intl.PluralRules`: the locale
     * knows the rules, not the component.
     */
    summary: (vars: { done: number; total: number; failed: number }) => string;
    /** Name of the progress bar when the file name is not a string. */
    progress: string;
    /** Name of the progress bar of a specific file. */
    itemProgress: (vars: { name: string }) => string;
  };

  treeView: {
    /**
     * The name of the expand button WITHOUT the node's name: react-aria appends its item's
     * label itself, and "Expand Nature" would become "…Nature Nature" (a lesson from the
     * wave-18 review).
     */
    expand: string;
    collapse: string;
    /** Name of the node's selection checkbox. */
    select: string;
  };

  timePicker: {
    label: string;
    /** Input mask: the letters for hours and minutes in the locale's language. */
    placeholder: string;
    /** Input mask with `hourCycle={12}`. */
    placeholder12: string;
    /** Label for the time before noon on a 12-hour clock. */
    am: string;
    /** Label for the time after noon on a 12-hour clock. */
    pm: string;
  };

  topbar: {
    /**
     * Accessible name of the `<header>`. It is needed even with a single header: in an
     * embedded widget it stops being the document's unique `banner`.
     */
    label: string;
  };

  rating: {
    /** The value in words: the only carrier of the magnitude for the screen reader. */
    value: (vars: { value: number; total: number }) => string;
    /** Name of an individual star in the radio group. */
    star: (vars: { index: number; total: number }) => string;
  };

  colorPicker: {
    /** Label of the row of presets. */
    presets: string;
    /**
     * Label of the input field. It is always about the hexadecimal format: the field is
     * exactly that, and `outputFormat` changes only the string that goes out.
     */
    hex: string;
  };

  treeSelect: {
    /** Label of the closed field when nothing is selected. */
    placeholder: string;
    /** The collapsed tail of the chips: "4 more". */
    more: (vars: { count: number }) => string;
  };

  transfer: {
    /** Label of the default left column. */
    source: string;
    /** Label of the default right column. */
    target: string;
    /** Name of the "right" button. */
    moveToTarget: string;
    /** Name of the "left" button. */
    moveToSource: string;
    /**
     * Name of the search field inside a column.
     *
     * Parameterized with the column's label: there are two search fields on the screen,
     * and "Search" in both would not tell them apart.
     */
    searchIn: (vars: { list: string }) => string;
  };

  splitPanel: {
    /** Name of the handle when the panel has no name of its own. */
    resize: string;
    /**
     * Name of the handle when the panel is named: "Resize: Order details".
     *
     * Two keys, not a substitution of an empty string: there can be several handles on the
     * screen, and "Resize" on each of them would not tell them apart.
     */
    resizeNamed: (vars: { panel: string }) => string;
    /** The current size in words: the slider's `aria-valuetext`. */
    size: (vars: { size: number }) => string;
  };

  splitButton: {
    /**
     * The accessible name of the expander, built from the label of the main action.
     *
     * Parameterized on purpose: there are usually several expanders on a page, and without
     * the action's label they are indistinguishable in speech: "button", "button", "button".
     */
    more: (vars: { action: string }) => string;
  };

  period: {
    /** Labels of the period presets: 7 days, this month and so on. */
    presets: Record<PeriodPresetKey, string>;
    /** Length of the period, with plural forms: 1 day, 2 days, 5 days. */
    length: (vars: { days: number }) => string;
  };

  carousel: {
    /**
     * What the screen reader calls the region: `aria-roledescription` is text for the ear,
     * not an ARIA token, and in a Russian interface the English "carousel" would sound like
     * a foreign word.
     */
    roleDescription: string;
    /** The same for a slide: "slide, 2 of 5". */
    slideRoleDescription: string;
    /** Name of the "back" button. */
    previous: string;
    /** Name of the "forward" button. */
    next: string;
    /** Name of a slide: its position in the strip. The role adds the word "slide", not the name. */
    slide: (vars: { index: number; total: number }) => string;
  };

  megaMenu: {
    /**
     * The back row on a narrow screen: an open category replaces the category column, and
     * this button brings it back. The button's name is one word without the category's name:
     * the name stands next to it as text, and the region is already labeled by it.
     */
    back: string;
  };

  shortcutsHelp: {
    /** Default window title. It is also the dialog's accessible name. */
    title: string;
    /**
     * The name of the scrollable area with the list. Its own, not a repeat of the title:
     * identical names on the window and on the region inside it would make the screen reader
     * announce them twice in a row.
     */
    list: string;
    /**
     * The word between the keys of a shortcut, for the ear only: "Ctrl plus K".
     *
     * Screen readers read the visible "+" differently: NVDA at its default punctuation level
     * drops it, and "Ctrl K" sounds like two separate keys rather than a shortcut. A word from
     * the catalog removes the dependency on settings.
     */
    keySeparator: string;
  };

  /**
   * The rich text editor: a separate entry point `@olddevs/ui/editor` (ADR-0050). Its strings
   * live in the shared catalog, not in a catalog of their own: the consumer wires the locale
   * with one line for the whole kit, and a second catalog for a subpath would simply not be
   * picked up.
   */
  editor: {
    /**
     * The accessible name of the field when neither `aria-label` nor a `FormField` label is
     * given. Without it, the screen reader would announce an unnamed "input field".
     */
    label: string;
    /** Placeholder of the empty default document. */
    placeholder: string;
    /** Counter with `maxLength`, starting at 80% of the limit: "12 characters left". */
    remaining: (vars: { count: number }) => string;
    /**
     * The document is longer than the limit: it came in that way in `value`. A string of its
     * own, not a negative "left" count: "−3 characters left" reads as a typo.
     */
    overLimit: (vars: { count: number }) => string;
    /**
     * The browser's bubble on an empty required editor. A string of its own, not the native
     * "Please fill out this field": that one lives in the browser's language and does not
     * follow the kit's locale.
     */
    required: string;
    /**
     * The name of the Toolbar (`role="toolbar"`). An unnamed toolbar is announced by the
     * screen reader simply as "toolbar", without saying what it belongs to.
     */
    toolbar: string;
    /**
     * The name of the selection menu (`toolbar="bubble"`, `role="toolbar"`). Its own, not the
     * Toolbar's "Formatting": it is a different set of buttons, and the screen reader must
     * tell the Bubble menu's pill over the selection apart from the Toolbar over the field.
     */
    selectionToolbar: string;
    /**
     * The former text style list on the Toolbar ("Text style: Paragraph").
     *
     * @deprecated The Toolbar no longer reads it: the Block type is chosen in the "¶" menu
     * (`blockType`). The key stays so that a consumer's partial catalog with it still
     * compiles; it is removed in 4.0.0.
     */
    textStyle: (vars: { current: string }) => string;
    /**
     * The "¶" menu, the Block type: the name of the button (and the menu) when there is no
     * text Block under the caret, that is, an image or a divider is selected.
     */
    blockTypeMenu: string;
    /**
     * The name of the "¶" menu button with the current Block type: "Block type: Heading 2".
     * The button's icon shows the type to the eye, the name shows it to the screen reader;
     * without the value in the name, the user would learn the type only by opening the menu.
     */
    blockType: (vars: { current: string }) => string;
    /**
     * The "…" menu: the name of the button and the menu with the rarer marks, the highlight,
     * text color and clearing of styles. There is no current value in the name: the menu has
     * many independent marks, and one value would not name the button.
     */
    moreFormatting: string;
    /**
     * The "plain text" item of the "¶" menu. Not `paragraph`: in the Slash menu the same
     * Block is called "Paragraph", while the "¶" menu uses the wording of the design
     * reference: "Text".
     */
    textBlock: string;
    /** The "plain paragraph" item in the "Turn into" section of the Slash menu. */
    paragraph: string;
    /**
     * Heading of level `level` (1–4): an item of the "¶" and Slash menus, and the value on
     * the "¶" button.
     */
    heading: (vars: { level: number }) => string;
    /**
     * The Slash menu: the name of the "+" button on the Toolbar and the name of the list that
     * `/` opens in the text. One name for both entry points: it is one menu.
     */
    insertMenu: string;
    /** Section of the Slash menu: a new Block after the current one. */
    insertSection: string;
    /** The "Turn into" section of the Slash menu: changes the type of the current Block, keeping the text. */
    turnIntoSection: string;
    /**
     * The Slash menu's row for when what is typed after `/` matches nothing. Without it, an
     * empty list would look frozen, and the screen reader would hear nothing.
     */
    nothingFound: string;
    /**
     * The name of the list for a custom trigger character (`@`, `#`) for which the consumer
     * did not set a `label`: the list of suggestions next to the caret.
     */
    triggerList: string;
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    /** Inline code: a mark inside a paragraph, not a code block. */
    code: string;
    superscript: string;
    subscript: string;
    /** Remove all marks from the selection. */
    clearFormatting: string;
    /** Link: the Toolbar button and the name of the link popover. */
    link: string;
    /** Label of the address field in the link popover. */
    linkAddress: string;
    /** Apply the address: the same as Enter in the field. */
    linkApply: string;
    /** Remove the link, keeping the text. Present when the caret is already in a link. */
    linkRemove: string;
    /**
     * The address was not accepted: a foreign scheme (`javascript:`, `ftp:`), a relative path,
     * or a space inside it. Names what is accepted, otherwise it is unclear what to fix.
     */
    linkInvalid: string;
    bulletList: string;
    orderedList: string;
    /** Checklist: items with checkboxes. */
    taskList: string;
    blockquote: string;
    codeBlock: string;
    /**
     * The language button of a code block: its name includes the current language, as the
     * color menu's name does: "Language: Python". The language names are data (`codeLanguages.ts`)
     * and are not translated; a block without a language is named `codeLanguagePlain`.
     */
    codeLanguage: (vars: { current: string }) => string;
    /** A code block without a language: no highlighting and no `class` in the Document. */
    codeLanguagePlain: string;
    /**
     * The hint of the "copy" button in the header of a code block: "Copy code". The button's
     * name and "Copied" come from `copyButton`, as they do everywhere in the kit.
     */
    codeCopy: string;
    /** Divider: a horizontal rule between Blocks. */
    horizontalRule: string;
    undo: string;
    redo: string;
    /**
     * The name of the checkbox on a checklist item. The engine renders the checkbox, and without
     * this string the screen reader would hear the English "Task item checkbox for …". An empty
     * item comes with `text: ""`.
     */
    taskCheckbox: (vars: { text: string }) => string;
    /**
     * The name of the "Highlight" button includes the current color as a word: a sample for the
     * eye, the name for the ear. The color is named by its shade, not by its token role: the
     * author selects "red", not `danger`, and the name is translated.
     */
    highlight: (vars: { current: string }) => string;
    /** The "remove text color" item and its label on a trigger without a color. */
    colorDefault: string;
    /** The "remove highlight" item and the label of a trigger without a highlight. */
    highlightNone: string;
    /**
     * The hint of the "Highlight" button on the Toolbar and in the Bubble menu's pill: a click
     * opens the row of highlights. The button's name is `highlight` with the current value.
     */
    highlightToggle: string;
    /** "Remove highlight": the last cell of the highlight row and grid, an icon with a hint. */
    highlightRemove: string;
    /** "Remove color": the last cell of the "Text color" grid, an icon with a hint. */
    colorRemove: string;
    /**
     * The "Color" button: the letter "A" in the current color; it opens the text color and
     * highlight grids. The same name belongs to its popover.
     */
    color: string;
    /** The name of the "Color" button with the current text color: "Color: Red". */
    colorMenu: (vars: { current: string }) => string;
    /** Headings of the grids in the "Color" popover. */
    textColorSection: string;
    highlightSection: string;
    /** Names of the text colors (`EDITOR_TEXT_COLORS` in `src/editor/styles/palette.ts`). */
    colorAccent: string;
    colorSuccess: string;
    colorWarning: string;
    colorDanger: string;
    colorLime: string;
    colorMuted: string;
    /** Names of the highlight colors (`EDITOR_MARKERS`): the nine circles of the grid, by shade. */
    markerGray: string;
    markerBrown: string;
    markerOrange: string;
    markerYellow: string;
    markerGreen: string;
    markerBlue: string;
    markerPurple: string;
    markerPink: string;
    markerRed: string;
    /**
     * A custom color through `ColorPicker`: the item at the top of each "Color" popover grid.
     * The ellipsis is the sign that the item opens a dialog rather than applying a color.
     */
    colorCustom: string;
    /**
     * The author's color in the button's name: "Color: Custom #00aa55", "Highlight: Custom #ffe066".
     */
    colorCustomCurrent: (vars: { hex: string }) => string;
    /** Name of the custom text color popover. */
    customColorText: string;
    /** Name of the custom highlight color popover. */
    customColorHighlight: string;
    /** The color choice button in the popover: the visible label names the value. */
    customColorValue: (vars: { hex: string }) => string;
    customColorApply: string;
    customColorCancel: string;
    /**
     * A warning about the contrast of the text color with the Editor's background in the current
     * theme (WCAG 1.4.3, 4.5:1). It warns, it does not forbid.
     */
    customColorLowContrastText: (vars: { ratio: string }) => string;
    /** The same for a highlight: the Editor's main text is measured against this background. */
    customColorLowContrastHighlight: (vars: { ratio: string }) => string;
    /** The author's color does not change with the theme, unlike the palette colors. */
    customColorThemeNote: string;
    /**
     * Alignment of a Block: the items of the "Alignment" menu and the rows of the shortcut
     * reference. The name of each one is self-sufficient.
     */
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    /**
     * The "Alignment" menu: the name of the button and the menu with the current alignment:
     * "Alignment: center". The button's icon shows it to the eye, the name to the screen reader.
     * The default (`left`) is a value too: a Block without `data-align` is aligned left.
     */
    alignMenu: (vars: { current: "left" | "center" | "right" }) => string;
    /**
     * The "Lists" menu: the name of the button and the menu with the current kind of list:
     * "List: numbered". `null` means the caret is not in a list, and the name simply names the menu.
     */
    listMenu: (vars: { current: "bulletList" | "orderedList" | "taskList" | null }) => string;
    /**
     * Table. `table` is the Slash menu item, the Toolbar button and the name of its menu (as in
     * TinyMCE: one "Table ▾" button for insertion and for actions), and the item of this menu
     * with a size grid. `tableInsertDialog` is the item that opens the window with numeric
     * fields, `tableInsertDialogTitle` is the window's title. `tableCell`, `tableRow`,
     * `tableColumn` and `tableSort` are submenus. The name of each submenu item is
     * self-sufficient: "Insert row above", not "Above" under the heading "Row", because the
     * screen reader reads the item, not its section.
     */
    table: string;
    tableInsertDialog: string;
    tableInsertDialogTitle: string;
    tableCell: string;
    tableRow: string;
    tableColumn: string;
    tableSort: string;
    tableMergeCells: string;
    tableSplitCell: string;
    tableAddRowBefore: string;
    tableAddRowAfter: string;
    tableAddColumnBefore: string;
    tableAddColumnAfter: string;
    tableDeleteRow: string;
    tableDeleteColumn: string;
    /** Toggle item: the first table row holds the column headers. */
    tableHeaderRow: string;
    /** Alignment of the column under the caret: radio items of the "Column" submenu. */
    tableAlignLeft: string;
    tableAlignCenter: string;
    tableAlignRight: string;
    /**
     * Column widths (ADR-0080). `tableColumnWider` and `tableColumnNarrower` are items of the "Column"
     * submenu: a step of 5% at the expense of the neighbour. `tableColumnWidth` names the width of the
     * column under the caret, both as the label of the section that holds the two items and as the
     * announcement after a change ("Column width: 35%"); `percent` is `null` for a table sized by its
     * content. `tableEqualColumns` and `tableFitContent` are items of the "Table" menu: the first
     * makes all columns the same width, the second removes the widths. The names are self-sufficient,
     * like the rest of the menu: the screen reader reads the item, not its section.
     */
    tableColumnWider: string;
    tableColumnNarrower: string;
    tableColumnWidth: (vars: { percent: number | null }) => string;
    tableEqualColumns: string;
    tableFitContent: string;
    tableSortAscending: string;
    tableSortDescending: string;
    /**
     * Why sorting is unavailable: the table has merged cells, and a row cannot be moved without
     * splitting the merge. The label of the submenu's section.
     */
    tableSortMerged: string;
    tableDelete: string;
    /** Cancel in the "Insert table" window. */
    tableCancel: string;
    /** Image: the Toolbar button, the Slash menu item and the name of the image popover. */
    image: string;
    /** Label of the image address field in the popover. */
    imageAddress: string;
    /**
     * The image address was not accepted: `data:`, `blob:`, a relative path or a foreign
     * scheme. Names what is accepted, otherwise it is unclear what to fix.
     */
    imageInvalid: string;
    /** Label of the alternative text field. */
    imageAlt: string;
    /**
     * The hint under the alternative text field: what it is for and what an empty value means.
     * Without it the field looks required, and an empty one looks like an error.
     */
    imageAltHint: string;
    /** Insert the image by its address: the same as Enter in the field. */
    imageInsert: string;
    /** Apply the changes to the existing image. */
    imageApply: string;
    /** Choose a file from the device: present when the consumer supplied `onUploadImage`. */
    imageChooseFile: string;
    /** Remove the image from the Document. */
    imageRemove: string;
    /** Open the popover of the selected image: address, description and width. */
    imageEdit: string;
    /** Name of the group of width presets and of the image's floating Toolbar. */
    imageWidth: string;
    /**
     * Width preset: "50 %". A function, because languages have their own percent sign and
     * space before it.
     */
    imageWidthPreset: (vars: { percent: number }) => string;
    /** Hint for an empty image caption. The caption is optional, and the string says so. */
    imageCaption: string;
    /** Placeholder in place of the uploading image, and the message of the live region. */
    imageUploading: (vars: { name: string }) => string;
    /** Live region: the image has been uploaded and placed in the Document. */
    imageUploaded: (vars: { name: string }) => string;
    /**
     * The upload failed (`onUploadImage` rejected the promise or returned an address outside
     * the policy). The Document does not change in this case.
     */
    imageUploadFailed: (vars: { name: string }) => string;
    /** A file from the clipboard or from a drag is not an image. */
    imageNotImage: (vars: { name: string }) => string;
    /**
     * A file was pasted or dropped, and there is no uploader (`onUploadImage` was not passed).
     * It explains how to insert the image another way.
     */
    imageFilesUnsupported: string;
    /**
     * The field's error: the Editor did not start, because the set of Tools was assembled with
     * an error (ADR-0058, items 1.5 and 2.4). The developer sees the cause in the console; the
     * author gets the message that the field does not work and the Document is untouched.
     */
    toolsFailed: string;
    /**
     * The button on the field's error, when an Extensions loader failed (network, a stale
     * chunk): it calls the failed loaders again (ADR-0058, item 11.6).
     */
    retry: string;
    /**
     * Live region: a Text card of a custom Tool has appeared in the text (ADR-0058, item 6.8).
     * `label` is the record's label, `shortcut` is the key combination that leads to the Text
     * card (`Alt+F10`). A function: the label and the key stand in the middle of the sentence.
     */
    textCardShown: (vars: { label: string; shortcut: string }) => string;
    /**
     * The table size picker. `tableGrid` is the name of the grid; `tableSize` is the size in
     * words ("3 columns, 4 rows") for the cell's name and the live region. In Russian the plural
     * depends on the number, so it is a function, not two strings. `tableColumns` and `tableRows`
     * are the names of the numeric fields, `tableInsert` is the button under them.
     */
    tableGrid: string;
    tableSize: (vars: { cols: number; rows: number }) => string;
    tableColumns: string;
    tableRows: string;
    tableInsert: string;
    /**
     * The layout: a Block of columns. `layout` is the Slash menu item and the "Add › Layout ›"
     * submenu of the Block handle; `layoutVariant` holds the names of the six variants ("Two
     * columns", "60/40"), the items of the submenu and "Format ›". The keys are the names of the
     * Schema's variants (`editor/features/layout/columnLayouts.ts`).
     */
    layout: string;
    layoutVariant: Record<EditorLayoutVariant, string>;
    /**
     * A Wrapper: a Block that gathers a group of Blocks. `wrapper` is the Slash menu item and the
     * "Add ›" submenu of the Block handle; `unwrap` is the handle's menu item that removes the
     * Wrapper and leaves its Blocks in place.
     */
    wrapper: string;
    unwrap: string;
    /**
     * The tone of a Wrapper: the "Tone ›" submenu of the Wrapper handle's menu. `wrapperTone` is
     * the name of the item with the current tone ("Tone: Note"), like the name of the "¶" button
     * with the current Block type. `wrapperToneNone` is the "No tone" item and the current value
     * of a Wrapper without a tone. `wrapperToneName` holds the tone names in the words of GitHub
     * alerts (Note, Tip, Important, Warning, Caution), and its keys are the `data-tone` names.
     * A word, not a color: the tone is chosen by the meaning of the note.
     */
    wrapperTone: (vars: { current: string }) => string;
    wrapperToneNone: string;
    wrapperToneName: Record<EditorWrapperTone, string>;
    /**
     * A collapsible Block (Details). `details` is the Slash menu item and the "Add ›" submenu
     * of the Block handle. `unwrapDetails` is the handle's menu item: the Block stops being
     * collapsible, its title becomes a paragraph, and the content stays in place.
     * `detailsToggle` is the name of the expand button: the engine renders the button without
     * text, and without a name the screen reader would say "button". The name identifies the
     * Block by its title (`text` is the summary text, empty for a Block without a title), and
     * whether it is expanded is said by `aria-expanded`. A function: the title stands in the
     * middle of the sentence.
     */
    details: string;
    unwrapDetails: string;
    detailsToggle: (vars: { text: string }) => string;
    /**
     * Formulas (Mathematics, ADR-0070). `mathInline` and `mathBlock` are the items of the Slash
     * menu and of the "Add ›" submenu of the Block handle; they are also the names of the formula popover
     * of the formula popover. In the popover: `mathLatex` is the label of the field, `mathPreview`
     * is the name of the preview area, `mathEmpty` is its hint while the field is empty,
     * `mathInvalid` is the error in the field (`detail` is the KaTeX message: the engine does not
     * translate it, so it stays in English), `mathInsert` and `mathApply` are the buttons for a
     * new and for an editable formula, and `mathRemove` removes the editable formula from the
     * Document.
     */
    mathInline: string;
    mathBlock: string;
    mathLatex: string;
    mathPreview: string;
    mathEmpty: string;
    mathInvalid: (vars: { detail: string }) => string;
    mathInsert: string;
    mathApply: string;
    mathRemove: string;
    /**
     * Date mention (ADR-0079). `date` is the Slash menu item and the name of the popover. In the
     * popover: `dateTime` is the label of the "Time" switch, `dateTimeField` is the name of the time
     * field (`HH:MM`), `dateRemoveTime` turns a date with a time back into a date, `dateRemove` deletes
     * the mention from the Document, `dateInsert` and `dateApply` are the buttons for a new and for an
     * editable mention.
     */
    date: string;
    dateTime: string;
    dateTimeField: string;
    dateRemoveTime: string;
    dateRemove: string;
    dateInsert: string;
    dateApply: string;
    /**
     * Footnotes (ADR-0076). `footnote` is the name of the Slash menu item and of the item in the "…"
     * menu of the Toolbar. `footnotes` is the name of the list, written into the saved HTML
     * (`aria-label` of the list) in the language of this catalog, like the rest of the Document's text.
     * `footnoteBack` is the name of the number button of a footnote in the Editor, which returns the
     * caret to the text; the number is in the sentence, so a function.
     */
    footnote: string;
    footnotes: string;
    footnoteBack: (vars: { number: number }) => string;
    /**
     * Emoji. `emoji` is the name of the Toolbar button; `emojiGrid` is the name of the grid in
     * the popover. `emojiCategory` holds the category names, `emojiName` the name of each emoji:
     * a screen reader reads a cell by its name, not by its character, because different programs
     * voice the same character differently, or stay silent. The keys come from
     * `editor/features/emoji/emoji.ts`.
     */
    emoji: string;
    emojiGrid: string;
    emojiCategory: Record<EmojiCategory, string>;
    emojiName: Record<EmojiName, string>;
    /**
     * Source mode. `source` is the name and the hint of the Toolbar's toggle button; `sourceField`
     * is the name of the field with the Document's source HTML, which replaces the Document in
     * this mode. The button's label is "HTML" in every language: that is what Redactor and the
     * CMSs call the mode, and "Source code" would be longer and explain no better.
     */
    source: string;
    sourceField: string;
    /**
     * Showing invisible characters (spaces, soft hyphens and paragraph ends). `invisibleCharacters`
     * is the name of the checkbox item in the "…" menu of the fixed Toolbar. Whether the characters
     * are shown is said by `aria-checked`, not by the words of the name.
     */
    invisibleCharacters: string;
    /**
     * Text part language (the `language` Tool, ADR-0078). `language` is the "Language ›" item of the
     * "…" menu, and the name of its submenu. The submenu lists the languages of the Tool's
     * `languages` option; their names are drawn by `Intl.DisplayNames` in the interface language, not
     * by the catalog. `languagePrimary` labels the page's own language in that list, the one that
     * needs no mark: `language` is the language's name. `languageRemove` is the item that removes the
     * mark from the selection.
     */
    language: string;
    languagePrimary: (vars: { language: string }) => string;
    languageRemove: string;
    /**
     * Search and replace. `search` is the name and the hint of the Toolbar button, and of the
     * shortcut reference row `Mod+F`; `searchReplace` is the `Mod+Alt+F` row; `searchPanel` is the
     * name of the panel; the rest are its fields, checkboxes and buttons. `searchCount` is the
     * counter "3 of 12", announced politely; with no matches, it is `searchNoMatches`.
     */
    search: string;
    searchReplace: string;
    searchPanel: string;
    searchField: string;
    replaceField: string;
    searchPrevious: string;
    searchNext: string;
    searchClose: string;
    searchMatchCase: string;
    searchWholeWord: string;
    searchRegex: string;
    replaceOne: string;
    replaceAll: string;
    searchCount: (vars: { current: number; total: number }) => string;
    searchNoMatches: string;
    searchInvalid: string;
    /**
     * The resize handle of a field (`resizable`): `resizeField` is the name of the slider,
     * `fieldHeight` is its current height in words (`aria-valuetext`).
     */
    resizeField: string;
    fieldHeight: (vars: { size: number }) => string;
    /**
     * The shortcut reference. `shortcuts` is the name of the Toolbar button, its hint and the
     * name of the popover; `shortcutsCommand` and `shortcutsKeys` are the headings of the two
     * table columns. The rest are labels of commands that have no button of their own, and so
     * no label above: the commands over Blocks, selection, moving a list item and moving into
     * the Toolbar. The label names the action, not the key: the keys are next to it, in the
     * adjacent column.
     */
    shortcuts: string;
    shortcutsCommand: string;
    shortcutsKeys: string;
    /** The first `⌘A`: select the text of the current Block. */
    selectBlock: string;
    /** A second `⌘A` in a row: select the whole Document. */
    selectDocument: string;
    duplicateBlock: string;
    moveBlockUp: string;
    moveBlockDown: string;
    indentListItem: string;
    outdentListItem: string;
    /** `Alt+F10`: move focus from the Document to the Toolbar. */
    focusToolbar: string;
    /**
     * The Block handle: `blockActions` is the name of the "⋮" button, its menu and the shortcut
     * reference rows (`Mod+/`); the rest are the menu items. The words are short and without
     * "block": the menu is already named "Block actions".
     */
    blockActions: string;
    blockAdd: string;
    blockFormat: string;
    blockMoveUp: string;
    blockMoveDown: string;
    blockDuplicate: string;
    blockDelete: string;
    /**
     * Block selection (the `blockSelection` Tool, ADR-0077) and the Block handle over several Blocks.
     * `blockSelect` is the handle's item that selects the current Blocks (the way in on a touch
     * screen); `blockWrap` is the handle's submenu "Wrap in ›" over a group of Blocks (its items are
     * the names of the containers: `wrapper`, `blockquote`, `details`). `blockSelectionSelect` and
     * `blockSelectionExtend` are the reference rows of `Esc` and `Shift+↑/↓`.
     */
    blockSelect: string;
    blockWrap: string;
    blockSelectionSelect: string;
    blockSelectionExtend: string;
    /**
     * What the screen reader hears (Field notice, tone `status`): the state of the selection and the
     * result of an action over Blocks. The count is in the phrase's tail, so the phrase needs no
     * plural form in any language.
     */
    blocksSelected: (vars: { count: number }) => string;
    blockSelectionCleared: string;
    blocksDeleted: (vars: { count: number }) => string;
    blocksDuplicated: (vars: { count: number }) => string;
    blocksMoved: (vars: { count: number }) => string;
    blocksChanged: (vars: { count: number }) => string;
    blocksWrapped: (vars: { count: number }) => string;
    blocksCopied: (vars: { count: number }) => string;
    blocksCut: (vars: { count: number }) => string;
    blocksReplaced: (vars: { count: number }) => string;
    /**
     * The Document's table of contents (`RichTextToc`): the name of the strip button and the label
     * of the `nav` with the list of headings. It is one word for both, because it is one thing.
     */
    toc: string;
    /**
     * Video by link (the `youtube` and `twitch` Tools, ADR-0071). `video` is the Slash menu item
     * and the "Add ›" submenu of the Block handle; `videoLink` is the name of the link field in the
     * popover; `videoInsert` is the popover's button; `videoNotFound` is the field's error for a
     * link that does not lead to a video of an enabled service (`services` holds the names of the
     * services joined by " / ": "YouTube" or "YouTube / Twitch". The separator is the same in every
     * language, and the phrase reads the same with it). `videoPlay` is the label of the placeholder
     * button; `videoPlayLabel` is its accessible name (the visible word "Play" is included in it
     * whole, WCAG 2.5.3); `videoPlayer` is the `iframe` title for the screen reader. The service
     * names (`service`) are brand names and are not translated.
     */
    video: string;
    videoLink: string;
    videoInsert: string;
    videoNotFound: (vars: { services: string }) => string;
    videoPlay: string;
    videoPlayLabel: (vars: { service: string }) => string;
    videoPlayer: (vars: { service: string }) => string;
    /**
     * The quote set of the catalog's language for the `typography` Tool: `"ru"` — «…» and „…“,
     * `"en"` — “…” and ‘…’. It is not text for a screen reader but a marker of the catalog's
     * language: a catalog in another language (German, French) has no quote set of its own
     * in the kit, and until the value is set, `"en"` applies. The set can be set explicitly
     * with the `quotes` Option.
     */
    typographyQuotes: EditorQuoteSet;
  };
}

/**
 * The Editor's Layout variants: the keys of `editor.layoutVariant`, the column shares in percent
 * joined by dashes, as `data-layout` writes them (`editor/features/layout/columnLayouts.ts`).
 */
export type EditorLayoutVariant = "100" | "50-50" | "33-33-33" | "25-25-25-25" | "60-40" | "40-60";

/**
 * The Editor's Wrapper tones: the keys of `editor.wrapperToneName`, the names of the kit's `Tone`
 * vocabulary, as `data-tone` writes them (`editor/features/wrapper/wrapperTones.ts`).
 */
export type EditorWrapperTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** The `typography` quote sets: the values of `editor.typographyQuotes` and of the `quotes` Option. */
export type EditorQuoteSet = "en" | "ru";

/**
 * The Editor's emoji categories: the keys of `editor.emojiCategory`. The display order is set by
 * `editor/features/emoji/emoji.ts`.
 */
export type EmojiCategory =
  "favorites" | "smileys" | "gestures" | "animals" | "food" | "activities" | "travel";

/**
 * The Editor's emoji names: the keys of `editor.emojiName`. The membership of the categories is
 * set by `editor/features/emoji/emoji.ts`.
 */
export type EmojiName =
  | "faceWithTearsOfJoy"
  | "redHeart"
  | "rollingOnTheFloorLaughing"
  | "thumbsUp"
  | "loudlyCrying"
  | "foldedHands"
  | "blowingKiss"
  | "smilingWithHearts"
  | "heartEyes"
  | "partyPopper"
  | "beamingFace"
  | "fire"
  | "birthdayCake"
  | "flushedFace"
  | "sunglassesFace"
  | "sparkles"
  | "eyes"
  | "pointingRight"
  | "hundredPoints"
  | "angryFace"
  | "slightlySmiling"
  | "grinningSmilingEyes"
  | "grinningSquinting"
  | "winkingFace"
  | "tongueFace"
  | "smilingBlushing"
  | "smirkingFace"
  | "thinkingFace"
  | "sleepyFace"
  | "thumbsDown"
  | "victoryHand"
  | "clappingHands"
  | "raisedHands"
  | "facepalm"
  | "shrug"
  | "oncomingFist"
  | "wavingHand"
  | "okHand"
  | "dog"
  | "cat"
  | "mouse"
  | "hamster"
  | "rabbit"
  | "bear"
  | "panda"
  | "lion"
  | "pig"
  | "frog"
  | "greenApple"
  | "pizza"
  | "hamburger"
  | "frenchFries"
  | "spaghetti"
  | "sushi"
  | "iceCream"
  | "doughnut"
  | "cookie"
  | "shortcake"
  | "soccerBall"
  | "basketball"
  | "americanFootball"
  | "baseball"
  | "tennis"
  | "bowling"
  | "golfer"
  | "fishing"
  | "cyclist"
  | "videoGame"
  | "airplane"
  | "car"
  | "bicycle"
  | "train"
  | "sailboat"
  | "worldMap"
  | "beach"
  | "mountain"
  | "camping"
  | "luggage";

/** The on-screen keyboard layout. This is input DATA, not the interface language. */
export type KeyboardLayoutName = "ru" | "en";

/** Period preset keys; they match `PeriodPreset` from `lib/period.ts`. */
export type PeriodPresetKey = "7d" | "30d" | "90d" | "365d" | "thisMonth" | "lastMonth";

/** A partial catalog: the consumer overrides only what it wants. */
export type PartialUiMessages = {
  [K in keyof UiMessages]?: Partial<UiMessages[K]>;
};

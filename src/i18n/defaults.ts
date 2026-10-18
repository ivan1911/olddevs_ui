import type { UiMessages } from "./messages.js";

/**
 * The English fallback, baked into the code.
 *
 * It is ALWAYS in the bundle: it backs the third step of string resolution
 * (`prop → provider message → fallback`), and without it a component with no provider
 * would render nothing. So the catalog is kept small and dependency-free.
 *
 * `@olddevs/ui/locales/en` re-exports this same object instead of repeating it: two
 * copies of the English would drift apart silently, as any two copies do.
 *
 * Russian moved to `@olddevs/ui/locales/ru` and is wired in with one line. Before
 * 2.0.0 it was baked in here as well, a consequence of ADR-0024 of the consuming
 * product; outside that product the reason fell away.
 */
export const DEFAULT_MESSAGES: UiMessages = {
  common: {
    close: "Close",
    clear: "Clear",
    notFound: "Nothing found",
    empty: "Empty",
    loading: "Loading",
    searchPlaceholder: "Search…",
  },

  alert: {
    close: "Dismiss message",
  },

  banner: {
    close: "Dismiss announcement",
  },

  breadcrumbs: {
    label: "Breadcrumbs",
    collapsed: ({ count }) => `${count} more`,
  },

  combobox: {
    showSuggestions: "Show suggestions",
  },

  commandPalette: {
    title: "Command palette",
    placeholder: "Search actions",
    emptyHint: "Start typing an action name",
  },

  confirmDialog: {
    confirm: "Confirm",
    cancel: "Cancel",
    typeToConfirm: ({ text }) => `Type “${text}” to confirm`,
    typeToConfirmHint: "The match is case-sensitive.",
  },

  datePicker: {
    placeholder: "Pick a date",
  },

  dateRangePicker: {
    placeholder: "Pick a period",
  },

  errorState: {
    title: "Failed to load",
  },

  fileDropzone: {
    label: "Drop files here",
    browse: "Choose files",
    tooLarge: ({ size }) => `too large, ${size}`,
    singleFileOnly: "only one file is accepted",
    foldersNotAccepted: "folders are not accepted",
    wrongType: "Unsupported type",
    unreadable: "Could not be read",
    folderName: "folder",
  },

  filterBar: {
    label: "Applied filters",
    remove: "Remove filter",
    clear: "Clear all",
    add: "Add filter",
    field: "Field",
    value: "Value",
    apply: "Apply",
    fromField: "From",
    toField: "To",
    rangeBetween: ({ from, to }) => `${from}–${to}`,
    rangeFrom: ({ from }) => `from ${from}`,
    rangeTo: ({ to }) => `to ${to}`,
  },

  maskedInput: {
    rejected: ({ expected }) =>
      expected === "digit"
        ? "A digit is expected here"
        : expected === "letter"
          ? "A letter is expected here"
          : "A digit or a letter is expected here",
    full: "The field is already complete",
    truncated: ({ count }) =>
      `The pasted value is ${count} character${count === 1 ? "" : "s"} too long; the rest was not accepted`,
  },

  inlineEdit: {
    edit: "edit",
    empty: "Not set",
  },

  keyboard: {
    label: ({ layout }) => (layout === "ru" ? "Russian keyboard" : "English keyboard"),
    close: "Close the on-screen keyboard",
    move: "Move the on-screen keyboard",
    switchLayout: "Switch layout",
    switchLayoutTo: ({ layout }) =>
      layout === "ru" ? "Switch layout to Russian" : "Switch layout to English",
    showSymbols: "Show symbols",
    showLetters: ({ layout }) =>
      layout === "ru" ? "Show Russian letters" : "Show English letters",
    showPrimarySymbols: "Show the primary symbol set",
    showExtraSymbols: "Show the extra symbol set",
    backspace: "Delete character",
    space: "Space",
    submit: "Submit search",
    keyComma: "Comma",
    keyPeriod: "Period",
    keyLess: "Less than",
    keyGreater: "Greater than",
    keySemicolon: "Semicolon",
    keyColon: "Colon",
  },

  link: {
    opensInNewTab: "(opens in a new tab)",
  },

  numberInput: {
    decrement: ({ label }) => `${label}: decrease`,
    increment: ({ label }) => `${label}: increase`,
  },

  nav: {
    label: "Main navigation",
    collapse: "Collapse navigation",
    expand: "Expand navigation",
  },

  mobileTabBar: {
    label: "Sections",
    new: "New",
    newCount: ({ count }) => `${count} new`,
  },

  pagination: {
    label: "Pages",
    previous: "Previous page",
    next: "Next page",
  },

  passwordInput: {
    toggle: "Show password",
    capsLock: "Caps Lock is on",
  },

  pinInput: {
    digit: ({ index, total }) => `Digit ${index} of ${total}`,
  },

  searchControl: {
    clear: "Clear search",
    openKeyboard: "Open the on-screen keyboard",
  },

  savedViews: {
    label: "Saved views",
  },

  contextualSaveBar: {
    label: "Unsaved changes",
    unsaved: "You have unsaved changes",
    changes: ({ count }) => `${count} unsaved ${count === 1 ? "change" : "changes"}`,
    save: "Save",
    cancel: "Discard",
    saving: "Saving\u2026",
  },

  selectionBar: {
    label: "Actions on selection",
    clearSelection: "Clear selection",
    count: ({ count }) => `${count} selected`,
  },

  shell: {
    skipToContent: "Skip to content",
    openNavigation: "Open navigation",
  },

  spinner: {
    label: "Loading",
  },

  stepper: {
    label: "Steps",
    state: ({ state }) => (state === "done" ? "completed" : "not started"),
  },

  table: {
    empty: "Nothing here",
    selectAll: "Select all rows",
    selectRow: "Select row",
    expandColumn: "Row details",
    expandRow: ({ row }) => (row ? `Show details for ${row}` : "Show details"),
    collapseRow: ({ row }) => (row ? `Hide details for ${row}` : "Hide details"),
  },

  tablePreferences: {
    columns: "Columns",
    density: "Density",
    comfortable: "Comfortable",
    compact: "Compact",
    moveUp: ({ column }) => `Move ${column} up`,
    moveDown: ({ column }) => `Move ${column} down`,
  },

  tableToolbar: {
    total: ({ count }) => `${count} ${count === 1 ? "record" : "records"}`,
    preferences: "Table settings",
  },

  tagInput: {
    remove: "Remove tag",
    add: "Add tag",
    addTo: ({ label }) => `${label}: add`,
  },

  tagGroup: {
    remove: ({ label }) => `Remove: ${label}`,
  },

  copyButton: {
    copy: "Copy",
    copied: "Copied",
    failed: "Could not copy",
  },

  mediaCard: {
    select: "Select",
  },

  notifications: {
    label: "Notifications",
    unread: "Unread",
    unreadCount: ({ count }) => `${count} unread`,
  },

  editableList: {
    drag: "Drag",
    emptyValue: "Not set",
  },

  sortableList: {
    drag: "Drag",
  },

  uploadQueue: {
    label: "Upload queue",
    summary: ({ done, total, failed }) =>
      failed > 0
        ? `${done} of ${total} uploaded, ${failed} failed`
        : `${done} of ${total} uploaded`,
    progress: "Upload progress",
    itemProgress: ({ name }) => `Uploading ${name}`,
  },

  treeView: {
    expand: "Expand",
    collapse: "Collapse",
    select: "Select",
  },

  timePicker: {
    label: "Time",
    placeholder: "HH:MM",
    placeholder12: "h:mm AM",
    am: "AM",
    pm: "PM",
  },

  topbar: {
    label: "Application header",
  },

  rating: {
    value: ({ value, total }) => `Rated ${value} out of ${total}`,
    star: ({ index, total }) => `${index} of ${total}`,
  },

  colorPicker: {
    presets: "Presets",
    hex: "HEX",
  },

  treeSelect: {
    placeholder: "Select a node",
    more: ({ count }) => `+${count} more`,
  },

  transfer: {
    source: "Available",
    target: "Selected",
    moveToTarget: "Move to selected",
    moveToSource: "Move to available",
    searchIn: ({ list }) => `Search in ${list}`,
  },

  splitPanel: {
    resize: "Resize the panel",
    resizeNamed: ({ panel }) => `Resize: ${panel}`,
    size: ({ size }) => `${size} pixels`,
  },

  splitButton: {
    more: ({ action }) => `More actions: ${action}`,
  },

  period: {
    presets: {
      "7d": "7 days",
      "30d": "30 days",
      "90d": "90 days",
      "365d": "Year",
      thisMonth: "This month",
      lastMonth: "Last month",
    },
    // English gets by with two forms, so `Intl.PluralRules` is not needed here.
    // Russian does need it — see `locales/ru.ts`.
    length: ({ days }) => `${days} ${days === 1 ? "day" : "days"}`,
  },

  carousel: {
    roleDescription: "carousel",
    slideRoleDescription: "slide",
    previous: "Previous slide",
    next: "Next slide",
    slide: ({ index, total }) => `${index} of ${total}`,
  },

  megaMenu: {
    back: "Back",
  },

  shortcutsHelp: {
    title: "Keyboard shortcuts",
    list: "Shortcuts",
    keySeparator: "plus",
  },

  editor: {
    label: "Rich text editor",
    placeholder: "Start writing…",
    remaining: ({ count }) => `${count} ${count === 1 ? "character" : "characters"} left`,
    overLimit: ({ count }) => `${count} ${count === 1 ? "character" : "characters"} over the limit`,
    required: "Fill in this field",
    toolbar: "Formatting",
    selectionToolbar: "Selection formatting",
    textStyle: ({ current }) => `Text style: ${current}`,
    blockTypeMenu: "Block type",
    blockType: ({ current }) => `Block type: ${current}`,
    moreFormatting: "More formatting",
    textBlock: "Text",
    paragraph: "Paragraph",
    heading: ({ level }) => `Heading ${level}`,
    insertMenu: "Insert block",
    insertSection: "Insert",
    turnIntoSection: "Turn into",
    nothingFound: "Nothing found",
    triggerList: "Suggestions",
    bold: "Bold",
    italic: "Italic",
    underline: "Underline",
    strike: "Strikethrough",
    code: "Inline code",
    superscript: "Superscript",
    subscript: "Subscript",
    clearFormatting: "Clear formatting",
    link: "Link",
    linkAddress: "Address",
    linkApply: "Apply",
    linkRemove: "Remove link",
    linkInvalid: "Enter a web address (http, https) or an email (mailto)",
    bulletList: "Bulleted list",
    orderedList: "Numbered list",
    taskList: "Checklist",
    blockquote: "Quote",
    codeBlock: "Code block",
    codeLanguage: ({ current }) => `Language: ${current}`,
    codeLanguagePlain: "Plain text",
    codeCopy: "Copy code",
    horizontalRule: "Divider",
    undo: "Undo",
    redo: "Redo",
    taskCheckbox: ({ text }) => (text ? `Done: ${text}` : "Done: empty item"),
    highlight: ({ current }) => `Highlight: ${current}`,
    colorDefault: "Default",
    highlightNone: "None",
    highlightToggle: "Highlight",
    highlightRemove: "Remove highlight",
    colorRemove: "Remove color",
    color: "Color",
    colorMenu: ({ current }) => `Color: ${current}`,
    textColorSection: "Text color",
    highlightSection: "Highlight color",
    colorAccent: "Accent",
    colorSuccess: "Green",
    colorWarning: "Amber",
    colorDanger: "Red",
    colorLime: "Lime",
    colorMuted: "Gray",
    markerGray: "Gray",
    markerBrown: "Brown",
    markerOrange: "Orange",
    markerYellow: "Yellow",
    markerGreen: "Green",
    markerBlue: "Blue",
    markerPurple: "Purple",
    markerPink: "Pink",
    markerRed: "Red",
    colorCustom: "Custom color…",
    colorCustomCurrent: ({ hex }) => `Custom ${hex}`,
    customColorText: "Custom text color",
    customColorHighlight: "Custom highlight color",
    customColorValue: ({ hex }) => `Color ${hex}`,
    customColorApply: "Apply",
    customColorCancel: "Cancel",
    customColorLowContrastText: ({ ratio }) =>
      `Low contrast: ${ratio}:1 against the editor background (4.5:1 needed)`,
    customColorLowContrastHighlight: ({ ratio }) =>
      `Low contrast: dark text on this highlight is ${ratio}:1 (4.5:1 needed)`,
    customColorThemeNote: "This color does not change with the theme.",
    alignLeft: "Align left",
    alignCenter: "Align center",
    alignRight: "Align right",
    alignMenu: ({ current }) => `Alignment: ${current}`,
    listMenu: ({ current }) =>
      current === "bulletList"
        ? "List: bulleted"
        : current === "orderedList"
          ? "List: numbered"
          : current === "taskList"
            ? "List: checklist"
            : "Lists",
    table: "Table",
    tableInsertDialog: "Insert table…",
    tableInsertDialogTitle: "Insert table",
    tableCell: "Cell",
    tableRow: "Row",
    tableColumn: "Column",
    tableSort: "Sort",
    tableMergeCells: "Merge cells",
    tableSplitCell: "Split cell",
    tableAddRowBefore: "Insert row above",
    tableAddRowAfter: "Insert row below",
    tableAddColumnBefore: "Insert column left",
    tableAddColumnAfter: "Insert column right",
    tableDeleteRow: "Delete row",
    tableDeleteColumn: "Delete column",
    tableHeaderRow: "Header row",
    tableAlignLeft: "Align column left",
    tableAlignCenter: "Align column center",
    tableAlignRight: "Align column right",
    tableSortAscending: "Sort ascending",
    tableSortDescending: "Sort descending",
    tableSortMerged: "Unavailable: the table has merged cells",
    tableDelete: "Delete table",
    tableCancel: "Cancel",
    image: "Image",
    imageAddress: "Image address",
    imageInvalid: "Enter an image address starting with https:// or http://",
    imageAlt: "Alternative text",
    imageAltHint:
      "Describe the image for people who can't see it. Leave empty if it is decorative.",
    imageInsert: "Insert",
    imageApply: "Apply",
    imageChooseFile: "Upload from device",
    imageRemove: "Remove image",
    imageEdit: "Edit image",
    imageWidth: "Width",
    imageWidthPreset: ({ percent }) => `${percent}%`,
    imageCaption: "Caption (optional)",
    imageUploading: ({ name }) => `Uploading ${name}…`,
    imageUploaded: ({ name }) => `${name} uploaded`,
    imageUploadFailed: ({ name }) => `Couldn't upload ${name}. The document is unchanged.`,
    imageNotImage: ({ name }) => `${name} is not an image`,
    imageFilesUnsupported: "Files can't be uploaded here. Insert the image by its address.",
    toolsFailed: "The editor couldn't start. The document is unchanged.",
    retry: "Retry",
    textCardShown: ({ label, shortcut }) =>
      `${label} card opened. Press ${shortcut} to move into it.`,
    tableGrid: "Table size",
    tableSize: ({ cols, rows }) =>
      `${cols} ${cols === 1 ? "column" : "columns"}, ${rows} ${rows === 1 ? "row" : "rows"}`,
    tableColumns: "Columns",
    tableRows: "Rows",
    tableInsert: "Insert",
    layout: "Layout",
    layoutVariant: {
      "100": "Single column",
      "50-50": "Two columns",
      "33-33-33": "Three columns",
      "25-25-25-25": "Four columns",
      "60-40": "60/40",
      "40-60": "40/60",
    },
    wrapper: "Wrapper",
    unwrap: "Unwrap",
    wrapperTone: ({ current }) => `Tone: ${current}`,
    wrapperToneNone: "None",
    // Labels of GitHub alerts: NOTE, TIP, IMPORTANT, WARNING, CAUTION.
    wrapperToneName: {
      accent: "Note",
      success: "Tip",
      neutral: "Important",
      warning: "Warning",
      danger: "Caution",
    },
    details: "Collapsible block",
    unwrapDetails: "Remove collapsing",
    detailsToggle: ({ text }) => (text ? `Details: ${text}` : "Details: no title"),
    mathInline: "Formula",
    mathBlock: "Block formula",
    mathLatex: "LaTeX",
    mathPreview: "Preview",
    mathEmpty: "The formula appears here",
    mathInvalid: ({ detail }) => `Invalid LaTeX: ${detail}`,
    mathInsert: "Insert",
    mathApply: "Apply",
    mathRemove: "Remove formula",
    date: "Date",
    dateTime: "Time",
    dateTimeField: "Time, hours and minutes",
    dateRemoveTime: "Remove time",
    dateRemove: "Delete date",
    dateInsert: "Insert",
    dateApply: "Apply",
    footnote: "Footnote",
    footnotes: "Footnotes",
    footnoteBack: ({ number }) => `Back to text, footnote ${number}`,
    emoji: "Emoji",
    emojiGrid: "Choose an emoji",
    emojiCategory: {
      favorites: "Favorites",
      smileys: "Smileys",
      gestures: "Gestures",
      animals: "Animals",
      food: "Food",
      activities: "Activities",
      travel: "Travel",
    },
    emojiName: {
      faceWithTearsOfJoy: "Face with tears of joy",
      redHeart: "Red heart",
      rollingOnTheFloorLaughing: "Rolling on the floor laughing",
      thumbsUp: "Thumbs up",
      loudlyCrying: "Loudly crying face",
      foldedHands: "Folded hands",
      blowingKiss: "Face blowing a kiss",
      smilingWithHearts: "Smiling face with hearts",
      heartEyes: "Heart eyes",
      partyPopper: "Party popper",
      beamingFace: "Beaming face",
      fire: "Fire",
      birthdayCake: "Birthday cake",
      flushedFace: "Flushed face",
      sunglassesFace: "Face with sunglasses",
      sparkles: "Sparkles",
      eyes: "Eyes",
      pointingRight: "Pointing right",
      hundredPoints: "Hundred points",
      angryFace: "Angry face",
      slightlySmiling: "Slightly smiling face",
      grinningSmilingEyes: "Grinning face with smiling eyes",
      grinningSquinting: "Grinning squinting face",
      winkingFace: "Winking face",
      tongueFace: "Face with tongue",
      smilingBlushing: "Smiling face with smiling eyes",
      smirkingFace: "Smirking face",
      thinkingFace: "Thinking face",
      sleepyFace: "Sleepy face",
      thumbsDown: "Thumbs down",
      victoryHand: "Victory hand",
      clappingHands: "Clapping hands",
      raisedHands: "Raising hands",
      facepalm: "Facepalm",
      shrug: "Shrug",
      oncomingFist: "Oncoming fist",
      wavingHand: "Waving hand",
      okHand: "OK hand",
      dog: "Dog",
      cat: "Cat",
      mouse: "Mouse",
      hamster: "Hamster",
      rabbit: "Rabbit",
      bear: "Bear",
      panda: "Panda",
      lion: "Lion",
      pig: "Pig",
      frog: "Frog",
      greenApple: "Green apple",
      pizza: "Pizza",
      hamburger: "Hamburger",
      frenchFries: "French fries",
      spaghetti: "Spaghetti",
      sushi: "Sushi",
      iceCream: "Ice cream",
      doughnut: "Doughnut",
      cookie: "Cookie",
      shortcake: "Shortcake",
      soccerBall: "Soccer ball",
      basketball: "Basketball",
      americanFootball: "American football",
      baseball: "Baseball",
      tennis: "Tennis",
      bowling: "Bowling",
      golfer: "Golfer",
      fishing: "Fishing",
      cyclist: "Cyclist",
      videoGame: "Video game",
      airplane: "Airplane",
      car: "Car",
      bicycle: "Bicycle",
      train: "Train",
      sailboat: "Sailboat",
      worldMap: "World map",
      beach: "Beach",
      mountain: "Snow-capped mountain",
      camping: "Camping",
      luggage: "Luggage",
    },
    source: "HTML",
    sourceField: "HTML source",
    invisibleCharacters: "Invisible characters",
    language: "Language",
    languagePrimary: ({ language }) => `${language} (primary)`,
    languageRemove: "Remove language mark",
    search: "Find",
    searchReplace: "Find and replace",
    searchPanel: "Find and replace",
    searchField: "Find",
    replaceField: "Replace with",
    searchPrevious: "Previous match",
    searchNext: "Next match",
    searchClose: "Close find and replace",
    searchMatchCase: "Match case",
    searchWholeWord: "Whole words",
    searchRegex: "Regular expression",
    replaceOne: "Replace",
    replaceAll: "Replace all",
    searchCount: ({ current, total }) => `${current} of ${total}`,
    searchNoMatches: "No matches",
    searchInvalid: "Invalid regular expression",
    resizeField: "Resize the editor",
    fieldHeight: ({ size }) => `${size} pixels high`,
    shortcuts: "Keyboard shortcuts",
    shortcutsCommand: "Command",
    shortcutsKeys: "Shortcut",
    selectBlock: "Select block text",
    selectDocument: "Select all (second press)",
    duplicateBlock: "Duplicate block",
    moveBlockUp: "Move block up",
    moveBlockDown: "Move block down",
    indentListItem: "Indent list item",
    outdentListItem: "Outdent list item",
    focusToolbar: "Go to the toolbar",
    blockActions: "Block actions",
    blockAdd: "Add",
    blockFormat: "Format",
    blockMoveUp: "Move up",
    blockMoveDown: "Move down",
    blockDuplicate: "Duplicate",
    blockDelete: "Delete",
    blockSelect: "Select",
    blockWrap: "Wrap in",
    blockSelectionSelect: "Select block",
    blockSelectionExtend: "Extend selection",
    blocksSelected: ({ count }) => `Blocks selected: ${count}`,
    blockSelectionCleared: "Block selection cleared",
    blocksDeleted: ({ count }) => `Blocks deleted: ${count}`,
    blocksDuplicated: ({ count }) => `Blocks duplicated: ${count}`,
    blocksMoved: ({ count }) => `Blocks moved: ${count}`,
    blocksChanged: ({ count }) => `Blocks changed: ${count}`,
    blocksWrapped: ({ count }) => `Blocks wrapped: ${count}`,
    blocksCopied: ({ count }) => `Blocks copied: ${count}`,
    blocksCut: ({ count }) => `Blocks cut: ${count}`,
    blocksReplaced: ({ count }) => `Blocks replaced: ${count}`,
    toc: "Table of contents",
    video: "Video",
    videoLink: "Video link",
    videoInsert: "Insert",
    videoNotFound: ({ services }) => `Enter a link to a ${services} video`,
    videoPlay: "Play",
    videoPlayLabel: ({ service }) => `Play ${service} video`,
    videoPlayer: ({ service }) => `${service} video`,
    typographyQuotes: "en",
  },
};

/** The fallback locale. Explicitly `en-US`, not `en`: engines resolve `en` differently. */
export const DEFAULT_LOCALE = "en-US";

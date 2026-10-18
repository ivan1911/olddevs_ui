/**
 * Size budgets, kept as data, apart from the measurement mechanics.
 *
 * The thresholds have a margin of about 15% over the measurement at 2.6.0. A budget set right
 * at the measured value turns red on any edit, and after a month people start moving it without
 * looking.
 *
 * **Raising a budget is a separate line in the MR, with an explanation of what grew.** A budget
 * that is moved together with a component change guards nothing: it only records after the fact
 * what has already happened.
 */

/** Import scenarios: exactly what the consumer writes in their code. */
export const PACKAGE_SCENARIOS = [
  {
    key: "utilities",
    title: "two pure utilities",
    documented: "`cn` and `tableStateToParams`",
    source:
      'import { cn, tableStateToParams } from "@olddevs/ui";\nglobalThis.probe = [cn, tableStateToParams];\n',
  },
  {
    key: "button",
    title: "a single Button",
    documented: "one `Button`",
    source: 'import { Button } from "@olddevs/ui";\nglobalThis.probe = Button;\n',
  },
  {
    key: "dataTable",
    title: "DataTable",
    documented: "`DataTable`",
    source: 'import { DataTable } from "@olddevs/ui";\nglobalThis.probe = DataTable;\n',
  },
  {
    key: "everything",
    title: "the whole kit",
    documented: "the whole kit (`import *`)",
    source: 'import * as ui from "@olddevs/ui";\nglobalThis.probe = ui;\n',
  },
  /*
    The Editor is a separate entry, `@olddevs/ui/editor`, with its own budgets (ADR-0050). The
    engine inside it is an order of magnitude heavier than the whole kit, so a shared budget
    would either drown in it or turn red on every extension.

    There are two numbers, because they guard different things. The first is the kit's own code,
    with Tiptap external, like React and the kit's dependencies: it catches growth of the wrapper.
    The second includes the engine (`bundled`). Tiptap is optional, but the kit chooses the set of
    extensions, and a heavy extension that gets included by accident costs the consumer exactly
    as much as extra code in the kit. The second number also reacts to Tiptap releases. That is a
    deliberate cost: an engine update is checked by the Editor's stories and tests anyway
    (ADR-0050, "Consequences").
  */
  /*
    Since OLDSUI-111 (ADR-0058, item 11.7) the Editor with the engine has two scenarios. "Start"
    is the static graph: it is what `basic` pays, and it has no lazy `codeBlock` or `table`. That
    is checked against the graph's modules (`notInStart`). "Full" is the static graph plus all the
    lazy chunks of the subpath (`chunks: "all"`): what `full` ends up loading, including the popover
    of a custom colour. The kit's code is measured at "start": its threshold is a constraint of the
    extension mechanism's design.
  */
  {
    key: "editor",
    title: "RichTextEditor (kit code, start)",
    documented: '`RichTextEditor` from `@olddevs/ui/editor`, without the engine, "start"',
    source:
      'import { RichTextEditor } from "@olddevs/ui/editor";\nglobalThis.probe = RichTextEditor;\n',
  },
  {
    key: "editorEngine",
    title: "RichTextEditor with Tiptap, start",
    documented: '`RichTextEditor` with the Tiptap engine, "start" (static graph, `basic`)',
    // ProseMirror and the other engine dependencies are not declared in the kit's manifest, so
    // they get into the measurement on their own. Only the Tiptap packages and `marked` need to
    // be listed (each Editor has its own instance of it, OLDSUI-47), and since OLDSUI-50 the
    // highlighter too: the kit chooses lowlight and the highlight.js grammars, just as it chooses
    // the extensions.
    bundled: ["@tiptap/", "marked", "lowlight", "highlight.js", "katex"],
    /*
      Modules of the lazy built-ins (ADR-0058, item 11.1): none of them may reach the static
      graph. The script also checks the reverse: that every pattern matches a module in the full
      graph. Otherwise the check would silently become empty.
    */
    notInStart: [
      "/dist/editor/features/code/codeBlock.js",
      "/dist/editor/features/code/CodeBlockView.js",
      "/dist/editor/features/code/lowlight.js",
      "/node_modules/@tiptap/extension-code-block-lowlight/",
      "/node_modules/lowlight/",
      "/node_modules/highlight.js/",
      "/dist/editor/features/table/tables.js",
      "/dist/editor/features/table/tableActions.js",
      "/dist/editor/features/table/TableMenuButton.js",
      "/dist/editor/features/table/TableInsertDialog.js",
      // `prosemirror-tables` is deliberately not listed here: its `CellSelection` statically
      // imports `@tiptap/extension-bubble-menu` (the selection menu), so the table core in
      // "start" is the cost of Tiptap, not a leak of the kit's table.
      "/node_modules/@tiptap/extension-table/",
      // Formulas (OLDSUI-280, ADR-0070): the extension, KaTeX and its CSS only as a chunk.
      "/dist/editor/features/mathematics/mathChunk.js",
      "/dist/editor/features/mathematics/MathForm.js",
      "/dist/editor/features/mathematics/katexEngine.js",
      "/node_modules/@tiptap/extension-mathematics/",
      "/node_modules/katex/",
      // Epic OLDSUI-305: footnotes and the Block selection extension are lazy built-ins below the
      // 10 kB rule of item 11.1, by the owner's decision on the epic's total (ADR-0076, ADR-0077).
      "/dist/editor/features/footnotes/footnotesChunk.js",
      "/dist/editor/features/footnotes/footnoteBehavior.js",
      "/dist/editor/features/footnotes/footnoteSync.js",
      "/dist/editor/features/footnotes/footnoteCommands.js",
      "/dist/editor/features/footnotes/footnoteMarkdown.js",
      "/dist/editor/features/blockSelection/blockSelectionExtension.js",
      "/dist/editor/features/blockSelection/blockSelectionMoves.js",
      // The date form with the kit's `Calendar` (OLDSUI-309) and the column handles of the table (OLDSUI-310).
      "/dist/editor/features/date/DateForm.js",
      "/dist/editor/features/table/TableColumnHandles.js",
    ],
    source:
      'import { RichTextEditor } from "@olddevs/ui/editor";\nglobalThis.probe = RichTextEditor;\n',
  },
  {
    key: "editorEngineFull",
    title: "RichTextEditor with Tiptap, full",
    documented: '`RichTextEditor` with the Tiptap engine, "full" (with all lazy chunks, `full`)',
    bundled: ["@tiptap/", "marked", "lowlight", "highlight.js", "katex"],
    chunks: "all",
    source:
      'import { RichTextEditor } from "@olddevs/ui/editor";\nglobalThis.probe = RichTextEditor;\n',
  },
  /*
    The View (OLDSUI-48) is measured with `bundled: ["@tiptap/"]` on purpose. Without it,
    Tiptap would be external, and an accidental import of the engine into the `RichTextView`
    graph would not change the number. With it, the engine would be part of the measurement and
    the number would grow by two orders of magnitude, so the threshold is under a kilobyte.
  */
  {
    key: "editorView",
    title: "RichTextView (engine counted)",
    documented:
      "`RichTextView` from `@olddevs/ui/editor`, Tiptap engine included in the measurement",
    // The highlighter too: `RichTextView` does not pull it in (OLDSUI-50), and an accidental
    // import of lowlight into the graph would show up as tens of kilobytes.
    bundled: ["@tiptap/", "lowlight", "highlight.js", "katex"],
    source:
      'import { RichTextView } from "@olddevs/ui/editor";\nglobalThis.probe = RichTextView;\n',
  },
  /*
    The light Schema entry (OLDSUI-48) is measured with `bundled: ["@tiptap/"]` for the same
    reason as the View: without it, an accidental import of the engine into its graph would go
    unnoticed, and with it the number would grow by two orders of magnitude. Since the epic's
    review, what is measured is what the consumer's server imports: `sanitizeRichText` together
    with the config, since the Schema hooks live there.
  */
  {
    key: "editorSchema",
    title: "editor/schema (engine counted)",
    documented:
      "`sanitizeRichText` and `richTextSanitizeConfig` from `@olddevs/ui/editor/schema`, Tiptap engine included",
    bundled: ["@tiptap/"],
    source:
      'import { richTextSanitizeConfig, sanitizeRichText } from "@olddevs/ui/editor/schema";\nglobalThis.probe = [richTextSanitizeConfig, sanitizeRichText];\n',
  },
  /*
    Server-side highlighting (OLDSUI-50, ADR-0051): the helper together with lowlight and the
    Editor's grammars, which is exactly what whoever imports it receives. The Tiptap engine is
    part of the measurement for the same reason as the View.
  */
  {
    key: "editorHighlight",
    title: "editor/highlight (with lowlight)",
    documented: "`highlightCodeBlocks` from `@olddevs/ui/editor/highlight`, with lowlight",
    bundled: ["@tiptap/", "lowlight", "highlight.js"],
    source:
      'import { highlightCodeBlocks } from "@olddevs/ui/editor/highlight";\nglobalThis.probe = highlightCodeBlocks;\n',
  },
  /*
    Highlighting for `CodeView` (OLDSUI-58, ADR-0052): the same lowlight with its grammars,
    plus the React node assembly and the theme string. React is not part of the measurement.
  */
  {
    key: "editorHighlightNodes",
    title: "editor/highlight nodes for CodeView (with lowlight)",
    documented: "`highlightCodeNodes` from `@olddevs/ui/editor/highlight`, with lowlight",
    bundled: ["@tiptap/", "lowlight", "highlight.js"],
    source:
      'import { highlightCodeNodes } from "@olddevs/ui/editor/highlight";\nglobalThis.probe = highlightCodeNodes;\n',
  },
];

export const BUDGETS = {
  /** The package's contribution to the consumer's bundle, gzip, bytes. Measured by `npm run size`. */
  package: {
    utilities: 800,
    button: 2600,
    // OLDSUI-46: the `editor` message catalog (en) +17 lines for the colour, the marker and the
    // alignment, plus six dictionary icons. They ship with the whole kit and with `DataTable`
    // (the shared catalog): `DataTable` 6.1 kB (+0.2), the whole kit 60.5 kB (+0.2). Headroom
    // about 5%, ADR-0030.
    // Editor labels in the shared catalog (ADR-0050, item 5): measured 6.5 kB after the tables and
    // the custom colour, ADR-0030.
    // After the merge of OLDSUI-44 (picture strings in the catalog): `DataTable` 6.7 kB, the whole
    // kit 61.1 kB, within budget, ADR-0030.
    // OLDSUI-68 (emoji): the `editor` catalog (en) +80 lines, the name of each of the 78 emoji and
    // seven categories. A screen reader announces them, so they are in the catalog, not in the
    // set's module.
    // The catalog ships in full with every entry that `useMessages` reads: `DataTable` 8.0 kB (+1.1),
    // the whole kit 62.5 kB (+1.0), `./editor` 42.9 kB (+2.8: the catalog, the grid, the button and
    // the set's data), with the engine 295.6 kB (+3.0), `RichTextView` 10.1 kB (+1.0: the "Copy"
    // island reads the same catalog). Headroom about 5%, ADR-0030.
    // Epic OLDSUI-98: the `editor` catalog (en) +10 extension lines: the input error and "Retry",
    // the Card declaration for text, the Handle and Status bar labels. The catalog also ships in
    // `DataTable`. The measurement of 8.5 kB hit the budget. Raised from 8.5 to 8.8 kB, headroom
    // about 3%, ADR-0030.
    // OLDSUI-193 (Gallery findings): measured 9.0 kB (+0.3): `onRowAction` on `Table` and the
    // filter range labels (ADR-0063). Raised to 9.3 kB, headroom about 3%, ADR-0030.
    // Epic OLDSUI-272 (OLDSUI-278…281): the measurement of 9.3 kB hit the threshold. The `editor`
    // catalog (en) +16 lines for the new Tools (formulas, video, invisible characters, the quote
    // set), and the catalog also ships in `DataTable`. Raised to 9.6 kB, headroom about 3%, ADR-0030.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): `DataTable` 9.7 kB (+0.4): the epic's rows in the shared catalog, which ships with
    // every entry that reads `useMessages`. Raised to 10.0 kB, headroom about 3%, ADR-0030.
    dataTable: 10240,
    // OLDSUI-193: the whole kit 66.7 kB (+2.5): eleven Gallery findings. The `FilterBar` ranges,
    // `onRowAction`, `onAction` and the cell menu of `VirtualGrid`, `activeKey` on `TreeView`,
    // `useMediaQuery`, `typeToConfirm`, `--bottombar-h`, the string API of the calendars, the
    // `Toggle` label, `hintPersistent`, and moving items between `SortableList`s. Raised to 68.3 kB.
    // OLDSUI-199: the whole kit 69.7 kB (+2.4): `VirtualGrid` for the Library. Window scrolling
    // and the offset under the header, page loading with its own window sensor, drag-to-select
    // (`useDragToSelect`, 1.2 kB), a layout without the outer margin, `rangeSelection`, and
    // `onAction` with a rectangle. `GridList` itself comes from react-aria and is not part of the
    // measurement. Raised to 71.3 kB.
    // OLDSUI-243 (Gallery audit): the whole kit 71.4 kB (+0.3): `PopoverAnchor` on `Select` (the
    // panel is anchored to the whole pill), the render prop of a `TreeView` row instead of variants,
    // and the disabled `fieldset` classes of checkboxes, radios, the slider and the switch. Raised
    // to 71.6 kB.
    // Epic OLDSUI-253 (mega menu): the whole kit 76.4 kB (+5.0). A new `MegaMenu` with its family:
    // the component itself is 5.0 kB after minification (the category column, the flyout, the
    // keyboard, the dropdown view on the Radix Popover that was already there, the step-by-step
    // drill-down on a phone), and menu aim is 0.8 kB. There are no new dependencies. Plus the
    // `megaMenu.back` catalog row and the shared `useNarrowScreen`. Raised to 77.9 kB, headroom
    // about 2%, ADR-0030.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): the whole kit 77.9 kB (+0.4), the same catalog rows; the measurement hit the threshold.
    // Raised to 80.2 kB, headroom about 3%, ADR-0030.
    everything: 82125,
    // The first measurement of the `./editor` entry (OLDSUI-40): 5.5 and 168.4 kB, headroom about
    // 15%, as for the others. The next slices of epic OLDSUI-38 add Blocks and the Toolbar. Each
    // of them raises these numbers in a separate line with an explanation.
    // OLDSUI-47 (Markdown): `./editor` 6.6 kB (+1.1: Markdown parsing and insertion) and
    // `editorEngine` 193.4 kB (+25: `@tiptap/markdown` together with `marked`).
    // OLDSUI-41 (Toolbar, checklist, code block, indexes): `./editor` 12.6 kB (+6.0: the Toolbar
    // pulls in the kit's primitives `Toolbar`, `Menu`, `Tooltip`, `Kbd`, `Separator`) and
    // `editorEngine` 200.2 kB (+6.8: the task-list extensions, `sub`/`sup`). Headroom about 15%,
    // ADR-0030.
    // OLDSUI-46 (colour, marker, alignment): `./editor` 14.7 kB (+2.1: two colour menus and three
    // alignment buttons in the Toolbar, the colour classes in `prose.ts`, the palette and the
    // wrapper extensions over `Color`, `Highlight`, `TextAlign`) and `editorEngine` 203.9 kB (+3.7:
    // the Tiptap extensions themselves). Headroom about 15%, ADR-0030. The engine budget has had
    // headroom since the previous slice.
    // OLDSUI-43 (Slash menu): `./editor` 15.3 kB (+2.7: the list at the caret on the kit's `Popover`,
    // the "+" on `Menu`, the item registry and the `/` extension) and `editorEngine` 213.7 kB (+13.5:
    // `@tiptap/suggestion` together with `@floating-ui/dom`). The engine budget is untouched, with
    // headroom of 8%. The whole kit 60.4 kB (+0.1: four Slash menu rows in the catalog), within budget.
    // ADR-0030.
    // After the merge of OLDSUI-43 and OLDSUI-46: `./editor` 17.4 kB (both increases together), headroom 15%.
    // OLDSUI-42 (floating Toolbar, link): `./editor` 16.2 kB (+3.6: the link popover on the kit's
    // `Popover`, `FormField`, `TextControl`, `Button`, and the `BubbleMenu` wrapper) and
    // `editorEngine` 222.5 kB (+22.3: `@tiptap/extension-link` with `linkifyjs`,
    // `extension-bubble-menu` with `@floating-ui/dom`).
    // After the merge of OLDSUI-42 with OLDSUI-43 and OLDSUI-46: `./editor` 20.9 kB, `editorEngine`
    // 233.3 kB (`@floating-ui/dom` was already coming in with `@tiptap/suggestion`). Headroom about 15%,
    // ADR-0030.
    // OLDSUI-46 (custom colour): `./editor` 21.8 kB (+0.9: a menu item, `style` parsing, lazy loading
    // of the popover), with the engine 234.3 kB (+1.0). `ColorPicker` itself is a lazy chunk (about
    // 51 kB with react-aria; the measurement counts only chunks without `import()`). The budgets are
    // untouched, ADR-0030. The whole kit 60.7 kB (+0.1: the catalog).
    // OLDSUI-45 (tables): `./editor` 22.4 kB (+1.5: the table action menu, the wrapper extensions,
    // the table and cursor-gap classes in `prose.ts`) and `editorEngine` 247.2 kB (+13.9:
    // `@tiptap/extension-table` together with `prosemirror-tables`). Headroom about 15%, ADR-0030.
    // After the merge of OLDSUI-45 and OLDSUI-46+: `./editor` 23.4 kB, with the engine 248.2 kB. Headroom about 15%, ADR-0030.
    // OLDSUI-44 (pictures): `./editor` 26.8 kB (+5.9: the `figure` node with a caption and handles,
    // the upload with a placeholder, the popover and the picture panel; no new packages),
    // `editorEngine` 239.5 kB (+6.2: the kit's code inside the measurement). The engine budget has
    // headroom. `./editor` headroom about 15%, ADR-0030.
    // After the merge of OLDSUI-44 with the tables and the custom colour: `./editor` 29.3 kB, with the engine 254.3 kB. Headroom about 15%, ADR-0030.
    // OLDSUI-45 (the "Table" menu, as in TinyMCE): `./editor` 35.6 kB (+6.2: the size grid, which was
    // previously not connected and therefore cut out, the "Insert table" window on the kit's `Dialog`
    // and `NumberInput`, submenus, merging, column alignment, and sorting with number and date parsing;
    // no new packages), with the engine 260.2 kB (+5.9), within budget. A lazy window would save
    // 1.2 kB at the cost of asynchronous opening, so it was not taken. The whole kit and `DataTable`
    // +0.1 (catalog rows, ADR-0050 item 5), within budget. Headroom of `./editor` about 15%, ADR-0030.
    // OLDSUI-50 (language and code-block highlighting): `./editor` 38.0 kB (+2.4: the language button
    // on the kit's `Menu` in the node view, the extension and the language data) and `editorEngine`
    // 289.1 kB (+28.9: lowlight, the highlight.js core and six grammars are now in the measurement,
    // ADR-0051). Headroom about 15%, ADR-0030.
    // OLDSUI-50 (code-block header): `./editor` 38.9 kB (+0.7: the "Copy" button with a hint, the shared
    // header) and `editorEngine` 290.2 kB (+0.9). The budgets have headroom, ADR-0030.
    // After the merge of OLDSUI-50 (code-block header) and OLDSUI-52 (the `surface="paper"` Paper):
    // `./editor` 40.0 kB, with the engine 292.3 kB. Headroom about 15%, ADR-0030.
    // OLDSUI-65 (the "…" menu): `./editor` 46.4 kB (+0.5: a submenu and a separator in the shared
    // `FormatMenu`, the "…" menu with rare labels and a colour submenu; the two earlier Toolbar
    // colour menus were removed), with the engine 299.2 kB (+0.6), within budget. `./editor`
    // headroom about 1%, ADR-0030.
    // OLDSUI-69 (selection menu `toolbar="bubble"`): `./editor` 47.4 kB (+1.0: the pill on `BubbleMenu`
    // with "¶", labels, "…", a link and emoji, the shared show condition moved out, a catalog row; no
    // new packages), with the engine 300.2 kB (+1.0), within the engine budget. The `./editor` budget
    // was raised from 46.8 to 48.0 kB: the pill's growth exceeded the 1% headroom left after OLDSUI-65.
    // ADR-0030.
    // OLDSUI-71 (links from pasted Markdown) and fixes to a set of labels (OLDSUI-60): `./editor`
    // 48.7 kB (+0.8: recognising highlighted source from code editors, HTML parsing and monospace
    // signals, new Markdown link signals, and a shared row of labels with the marker as one button;
    // no new packages), with the engine 301.5 kB. The `./editor` budget was raised from 48.0 to 50.0 kB,
    // with about 3% headroom for the Block handle, the next task in the epic. ADR-0030.
    // OLDSUI-72 (Block handle "⋮" with a menu): `./editor` 51.1 kB (+2.4: the handle with the first-line
    // measurement, a menu on the shared `FormatMenu` frame with the "Add" and "Format" submenus, the
    // handle's Block commands and "Delete", catalog rows; no new packages), with the engine 303.9 kB
    // (+2.4), within the engine budget. The `./editor` budget was raised from 50.0 to 52.5 kB, headroom
    // about 3%. The whole kit, `DataTable` and `RichTextView` +0.1: seven catalog rows (ADR-0050 item 5),
    // within budget. ADR-0030.
    // OLDSUI-74 (Column layout) after the merge with the Block handle: `./editor` 54.3 kB (+3.2: the
    // Column layout nodes and the columns with their own Document, the insert command and the variant
    // switch with column merging, arrows and Tab between columns, expanding the Column layout on insert,
    // the variants as data, the grid with a container query in `prose.ts`, a Slash menu item, the
    // variants submenu on the handle, an icon; no new packages), with the engine 307.4 kB (+3.5), within
    // the engine budget. The `./editor` budget was raised from 52.5 to 56.0 kB, headroom about 3%. The
    // Schema 2.5 kB (+0.3: the Column layout variants and hooks), within budget. ADR-0030.
    // OLDSUI-77 (Wrapper: a group of Blocks): `./editor` 55.5 kB (+1.1: the Wrapper node with the insert
    // and unwrap commands, exit on Enter and an edge guard, the shared container Document, a Slash menu
    // item and "Unwrap" on the handle, the dashed outline in `prose.ts`, two icons, catalog rows; no new
    // packages), with the engine 308.6 kB (+1.0), within the engine budget. The `./editor` budget was
    // raised from 56.0 to 57.5 kB, headroom about 3%. ADR-0030.
    // OLDSUI-76 (HTML mode): `./editor` 56.4 kB (+2.0: formatting of the Document's HTML: parsing tag
    // positions and laying them out by structure, the mode state with the change applied through the
    // Schema in one edit, the HTML field with a height mirror, the "HTML" button and `aria-disabled` on
    // the Toolbar menus in this mode, catalog rows; no new packages: `createDocument` and `closeHistory`
    // come from the already-external `@tiptap/core` and `@tiptap/pm`), with the engine 309.4 kB (+1.8),
    // within the engine budget. The `./editor` budget was raised from 56.0 to 58.0 kB, headroom about 3%.
    // The whole kit +0.2: two catalog rows and an icon, within budget. ADR-0030.
    // After the merge of OLDSUI-76 and OLDSUI-77 (epic OLDSUI-75): `./editor` 57.5 kB, with the engine
    // 310.6 kB, within the engine budget. The `./editor` budget was raised to 59.5 kB, headroom about 3%.
    // ADR-0030.
    // Fixes from the review of epic OLDSUI-75: `./editor` 57.8 kB (+0.3: applying the HTML mode edit on
    // unmount, `required` on the HTML field's text, `Alt+F10` from the field, Backspace removes an empty
    // Wrapper; the shared helpers of the container Blocks and the Toolbar menus were, if anything, compressed
    // by the code), with the engine 310.8 kB (+0.2), within the budgets, headroom about 3%. ADR-0030.
    // OLDSUI-78 (Wrapper Callout tone): `./editor` 59.1 kB (+1.3: the tone attribute and command, the "Tone ›"
    // submenu with samples on the handle, parsing GitHub alerts in Markdown and exporting them, the fill and
    // stripe classes for the five tones in `prose.ts`, and twenty `--rte-tone-*` roles of the theme and the
    // Paper in `tokens.ts`, catalog rows; no new packages), with the engine 312.2 kB (+1.4), within the
    // engine budget. The `./editor` budget was raised from 59.5 to 61.0 kB, headroom about 3%. ADR-0030.
    // The secondary text roles on the tone surface (link, quote, muted, hint): `./editor` 59.2 kB (+0.1),
    // with the engine 312.3 kB, within the budgets. ADR-0030.
    // Epic OLDSUI-98 (an extensible Editor, ADR-0058 item 11.7): the kit's code grows by no more than
    // 3 kB from the measurement before the epic. It was 59.2 kB on 3.35.0 (the ADR was written at 57.8 kB,
    // before the Wrapper Callout tone; the owner on 2026-10-07 took the measurement on the epic's branch as the
    // base). The threshold is exactly 59.2 + 3 = 62.2 kB, with no headroom: an overrun is a reason to
    // reconsider the implementation, not to raise the threshold. After W1 (Handle, field message, internal
    // description): 60.7 kB.
    // After W2 of epic OLDSUI-98 (internal description and the check set 99–102, a custom Tool 103, Handle
    // 107, field message 112): `./editor` 64.6 kB (+5.4 from 59.2: the description buttons and popovers,
    // `ToolButtonView` and `toolButtons`, about 1.6; the check and wiring of a custom Tool, `customToolEngine`,
    // about 1.8; the Handle and the field message 1.2; the `tools` expansion and the projection registries
    // account for the rest; there are no new packages in the kit's code). The mechanism outgrew the 3 kB of
    // item 11.7 of ADR-0058. The owner on 2026-10-07 decided to raise the threshold rather than trim the
    // slices. The threshold was raised from 62.2 to 67.0 kB, headroom about 3%. ADR-0030.
    // OLDSUI-111 (lazy `codeBlock` and `table`, ADR-0058 items 11.1 and 11.7): the kit's code is measured at
    // "start": 60.3 kB (it was 68.0 before the cut, 68.6 on the epic's branch after OLDSUI-113). The code
    // block's and the table's Extensions, `CodeBlockView`, the "Table" menu, the insert window and the table
    // actions went into lazy chunks (12.9 kB of kit code beyond "start"), while the shapes of their Blocks for
    // the Skeleton and the loaders (about 0.6 kB) came into the static graph. The threshold is untouched.
    // OLDSUI-153 (the "Marker" and "Colour" popovers with circle grids): `./editor` 67.6 kB (+2.2 from 65.4:
    // a grid menu with its own row traversal, samples, two buttons and their popovers; the colour submenu from
    // "…" was removed; the Toolbar's Skeleton repeats its layout), 0.6 over the 67.0 threshold. The grid is in
    // the static graph on purpose: in a lazy chunk, Radix would move focus into the still-empty popover when it
    // opens, and the focus would have to be moved back by hand. The threshold was raised to 69.0 kB, headroom
    // about 2%. ADR-0030.
    // OLDSUI-193: `./editor` 70.4 kB (+1.9): the trigger characters of Tools (ADR-0064): the shared
    // `SuggestionList`, `TriggerMenu` and `TriggerCommand`. Raised to 72.1 kB, headroom about 2.5%.
    // OLDSUI-268: "start" 72.6 kB (+1.3 from 71.3): the Tool's Options, State and Commands: the expansion and
    // check of `tool()`, the merge of Options and `defineTool`, the synchronous `search` and `toc` Commands
    // (`handle.tool()`), the State signals by `ref`, and a warning about `openSearch`. The State hook, the
    // snapshots of the built-ins and the scroll-to-match are outside "start". The owner on 2026-10-14 decided
    // to raise the threshold rather than make the Commands asynchronous. Raised to 73.5 kB, headroom about 1%.
    // OLDSUI-273: 72.9 kB (+0.2): the built-in Tools on descriptions: description modules instead of
    // name-keyed registries. Within the threshold.
    // OLDSUI-277: "start" 75.8 kB (+2.9): the `details` Tool (a collapsible Block, epic OLDSUI-272): the nodes
    // and the node view with a toggle button, the Markdown tokenizer for `<details>`, the "Remove collapsing"
    // action, and the catalog rows. Some of the Extensions are under 10 kB, so by ADR-0058, item 11.1 there is
    // no Loader for them. The owner on 2026-10-15 allowed raising the threshold without asking when the growth
    // is explainable. Raised to 77.5 kB, headroom about 2%.
    // Epic OLDSUI-272, slices OLDSUI-278…281: "start" 79.5 kB (+4.2 from 75.3 at OLDSUI-277): `typography` and
    // `invisibleCharacters` without a Loader (under 10 kB), and the light parts of the lazy `mathematics` and
    // video in the static graph: descriptions, the formula Skeleton, parsing a formula into text without a Tool,
    // the video link check, Slash menu items and catalog rows. Raised to 81.0 kB, headroom about 2%.
    // Review of slices OLDSUI-280 and OLDSUI-281: "start" 81.8 kB (+2.3): search finds the LaTeX of formulas
    // (decision of 2026-10-16), a formula and a video from the JSON envelope without a Tool are parsed into text
    // and a link, a space in `data-latex` for DOMPurify, the shared parsing of the built-ins' Options, and the
    // formula names in a single module. All of this runs before the lazy chunks load, so it belongs in "start".
    // Raised to 83.5 kB, headroom about 2%.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): "start" 96.7 kB (+14.3 from 82.4 at 4.11.0). Seven built-ins in `full`: the text part
    // language Mark and its submenu (+2.0), Block selection's core (the handle over a range, the
    // `BlockSelection` class, Block unit, wrap and turn; +2.8, its extension is a lazy chunk), the date
    // mention Atom and keys (+2.1, the form is lazy), the column share rules of tables (+0.8), image
    // alignment (+1.3), fullscreen and focus modes (+2.3), the footnote Schema shape and descriptor
    // (+1.9, the engine part is a lazy chunk), and the catalog. Footnotes and the Block selection
    // extension were made lazy below the 10 kB rule of ADR-0058, 11.1 (ADR-0076, ADR-0077), which
    // took 6.8 kB out of "start". Raised to 100.5 kB, headroom about 4%, ADR-0030.
    editor: 102912,
    // The engine's "start" (ADR-0058, item 11.7) is 285.4 kB: 35.7 kB less than the 321.1 kB on the epic's branch
    // (`@tiptap/extension-table`, `@tiptap/extension-code-block-lowlight`, lowlight and the highlight.js grammars
    // are gone). The threshold is the measurement plus about 15%, ADR-0030: lowered from 336.1 to 328.2 kB. The
    // earlier one was taken from a measurement in which the table and the code block shipped together.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): "start" with the engine 330.5 kB (+14.4), the same kit code; no new engine packages.
    // Raised to 340 kB, headroom about 3%, ADR-0030.
    editorEngine: 348160,
    // "Full": the whole subpath graph with all the lazy chunks, which is what `full` loads: 326.3 kB (the static
    // graph 285.4 and the lazy 40.8: the code block, the table, and the popover of a custom colour without
    // react-aria, which is not part of the measurement). The first measurement; the threshold is plus about 15%,
    // ADR-0030.
    // OLDSUI-280 (ADR-0070): "full" 461.0 kB (+101.1): the lazy chunk of formulas: KaTeX (about 92 kB),
    // `@tiptap/extension-mathematics` and the formula popover; plus a lazy chunk for video (OLDSUI-281, the
    // player and the link field, ADR-0071). The growth was accepted in ADR-0070 ("Consequences"): a page without
    // formulas does not load it. Raised to 484.0 kB, headroom about 5%.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): "full" 498.7 kB (+28.4): the start growth plus the lazy chunks (the footnote engine
    // part, the Block selection extension, the date form with `Calendar`, the table column handles).
    // Raised to 514 kB, headroom about 3%, ADR-0030.
    editorEngineFull: 526336,
    // RichTextView (OLDSUI-48): the first measurement 0.7 kB: PROSE_CLASS and the wrapper. The engine is
    // included in the measurement: were it pulled in by accident, it would grow the budget two hundredfold.
    // OLDSUI-41: 1.0 kB: the typography of the checklist and the code block in `prose.ts`.
    // The 1.1 kB measurement hit the budget after the colours in `prose.ts`. Headroom 15%.
    // OLDSUI-45: 1.3 kB (+0.2): the table and cursor-gap classes in `prose.ts`. Headroom 15%.
    // OLDSUI-44: 1.2 kB: the `figure`, `img[data-width]` and `figcaption` classes in `prose.ts`. Headroom 15%.
    // After the merge of OLDSUI-44 and OLDSUI-45: 1.4 kB: the table and picture classes in `prose.ts`. Headroom 15%, ADR-0030.
    // OLDSUI-50: 1.7 kB (+0.3): the `.hljs-*` rules as classes in `prose.ts` (`codeTheme.ts`; the colours are variables in `styles.css`); there is no lowlight in the graph. Headroom 15%, ADR-0030.
    // OLDSUI-50 (the "Copy" button on code blocks): 8.4 kB (+6.7: the client island pulls in `CopyButton`, `Button`, `Tooltip`, the icons and the kit's message catalog, and the block header `codeHeader`); there is still no engine or lowlight in the graph. Headroom 15%, ADR-0030.
    // OLDSUI-52: 2.2 kB (+0.4): the `surface="paper"` Paper: a second set of `--rte-*` roles (`tokens.ts`) and roles in place of the kit's tokens in `prose.ts`. Headroom 15%, ADR-0030.
    // After the merge of OLDSUI-50 (the "Copy" island) and OLDSUI-52 (the Paper): 9.0 kB. Headroom 15%, ADR-0030.
    // OLDSUI-74: 10.8 kB (+0.3): the Column layout grid with a container query and the Editor's column dashed lines in `prose.ts`, the Column layout rows in the catalog. The budget was raised from 10.7 to 11.2 kB, headroom about 4%, ADR-0030.
    // OLDSUI-78: 11.2 kB (+0.4): the surface and the five-tone stripe of the Wrapper in `prose.ts`, and the `--rte-tone-*` roles of the theme and the Paper in `tokens.ts`. The measurement hit the budget, raised from 11.2 to 11.6 kB, headroom about 4%, ADR-0030. The secondary text roles in a Wrapper with a Callout tone: 11.3 kB (+0.1), within budget, headroom about 3%.
    // Epic OLDSUI-98: 11.6 kB (+0.3): the same catalog rows, the rhythm of a custom Block in `prose.ts` (OLDSUI-104), and the shell of the custom Block's Island with a lazy body (OLDSUI-114; the body is in a lazy chunk, 0.6 kB). The measurement hit the budget; raised from 11.6 to 12.0 kB, headroom about 3%. ADR-0030.
    // OLDSUI-193: the 12.0 kB measurement hit the threshold: the shared message catalog grew with the Gallery findings' rows. Raised to 12.3 kB, headroom about 2.5%.
    // OLDSUI-268: the 12.3 kB measurement hit the threshold: the Islands of custom Blocks also read the rules from `defineTool` definitions (`customToolOf`). Raised to 12.6 kB, headroom about 2.5%.
    // OLDSUI-277: 12.7 kB (+0.3): the frame, heading and chevron of the collapsible `details` Block in `prose.ts` (the View draws native `details` and `summary` without the engine), and its rows in the catalog. Raised to 13.0 kB, headroom about 2.5%.
    // OLDSUI-280, OLDSUI-281: 14.2 kB (+1.4): formula and video search in HTML (`hasMath`, `hasVideoBlocks`), the LaTeX source in an empty formula for display without JS (`withMathSource`), the lazy formula and video Islands and their catalog rows. The KaTeX and player code is in lazy chunks. Raised to 14.6 kB, headroom about 3%.
    // Review of OLDSUI-280/281: 14.8 kB (+0.6): the 16:9 frame of the video Block in the server HTML (no height jump), parsing of the formula Options by the Editor's shared code, the Document fingerprint once per render. Raised to 15.2 kB, headroom about 3%.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): 16.1 kB (+1.3): the View renders the new markup without JS (footnote anchors, `time`,
    // `colgroup` shares, aligned figures) through the shared prose classes, plus the catalog rows.
    // Raised to 16.6 kB, headroom about 3%, ADR-0030.
    editorView: 16998,
    // The Schema entry (OLDSUI-48): data and one function, with no engine and no React.
    // The palette and the alignments in the Schema: 0.4 kB measurement, a margin for the links (OLDSUI-42).
    // OLDSUI-42: 0.5 kB (+0.2): the list of link schemes and the address check for `ALLOWED_URI_REGEXP`.
    // After the merge of OLDSUI-44 and OLDSUI-45: 0.56 kB, the headroom was 5%: raised to 15%, ADR-0030.
    // Review of epic OLDSUI-38: 2.2 kB (+1.6): `sanitizeRichText`, the Schema hooks for the consumer's DOMPurify (the attribute rules per tag and value, the checklist structure, pictures and links). They used to live as a recipe on the `RichTextView` page and were not in the measurement; the measurement now includes the helper that the server imports. Headroom 15%, ADR-0030.
    // OLDSUI-77: 2.6 kB (+0.1): the place of the Wrapper in the structure hook and its `data-block` value. The measurement hit the budget, raised to 2.9 kB, headroom about 15% again, ADR-0030.
    // OLDSUI-104: 3.4 kB (+0.8): custom Tools on the server (ADR-0058, item 2.3): `richTextSchema(tools)`, the hooks of a custom element, its attributes and the `top` place, and the check of a custom attribute's value (`isAllowedAttributeValue` moved here from `customTool.ts`, so that the cleanup and the Editor check it with the same code). Raised to 3.9 kB, headroom about 15%.
    // OLDSUI-268: 3.9 kB (+0.1): the Schema rules from `defineTool` definitions (`customToolOf`, the merge of Options and the cache of the `create` result per `tools` entry); the measurement hit the threshold. Raised to 4.2 kB, headroom about 7%, ADR-0030.
    // OLDSUI-280, OLDSUI-281: 4.4 kB (+0.4): the formula rules (`data-type` and `data-latex`, `<` only in `data-latex`, a formula is an empty leaf) and video (`data-provider`, `data-src` by the host template). Raised to 4.6 kB, headroom about 4%, ADR-0030.
    // Review of OLDSUI-280/281: 4.7 kB (+0.3): the space in `data-latex` before the DOMPurify check, and the Twitch channel-name rules for the sanitizer and the link parsing. Raised to 4.9 kB, headroom about 4%.
    // Epic OLDSUI-305 (footnotes, Block selection, text part language, date mention, table column widths, image alignment, fullscreen and focus modes): 6.4 kB (+1.7): the sanitizer rules of the new markup: the footnote `id`/`#`/role
    // shapes, `span[lang]` by the BCP 47 pattern, `time[datetime]` with the calendar check, the
    // `colgroup` share list, `figure[data-align]` and the wider image presets. Raised to 6.6 kB,
    // headroom about 3%, ADR-0030.
    editorSchema: 6758,
    // The highlighting entry (OLDSUI-50): the first measurement 21.3 kB: the helper, lowlight, the highlight.js core and six grammars. Headroom 15%, ADR-0030.
    editorHighlight: 25100,
    // Highlighting for `CodeView` (OLDSUI-58): the first measurement 22.4 kB: the node helper, lowlight, the highlight.js core, seven grammars and the theme string. Headroom 15%, ADR-0030.
    editorHighlightNodes: 25800,
  },

  /**
   * `First Load JS` of the fixture's page, in kilobytes. Measured by `npm run check:consumer`.
   *
   * This value is of a different nature: it includes the Next.js runtime with React (a baseline of
   * about 103 kB), so it cannot be compared with the numbers above. What it guards is something else:
   * that the client-graph boundary has not started pulling in the whole kit. Without
   * `optimizePackageImports`, this same page weighs 408 kB (ADR-0029).
   */
  consumer: {
    route: "/",
    firstLoadKb: 130,
  },

  /**
   * `First Load JS` of the fixture's `/editor` page: `RichTextView` from a server component
   * with a code block, with cleanup and highlighting on the server.
   *
   * It guards the same thing as the budget above, but for the `@olddevs/ui/editor` subpath: the
   * entry re-exports `RichTextEditor`, and without its own line in `optimizePackageImports`, a page
   * with only a View ships the whole Editor with the engine: 435 kB instead of 137 (review of epic
   * OLDSUI-38). Only the "Copy" island may reach the client. The first measurement was 137 kB,
   * headroom about 15%, ADR-0030.
   */
  consumerEditor: {
    route: "/editor",
    firstLoadKb: 158,
  },

  /**
   * `First Load JS` of the fixture's `/rich-text-editor` page: `RichTextEditor` with the `full`
   * preset from a server component (OLDSUI-111, ADR-0058, item 11.7).
   *
   * It guards that Next.js bundles the Editor's "start", while the lazy `codeBlock` and `table`
   * chunks go behind `import()` and are not part of `First Load JS` (lowlight with its grammars and
   * the table chunk are separate build files). The first measurement was 427 kB: the Next.js runtime
   * with React at about 103 kB, plus the engine and the kit's code. Headroom about 15%, ADR-0030.
   */
  consumerEditorFull: {
    route: "/rich-text-editor",
    firstLoadKb: 491,
  },
};

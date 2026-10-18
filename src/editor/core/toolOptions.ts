import type { EditorQuoteSet } from "../../i18n/messages.js";
import { devError } from "../../lib/dev-warn.js";
import type { PrefixedName } from "./customTool.js";
import type { ToolDefinition } from "./toolDefinition.js";
import type {
  BlockSelectionToolState,
  InvisibleCharactersToolState,
  LanguageToolState,
  SearchToolState,
  TocToolState,
} from "./toolState.js";
import type {
  BlockSelectionToolCommands,
  InvisibleCharactersToolCommands,
  LanguageToolCommands,
  SearchToolCommands,
  TocToolCommands,
} from "./toolCommands.js";
import type { Tool as ToolName } from "./tools.js";

/*
  Tool options: `tool()` and the `RichTextTools` map. The module is server-safe,
  like `customTool.ts`: types and functions over data, with no Tiptap and no React.
  The `tools` array is built in the screen's server module, next to the rest of the
  configuration. A Configured Tool is a plain data object with no functions, so it
  can be passed to a client component across the RSC boundary, provided the options
  themselves are data.
*/

/**
 * Heading level in the Table of contents options: 1 for `h1` … 4 for `h4`. The kit's
 * heading Schema has no levels beyond the fourth.
 */
export type TocLevel = 1 | 2 | 3 | 4;

/**
 * Options of the `search` Tool (all values have the kit's defaults). These are the
 * starting Find flags in general, not only for the panel: a query set by the
 * `setQuery` command takes the flags it does not name from here, until Find is
 * closed (`close()`, Escape in the panel).
 */
export interface SearchToolOptions {
  /**
   * The panel opens with the "Match case" checkbox on. The checkbox stays
   * toggleable; the kit does not remember it between openings. Default `false`.
   */
  matchCase: boolean;
  /** The panel opens with the "Whole words" checkbox on. Default `false`. */
  wholeWord: boolean;
  /** The panel opens with the "Regular expression" toggle on. Default `false`. */
  regex: boolean;
}

/** Options of the `toc` Tool (ADR-0068). */
export interface TocToolOptions {
  /**
   * Name of the CSS variable with the height of the screen's sticky header (ADR-0016).
   * Jumping to a heading puts it below the header, and the highlight counts a section
   * as current from the header's bottom edge. The value is the whole variable name,
   * with both dashes: `--header-h`. This does not move the Editor's sticky Toolbar,
   * which still sits below `--topbar-h`. Default `--topbar-h`.
   */
  offsetVar: string;
  /**
   * Heading levels that go into the Table of contents: a subset of 1–4. A heading of
   * another level is in neither the strip nor the list, and an entry's indent is
   * computed from the largest of the remaining levels. Default: all four.
   */
  levels: readonly TocLevel[];
  /**
   * Width of the list: a CSS length or pixels. Fixed, not based on the longest
   * heading. Default 240.
   */
  listWidth: number | string;
}

/**
 * Options of the `details` Tool (based on the Details extension from Tiptap, ADR-0048).
 */
export interface DetailsToolOptions {
  /**
   * Whether the Block's open state is written into the Document: an open Block is
   * saved with `open`, and comes out of `RichTextView` open too. Default `false`, as
   * in Tiptap: a Block expanded while editing is not published expanded without
   * asking, and the open state lives only in display (in the Editor and in the View,
   * the reader opens a Block themselves). With `true`, a Block inserted from the
   * Slash menu is open right away and writes `open`, and `open` from `value` and from
   * an insert is read back.
   */
  persist: boolean;
}

/**
 * Options of the `mathematics` Tool (based on the Mathematics extension from Tiptap,
 * ADR-0048, ADR-0070): only the KaTeX options that do not affect the saved HTML, since
 * that holds the original LaTeX source. `RichTextView` reads the same options from its
 * `tools`, so a formula looks in the View the same as in the Editor.
 *
 * Data, not functions: a Configured Tool can be passed to a client component across
 * the RSC boundary, and the View's Island gets its options from the server.
 */
export interface MathematicsToolOptions {
  /**
   * Custom KaTeX macros: a name with a backslash is a substitution
   * (`{ "\\RR": "\\mathbb{R}" }`). Nested objects are merged, as with any option.
   * Default: no macros.
   */
  macros: Readonly<Record<string, string>>;
  /**
   * What to do with non-LaTeX input (Unicode in math mode and the like): `"ignore"`
   * accepts it silently, `"warn"` accepts it and writes to the console, `"error"`
   * treats the formula as invalid. Default `"ignore"`, not `"warn"` as in KaTeX: the
   * console would be noisy on every typed character.
   */
  strict: "ignore" | "warn" | "error";
}

/**
 * Options of the `typography` Tool (based on the Typography extension from Tiptap,
 * ADR-0048).
 *
 * Each Tiptap rule is an option with the same name: `false` turns the rule off, and a
 * string replaces the replacement character. Quotes involve two decisions of the kit:
 * the `quotes` set, and the nesting of guillemets in the Russian set.
 */
export interface TypographyToolOptions {
  /**
   * Quote set for `"`: `"ru"` gives guillemets « » with nested „ “, `"en"` gives
   * “ ”. `"auto"` takes the set from the Editor's message catalog
   * (`UiMessages.editor.typographyQuotes`) and follows it when the catalog changes.
   * An explicit set is needed when the Document's language differs from the interface
   * language. A single `'` does not depend on the set. Default `"auto"`.
   */
  quotes: "auto" | EditorQuoteSet;
  /**
   * Opening and closing double quote. An explicit string overrides the `quotes` set
   * and turns nesting off: quotes come in pairs, and the opening one follows a space,
   * the start of a Block, or a bracket. `false` turns the rule off. No value means the
   * set's quotes.
   */
  openDoubleQuote?: false | string;
  closeDoubleQuote?: false | string;
  /** Single quotes: a `'` after a space is opening, otherwise closing (which is also the apostrophe). */
  openSingleQuote: false | string;
  closeSingleQuote: false | string;
  /** `--` → em dash. */
  emDash: false | string;
  /** `...` → ellipsis. */
  ellipsis: false | string;
  /** `<-` and `->` → arrows. */
  leftArrow: false | string;
  rightArrow: false | string;
  /** `(c)`, `(tm)`, `(sm)`, `(r)`. */
  copyright: false | string;
  trademark: false | string;
  servicemark: false | string;
  registeredTrademark: false | string;
  /** `1/2 `, `1/4 `, `3/4 ` (with a space after the fraction) → fractions. */
  oneHalf: false | string;
  oneQuarter: false | string;
  threeQuarters: false | string;
  /** `+/-` → `±`, `!=` → `≠`. */
  plusMinus: false | string;
  notEqual: false | string;
  /** `<<` and `>>` → guillemets. */
  laquo: false | string;
  raquo: false | string;
  /** `2x3` and `2*3` → `2×3`. */
  multiplication: false | string;
  /** `^2` and `^3` → `²` and `³`. */
  superscriptTwo: false | string;
  superscriptThree: false | string;
}

/**
 * Options of the `invisibleCharacters` Tool (based on the Invisible Characters
 * extension from Tiptap, ADR-0048).
 */
export interface InvisibleCharactersToolOptions {
  /**
   * Invisible characters are shown from the start. Default `false`, unlike Tiptap,
   * where it is `true`: the Tool is part of `full`, and a kit update must not change
   * how every such Editor looks. After that, the button, the `toggle` command and the
   * `visible` state control the display; the option sets only the starting value.
   */
  visible: boolean;
}

/**
 * Options of the `language` Tool (Text part language, ADR-0078).
 */
export interface LanguageToolOptions {
  /**
   * The languages the "Language ›" submenu offers, as BCP 47 tags (`"en"`, `"de"`, `"pt-BR"`), in the
   * order of the list. Names are drawn by `Intl.DisplayNames` in the interface language. The list
   * only fills the menu: the Schema and the sanitizer accept a `lang` of any language, so a Document
   * with `lang="de"` keeps its marks in an Editor whose menu has no German. A list with an invalid
   * tag, or an empty one, is replaced with the default and logs one `console.error` in development.
   * Default `["en", "ru"]`, the languages of the kit's message catalogs. An array is replaced whole,
   * not merged with the default.
   */
  languages: readonly string[];
}

/**
 * Options of the `youtube` and `twitch` Tools (ADR-0071, item 4). Both have the same
 * options, because each Tool configures the blocks of its own service. Neither one
 * changes the saved HTML, which still holds only the link. `RichTextView` reads the
 * same options from its `tools`, so the video behaves in the View the same as in the
 * Editor.
 */
export interface VideoToolOptions {
  /**
   * The service's player loads at once: an `iframe` with `loading="lazy"` in the
   * Editor and in the View. With `false`, the kit's placeholder stands in its place,
   * showing the service's name and a "Play" button, with no request to the service
   * until the reader clicks. Use it on screens where privacy matters. Default `true`:
   * an empty placeholder in place of the video looked like a bug.
   */
  autoload: boolean;
}

/**
 * Editor Tool types by name: what the screen sets when configuring (`options`), what it
 * reads (`state`) and what it calls (`commands`). An extensible interface, like `Storage`
 * and `Commands` in Tiptap: the kit declares `search`, `toc`, `details`, `mathematics`,
 * `youtube`, `twitch`, `typography`, `invisibleCharacters` and `language` in it, and the consumer
 * adds its own Tools through declaration merging:
 *
 * ```ts
 * declare module "@olddevs/ui/editor" {
 *   interface RichTextTools {
 *     acme_note: {
 *       options: { tone: "info" | "warning" };
 *       state: { count: number };
 *       commands: { clear(): boolean };
 *     };
 *   }
 * }
 * ```
 *
 * The types of `useRichTextToolState`, `handle.tool()` and the options of `tool()` for
 * a built-in Tool are derived from the map; the options of a custom Tool's `tool()` come
 * from the `defaults` of its definition. A Tool that is not added to the map still works:
 * typing is optional.
 */
export interface RichTextTools {
  search: {
    options: SearchToolOptions;
    state: SearchToolState;
    commands: SearchToolCommands;
  };
  toc: {
    options: TocToolOptions;
    state: TocToolState;
    commands: TocToolCommands;
  };
  // Options only: a collapsible Block has no state or commands.
  details: {
    options: DetailsToolOptions;
  };
  // Options only: formulas have no state or commands.
  mathematics: {
    options: MathematicsToolOptions;
  };
  // Options only: the player draws the node view and the Island; the video has no state or commands.
  youtube: {
    options: VideoToolOptions;
  };
  twitch: {
    options: VideoToolOptions;
  };
  // Options only: input rules; they have no state or commands.
  typography: {
    options: TypographyToolOptions;
  };
  invisibleCharacters: {
    options: InvisibleCharactersToolOptions;
    state: InvisibleCharactersToolState;
    commands: InvisibleCharactersToolCommands;
  };
  // State and commands only: the mode has no options (ADR-0077).
  blockSelection: {
    state: BlockSelectionToolState;
    commands: BlockSelectionToolCommands;
  };
  language: {
    options: LanguageToolOptions;
    state: LanguageToolState;
    commands: LanguageToolCommands;
  };
}

/**
 * Names of the built-in Tools that have options: the map's keys that match the kit's
 * names. A custom Tool added to the map does not appear here; it is configured by its
 * definition, not by name.
 */
export type ConfigurableToolName = {
  [Name in keyof RichTextTools & ToolName]: RichTextTools[Name] extends { options: object }
    ? Name
    : never;
}[keyof RichTextTools & ToolName];

/** Options of a Tool from the map; no map entry or no `options` gives `never`. */
type OptionsOf<Name extends ConfigurableToolName> = RichTextTools[Name] extends {
  options: infer Options;
}
  ? Options
  : never;

/**
 * Options the screen passes to `tool()`: every field is optional, and the rest comes from
 * the defaults. Nested objects are merged the same way, while arrays and functions are
 * replaced as a whole (the merge rule, `mergeOptions`).
 */
export type ToolOptionsInput<Options> = {
  [Key in keyof Options]?: Options[Key] extends readonly unknown[] | ((...args: never[]) => unknown)
    ? Options[Key]
    : Options[Key] extends object
      ? ToolOptionsInput<Options[Key]>
      : Options[Key];
};

/**
 * Configured Tool: an entry for `tools`, returned by `tool()`. It is opaque: only the kit
 * reads its fields. For a built-in Tool it is the name and the options, not a description:
 * descriptions of built-in Tools are not exposed (ADR-0058, item 10.3). A custom Tool
 * adds the definition that `tool()` configures.
 */
export interface ConfiguredTool<Name extends string = ToolName> {
  /** Marker of the entry: `tools` uses it to tell a Configured Tool from a custom one. */
  readonly configured: true;
  readonly name: Name;
  readonly options: Readonly<Record<string, unknown>>;
  /** Definition of a custom Tool (`defineTool`); a built-in Tool has none. */
  readonly definition?: ToolDefinition;
}

/**
 * Merges options: nested plain objects are merged, while arrays, functions and everything
 * else are replaced whole, as `configure` in Tiptap. A value of `undefined` does not count:
 * what was there stays. Returns a new object; the source objects are not changed (a nested
 * object that is absent from `given` stays the same object).
 */
export function mergeOptions(base: object, given: object): object {
  // A plain object is a literal; class instances, `Date` and React elements count as values.
  const plain = (value: unknown): value is object =>
    (value as { constructor?: unknown } | null)?.constructor === Object;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(given)) {
    if (value !== undefined) {
      result[key] = plain(value) && plain(result[key]) ? mergeOptions(result[key], value) : value;
    }
  }
  return result;
}

/**
 * Configures a Tool directly in `tools`: a built-in one by name, a custom one by its
 * definition (`defineTool`).
 *
 * ```tsx
 * <RichTextEditor
 *   tools={[
 *     ...RICH_TEXT_PRESETS.full,
 *     tool("toc", { offsetVar: "--header-h", levels: [2, 3] }),
 *     tool(mention, { labels: { insert: "Mention a colleague" } }),
 *   ]}
 * />
 * ```
 *
 * An entry also enables the Tool without its name in `tools`. If `tools` contains both a
 * bare name (from a preset) and a Configured Tool, the Configured Tool wins. Two `tool()`
 * entries with the same built-in name are a mistake in the set, as are two entries of the
 * same custom Tool. The Tool's place on the surface does not change: for a built-in one it
 * is set by the kit's order, and for a custom one by the order in `tools`. Pass only the
 * options that change; the rest come from the defaults. Nested objects are merged, while
 * arrays and functions are replaced whole.
 *
 * Options are read once, together with the set, when the engine is created. To change them
 * on the fly, recreate the Editor with a `key`. An invalid value for a built-in option (from
 * JS without types) is replaced by its default, and in development it logs one
 * `console.error`; the author of a custom Tool checks that Tool's own options.
 *
 * Only built-in Tools with options can be configured by name: `search`, `toc`, `details`,
 * `mathematics`, `youtube`, `twitch`, `typography`, `invisibleCharacters` and `language`. The function
 * is server-safe.
 */
export function tool<Name extends ConfigurableToolName>(
  name: Name,
  options?: ToolOptionsInput<OptionsOf<Name>>
): ConfiguredTool<Name>;
export function tool<Name extends PrefixedName, Options extends object>(
  definition: ToolDefinition<Name, Options, unknown, object>,
  options?: ToolOptionsInput<Options>
): ConfiguredTool<Name>;
export function tool(
  entry: ToolName | ToolDefinition,
  options: Record<string, unknown> = {}
): ConfiguredTool<string> {
  return typeof entry === "string"
    ? { configured: true, name: entry, options }
    : { configured: true, name: entry.name, options, definition: entry };
}

/** Whether a `tools` entry is a Configured Tool. `null` and strings are not. */
export function isConfiguredTool(entry: unknown): entry is ConfiguredTool<string> {
  return (
    typeof entry === "object" &&
    entry !== null &&
    (entry as { configured?: unknown }).configured === true
  );
}

/** Configured built-in Tools from `tools`: the `tool("name", …)` entries, without the custom ones' definitions. */
export function configuredBuiltins(tools: readonly unknown[] | undefined): ConfiguredTool[] {
  return (tools ?? []).filter(
    (entry): entry is ConfiguredTool => isConfiguredTool(entry) && !entry.definition
  );
}

/**
 * First entry whose name has already appeared earlier: two `tool()` entries for one Tool
 * are a mistake in the set.
 */
export function repeatedConfigured(
  configured: readonly ConfiguredTool[]
): ConfiguredTool | undefined {
  return configured.find((entry, index) =>
    configured.some((other, i) => i < index && other.name === entry.name)
  );
}

/**
 * Tool options: the defaults, with the ones passed to `tool()` on top. A value that failed
 * its check, and an option the Tool does not have (for which there is no check either), are
 * dropped. In development, one `console.error` per Tool is logged: a consumer on plain JS
 * bypasses the map's types, and the field does not break because of it.
 *
 * ONE READ FOR THE EDITOR AND THE VIEW. The Editor reads options when it assembles the set
 * (`expandTools`), and the server-side `RichTextView` reads the formula options for its Island
 * (`mathOptionsOf`). It is one rule, so that whatever the Editor accepts, the View accepts too.
 * `owner` is the name that appears in the message.
 */
export function resolveToolOptions(
  owner: "RichTextEditor" | "RichTextView",
  name: string,
  defaults: object,
  checks: Readonly<Record<string, (value: unknown) => boolean>> | undefined,
  configured: ConfiguredTool | undefined
): object {
  const given = Object.entries(configured?.options ?? {}).filter(
    ([, value]) => value !== undefined
  );
  const valid = given.filter(([key, value]) => checks?.[key]?.(value));
  if (valid.length < given.length) {
    devError(
      `${owner}: tool "${name}": ignored invalid options: ` +
        given
          .filter((entry) => !valid.includes(entry))
          .map(([key]) => key)
          .join(", ")
    );
  }
  return mergeOptions(defaults, Object.fromEntries(valid));
}

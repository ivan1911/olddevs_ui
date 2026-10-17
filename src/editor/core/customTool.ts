import type { ChainedCommands, Editor, Extensions } from "@tiptap/core";
import type { Mark } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "../../icons.js";
import type { ToolDefinition } from "./toolDefinition.js";
import type { ConfiguredTool } from "./toolOptions.js";
import type { Tool as ToolName } from "./tools.js";

/*
  Custom Tool: the public form (ADR-0058, sections 1 and 2).

  The module is safe to load on the server, like `schema.ts`: types and one function over data.
  Tiptap appears here only as a type (`Extensions`), which is erased at build time, so the
  description of a custom Tool is imported where the engine is absent too: server-side
  sanitization reads the same Schema rules. Everything that touches the engine is in
  `customToolEngine.ts`.
*/

export type { ToolName };

/**
 * A name with the consumer prefix: the prefix, an underscore, the rest, for example `acme_mergeTag`.
 * Kit names have no underscores, so custom and built-in names never overlap. An underscore
 * rather than a hyphen: in ProseMirror content expressions a node name must be a word.
 */
export type PrefixedName = `${string}_${string}`;

/**
 * The kind of value a custom attribute accepts. The kit's code checks it, both in the Editor and
 * on the server; the consumer writes no check functions.
 *
 * - `list` — one of the `values`;
 * - `pattern` — a regular expression as a string for the WHOLE value (the kit adds `^…$`
 *   itself), like `customColor` in the kit's Schema;
 * - `url` — an address under the kit's protocol policy: an absolute `http`, `https` or
 *   `mailto` URL, the same as for a link.
 */
export type CustomAttribute =
  | { kind: "list"; values: readonly string[] }
  | { kind: "pattern"; pattern: string }
  | { kind: "url" };

/**
 * Schema rules of a custom Block, and its traits.
 *
 * The kit writes the Block's HTML by convention: a block-level one is `div[data-block="<name>"]`,
 * an inline one is `span[data-block="<name>"]`, and the attribute `acme_size` is `data-acme_size`.
 */
export interface CustomBlock {
  /** Block-level (`div`, group `block`) or inline (`span`, group `inline`). */
  kind: "block" | "inline";
  /**
   * Where a block-level Block can sit: `anywhere` (default) — wherever a Block of the Document
   * can go; `top` — only at the top level of the Document, like a Column layout.
   */
  place?: "anywhere" | "top";
  /** Custom attributes: a name with the consumer prefix, mapped to the kind of value. */
  attributes?: Readonly<Record<PrefixedName, CustomAttribute>>;
  /** The "container" trait: Blocks inside get their own Block handle, as in a Wrapper. */
  container?: boolean;
  /**
   * The "can be turned into" trait: the Format › item of the Block handle is available for it too.
   */
  turnInto?: boolean;
  /**
   * The "plain Atom" trait: the Bubble menu is not shown above a selected Block of this kind.
   */
  plainAtom?: boolean;
  /**
   * The Block's Island in `RichTextView`: a client component from a module with the
   * `"use client"` directive (ADR-0058, item 3.3). Without it, the Block in the View is sanitized
   * HTML. The Editor does not read this field: its look comes from the Extensions.
   *
   * Only a component from a module with the directive is allowed. A server component and a
   * Loader function do not cross the RSC boundary: the server gets a reference to the client
   * component, and its code loads only when the Block is in the Document. Sanitization and the
   * Schema do not read this field.
   */
  island?: ComponentType<CustomIslandProps>;
}

/**
 * What an Island of a custom Block receives: the Block's name, its attributes and its text.
 * The attributes are only those declared in the Block's `attributes`, by their names without
 * `data-` (`acme_size`), with values as in the sanitized HTML of the Document; an undeclared
 * attribute is not visible to the component. The text is the Block's `textContent` from the
 * server-rendered HTML.
 */
export interface CustomIslandProps {
  /** The Block name: the `blocks` key. One component can serve several Blocks. */
  block: string;
  /** Declared attributes of the Block that are present in the HTML. */
  attributes: Readonly<Record<string, string>>;
  /** The Block's text: for an Atom, its Atom text from the server HTML, often empty. */
  text: string;
}

/** Schema rules of a custom Mark: the HTML is `span[data-mark="<name>"]`. */
export interface CustomMark {
  /**
   * Custom attributes of the Mark: a name with the consumer prefix, mapped to the kind of value.
   */
  attributes?: Readonly<Record<PrefixedName, CustomAttribute>>;
}

/**
 * Description of a custom Tool: the public subset of the internal description of built-in Tools
 * (`ToolDescriptor`, ADR-0058, item 10). Passed in `tools`, mixed with the kit's Tool names.
 *
 * Required: the name, the Extensions, and the Schema rules for each Block and Mark they define.
 * The rest has defaults (ADR-0058, item 1.6): an ordinary Block with no traits and no UI
 * contributions.
 */
export interface CustomTool {
  /** The name with the consumer prefix, unique within `tools`. */
  name: PrefixedName;
  /**
   * Extensions: Tiptap extensions, that is Node, Mark, Extension, ProseMirror plugins, a React
   * node view, the `renderText` of an Atom. Their contract follows the major version of Tiptap.
   * Nodes and Marks stand at the top level of the array: the kit assigns the group, HTML parsing
   * and the custom attributes itself, by the rules.
   *
   * Either an array right away, or a Loader: a function with a dynamic import that returns a
   * promise of the same array, for example `() => import("./engine.js").then((m) => m.engine)`.
   * With a Loader, the description module is imported on the server too, without Tiptap and
   * React. The engine is created after the Loaders of all Tools; until then the field shows the
   * Skeleton. The promise is cached on the Loader function.
   */
  engine: Extensions | (() => Promise<Extensions>);
  /** Schema rules for each Node from Extensions, by node name. */
  blocks?: Readonly<Record<PrefixedName, CustomBlock>>;
  /** Schema rules for each Mark from Extensions, by Mark name. */
  marks?: Readonly<Record<PrefixedName, CustomMark>>;

  /* UI contributions (ADR-0058, items 5 and 6): buttons, Insert items and Block actions. */

  /**
   * Toolbar buttons, fixed and floating (one set). They go in one group before "Undo" and "Redo",
   * in the order of `tools` and the order of the array; a disabled Tool takes them along.
   */
  buttons?: readonly CustomToolButton[];
  /**
   * Insert items: they appear in the Slash menu ("/" and "+") and in the "Add ›" and
   * "Format ›" items of the Block handle.
   */
  insertItems?: readonly CustomInsertItem[];
  /** Block actions in the Block handle menu, as a section before "Delete". */
  blockActions?: readonly CustomBlockAction[];
  /**
   * Text cards (ADR-0058, items 7.6–7.11): the kit shows them under a Mark or another range where
   * the caret is. At most one is open: the narrowest range under the caret wins; at equal width,
   * the Tool that comes first in `tools` wins.
   */
  textCards?: readonly CustomTextCard[];
  /**
   * A custom trigger character (ADR-0064): typing `char` at the start of a Block or after a space
   * opens a list of items at the caret, the same list the "/" Slash menu draws. One trigger per
   * Tool; the character is unique within `tools`.
   */
  trigger?: CustomTrigger;
}

/**
 * An item of a custom trigger's list. The kit draws it: the icon and the label. The consumer
 * filters by the typed query itself, in `items`, which is why there are no `aliases` here.
 */
export interface TriggerItem {
  /** The item key, unique within one `items` response. */
  id: string;
  /** The label: the row's text; the consumer prepares it in the interface language. */
  label: string;
  /** The row's icon: a component with the `IconProps` contract. No icon means a plain row. */
  icon?: ComponentType<IconProps>;
  /** Any data of the consumer: the kit does not read it and passes it to `onSelect` as is. */
  data?: unknown;
}

/**
 * What `onSelect` receives. `range` is the text typed together with the character (`@query`):
 * the kit does NOT delete it, the handler replaces it with its own node. `query` is the query
 * without the character.
 */
export interface TriggerContext {
  /** The Editor (raw Tiptap), for inserting your own node. */
  editor: Editor;
  /** The `@query` range in the Document: ProseMirror positions, `from < to`. */
  range: { from: number; to: number };
  /** What was typed after the character, without the character itself. */
  query: string;
}

/**
 * A custom trigger character of a Tool (ADR-0064): mentions with `@`, tags with `#`.
 *
 * The opening rules are the same as for "/": the character must stand at the start of a Block or
 * after a space (inside a word, as in `a@b.com`, the list stays closed); it does not open in a
 * code Block or in inline code. The query runs up to the next space. Focus stays in the Document;
 * the arrows, `Enter` and `Escape` work as in the Insert menu. An empty response shows the row
 * "Nothing found".
 */
export interface CustomTrigger {
  /**
   * One printable character, not `/` and not a space: `@`, `#`, `:`. Two Tools with the same
   * character are an error in the set of Tools (`console.error` in development, and an error of
   * the field).
   */
  char: string;
  /**
   * The name of the list for screen readers: a string or a function of `{ locale }`. If absent,
   * the kit's catalog name ("Suggestions") is used.
   */
  label?: CustomToolLabel;
  /**
   * Items for the query, at once or as a promise. Called on every change of the query, including
   * an empty query right after the character; the kit discards the answer to an outdated query.
   * A rejected promise gives an empty list and a `console.error` in development.
   */
  items: (query: string) => TriggerItem[] | Promise<TriggerItem[]>;
  /**
   * An item is chosen (the arrows and `Enter`, or a click). The handler replaces `ctx.range` with
   * its own node in one transaction; the kit closes the list after the call.
   */
  onSelect: (item: TriggerItem, ctx: TriggerContext) => void;
}

/**
 * Whether a character can be a trigger (ADR-0064): one printable character, not a space and not a
 * control character, except `/`, which the Slash menu occupies. A character outside the BMP (an
 * emoji) counts as one character.
 */
export function isTriggerChar(char: unknown): char is string {
  return typeof char === "string" && char !== "/" && /^[^\s\p{C}]$/u.test(char);
}

/** The Document range a Text card is attached to: ProseMirror positions, `from <= to`. */
export interface TextCardRange {
  from: number;
  to: number;
}

/**
 * The Text card's range at the caret: `pos` is the caret (or the click position). The result is
 * the range the Text card is attached to, or `null` if there is no Text card here. For a Mark,
 * the ready-made helper is `markRange`. The function only reads the state and is called on every
 * transaction, so it must be fast and free of side effects. A range wider than the Document, or
 * with `from > to`, is discarded by the kit.
 */
export type TextCardRangeAt = (state: EditorState, pos: number) => TextCardRange | null;

/**
 * The body of a Text card. `range` is the range from `rangeAt` on the current state (it moves
 * with edits); `close` hides the Text card the same way Escape does.
 */
export type CustomTextCardRender = (props: {
  editor: Editor;
  range: TextCardRange;
  close: () => void;
}) => ReactNode;

/**
 * A Text card is the fourth kind of UI contribution (ADR-0058, items 7.6–7.11): for example, a
 * comment card under a Mark-highlighted range.
 *
 * The kit holds the frame: the layer and the Escape stack as in the kit's `Popover`, the anchor
 * under the range, a flip at the edge of the window. The body is the React node `render`; the
 * frame has no header and no data buttons, and the entry has no icon. The Text card is non-modal:
 * focus stays in the Document and typing goes on; `Alt+F10` moves into the Text card, and Escape
 * moves back to the Document.
 *
 * It opens when the collapsed caret is inside the range, or on a click on it, but not on hover.
 * It stays closed while the selection is expanded (the Bubble menu works there). Escape and
 * `close` hide it until the caret leaves the range; a click opens it again. It also works with
 * `readOnly`: the engine itself blocks edits made from `render`. `RichTextView` has no Text cards.
 */
export interface CustomTextCard {
  /**
   * The label: a string or a function of `{ locale }`. It is the accessible name of the frame and
   * part of the phrase the kit uses to announce the Text card to screen readers. There is no icon.
   */
  label: CustomToolLabel;
  /** The range under the caret: for a Mark, `markRange("acme_comment")`. */
  rangeAt: TextCardRangeAt;
  /** The body of the Text card; it is mounted again on each opening. */
  render: CustomTextCardRender;
}

/**
 * An Insert item of a custom Tool (ADR-0058, item 5).
 *
 * It gets into the "/" and "+" menus, and into the "Add ›" and "Format ›" items of the Block
 * handle, by itself: the kit edits those menus, the consumer does nothing. The item goes at the
 * end of its section; the custom items keep the order of `tools`. A disabled Tool removes the
 * item too.
 *
 * The section decides what happens to the Document, and `run` decides which Block: in `insert`
 * the kit prepares an empty paragraph (the current empty one, or a new one right after the
 * Block); in `turnInto` it strips the wrappers (a list, a quote) off the Block. The preparation
 * and `run` go in one transaction, so the edit is undone with a single `Ctrl+Z`.
 *
 * Exactly one of `run` or `popover` (ADR-0058, item 5.6). A popover is the same kit frame as a
 * button's, and it opens at the caret however the item was invoked.
 */
export type CustomInsertItem = CustomInsertItemFields &
  (
    | {
        /**
         * A command on the chain: return it together with the Block's command.
         * The kit calls `.run()`.
         */
        run: (chain: ChainedCommands, editor: Editor) => ChainedCommands;
        popover?: undefined;
      }
    | {
        /**
         * A popover instead of a command: it opens at the caret (from "/", where the "/" stood). The
         * kit does not prepare the Document: it removes the typed "/command", and the popover itself
         * puts the content into the Document through `editor`.
         */
        popover: CustomToolPopover;
        run?: undefined;
      }
  );

interface CustomInsertItemFields {
  /** "Insert": a new Block after the current one. "Turn into": change the current one. */
  section: "insert" | "turnInto";
  /** The label: a string or a function of `{ locale }`; search matches it too. */
  label: CustomToolLabel;
  /**
   * A component with the `IconProps` contract: from the `@olddevs/ui/icons` set, or your own.
   */
  icon: ComponentType<IconProps>;
  /** Extra search words beyond the label, in any language; the kit searches the labels itself. */
  aliases?: readonly string[];
  /**
   * A shortcut in the Toolbar notation (`mod`, `alt`, `shift`, a key). It is the only source: the
   * kit binds the key itself and writes it in the item's hint and in the shortcuts reference.
   */
  shortcut?: readonly string[];
}

/**
 * A Block action of a custom Tool: an item of the Block handle menu (ADR-0058, item 5). Custom
 * Block actions stand as a section before "Delete", in the order of `tools`.
 *
 * Exactly one of `run` or `popover` (ADR-0058, item 5.6). The popover opens at the Block: by a
 * choice in the handle menu, at its Block; by a shortcut, at the Block under the caret.
 */
export type CustomBlockAction = CustomBlockActionFields &
  (
    | {
        /**
         * `pos` is the position of the handle's Block in the Document. One edit is one undo.
         */
        run: (editor: Editor, pos: number) => void;
        popover?: undefined;
      }
    | {
        /**
         * A popover instead of an action: it opens at the Block. The content also gets the Block's `pos`.
         */
        popover: CustomToolPopover<{ pos: number }>;
        run?: undefined;
      }
  );

interface CustomBlockActionFields {
  /** The label: a string or a function of `{ locale }`. */
  label: CustomToolLabel;
  /** The icon: a component with the `IconProps` contract. */
  icon: ComponentType<IconProps>;
  /**
   * The names of the Blocks for which the action is shown: the name of the handle's Block, or of
   * the container it stands directly in.
   */
  blocks: readonly string[];
  /** The shortcut in the Toolbar notation; the kit binds it to the Block under the caret. */
  shortcut?: readonly string[];
  /** Visibility by context; if absent, the action is visible for all of its `blocks`. */
  isVisible?: (editor: Editor, pos: number) => boolean;
}

/**
 * The label of an entry: a string or a function of the context (ADR-0058, item 6.1). The kit
 * calls the function on render with the `UiProvider` locale, so a change of locale re-renders the
 * entry. A string suits a single-language application.
 */
export type CustomToolLabel = string | ((context: { locale: string }) => string);

/**
 * The content of the popover of a button, an Insert item or a Block action. The kit holds the
 * frame: the layer, the anchor, the Escape stack, and returning focus and the selection to the
 * Document. `close` closes the popover the same way Escape does. `Extra` is what the entry adds
 * to `editor` and `close`: for a Block action, the Block's `{ pos }`.
 */
export type CustomToolPopover<Extra extends object = object> = (
  props: { editor: Editor; close: () => void } & Extra
) => ReactNode;

interface CustomToolButtonFields {
  /**
   * The button key, unique within its Tool. It never collides with the kit's ids or with the
   * buttons of other Tools.
   */
  id: string;
  /**
   * The caption: the button's name for screen readers, the tooltip text and the popover's name.
   * An empty one means the Tool's name.
   */
  label: CustomToolLabel;
  /**
   * The icon: a component with the `IconProps` contract, from the kit's icon set or your own.
   * Required.
   */
  icon: ComponentType<IconProps>;
  /**
   * Whether the button is available now. In a read-only field the kit disables the buttons itself,
   * so the check does not belong here.
   */
  can: (editor: Editor) => boolean;
  /** Present: a toggle button with `aria-pressed`. Absent: a one-off action. */
  isActive?: (editor: Editor) => boolean;
  /** Visibility predicate by context; if absent, the button is always visible. */
  isVisible?: (editor: Editor) => boolean;
  /** The button is also placed in the Bubble menu. */
  selectionMenu?: boolean;
  /**
   * A shortcut in the Toolbar notation: `mod`, `alt`, `shift` and a key, for example
   * `["mod", "shift", "Y"]`. It is the only source: the kit binds the key itself and writes it in
   * the hint, in `aria-keyshortcuts` and in the shortcuts reference.
   */
  shortcut?: readonly string[];
}

/**
 * A button of a custom Tool: data, drawn by the kit (ADR-0058, section 5).
 *
 * Exactly one of `run` or `popover`. `run` runs on a click and on a shortcut; `popover` opens on a
 * click at the button, and on a shortcut at the caret.
 */
export type CustomToolButton = CustomToolButtonFields &
  (
    | {
        /** The button's action: runs over the editor on a click and on a shortcut. */
        run: (editor: Editor) => void;
        /** Not set together with `run`: a button has one action. */
        popover?: undefined;
      }
    | {
        /**
         * The button's popover: opens on a click at the button, and on a shortcut at the caret.
         */
        popover: CustomToolPopover;
        /** Not set together with `popover`: a button has one action. */
        run?: undefined;
      }
  );

/**
 * An element of `tools`: the name of a kit Tool, a Configured Tool (`tool()`), a definition of a
 * custom Tool (`defineTool()`), or a description of a custom Tool as a plain object.
 */
export type ToolEntry = ToolName | ConfiguredTool<string> | ToolDefinition | CustomTool;

/**
 * Whether an attribute value is allowed by its kind (`CustomAttribute`). It lives in `schema.ts`,
 * next to the address policy: the sanitizer on the server reads the same check.
 */
export { isAllowedAttributeValue } from "./schema.js";

/**
 * `rangeAt` for a Mark: the continuous stretch of text with this Mark (and the same attribute
 * values) around `pos`. The edges are included: a caret right after or right before a word is
 * still "inside" the range, otherwise a click on the first letter would not open the Text card.
 * If the caret stands between two stretches, the one that ends here is taken: that is where one
 * continues typing. No Mark, `null`.
 */
export function markRange(markName: string): TextCardRangeAt {
  return (state, pos) => {
    const type = state.schema.marks[markName];
    if (!type || pos < 0 || pos > state.doc.content.size) return null;
    const $pos = state.doc.resolve(pos);
    const parent = $pos.parent;
    const start = $pos.start();
    const runs: { from: number; to: number }[] = [];
    let last: { mark: Mark; to: number } | undefined;
    parent.forEach((child, offset) => {
      const mark = type.isInSet(child.marks) || undefined;
      const from = start + offset;
      const to = from + child.nodeSize;
      if (mark && last && last.to === from && mark.eq(last.mark)) {
        runs[runs.length - 1]!.to = to;
      } else if (mark) {
        runs.push({ from, to });
      }
      last = mark ? { mark, to } : undefined;
    });
    const inside = runs.find((run) => run.from < pos && pos < run.to);
    return (
      inside ?? runs.find((run) => run.to === pos) ?? runs.find((run) => run.from === pos) ?? null
    );
  };
}

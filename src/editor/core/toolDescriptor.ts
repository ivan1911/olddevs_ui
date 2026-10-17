import type { Editor, Extensions } from "@tiptap/core";
import type { StarterKitOptions } from "@tiptap/starter-kit";
import type { ComponentType, ReactNode } from "react";
import type { UiMessages } from "../../i18n/messages.js";
import type { IconProps } from "../../icons.js";
import type { BlockTypeItem } from "./blockTypes.js";
import type {
  TextCardRangeAt,
  CustomTextCardRender,
  CustomTool,
  CustomTrigger,
  PrefixedName,
} from "./customTool.js";
import type { EditorExtensionOptions } from "./extensions.js";
import type { InsertItem } from "./insertItems.js";
import type { ShortcutCommand, ShortcutGroup } from "./shortcuts.js";
import type { ConfigurableToolName, RichTextTools } from "./toolOptions.js";
import type { ToolLoader } from "./toolLoader.js";
import type { Tool } from "./tools.js";

/**
 * Internal description of a built-in Tool (ADR-0058, item 10).
 *
 * SHAPE. The type is a superset of the future public description of a custom Tool: the same
 * Extensions, Block traits and UI entries, plus the kit's privileges that a custom Tool is not
 * given (the Schema tags of the kit, the content model, Toolbar widgets, its own place in the order
 * of the surface). Built-in descriptions are not exported: only the names and the presets are public.
 *
 * ONE LIST. `tools` and `preset` are expanded into a list of descriptions (`expandTools`,
 * `features/builtins.ts`), and the registries by name (the engine, the Slash menu, "¶", the shortcut
 * reference and what follows them) read its projection (`projectRecords`). The rule "a disabled Tool
 * removes both its button and its Schema" holds by itself: the entries and the Extensions of a Tool
 * that is not in the list go nowhere.
 *
 * EVERY BUILT-IN HAS A DESCRIPTION: `BUILTIN_TOOLS` is complete, and the compiler does not let a name
 * into `TOOLS` without a description. The place of an entry on the surface is held by the kit's order
 * for that surface (`INSERT_ORDER`, `BLOCK_TYPE_ORDER`, `SHORTCUT_ORDER`, `ENGINE_ORDER`), not by the
 * description. Toolbar widgets, the Bubble menu, the "…" menu, the Block handle's submenu and the image
 * popovers remain kit components and ask for the set by name (`tools.has`).
 */
export interface ToolDescriptor {
  /** The Tool's name, the same as in `tools`; a custom Tool's name has the consumer prefix. */
  name: Tool | PrefixedName;
  /**
   * Extensions: the Tool's Tiptap extensions, meaning Node, Mark, Extension and ProseMirror plugins.
   * A function of the context is a kit privilege: built-ins need the bridges of `RichTextEditor` (the
   * link popover, the Slash menu, `Alt+F10`). The second argument is this Editor's Options (`options`),
   * if it has any.
   */
  engine?: (context: ToolEngineContext, options?: object) => Extensions;
  /**
   * The StarterKit share: the `StarterKit.configure` keys that switch on the Tool's Blocks and Marks
   * (`bold: {}`, `heading: { levels }`). A kit privilege. The shares of all descriptions are merged
   * into ONE `StarterKit` (`extensions.ts`): this keeps the order of Marks in the saved HTML and the
   * list of engine packages the same as with the whole StarterKit. A key that is in no share is
   * switched off.
   */
  starterKit?: (context: ToolEngineContext) => Partial<StarterKitOptions>;
  /**
   * The loader of Extensions (`toolLoader.ts`): the engine is created after the loaders of all the
   * descriptions in the list have run, and `engine` reads the value that `loaded` returned.
   */
  load?: ToolLoader;
  /**
   * The shape of Blocks for the Skeleton while the loader has not finished (`skeleton.ts`): light
   * nodes with the same markup and the same attribute parsing, without plugins and heavy packages. A
   * privilege of a lazy built-in: without it its Blocks show up as text in the Skeleton, and the field
   * jumps in height when the chunk arrives.
   */
  skeleton?: () => Extensions;
  /** Block traits by node name; the kit copies them into the node spec. None means an ordinary Block. */
  blocks?: Readonly<Record<string, BlockTraits>>;

  /* Options. */

  /**
   * Default Options of a built-in Tool: the complete set of fields, from which `tool()` changes the ones
   * it needs. None means the Tool has no Options. The field is the internal shape: the public Options of
   * a custom Tool are set by `defineTool` (`defaults`).
   */
  defaults?: object;
  /**
   * Checks of Option values by field name, one for each field of `defaults`. A value that fails its check
   * is replaced with the default (`expandTools`): a JavaScript consumer bypasses the types of the
   * `RichTextTools` map.
   */
  checks?: Readonly<Record<string, (value: unknown) => boolean>>;
  /**
   * This Editor's Options: the defaults merged with `tool()`. `expandTools` sets it when the set is
   * assembled, so the description in the registry is shared by all Editors, while this field is each
   * Editor's own in its list. Read once, together with the set.
   */
  options?: object;

  /* UI entries. */

  /**
   * Toolbar buttons (the fixed and the floating Toolbar share one set), flagged, and the Bubble menu. The
   * place of a built-in button on the Toolbar is a kit privilege: the Toolbar places it by the Tool's name
   * (`EditorToolbar.tsx`).
   */
  buttons?: readonly KitToolButton[];
  /** Slash menu items: "/", "+", "Add ›" and the Block handle's "Format ›". */
  insertItems?: readonly InsertItem[];
  /** Block actions in the Block handle menu. */
  blockActions?: readonly BlockAction[];
  /** Text cards: built-ins have none yet, but the shape is one (ADR-0058, item 7.6). */
  textCards?: readonly TextCardRecord[];
  /** Trigger characters: built-ins have none; a custom Tool has one (ADR-0064). */
  triggers?: readonly TriggerRecord[];

  /**
   * The public description of a custom Tool that this one is built from (`customToolEngine.ts`): the set
   * is checked against it when it is assembled.
   */
  custom?: CustomTool;

  /* Kit privileges. */

  /**
   * The Schema tags of the kit that the Tool writes (`p`, `h1`–`h4`, `a`, `table`…). A custom Tool does
   * not get them: its HTML is `data-block` and `data-mark`.
   */
  kitTags?: readonly string[];
  /**
   * The content model: nodes that the Document names individually, rather than through the `block` group.
   * These are top-level containers, such as the Column layout and the Wrapper (`document.ts`).
   */
  documentContent?: readonly string[];
  /** Items of the "¶" Toolbar widget: it has its own labels and icons (`blockTypes.ts`). */
  blockTypes?: readonly BlockTypeItem[];
  /**
   * Rows of the shortcut reference for keys that Extensions bind (`shortcuts.ts`): for an entry, the
   * shortcut is its field; a Mark from the engine has none.
   */
  shortcuts?: readonly ShortcutCommand[];

  /* Commands. */

  /**
   * The Tool's commands: what `handle.tool(name)` hands to the screen. Called on every access to the
   * Handle, so it must be cheap: only wrappers over the engine and the bridge, with no subscriptions and
   * no state. None means the Tool has no commands, and `handle.tool(name)` returns `null`.
   */
  commands?: (context: ToolCommandsContext) => object;

  /* State. */

  /**
   * The Tool's state: a snapshot for `useRichTextToolState(ref, name)`. The hook calls it on every
   * transaction and every read, so it is fast and free of side effects. It exists only for a custom Tool
   * (`defineTool`): the hook keeps the snapshots of built-ins itself (`SNAPSHOTS`), so that Find and the
   * Table of contents do not pull their code into the Editor's initial chunk. None means the Tool has no
   * State.
   */
  state?: (editor: Editor) => unknown;
}

/** What the commands function receives from `RichTextEditor`. */
export interface ToolCommandsContext {
  /** Live engine: the function is called only when it has been created and not destroyed. */
  editor: Editor;
  /** The bridge to what `RichTextEditor` itself holds: the panels and the lazy UI. */
  bridge: ToolBridge;
}

/**
 * What the Commands of built-ins take from `RichTextEditor`: the Find panel and the core of the Table of
 * contents live in its React tree, not in the engine. Every method returns `false` when the action is
 * impossible (source mode, UI not loaded yet). A kit privilege: a custom Tool does not get the bridge.
 */
export interface ToolBridge {
  /** Open the Find panel; `query` goes straight into the field, without it the selected text is used. */
  openSearch: (replace: boolean, query?: string) => boolean;
  /** Close the Find panel and remove the highlight, without moving focus. */
  closeSearch: () => boolean;
  /** Whether source mode is open: the Document is not on screen, so it cannot be searched or replaced. */
  sourceOpen: () => boolean;
  /** Go to a Table of contents heading by its list index. */
  jumpToc: (index: number) => boolean;
}

/** A trigger character of a Tool in the descriptor list: the public entry and the owner's name for messages. */
export type TriggerRecord = CustomTrigger & { tool: string };

/**
 * What a built-in Tool's Extensions get from `RichTextEditor`: the bridges and, instead of the whole set,
 * the question `has`. The links between Tools (the heading levels with `heading1`, the Wrapper in a Column
 * layout column, clearing the format) ask it, not the list of descriptions.
 */
export type ToolEngineContext = Omit<EditorExtensionOptions, "tools"> & {
  /** Whether the kit's Tool is enabled in this Editor. */
  has: (tool: Tool) => boolean;
  /**
   * The Options of another built-in Tool of this Editor (`toolOptions`). They are needed by Tools that
   * share one node (`youtube` and `twitch` both use `video`): `engine` receives only its own Options,
   * while the shared node reads the Options of both.
   */
  optionsOf: <Name extends ConfigurableToolName>(
    name: Name
  ) => RichTextTools[Name]["options"] | undefined;
};

type EditorMessages = UiMessages["editor"];

/**
 * Block traits that only the kit understands. All are off by default: an ordinary Block is not a container,
 * has no "Turn into", and gets the formatting menu.
 */
export interface BlockTraits {
  /** A container: Blocks inside it get their own Block handle (`blockContainer` in the node spec). */
  container?: boolean;
  /** The Block can be turned into another one: the "Format ›" item of the Block handle and "¶". */
  turnInto?: boolean;
  /** An atom without the formatting menu: the Mark buttons are not shown over it. */
  plainAtom?: boolean;
}

/**
 * A label: a string, or a function of the context (ADR-0058, item 6.1). The kit calls it on render, so a
 * change of the `UiProvider` locale re-renders the entry. Built-ins also get the kit's `messages` in the
 * context: the shape of a label is the same for a custom Tool and a built-in one.
 */
export type ToolLabel = string | ((context: ToolLabelContext) => string);

export interface ToolLabelContext {
  /** Locale of `UiProvider` (`useUiLocale`). */
  locale: string;
  /** Strings of the Editor from the kit's catalog, for built-in Tools. */
  messages: EditorMessages;
}

/** The label in the current context. */
export function toolLabel(label: ToolLabel, context: ToolLabelContext): string {
  return typeof label === "string" ? label : label(context);
}

/**
 * The content of a button's popover. The kit holds the frame: the layer, the anchor, the Escape stack
 * (ADR-0041), the frame's name (the button's label), and the return of focus and selection to the
 * Document. `close` closes the popover the same way Escape does.
 */
export type ToolPopover = (props: { editor: Editor; close: () => void }) => ReactNode;

interface ToolButtonFields {
  /** Stable key, unique among the Toolbar buttons. */
  id: string;
  label: ToolLabel;
  icon: ComponentType<IconProps>;
  /**
   * Whether the button is available now. In a non-editable field the kit disables the buttons itself, so
   * there is no need to check that here.
   */
  can: (editor: Editor) => boolean;
  /** Present: a toggle button with `aria-pressed`; absent: a one-off action. */
  isActive?: (editor: Editor) => boolean;
  /** Visibility predicate by context; absent means the button is always visible. */
  isVisible?: (editor: Editor) => boolean;
  /** The button is also in the Bubble menu. */
  selectionMenu?: boolean;
  /**
   * The shortcut in the Toolbar notation (`mod`, `alt`, `shift`, a key), its only source: the kit binds the
   * key itself, writes it into the hint, `aria-keyshortcuts` and the shortcut reference.
   */
  shortcut?: readonly string[];
}

/**
 * A Toolbar button (the fixed and the floating Toolbar share one set), flagged, and the Bubble menu. The hint
 * is the label and the `Kbd` of the shortcut; `aria-pressed` appears only with `isActive`. The shape is the
 * same as that of the future public button of a custom Tool (ADR-0058, item 5).
 *
 * ACTION OR POPOVER: exactly one of the two. `run` is executed by a click and by the shortcut. `popover`
 * opens on a click at the button, and by the shortcut at the caret: the button may not be on screen at all
 * (`toolbar="none"`, a hidden floating Toolbar).
 */
export type ToolButton = ToolButtonFields &
  (
    | { run: (editor: Editor) => void; popover?: undefined }
    | { popover: ToolPopover; run?: undefined }
  );

/**
 * A built-in Tool's button: the public shape plus the kit's privileges, which a custom button does not get.
 */
export type KitToolButton = ToolButton &
  (
    | {
        /**
         * A shortcut that is bound not by the kit but by Extensions (`undoRedo` of StarterKit, `Mod-B` of a
         * Mark): only a label, that is, the hint, `aria-keyshortcuts` and a row of the reference. Mutually
         * exclusive with `shortcut`: that one both binds the key and labels it, and two bindings of one key
         * would conflict.
         */
        keys: readonly string[];
        shortcut?: undefined;
      }
    | { keys?: undefined }
  ) & {
    /**
     * The group of the shortcut reference. None means the row goes into the Tool's group without a heading,
     * after the kit's groups, as for a custom Tool.
     */
    shortcutGroup?: ShortcutGroup;
    /** The popover frame, if it is not the kit's default (for a button, by content). */
    popoverFrame?: {
      /**
       * `selection`: the frame is always at the selection, including on a button click. The popover edits the
       * selected text, and stays at it however it was opened (the link popover).
       */
      anchor?: "selection";
      /** Size and padding classes of the frame, instead of the default `w-auto p-2`. */
      className?: string;
    };
  };

/** A Block action: a menu item of the Block handle, in the Tool's section before "Delete". */
export interface BlockAction {
  id: string;
  /** Label in the `UiProvider` locale: for built-ins, a catalog string; for custom ones, a `ToolLabel`. */
  label: (messages: EditorMessages, locale: string) => string;
  icon: ComponentType<IconProps>;
  /**
   * Block names for which the action is shown: the name of the handle's Block, or of the container it stands
   * in directly (`blockContainer` in the node spec). This way "Remove wrapper" with `["wrapper"]` is on the
   * Wrapper itself and on the Block inside it.
   */
  blocks: readonly string[];
  /**
   * A shortcut that the kit binds, on the Block under the caret, for which the action is visible. Built-ins
   * have none.
   */
  shortcut?: readonly string[];
  /** `pos` is the position of the handle's Block in the Document. */
  run: (editor: Editor, pos: number) => void;
  /**
   * A custom Tool's popover on a Block (ADR-0058, item 5.6). The `run` of such an action opens it: the Block
   * handle's menu and the shortcut know nothing about the popover.
   */
  popover?: (props: { editor: Editor; close: () => void; pos: number }) => ReactNode;
  isVisible?: (editor: Editor, pos: number) => boolean;
}

/**
 * A text card: a range at the caret and a body. The kit holds the frame (`TextCard.tsx`, ADR-0058,
 * items 7.6–7.11).
 */
export interface TextCardRecord {
  id: string;
  /** Label in the `UiProvider` locale: the accessible name of the frame and part of the phrase about its appearance. */
  label: (messages: EditorMessages, locale: string) => string;
  rangeAt: TextCardRangeAt;
  render: CustomTextCardRender;
}

/**
 * The expanded set of Tools: the list of descriptions and, as a `Set`, the names of the kit's enabled Tools.
 *
 * The set of names is also a projection of the list: kit widgets that ask the set by name (`tools.has("table")`)
 * read it without changes. Custom Tools are only in the list of descriptions.
 */
export interface ToolList extends ReadonlySet<Tool> {
  /**
   * A set-assembly error found before the engine: two `tool()` entries with one name. The Editor shows it the
   * same way as the errors of custom Tools (`customToolsError`): as a field line, and as `console.error` in
   * development.
   */
  readonly error?: string;
  /**
   * Descriptions of the enabled Tools: built-ins in the kit's order, followed by custom ones in the order of
   * `tools`.
   */
  readonly descriptors: readonly ToolDescriptor[];
}

/**
 * A set built from kit names and a list of descriptions. It is the only way to build one: expand `tools`
 * (`expandTools`) or narrow a ready one (the Skeleton).
 */
export function toolList(
  names: Iterable<Tool>,
  descriptors: readonly ToolDescriptor[],
  error?: string
): ToolList {
  return Object.assign(new Set(names), { descriptors, ...(error !== undefined && { error }) });
}

/**
 * Options of a built-in Tool for this Editor: the kit's defaults merged with `tool()`. If the Tool is not in
 * the set, or has no Options, the result is `undefined`.
 */
export function toolOptions<Name extends ConfigurableToolName>(
  tools: ToolList,
  name: Name
): RichTextTools[Name]["options"] | undefined {
  const descriptor = tools.descriptors.find((candidate) => candidate.name === name);
  return descriptor?.options as RichTextTools[Name]["options"] | undefined;
}

/**
 * The Block actions of the set: a projection of the list of descriptions, in the kit's order. There is no
 * filter by Block here: the name and the visibility predicate are checked by the handle's menu on its own
 * Block (`blockActionVisible`).
 */
export function blockActionsOf(tools: ToolList): readonly BlockAction[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.blockActions ?? []);
}

/**
 * The text cards of the set in list order: for equal range width, the one that comes first wins, that is,
 * the Tool that is earlier in `tools`.
 */
export function textCardsOf(tools: ToolList): readonly TextCardRecord[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.textCards ?? []);
}

/** The trigger characters of the set in list order (ADR-0064). */
export function triggersOf(tools: ToolList): readonly TriggerRecord[] {
  return tools.descriptors.flatMap((descriptor) => descriptor.triggers ?? []);
}

/**
 * Whether the action is shown at Block `pos`: `block` is the name of this Block, `container` is the name of
 * the container it stands in directly (for the Document's own Block, that is the Document itself).
 */
export function blockActionVisible(
  action: BlockAction,
  editor: Editor,
  pos: number,
  block: { name: string; container: string }
): boolean {
  return (
    (action.blocks.includes(block.name) || action.blocks.includes(block.container)) &&
    (action.isVisible?.(editor, pos) ?? true)
  );
}

/**
 * The entries of one surface, a projection of the list of descriptions.
 *
 * - `order` is the place of the built-in Tools on the surface, a kit privilege. The set's Tools that are not
 *   in it follow, in list order: this is how an entry with no place of its own on the surface lands.
 * - `own` is the field of a description with that surface's entries.
 *
 * There is no filter by enabled Tools here: the list itself holds it.
 */
export function projectRecords<R>(
  tools: ToolList,
  order: readonly Tool[],
  own: (descriptor: ToolDescriptor) => readonly R[] | undefined
): R[] {
  const list = tools.descriptors;
  const placed = order.flatMap((name) => list.filter((descriptor) => descriptor.name === name));
  const rest = list.filter((descriptor) => !(order as readonly string[]).includes(descriptor.name));
  return [...placed, ...rest].flatMap((descriptor) => own(descriptor) ?? []);
}

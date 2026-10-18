"use client";

// Provenance: minimal-tiptap, `hooks/use-minimal-tiptap.ts`, the `createExtensions` function
// (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap). The StarterKit core and
// Placeholder are kept; images, files, color, tables and Markdown will arrive in separate
// slices. The license is in NOTICE at the package root.

import { Extension, type Extensions } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Placeholder } from "@tiptap/extensions";
import { StarterKit, type StarterKitOptions } from "@tiptap/starter-kit";
import type { EditorQuoteSet } from "../../i18n/messages.js";
import { AtomText } from "./atomText.js";
import { BlockCommands, BlockMenuKey } from "./blockCommands.js";
import { FieldNoticeExtension, type FieldNoticeOptions } from "./fieldNotice.js";
import type { RichImageOptions } from "../features/image/image.js";
import { createDocumentNode } from "./document.js";
import { createMarkdown, MarkdownPaste } from "./markdown.js";
import { FormulasAsText } from "../features/mathematics/mathAsText.js";
import { MaxLength } from "./maxLength.js";
import { TriggerCommand, type SlashBridge, type TriggerBinding } from "./slashCommand.js";
import {
  toolOptions,
  type BlockTraits,
  type ToolDescriptor,
  type ToolEngineContext,
  type ToolList,
} from "./toolDescriptor.js";
import { ToolButtons, type ToolPopoverEntry, type ToolPopoverRequest } from "./toolButtons.js";
import { ToolEntryShortcuts } from "./toolEntryShortcuts.js";
import type { Tool } from "./tools.js";

export interface EditorExtensionOptions {
  /** Enabled Tools. A disabled Tool does not reach the Schema at all. */
  tools: ToolList;
  /** The placeholder is read on every show: a locale change does not recreate the engine. */
  placeholder: () => string;
  /** Character limit; `undefined` means no limit. Read on every transaction. */
  limit: () => number | undefined;
  /** Name of the checkbox of a Task list item, from the catalog; read on every re-render of the item. */
  taskCheckbox: (text: string) => string;
  /**
   * Name of the toggle button of a Details Block, looked up by the text of its title, from the
   * catalog; read on every re-render of the button.
   */
  detailsToggle: (text: string) => string;
  /**
   * Quotation marks for the message catalog language (`UiMessages.editor.typographyQuotes`) for the
   * `typography` Tool with the `quotes: "auto"` option. Read on every quote typed: a catalog
   * change does not recreate the engine.
   */
  quoteSet: () => EditorQuoteSet;
  /**
   * The interface locale (`UiProvider`): the `language` Tool's last fallback for the page's primary
   * language when no ancestor of the field has a `lang`. Read when asked: a locale change does not
   * recreate the engine.
   */
  locale: () => string;
  /**
   * Bridge to the Slash menu, opened by `/`. Without it the menu does not open: the `insertMenu`
   * Tool is disabled or has no items for it.
   */
  slash?: SlashBridge;
  /**
   * Trigger characters of custom Tools and bridges to their lists (ADR-0064). Absent or empty
   * means there are no custom triggers; they do not depend on the Slash menu.
   */
  triggers?: readonly TriggerBinding[];
  /**
   * Open the popover of a description entry at the selection or at a Block: a button shortcut,
   * the link button, an Insert item and a Block action with a popover. The popover is held by
   * `RichTextEditor`.
   */
  openPopover: (request: ToolPopoverRequest) => void;
  /** Move focus to the Toolbar (`Alt+F10`); `false` means there is no Toolbar and the key goes on. */
  focusToolbar: () => boolean;
  /** Open the Block handle menu (`Mod+/`); `false` means there is no handle and the key goes on. */
  openBlockMenu: () => boolean;
  /**
   * Image: the popover, the uploader and the file messages are held by `RichTextEditor`. Absent
   * means there is no image in the Schema, even with the Tool enabled.
   */
  image?: RichImageOptions;
  /** Field notice (`showNotice`): the state is held by `RichTextEditor`. */
  onNotice: FieldNoticeOptions["onNotice"];
  /**
   * Open the search panel (`Mod+F`, `Mod+Alt+F`); `replace` puts focus in the replace field. The
   * panel is held by `RichTextEditor`; `false` means there is no panel, and the key goes to the
   * browser.
   */
  openSearch?: (replace: boolean) => boolean;
}

/**
 * `Alt+F10` moves focus from the Document to the Toolbar. CKEditor, TinyMCE and Google Docs work
 * this way (`Alt+F10` / `Alt+/`): the WAI-ARIA APG has no shortcut of its own, and keyboard users
 * are more familiar with one shortcut across editors than with a different one in each. Tab does not
 * work for this: inside the Document it moves a list item.
 */
const ToolbarFocus = Extension.create<{ focus: () => boolean }>({
  name: "toolbarFocus",
  addOptions: () => ({ focus: () => false }),
  addKeyboardShortcuts() {
    return { "Alt-F10": () => this.options.focus() };
  },
});

/**
 * A Tab that the Document has taken does not reach the window around the Editor.
 *
 * In the Document, Tab is taken: it moves a list item, walks table cells and the columns of a
 * Column layout. But Radix's focus trap in `Dialog` and `Drawer` listens for Tab on its own
 * container and, when the Editor is the last field in the window, moves focus to the first one
 * without checking `defaultPrevented`: the caret is already in the next column, while focus is on
 * the "Close" button. So a Tab taken by the Document does not bubble any further. The listener sits
 * in the plugin view: it is created after ProseMirror's handlers and sees whether they took the
 * key. A Tab that the Document let go (the edge of a Column layout, a paragraph outside a list)
 * reaches the window as usual.
 */
const HandledTabStaysInside = Extension.create({
  name: "handledTabStaysInside",
  addProseMirrorPlugins: () => [
    new Plugin({
      key: new PluginKey("handledTabStaysInside"),
      view(view) {
        const keep = (event: KeyboardEvent) => {
          if (event.key === "Tab" && event.defaultPrevented) event.stopPropagation();
        };
        view.dom.addEventListener("keydown", keep);
        return { destroy: () => view.dom.removeEventListener("keydown", keep) };
      },
    }),
  ],
});

/**
 * Block traits of the descriptions (`blocks`), in the node spec of the Schema: `blockContainer`,
 * `turnInto` and `plainAtom`, which the Block handle and the Bubble menu read. An extension with no
 * markup of its own: Tiptap calls `extendNodeSchema` for every node in the set, and the trait finds
 * its own node by name. No traits, no extension.
 */
function blockTraitsExtension(traits: Readonly<Record<string, BlockTraits>>) {
  return Extension.create({
    name: "blockTraits",
    extendNodeSchema: (extension) => {
      const own = Object.hasOwn(traits, extension.name) ? traits[extension.name] : undefined;
      return own
        ? {
            blockContainer: own.container === true,
            turnInto: own.turnInto === true,
            plainAtom: own.plainAtom === true,
          }
        : {};
    },
  });
}

/**
 * StarterKit keys that belong to Tools. All are off until a description's share (`starterKit`)
 * turns them on: a Mark that is not in the set does not reach the Schema. The quote (blockquote),
 * horizontal rule, code block and link are the kit's own extensions, and `trailingNode` is always
 * off (see above). The Document, paragraph, text, hard break, list item, its keys and the gap and
 * drop cursors stay at their StarterKit defaults: they are in any set.
 */
const STARTER_KIT_OFF: Partial<StarterKitOptions> = {
  heading: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  bulletList: false,
  orderedList: false,
  undoRedo: false,
  blockquote: false,
  codeBlock: false,
  horizontalRule: false,
  link: false,
  trailingNode: false,
};

/** Position of the trigger characters in `ENGINE_ORDER`: they are not a Tool, but they keep the order. */
const TRIGGERS = "triggers";

/**
 * REGISTRATION ORDER of the built-in Tools' Extensions is a privilege of the kit, like the order of
 * surfaces; a description does not set it. It determines:
 *
 * - **Mark rank**, and with it the nesting of Marks in the saved HTML;
 * - **paste and drop** (ADR-0058, item 9.5): Tiptap's ProseMirror plugins run in reverse
 *   registration order at equal `priority`, so the one registered last is asked first. Custom Tools
 *   come after the built-in ones (`expandTools`), so the `transformPastedHTML`, `transformPasted`,
 *   `handlePaste` and `handleDrop` of a custom Tool see the event first and can take it. A built-in
 *   plugin must not get a `priority` above 100 without changing this rule;
 * - **keys**: `Enter`, `Backspace` and the arrows of a Details Block (`details`) act only in its
 *   title and in the empty end of its content, so they do not compete with the keys of other
 *   Blocks. It stands right after the containers (Column layout, Wrapper): later than the core and
 *   StarterKit, so it is asked before them. `Enter` in the title goes to the content and does not
 *   split the title in two;
 * - **keys**: the `Alt+F10` of the code block (`codeBlockTool.ts`) is registered after
 *   `ToolbarFocus` and is asked first; Tab in a table is asked before the Column layout.
 *
 * The list keeps the order that the built-in Tools had before they moved to descriptions: the
 * golden tests (`rich-text-editor-golden.test.tsx`) pin the saved HTML and the keys. Marks and
 * Blocks from StarterKit are registered by StarterKit itself, in its own order.
 */
const ENGINE_ORDER: readonly (Tool | typeof TRIGGERS)[] = [
  "superscript",
  "subscript",
  "color",
  "highlight",
  "language",
  "align",
  "taskList",
  "image",
  "layout",
  "wrapper",
  "details",
  "mathematics",
  "insertMenu",
  TRIGGERS,
  "history",
  "heading",
  "heading1",
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "clearFormatting",
  "link",
  "bulletList",
  "orderedList",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "table",
  "youtube",
  "twitch",
  "emoji",
  "typography",
  "pasteCleanup",
  "source",
  "search",
  "invisibleCharacters",
  "toc",
];

/**
 * The extension set is the Schema in code: what is not registered here, ProseMirror cannot parse
 * from `value` or from the clipboard. The allowlist as data, matching the full set, lives in
 * `schema.ts`.
 *
 * A DISABLED TOOL IS A DISABLED EXTENSION. Along with the node or Mark go its keyboard shortcut, its
 * Markdown shortcut and its paste parsing rule: such a Block cannot be obtained by any means (spec,
 * "Tool set"). Tools without an extension of their own (`clearFormatting`) remove only the button.
 *
 * Differences from the original, each one about keeping the value clean:
 *
 * - **No `HTMLAttributes: { class: "…-node" }`** on the nodes. The original put classes there for
 *   its own styles, and they ended up in the saved HTML, that is, in the consumer's database and in
 *   its sanitizer allowlist. The typography lives on the container (`prose.ts`) and finds tags by
 *   name.
 * - **`trailingNode: false`.** The extension appends an empty paragraph after a heading, list or
 *   quote at the end, and every such document came out with a `<p></p>` tail.
 * - **The link is the kit's own extension** (`link.ts`), not `link` from StarterKit: that one would
 *   let through `target`, `class` and relative addresses.
 * - **The code block is the kit's own extension** (`codeBlock.ts`), not `codeBlock` from StarterKit:
 *   the language comes from `codeLanguages.ts` and the highlighting comes from lowlight decorations
 *   (ADR-0051). Only `class="language-*"` on `<code>` still goes into the Document. Like the table,
 *   it arrives from the description through lazy Extensions (`codeBlockTool.ts`, `tableTool.ts`).
 */
export function createEditorExtensions(options: EditorExtensionOptions): Extensions {
  /*
    The engine is a projection of the list of descriptions (`toolDescriptor.ts`): a Tool's
    Extensions are taken from its description. Links between Tools (heading levels, a Wrapper in a
    column) ask the context's `has`.
  */
  const described = options.tools.descriptors;
  // Without the set itself: links between Tools go only through `has`.
  const { tools, ...bridges } = options;
  const context: ToolEngineContext = {
    ...bridges,
    has: (tool) => tools.has(tool),
    optionsOf: (name) => toolOptions(tools, name),
  };
  // Top-level container Blocks: only their own Document accepts them.
  const containers = described.flatMap((descriptor) => descriptor.documentContent ?? []);

  const extensions: Extensions = [
    StarterKit.configure({
      ...STARTER_KIT_OFF,
      // Description shares go into one StarterKit: its Mark order does not change.
      ...Object.assign({}, ...described.map((descriptor) => descriptor.starterKit?.(context))),
      // With a Column layout or a Wrapper the Document is custom (`document.ts`): they are not in
      // the `block` group, and only a node that names them by name can accept them.
      document: containers.length > 0 ? false : undefined,
    }),
    ...(containers.length > 0 ? [createDocumentNode(containers)] : []),
    Placeholder.configure({ placeholder: () => options.placeholder() }),
    // Comes after the Blocks and Marks: Markdown collects its rules from the extensions registered
    // by the time it starts.
    createMarkdown(),
    MarkdownPaste,
    MaxLength.configure({ limit: options.limit }),
    // `leafText` from `renderText`: the Atom text for the counter, copying and `textContent`.
    AtomText,
    // Without the `mathematics` Tool, a formula from `value` and from paste is read as `$…$` text,
    // instead of disappearing together with an empty element (`mathAsText.ts`).
    ...(options.tools.has("mathematics") ? [] : [FormulasAsText]),
    ToolbarFocus.configure({ focus: options.focusToolbar }),
    HandledTabStaysInside,
    // Commands over Blocks have no markup of their own and are always on (`blockCommands.ts`).
    // After the Tiptap core: its `Mod+A` (the whole Document) is asked later than ours.
    BlockCommands.configure({ clearFormatting: options.tools.has("clearFormatting") }),
    // `⌘/` — the Block handle menu, opened from the keyboard, runs before the Mark keymaps
    // (`blockCommands.ts`).
    BlockMenuKey.configure({ openBlockMenu: options.openBlockMenu }),
    // `showNotice` — in every Editor: any Tool can report through it (`fieldNotice.ts`).
    FieldNoticeExtension.configure({ onNotice: options.onNotice }),
  ];
  // Block traits of the descriptions (`blocks`) — one extension for the whole set.
  const traits: Record<string, BlockTraits> = Object.assign(
    {},
    ...described.map((descriptor) => descriptor.blocks)
  );
  if (Object.keys(traits).length > 0) extensions.push(blockTraitsExtension(traits));
  // Extensions of the built-in Tools go in the kit's order; custom ones follow in list order.
  const engineOf = (descriptor: ToolDescriptor) =>
    descriptor.engine?.(context, descriptor.options) ?? [];
  for (const slot of ENGINE_ORDER) {
    if (slot === TRIGGERS) {
      if (options.triggers?.length) {
        extensions.push(TriggerCommand.configure({ triggers: options.triggers }));
      }
      continue;
    }
    const descriptor = described.find((candidate) => candidate.name === slot);
    if (descriptor) extensions.push(...engineOf(descriptor));
  }
  for (const descriptor of described) {
    if (!(ENGINE_ORDER as readonly string[]).includes(descriptor.name)) {
      extensions.push(...engineOf(descriptor));
    }
  }
  // The kit binds the button shortcuts of the descriptions: the entry field is their only source.
  const buttons = described.flatMap((descriptor) => descriptor.buttons ?? []);
  // The popover of an Insert item and of a Block action is opened by the same command as the button's.
  const entries = described
    .flatMap((descriptor) => [
      ...(descriptor.insertItems ?? []),
      ...(descriptor.blockActions ?? []),
    ])
    .flatMap(({ id, label, popover }): ToolPopoverEntry[] =>
      popover ? [{ id, label: ({ messages, locale }) => label(messages, locale), popover }] : []
    );
  // A button with no shortcut and no popover (undo, image) needs no extension: its `run` is called
  // by the Toolbar. This way the extension set does not change because the button moved into the
  // description.
  const keyed = buttons.filter((button) => button.shortcut || button.popover);
  if (keyed.length + entries.length > 0) {
    extensions.push(
      ToolButtons.configure({ buttons: keyed, entries, openPopover: options.openPopover })
    );
  }
  // The same goes for Insert items and Block actions.
  const keyedItems = described.flatMap((d) => d.insertItems ?? []).filter((i) => i.shortcut);
  const keyedActions = described.flatMap((d) => d.blockActions ?? []).filter((a) => a.shortcut);
  if (keyedItems.length + keyedActions.length > 0) {
    extensions.push(
      ToolEntryShortcuts.configure({ insertItems: keyedItems, blockActions: keyedActions })
    );
  }
  // One extension shared by two descriptions (the common `video` node) is registered once.
  return [...new Set(extensions)];
}

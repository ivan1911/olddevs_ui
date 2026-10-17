import { Extension, Mark, Node, type Editor, type Extensions } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { createElement, useState } from "react";
import { markRange, type CustomIslandProps, type CustomTool } from "../src/editor/index.js";
import { ImageIcon, PinIcon, SparkleIcon, TagIcon, WrapperIcon } from "../src/icons.js";

/**
 * Custom test Tools of the OLDSUI-98 epic: a shared helper for the tests.
 *
 * The `test_` prefix marks a check of the public API, not new kit Blocks. Each
 * Tool has its own variable, so a test takes exactly what it needs, and `TEST_TOOLS` is
 * the whole set. The Extensions are written the way a consumer would write them from the
 * component page: Node and Mark without `parseHTML`, `renderHTML`, `group` and
 * attribute parsing; the kit takes all of that from the Schema rules.
 *
 * Later slices add their own here (a Mark with a Text card, a Tool without a Block and with
 * a paste filter, a Tool with a Loader) instead of creating copies.
 */

/** Inline atom — Merge Tag: `{{key}}` as the atom's text, the key as a pattern. */
export const testMergeTagNode = Node.create({
  name: "test_mergeTag",
  atom: true,
  selectable: true,
  addAttributes: () => ({ test_key: { default: null } }),
  renderText: ({ node }) => `{{${String(node.attrs.test_key ?? "")}}}`,
});

export const testMergeTagTool: CustomTool = {
  name: "test_mergeTag",
  engine: [testMergeTagNode],
  blocks: {
    test_mergeTag: {
      kind: "inline",
      attributes: { test_key: { kind: "pattern", pattern: "[a-z_]+" } },
    },
  },
};

/** Container Block — like a Wrapper: the Blocks inside get their own Block handle. */
export const testBoxNode = Node.create({
  name: "test_box",
  content: "block+",
  isolating: true,
});

export const testBoxTool: CustomTool = {
  name: "test_box",
  engine: [testBoxNode],
  blocks: { test_box: { kind: "block", container: true } },
  // "Add" item: an empty box with a paragraph; the label is localized, the shortcut is a field of the item.
  insertItems: [
    {
      section: "insert",
      // The label is a function of the context: the UiProvider locale is visible in the label itself.
      label: ({ locale }) => `Box ${locale}`,
      icon: WrapperIcon,
      aliases: ["crate", "bin"],
      shortcut: ["mod", "alt", "B"],
      run: (chain) => chain.insertContent({ type: "test_box", content: [{ type: "paragraph" }] }),
    },
  ],
  // Block action: shown on the box and on the Block inside it.
  blockActions: [
    {
      label: "Unbox",
      icon: WrapperIcon,
      blocks: ["test_box"],
      shortcut: ["mod", "alt", "U"],
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            // The position is the Block the handle points to: the box itself or a Block inside it; the box is unwrapped.
            const $pos = tr.doc.resolve(pos);
            const depth = $pos.parent.type.name === "test_box" ? $pos.depth : -1;
            const from = depth < 0 ? pos : $pos.before(depth);
            const box = tr.doc.nodeAt(from);
            if (box?.type.name === "test_box")
              tr.replaceWith(from, from + box.nodeSize, box.content);
            return true;
          })
          .run(),
    },
  ],
};

/**
 * Block with attributes of three value kinds and no Block traits: size as a list,
 * code as a pattern, address by the kit's URL protocol policy. The Node does not
 * declare its own attributes: the kit adds them by the rules.
 */
export const testCardNode = Node.create({
  name: "test_card",
  content: "inline*",
});

export const testCardTool: CustomTool = {
  name: "test_card",
  engine: [testCardNode],
  blocks: {
    test_card: {
      kind: "block",
      attributes: {
        test_size: { kind: "list", values: ["s", "m", "l"] },
        test_code: { kind: "pattern", pattern: "[0-9]{3}" },
        test_href: { kind: "url" },
      },
    },
  },
  // "Turn into" item: the current Block becomes a card; the label is a plain string.
  insertItems: [
    {
      section: "turnInto",
      label: "Card",
      icon: ImageIcon,
      aliases: ["tile"],
      shortcut: ["mod", "alt", "K"],
      run: (chain) => chain.setNode("test_card"),
    },
  ],
  // Block action with a visibility predicate: "Enlarge" is shown while the size is not `l`.
  blockActions: [
    {
      label: "Enlarge",
      icon: ImageIcon,
      blocks: ["test_card"],
      isVisible: (editor, pos) => editor.state.doc.nodeAt(pos)?.attrs.test_size !== "l",
      run: (editor, pos) =>
        void editor
          .chain()
          .focus()
          .command(({ tr }) => {
            const card = tr.doc.nodeAt(pos);
            if (card) tr.setNodeMarkup(pos, undefined, { ...card.attrs, test_size: "l" });
            return true;
          })
          .run(),
    },
  ],
};

/** Custom Mark — a margin note with an author. */
export const testNoteMark = Mark.create({
  name: "test_note",
  addAttributes: () => ({ test_author: { default: null } }),
});

export const testNoteTool: CustomTool = {
  name: "test_note",
  engine: [testNoteMark],
  marks: {
    test_note: { attributes: { test_author: { kind: "pattern", pattern: "[A-Za-z ]+" } } },
  },
};

/**
 * A Tool without a Block: a paste filter and file interception. Only Extensions
 * (`Extension`), no Block and no Mark: behavior, not markup.
 *
 * The `transformPastedHTML` filter appends foreign markup to the paste
 * (`<script>`, `onclick`): the Schema parses it by its own rules anyway.
 * `handlePaste` and `handleDrop` take a PDF whole and pass it to `onFile`;
 * other files are left alone, they go on to the kit.
 */
export interface TestPasteFilterOptions {
  /** The file the Tool took: by paste (`paste`) or by drag and drop (`drop`). */
  onFile?: (file: File, via: "paste" | "drop") => void;
  /** Order of calls to the Tool's handlers, to check the sequence. */
  trace?: string[];
}

const isPdf = (file: File) => file.type === "application/pdf";

export function testPasteFilterTool(options: TestPasteFilterOptions = {}): CustomTool {
  const filter = Extension.create({
    name: "test_pasteFilter",
    addProseMirrorPlugins: () => [
      new Plugin({
        key: new PluginKey("test_pasteFilter"),
        props: {
          transformPastedHTML(html) {
            options.trace?.push("transformPastedHTML");
            return `${html}<script>alert(1)</script><p onclick="steal()">added</p>`;
          },
          handlePaste(view, event) {
            options.trace?.push("handlePaste");
            // `!!text` — the paste goes in its own transaction, without the `paste` meta flag.
            const own = /^!!(.+)$/.exec(event.clipboardData?.getData("text/plain") ?? "")?.[1];
            if (own !== undefined) {
              view.dispatch(view.state.tr.insertText(own));
              event.preventDefault();
              return true;
            }
            const pdf = Array.from(event.clipboardData?.files ?? []).find(isPdf);
            if (!pdf) return false;
            options.onFile?.(pdf, "paste");
            event.preventDefault();
            return true;
          },
          handleDrop(_view, event) {
            options.trace?.push("handleDrop");
            const pdf = Array.from(event.dataTransfer?.files ?? []).find(isPdf);
            if (!pdf) return false;
            options.onFile?.(pdf, "drop");
            event.preventDefault();
            return true;
          },
        },
      }),
    ],
  });
  return { name: "test_pasteFilter", engine: [filter] };
}

/**
 * An atom Block without Atom text: a video. It has no `renderText`, so in the Document it is
 * "empty text, but content" (OLDSUI-109). The same node is inserted by link
 * (`testVideoLinkTool`, OLDSUI-108): a video address pasted as text becomes a `test_video`
 * Block, ahead of the built-in paste and Markdown. The paste goes in its own transaction
 * without the `paste` meta: the character limit does not cut it, it rejects it whole.
 */
export const testVideoNode = Node.create({
  name: "test_video",
  atom: true,
  selectable: true,
  addAttributes: () => ({ test_id: { default: null } }),
});

const VIDEO_LINK = /https:\/\/video\.example\.com\/watch\/([a-z0-9]+)/;

export const testVideoLinkTool: CustomTool = {
  name: "test_video",
  engine: [
    testVideoNode,
    Extension.create({
      name: "test_videoPaste",
      addProseMirrorPlugins: () => [
        new Plugin({
          key: new PluginKey("test_videoPaste"),
          props: {
            handlePaste(view, event) {
              const id = VIDEO_LINK.exec(event.clipboardData?.getData("text/plain") ?? "")?.[1];
              if (!id) return false;
              view.dispatch(
                view.state.tr.replaceSelectionWith(
                  view.state.schema.nodes["test_video"]!.create({ test_id: id })
                )
              );
              event.preventDefault();
              return true;
            },
          },
        }),
      ],
    }),
  ],
  blocks: {
    test_video: {
      kind: "block",
      attributes: { test_id: { kind: "pattern", pattern: "[a-z0-9]+" } },
    },
  },
};

export const testVideoTool: CustomTool = {
  name: "test_video",
  engine: [testVideoNode],
  blocks: {
    test_video: {
      kind: "block",
      attributes: { test_id: { kind: "pattern", pattern: "[a-z0-9]+" } },
    },
  },
};

/** Atom Block with content and without `renderText`: its Atom text is the text of its children. */
export const testEmbedNode = Node.create({
  name: "test_embed",
  atom: true,
  content: "inline*",
  selectable: true,
});

export const testEmbedTool: CustomTool = {
  name: "test_embed",
  engine: [testEmbedNode],
  blocks: { test_embed: { kind: "block" } },
};

/**
 * A Block with its own Markdown rules (OLDSUI-104): the `::: text` line is handled by
 * a Tiptap tokenizer, the parser and `renderMarkdown` in the Extensions, written the way
 * a consumer would write them. Without them the kit would export the Block as plain content.
 */
export const testAsideNode = Node.create({
  name: "test_aside",
  content: "inline*",
  markdownTokenizer: {
    name: "test_aside",
    level: "block",
    start: (src: string) => src.indexOf(":::"),
    tokenize: (src, _tokens, lexer) => {
      const match = /^::: ([^\n]*)(?:\n|$)/.exec(src);
      return match
        ? {
            type: "test_aside",
            raw: match[0],
            text: match[1],
            tokens: lexer.inlineTokens(match[1]!),
          }
        : undefined;
    },
  },
  parseMarkdown: (token, helpers) =>
    helpers.createNode("test_aside", {}, helpers.parseInline(token.tokens ?? [])),
  renderMarkdown: (node, helpers) => `::: ${helpers.renderChildren(node.content ?? [])}`,
});

export const testAsideTool: CustomTool = {
  name: "test_aside",
  engine: [testAsideNode],
  blocks: { test_aside: { kind: "block" } },
};

/**
 * A Block with an Island in the View (OLDSUI-114): a player built from an address and a caption.
 * The Island draws a "Play …" button and keeps the click count as its own state, which shows
 * whether the View remounted it. Calls are written to `testPlayerCalls`: the test checks
 * that the Island did not run for a Document without such a Block.
 *
 * In a real app the Island is a component from a module with `"use client"`; in jsdom
 * the directive changes nothing, so the component lives here.
 */
export const testPlayerCalls: CustomIslandProps[] = [];

export function TestPlayerIsland(props: CustomIslandProps) {
  testPlayerCalls.push(props);
  const [plays, setPlays] = useState(0);
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "player",
      "data-src": props.attributes.test_src ?? "",
      "data-keys": Object.keys(props.attributes).sort().join(","),
      onClick: () => setPlays(plays + 1),
    },
    `Play ${props.text} ${plays}`
  );
}

export const testPlayerNode = Node.create({
  name: "test_player",
  content: "inline*",
});

export const testPlayerTool: CustomTool = {
  name: "test_player",
  engine: [testPlayerNode],
  blocks: {
    test_player: {
      kind: "block",
      attributes: {
        test_src: { kind: "url" },
        test_kind: { kind: "list", values: ["audio", "video"] },
      },
      island: TestPlayerIsland,
    },
  },
};

/** Inline Block with an Island: the Island mounts in a `span` too. */
export const testBadgeNode = Node.create({
  name: "test_badge",
  atom: true,
  inline: true,
  group: "inline",
  renderText: () => "badge",
});

export const testBadgeTool: CustomTool = {
  name: "test_badge",
  engine: [testBadgeNode],
  blocks: {
    test_badge: {
      kind: "inline",
      island: (props) => createElement("em", { "data-testid": "badge" }, `Badge ${props.block}`),
    },
  },
};

/** All test custom Tools, in `tools` order. */
export const TEST_TOOLS: readonly CustomTool[] = [
  testMergeTagTool,
  testBoxTool,
  testCardTool,
  testNoteTool,
  testVideoTool,
  testEmbedTool,
];

/**
 * Tools with buttons (OLDSUI-105) are not in `TEST_TOOLS`: a button changes the Toolbar,
 * and tests that do not expect it keep the old one. A test takes the one it needs.
 */

/** The caret is in text: there is room to insert. */
const inText = (editor: Editor) => editor.state.selection.$to.parent.inlineContent;

/**
 * An action button: inserts "★" at the caret. The shortcut is a field of the button, and the kit
 * binds the key; the Extensions bind their own key (`Mod-Shift-K`) as well, which must not
 * appear in the Reference.
 */
export const testStampTool: CustomTool = {
  name: "test_stamp",
  engine: [
    Extension.create({
      name: "test_stampKeys",
      addKeyboardShortcuts: () => ({ "Mod-Shift-K": () => true }),
    }),
  ],
  buttons: [
    {
      id: "stamp",
      label: "Stamp",
      icon: SparkleIcon,
      can: inText,
      run: (editor) => void editor.chain().insertContent("★").run(),
      shortcut: ["mod", "shift", "Y"],
    },
  ],
};

/** Toggle Mark: `isActive` gives `aria-pressed`, `selectionMenu` places it in the Bubble menu. */
export const testPinMark = Mark.create({ name: "test_pin" });

export const testPinTool: CustomTool = {
  name: "test_pin",
  engine: [testPinMark],
  marks: { test_pin: {} },
  buttons: [
    {
      id: "pin",
      label: "Pin",
      icon: PinIcon,
      can: (editor) => editor.can().toggleMark("test_pin"),
      isActive: (editor) => editor.isActive("test_pin"),
      run: (editor) => void editor.chain().focus().toggleMark("test_pin").run(),
      selectionMenu: true,
      shortcut: ["mod", "alt", "P"],
    },
  ],
};

/**
 * Two buttons, in the order of description: "Count" is visible only over a non-empty
 * selection, "Lock" is never available (there is no `can`).
 */
export const testContextTool: CustomTool = {
  name: "test_context",
  engine: [],
  buttons: [
    {
      id: "count",
      label: "Count",
      icon: TagIcon,
      can: () => true,
      isVisible: (editor) => !editor.state.selection.empty,
      run: (editor) => void editor.chain().insertContent("#").run(),
    },
    { id: "lock", label: "Lock", icon: PinIcon, can: () => false, run: () => {} },
  ],
};

/** Label as a function of the context: a change of the `UiProvider` locale re-renders the button. */
export const testLocaleTool: CustomTool = {
  name: "test_locale",
  engine: [],
  buttons: [
    {
      id: "greet",
      label: ({ locale }) => (locale.startsWith("de") ? "Stempel" : "Stamp"),
      icon: SparkleIcon,
      can: inText,
      run: (editor) => void editor.chain().insertContent("★").run(),
      shortcut: ["mod", "shift", "G"],
    },
  ],
};

/**
 * A button with a popover: the content is a function of `editor` and `close`. The item
 * "Choose Alpha" inserts the text and closes the popover; "Dismiss" only closes it.
 */
export const testPickerTool: CustomTool = {
  name: "test_picker",
  engine: [],
  buttons: [
    {
      id: "picker",
      label: "Picker",
      icon: TagIcon,
      can: inText,
      shortcut: ["mod", "shift", "J"],
      popover: ({ editor, close }) =>
        createElement(
          "div",
          null,
          createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                editor.chain().insertContent("Alpha").run();
                close();
              },
            },
            "Choose Alpha"
          ),
          createElement("button", { type: "button", onClick: close }, "Dismiss")
        ),
    },
  ],
};

/** Content of the item's popover: "Choose Alpha" inserts the text at the caret and closes it. */
const choiceOf: NonNullable<NonNullable<CustomTool["insertItems"]>[number]["popover"]> = ({
  editor,
  close,
}) =>
  createElement(
    "button",
    {
      type: "button",
      onClick: () => {
        editor.chain().insertContent("Alpha").run();
        close();
      },
    },
    "Choose Alpha"
  );

/**
 * Insert items and a Block action with a popover (history 39): "Ask" is under "Insert",
 * "Reshape" is under "Turn into", and both insert "Alpha" at the caret.
 * "Inspect" on a paragraph shows the position of its Block and writes "Beta" at its start.
 */
export const testAskTool: CustomTool = {
  name: "test_ask",
  engine: [],
  insertItems: [
    {
      section: "insert",
      label: "Ask",
      icon: TagIcon,
      aliases: ["prompt"],
      shortcut: ["mod", "alt", "Q"],
      popover: choiceOf,
    },
    { section: "turnInto", label: "Reshape", icon: TagIcon, popover: choiceOf },
  ],
  blockActions: [
    {
      label: "Inspect",
      icon: TagIcon,
      blocks: ["paragraph"],
      shortcut: ["mod", "alt", "I"],
      popover: ({ editor, close, pos }) =>
        createElement(
          "div",
          null,
          createElement("output", null, `Block at ${pos}`),
          createElement(
            "button",
            {
              type: "button",
              onClick: () => {
                editor
                  .chain()
                  .insertContentAt(pos + 1, "Beta")
                  .run();
                close();
              },
            },
            "Prefix Beta"
          )
        ),
    },
  ],
};

/**
 * A Tool with a Loader (OLDSUI-110): the Extensions arrive as a promise
 * that the test settles itself. A factory rather than a constant: the promise is cached on
 * the loader function, and each test needs its own. `calls` is how many times the kit
 * called the Loader; `resolve` and `reject` settle the last call. `engine` replaces
 * what the Loader returns, for example Extensions that bypass the Schema rules.
 */
export function testLazyTool(name: `test_${string}` = "test_lazy", engine?: Extensions) {
  const node = Node.create({ name, content: "inline*" });
  let settle = { resolve: () => {}, reject: () => {} };
  const loader = Object.assign(
    (): Promise<Extensions> => {
      loader.calls += 1;
      return new Promise((resolve, reject) => {
        settle = {
          resolve: () => resolve(engine ?? [node]),
          reject: () => reject(new Error("chunk failed")),
        };
      });
    },
    { calls: 0 }
  );
  const tool: CustomTool = { name, engine: loader, blocks: { [name]: { kind: "block" } } };
  return { tool, loader, resolve: () => settle.resolve(), reject: () => settle.reject() };
}

/**
 * Text cards (OLDSUI-113) are not in `TEST_TOOLS`: a card opens when the caret enters
 * its range, and tests that do not expect it must not see it.
 *
 * A Mark with a Text card is a remark: `markRange` is the kit's ready-made helper for a Mark.
 * The card body shows the range (it moves with the edit) and two buttons: "Reply"
 * for focus and Tab, and "Close": `close` hides the card until the caret leaves.
 * The label is a function of the locale, so the accessible name of the frame changes with the language.
 */
export const testRemarkMark = Mark.create({ name: "test_remark" });

const textCardBody =
  (name: string): NonNullable<CustomTool["textCards"]>[number]["render"] =>
  ({ editor, range, close }) =>
    createElement(
      "div",
      null,
      createElement("p", null, `${name} ${range.from}-${range.to}`),
      createElement("button", { type: "button" }, "Reply"),
      createElement(
        "button",
        {
          type: "button",
          onClick: () => {
            close();
            editor.commands.focus();
          },
        },
        "Close"
      )
    );

export const testRemarkTool: CustomTool = {
  name: "test_remark",
  engine: [testRemarkMark],
  marks: { test_remark: {} },
  textCards: [
    {
      label: ({ locale }) => (locale.startsWith("de") ? "Anmerkung" : "Remark"),
      rangeAt: markRange("test_remark"),
      render: textCardBody("Remark"),
    },
  ],
};

/** Second Mark with a Text card: the ranges of two Tools overlap and coincide. */
export const testTopicMark = Mark.create({ name: "test_topic" });

export const testTopicTool: CustomTool = {
  name: "test_topic",
  engine: [testTopicMark],
  marks: { test_topic: {} },
  textCards: [{ label: "Topic", rangeAt: markRange("test_topic"), render: textCardBody("Topic") }],
};

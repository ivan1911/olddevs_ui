"use client";

import { Extension, Node, type Editor, type Extensions } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { DateMentionIcon } from "../../../icons.js";
import type { ToolDescriptor, ToolEngineContext } from "../../core/toolDescriptor.js";
import type { ToolPopoverRequest } from "../../core/toolButtons.js";
import type { DateToolCommands } from "../../core/toolCommands.js";
import type { DateToolOptions } from "../../core/toolOptions.js";
import { insertDate, isDateNode, selectedDate } from "./dateCommands.js";
import { renderDateForm } from "./DateFormLazy.js";
import { dateText } from "./dateFormat.js";
import { DATE_CHECKS, DATE_DEFAULTS } from "./dateOptions.js";
import { DATE_ATTRIBUTE, DATE_NODE, DATE_SELECTOR, DATE_TAG, isDatetime } from "./dateValue.js";

/*
  The date mention (ADR-0079): an inline Atom `<time datetime="…">text</time>`. The node, its
  keys and the Slash menu item are in the start bundle and weigh little; the calendar and the
  popover form are a lazy chunk behind `renderDateForm`. So there is no Loader and no Skeleton shape:
  the node is already in the Schema when the Skeleton is drawn, and the Skeleton shows the mention
  as the same `time` element with its words.
*/

/**
 * The longest text of a mention that is accepted from someone else's HTML. A `<time>` that wraps a
 * sentence is a page's markup, not a date chip: it stays ordinary text.
 */
const MAX_TEXT = 120;

/** A popover request to edit a mention: the popover stands right at it and follows it. */
function editRequest(pos: number): ToolPopoverRequest {
  return {
    label: ({ messages }) => messages.date,
    popover: ({ editor, close, pos: current }) => renderDateForm({ editor, pos: current, close }),
    block: pos,
  };
}

/** The node: `datetime` (the machine value) and `text` (what the author and the reader see). */
function dateNode(
  { locale, openPopover }: ToolEngineContext,
  format: Intl.DateTimeFormatOptions | undefined
) {
  // The Editor that hosts the node: a click edits only in an editable field.
  let host: Editor | null = null;
  const textOf = (datetime: string) => dateText(datetime, locale(), format);
  return Node.create({
    name: DATE_NODE,
    group: "inline",
    inline: true,
    atom: true,
    selectable: true,

    addStorage: () => ({ text: textOf }),

    onBeforeCreate() {
      host = this.editor;
    },

    addAttributes: () => ({
      datetime: { default: null, rendered: false },
      text: { default: "", rendered: false },
    }),

    /*
      Someone else's `<time datetime>` is an Atom only in OUR forms of `datetime` (`isDatetime`); a
      period, a year, a week or a time without an offset stays text. The words are kept as they are,
      collapsed to one line; an empty element is written by the option (decision 11). Anything long is
      page markup around a sentence, and it stays text too.
    */
    parseHTML: () => [
      {
        tag: DATE_SELECTOR,
        getAttrs: (element) => {
          const datetime = element.getAttribute(DATE_ATTRIBUTE) ?? "";
          if (!isDatetime(datetime)) return false;
          const words = (element.textContent ?? "").replace(/\s+/g, " ").trim();
          if (words.length > MAX_TEXT) return false;
          return { datetime, text: words || textOf(datetime) };
        },
      },
    ],

    renderHTML: ({ node }) => [
      DATE_TAG,
      // An invalid value from a hand-made JSON is not written: the sanitizer would cut it anyway.
      isDatetime(String(node.attrs.datetime)) ? { [DATE_ATTRIBUTE]: node.attrs.datetime } : {},
      String(node.attrs.text ?? ""),
    ],

    // The Atom text is what the reader sees: the counter, copying as text and search read it.
    renderText: ({ node }) => String(node.attrs.text ?? ""),

    addProseMirrorPlugins() {
      const edit = (pos: number) => {
        if (!host?.isEditable) return;
        // The click selects the node itself: Enter and the author who comes back need the selection.
        host.commands.setNodeSelection(pos);
        openPopover(editRequest(pos));
      };
      return [
        new Plugin({
          key: new PluginKey("dateClick"),
          props: {
            handleDOMEvents: {
              // A click on a mention opens the popover. The mention is found by its element, since
              // ProseMirror's own click handlers do not tell an inline Atom from its neighbours.
              click: (view, event) => {
                const target = event.target;
                const element = target instanceof Element ? target.closest(DATE_TAG) : null;
                if (!element || !view.dom.contains(element) || !view.editable) return false;
                // The position comes straight from the element, not from a walk over the Document.
                // For an Atom `posAtDOM` gives the position before it or right after it, and the node's
                // own DOM tells which of the two is the mention that was clicked.
                const at = view.posAtDOM(element, 0);
                const pos = [at, at - 1].find(
                  (candidate) =>
                    candidate >= 0 &&
                    view.state.doc.nodeAt(candidate)?.type.name === DATE_NODE &&
                    view.nodeDOM(candidate) === element
                );
                if (pos === undefined) return false;
                edit(pos);
                return false;
              },
            },
          },
        }),
      ];
    },
  });
}

/**
 * Keys on a mention: `Shift+→` / `Shift+←` from the caret next to it select it, and `Enter` on
 * the selected one opens the popover. The same contract as the inline formula: Chromium widens a
 * keyboard selection over `contenteditable="false"` into something Enter cannot find, so the key
 * handler selects exactly the node's range.
 */
function dateKeyboard({ openPopover }: ToolEngineContext) {
  const selectBeside = (editor: Editor, forward: boolean) => {
    const { selection } = editor.state;
    if (!selection.empty) return false;
    const { $head } = selection;
    const node = forward ? $head.nodeAfter : $head.nodeBefore;
    if (!node || !isDateNode(node)) return false;
    const head = forward ? $head.pos + node.nodeSize : $head.pos - node.nodeSize;
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, $head.pos, head))
    );
    return true;
  };
  return Extension.create({
    name: "dateKeyboard",
    addKeyboardShortcuts() {
      return {
        "Shift-ArrowRight": ({ editor }) => selectBeside(editor, true),
        "Shift-ArrowLeft": ({ editor }) => selectBeside(editor, false),
        // Enter on a selected mention, by a click or by `Shift+→`, edits it instead of splitting the paragraph.
        Enter: ({ editor }) => {
          const found = editor.isEditable ? selectedDate(editor.state) : null;
          if (!found) return false;
          openPopover(editRequest(found.pos));
          return true;
        },
      };
    },
  });
}

/**
 * The date mention on the Tool's descriptor (ADR-0079). One Slash menu item, "Date"; the inline Atom
 * `time[datetime]`; editing by a click or `Enter` in the same popover. Without a Toolbar button: a date is
 * rare enough to live in the menu, and `full` does not get a second row.
 *
 * LAZY IN PART. The popover form with the `Calendar` is a separate chunk (`DateFormLazy.tsx`); the node
 * and the item are not, because the Document may already hold mentions and the menu must show the item
 * at once. `insert(value)` needs no chunk at all.
 *
 * Without the Tool, someone else's `<time>` is read as its words (the Schema does not know the tag, and
 * the text of an unknown inline element stays): `schemaConform.ts` does the same for a JSON tree.
 */
export const DATE_TOOL: ToolDescriptor = {
  name: "date",
  defaults: DATE_DEFAULTS,
  checks: DATE_CHECKS,
  engine: (context, options): Extensions => [
    dateNode(context, (options as DateToolOptions | undefined)?.format),
    dateKeyboard(context),
  ],
  // Marks do not apply to an atom: the Bubble menu and the floating Toolbar do not surround a mention.
  blocks: { [DATE_NODE]: { plainAtom: true } },
  kitTags: [DATE_TAG],
  insertItems: [
    {
      id: "date",
      section: "insert",
      label: (m) => m.date,
      icon: DateMentionIcon,
      // The Russian words are escape sequences: the i18n gate rejects Cyrillic letters in code. They are
      // input data for the filter, so "date" and "today" in Russian find the item in an English interface too.
      aliases: [
        "date",
        "today",
        "calendar",
        "time",
        "\u0434\u0430\u0442\u0430",
        "\u0441\u0435\u0433\u043e\u0434\u043d\u044f",
      ],
      // The Document is not prepared: the popover places the mention at the caret.
      run: (chain) => chain,
      popover: ({ editor, close }) => renderDateForm({ editor, close }),
    },
  ],
  commands: ({ editor, bridge }): DateToolCommands => ({
    insert: (value) => {
      if (!editor.isEditable || bridge.sourceOpen()) return false;
      if (value === undefined) return editor.commands.openToolPopover("date");
      return insertDate(editor, value);
    },
  }),
};

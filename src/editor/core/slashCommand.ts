"use client";

import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { exitSuggestion, Suggestion } from "@tiptap/suggestion";

/** Plugin key: the menu closes the session from outside through it (`closeSlashMenu`). */
const SLASH_KEY = new PluginKey("olddevsSlashMenu");

/**
 * Plugin key of its own trigger, one for each character (ADR-0064). The `@tiptap/suggestion`
 * plugins in one state need different keys, and the session is closed from outside by the same
 * key. One key per character for the whole module: the key is an identifier, not state, and
 * different Editors share it without harm.
 */
const TRIGGER_KEYS = new Map<string, PluginKey>([["/", SLASH_KEY]]);

function triggerKey(char: string): PluginKey {
  let key = TRIGGER_KEYS.get(char);
  if (!key) {
    key = new PluginKey(`olddevsTrigger:${char}`);
    TRIGGER_KEYS.set(char, key);
  }
  return key;
}

/** Session of a trigger character: what was typed, where, and how to find the caret on screen. */
export interface SlashSession {
  /** What was typed after the character, without the character itself. */
  query: string;
  /** The `character+query` range in the document; the selected item replaces it. */
  range: Range;
  /** The rectangle of the typed text on screen: the menu's anchor. */
  rect: () => DOMRect | null;
}

/**
 * Bridge between the plugin and React. The extension lives as long as the engine, while the menu
 * is a component, so the bridge is an object with replaceable fields rather than callbacks in the
 * options: the engine cannot be recreated for a new handler.
 */
export interface SlashBridge {
  open: (session: SlashSession) => void;
  close: () => void;
  /**
   * Key press while the menu is open. `true` means the menu consumed it, so the engine does not need
   * it.
   */
  keyDown: (event: KeyboardEvent) => boolean;
}

/** Closes the `/` session, leaving the typed text in place (Escape, click outside). */
export function closeSlashMenu(view: Parameters<typeof exitSuggestion>[0]): void {
  exitSuggestion(view, SLASH_KEY);
}

/** Closes the session of its own trigger `char`, leaving the typed text in place. */
export function closeTrigger(view: Parameters<typeof exitSuggestion>[0], char: string): void {
  exitSuggestion(view, triggerKey(char));
}

/**
 * Plugin of a trigger character: the common mechanics of `/` and of custom characters. Matching is
 * `@tiptap/suggestion`'s: the character at the start of a Block or after a space, and the query
 * runs up to the next space. Inside a word (`and/or`, `a@b.com`) the menu stays silent, since
 * there is no allowed prefix before the character. A non-breaking space is a space too: the
 * browser inserts it in a `contenteditable` in place of a regular trailing one.
 *
 * Inside a code block or inline code the menu does not open: there the character means a path, a
 * comment or a division, not a command.
 *
 * Escape usually does not reach the plugin: an open menu is a Radix layer, and the Escape stack
 * takes Escape before the engine does (`SlashMenu`). The plugin's branch stays for the case when
 * there is no menu on screen: the session then closes the same way.
 */
function triggerPlugin(editor: Editor, char: string, bridge: SlashBridge) {
  const open = (props: {
    query: string;
    range: Range;
    clientRect?: (() => DOMRect | null) | null;
  }) =>
    bridge.open({
      query: props.query,
      range: props.range,
      rect: () => props.clientRect?.() ?? null,
    });
  return Suggestion({
    editor,
    pluginKey: triggerKey(char),
    char,
    allowedPrefixes: [" ", "\u00a0"],
    allow: ({ state, range }) => {
      const $from = state.doc.resolve(range.from);
      if ($from.parent.type.spec.code) return false;
      return !$from.marks().some((mark) => mark.type.spec.code);
    },
    render: () => ({
      onStart: open,
      onUpdate: open,
      onExit: () => bridge.close(),
      onKeyDown: ({ event }) => (event.key === "Escape" ? false : bridge.keyDown(event)),
    }),
  });
}

/**
 * Opening the Slash menu on `/`: the rules of the trigger character (`triggerPlugin`).
 */
export const SlashCommand = Extension.create<{ bridge: SlashBridge | null }>({
  name: "slashCommand",

  addOptions() {
    return { bridge: null };
  },

  addProseMirrorPlugins() {
    const bridge = this.options.bridge;
    if (!bridge) return [];
    return [triggerPlugin(this.editor, "/", bridge)];
  },
});

/** A custom trigger character and the bridge of its menu. */
export interface TriggerBinding {
  char: string;
  bridge: SlashBridge;
}

/**
 * Custom trigger characters of Tools (ADR-0064): a plugin per character, each with its own key.
 * The tool set checks the character (`customToolsError`); here it is already valid and unique.
 */
export const TriggerCommand = Extension.create<{ triggers: readonly TriggerBinding[] }>({
  name: "triggerCommand",

  addOptions() {
    return { triggers: [] };
  },

  addProseMirrorPlugins() {
    return this.options.triggers.map(({ char, bridge }) =>
      triggerPlugin(this.editor, char, bridge)
    );
  },
});

"use client";

import type { Editor } from "@tiptap/react";
import { useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { devError } from "../../lib/dev-warn.js";
import type { TriggerItem } from "../core/customTool.js";
import {
  closeTrigger,
  type SlashBridge,
  type SlashSession,
  type TriggerBinding,
} from "../core/slashCommand.js";
import { toolLabel, type TriggerRecord } from "../core/toolDescriptor.js";
import { emptyRect, SuggestionList, suggestionOptionId } from "./SuggestionList.js";

export interface TriggerMenu {
  /** Characters and bridges for the extension. Empty means the set has no triggers of its own. */
  bindings: readonly TriggerBinding[];
  /** Field attributes: the combobox part of the pattern, as in the Insert menu. */
  attributes: Record<string, string>;
  /** The list itself, rendered next to the field. */
  element: ReactNode;
}

/** The open session: which trigger character it belongs to and what was typed. */
interface Opened {
  char: string;
  session: SlashSession;
}

/**
 * Lists for custom trigger characters (ADR-0064). They use the same `SuggestionList` as the
 * `/` Insert menu: a popover at the caret, the rows, and "Nothing found". Focus stays in the
 * field, and the engine hears the arrow keys and `Enter` and passes them here through a
 * bridge.
 *
 * At most one list can be open: the characters differ, and what was typed in the Document
 * matches only one of them. Items come from the consumer on request, either at once or as a
 * promise. The response to a stale request is dropped. Selecting an item passes the item and
 * the range `character+query` to the consumer's handler. The handler must delete what was
 * typed itself, by replacing it with its own node. The list closes after the call.
 */
export function useTriggerMenu(
  triggers: readonly TriggerRecord[],
  editorRef: RefObject<Editor | null>
): TriggerMenu {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const listboxId = useId();
  const [opened, setOpened] = useState<Opened | null>(null);
  const [found, setFound] = useState<readonly TriggerItem[]>([]);
  // The response is still pending: the empty list must not flash "Nothing found".
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(0);

  /*
    The engine asks about a key in the middle of its handler, not through a render. So
    whatever it reads lives in a ref that every render updates, and is updated at once in the
    handlers that need the state before a render.
  */
  const triggersRef = useRef(triggers);
  triggersRef.current = triggers;
  const openedRef = useRef(opened);
  openedRef.current = opened;
  const foundRef = useRef(found);
  foundRef.current = found;
  // The response to the current query has not arrived yet: the screen shows the items of the
  // previous query.
  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const activeRef = useRef(active);
  activeRef.current = active;
  // The number of the last request: a response with a different number is stale.
  const requestRef = useRef(0);

  const fetchItems = (char: string, query: string) => {
    const trigger = triggersRef.current.find((candidate) => candidate.char === char);
    if (!trigger) return;
    const request = ++requestRef.current;
    const fail = (cause: unknown) =>
      devError(`RichTextEditor: custom tool "${trigger.tool}": trigger.items failed`, cause);
    let result: ReturnType<TriggerRecord["items"]> = [];
    try {
      result = trigger.items(query);
    } catch (cause) {
      fail(cause);
    }
    if (typeof (result as { then?: unknown } | null)?.then !== "function") {
      setFound(Array.isArray(result) ? result : []);
      setPending(false);
      return;
    }
    setPending(true);
    // Set the ref at once: an Enter pressed before the next render must not take an item from
    // the previous query.
    pendingRef.current = true;
    Promise.resolve(result).then(
      (list) => {
        if (request !== requestRef.current) return;
        setFound(Array.isArray(list) ? list : []);
        setPending(false);
      },
      (cause) => {
        if (request !== requestRef.current) return;
        fail(cause);
        setFound([]);
        setPending(false);
      }
    );
  };

  const apply = (item: TriggerItem) => {
    const editor = editorRef.current;
    const current = openedRef.current;
    const trigger = triggersRef.current.find((candidate) => candidate.char === current?.char);
    if (!editor || editor.isDestroyed || !current || !trigger) return;
    trigger.onSelect(item, {
      editor,
      range: current.session.range,
      query: current.session.query,
    });
    // The handler has usually replaced what was typed, and the session has ended by itself.
    // If not, close it here.
    if (!editor.isDestroyed) closeTrigger(editor.view, current.char);
  };

  const handlers = {
    open: (char: string, next: SlashSession) => {
      const previous = openedRef.current;
      const sameQuery = previous?.char === char && previous.session.query === next.query;
      const value = { char, session: next };
      openedRef.current = value;
      setOpened(value);
      if (sameQuery) return;
      // A new query means a new list: the active row resets to the first one.
      activeRef.current = 0;
      setActive(0);
      fetchItems(char, next.query);
    },
    close: (char: string) => {
      if (openedRef.current?.char !== char) return;
      openedRef.current = null;
      requestRef.current++;
      setOpened(null);
      setFound([]);
      setPending(false);
    },
    keyDown: (char: string, event: KeyboardEvent) => {
      if (openedRef.current?.char !== char) return false;
      // An Enter that confirms IME composition belongs to the IME, not to the list.
      if (event.isComposing) return false;
      const list = foundRef.current;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (list.length === 0) return false;
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Update the ref right away, without waiting for a render: two arrow presses in a row
        // must not read the same row.
        const next = (activeRef.current + step + list.length) % list.length;
        activeRef.current = next;
        setActive(next);
        return true;
      }
      if (event.key === "Enter") {
        // A response to what was typed is still on its way. The list holds the items of the
        // previous query, and Enter would insert something the new query may not find. Enter
        // is swallowed: it neither picks an item nor breaks a line in the middle of typing.
        if (pendingRef.current) return true;
        const item = list[activeRef.current];
        // Nothing matches: Enter stays a line break, and the list closes by itself.
        if (!item) return false;
        apply(item);
        return true;
      }
      return false;
    },
  };
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  /*
    There is one bridge per character, and the bridges live as long as the set of characters
    stays the same. The engine's extensions depend on them, and the engine cannot be
    recreated for a new handler. The bridges themselves are thin: they read everything from
    `handlersRef`.
  */
  const chars = triggers.map((trigger) => trigger.char).join("\n");
  const bindings = useMemo<readonly TriggerBinding[]>(
    () =>
      chars === ""
        ? []
        : chars.split("\n").map((char) => {
            const bridge: SlashBridge = {
              open: (session) => handlersRef.current.open(char, session),
              close: () => handlersRef.current.close(char),
              keyDown: (event) => handlersRef.current.keyDown(char, event),
            };
            return { char, bridge };
          }),
    [chars]
  );

  const anchorRef = useRef({
    getBoundingClientRect: () => openedRef.current?.session.rect() ?? emptyRect(),
    get contextElement() {
      const editor = editorRef.current;
      return editor && !editor.isDestroyed ? editor.view.dom : undefined;
    },
  });

  const enabled = triggers.length > 0;
  const open = opened !== null;
  const current = open ? found[active] : undefined;
  const listboxLabel = (() => {
    const trigger = triggers.find((candidate) => candidate.char === opened?.char);
    const text = trigger?.label ? toolLabel(trigger.label, { locale, messages }).trim() : "";
    return text !== "" ? text : messages.triggerList;
  })();
  const activeId = current ? suggestionOptionId(listboxId, current.id) : undefined;
  // The object changes only when its values change: the engine options are built from it,
  // and a new object on every render would set them again.
  const attributes = useMemo(() => {
    const result: Record<string, string> = {};
    if (enabled) result["aria-autocomplete"] = "list";
    if (open) result["aria-controls"] = listboxId;
    if (open && activeId) result["aria-activedescendant"] = activeId;
    return result;
  }, [enabled, open, listboxId, activeId]);

  const element = enabled && (
    <SuggestionList
      open={open}
      onClose={() => {
        const editor = editorRef.current;
        const char = openedRef.current?.char;
        if (editor && !editor.isDestroyed && char) closeTrigger(editor.view, char);
      }}
      anchorRef={anchorRef}
      editorRef={editorRef}
      listboxId={listboxId}
      label={listboxLabel}
      groups={[
        {
          id: "items",
          rows: found.map((item) => ({ id: item.id, label: item.label, icon: item.icon })),
        },
      ]}
      active={active}
      onActivate={setActive}
      onApply={(rowId) => {
        const item = found.find((candidate) => candidate.id === rowId);
        if (item) apply(item);
      }}
      emptyText={messages.nothingFound}
      showEmpty={!pending}
    />
  );

  return { bindings, attributes, element };
}

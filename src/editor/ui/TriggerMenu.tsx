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
  /** Символы и мосты для расширения; пусто — у набора нет своих триггеров. */
  bindings: readonly TriggerBinding[];
  /** Атрибуты поля — комбобокс-часть паттерна, как у Меню вставки. */
  attributes: Record<string, string>;
  /** Сам список — рисуется рядом с полем. */
  element: ReactNode;
}

/** Открытая сессия: чей символ и что набрано. */
interface Opened {
  char: string;
  session: SlashSession;
}

/**
 * Списки своих символов-триггеров (ADR-0064): тот же `SuggestionList`, что у
 * Меню вставки «/», — поповер у каретки, строки и «Ничего не найдено», фокус в
 * поле, стрелки и `Enter` слушает движок и передаёт сюда мостом.
 *
 * Открыт может быть один список: символы разные, и набранное в Документе
 * подходит под один. Пункты приходят от потребителя по запросу — сразу или
 * промисом; ответ устаревшего запроса отбрасывается. Выбор отдаёт пункт и
 * диапазон `символ+запрос` обработчику потребителя; удалять набранное он
 * должен сам, заменив его своим узлом. После вызова список закрывается.
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
  // Ответ ещё идёт: пустой список не должен мигнуть «Ничего не найдено».
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(0);

  /*
    Движок спрашивает про клавишу посреди своего обработчика, а не через
    рендер: поэтому то, что он читает, лежит в ref и обновляется каждым
    рендером — и сразу в обработчиках, где состояние нужно до рендера.
  */
  const triggersRef = useRef(triggers);
  triggersRef.current = triggers;
  const openedRef = useRef(opened);
  openedRef.current = opened;
  const foundRef = useRef(found);
  foundRef.current = found;
  // Ответ на текущий запрос ещё не пришёл: на экране — пункты прошлого запроса.
  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const activeRef = useRef(active);
  activeRef.current = active;
  // Номер последнего запроса: ответ с другим номером устарел.
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
    // Ref — сразу: Enter, нажатый до следующего рендера, не должен взять пункт прошлого запроса.
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
    // Обработчик обычно заменил набранное, и сессия кончилась сама; если нет — закрыть.
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
      // Новый запрос — новый список: курсор встаёт на первую строку.
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
      // Enter, подтверждающий набор IME, принадлежит IME, а не списку.
      if (event.isComposing) return false;
      const list = foundRef.current;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (list.length === 0) return false;
        const step = event.key === "ArrowDown" ? 1 : -1;
        // Ref — сразу, не дожидаясь рендера: две стрелки подряд не должны
        // прочитать одну и ту же строку.
        const next = (activeRef.current + step + list.length) % list.length;
        activeRef.current = next;
        setActive(next);
        return true;
      }
      if (event.key === "Enter") {
        // Ответ на набранное ещё в пути: в списке пункты прошлого запроса, и Enter
        // вставил бы то, чего новый запрос, может быть, не находит. Enter съедается —
        // и не выбирает, и не переводит строку посреди набора.
        if (pendingRef.current) return true;
        const item = list[activeRef.current];
        // Пусто — Enter остаётся переводом строки, и список закрывается сам.
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
    Мосты — по одному на символ, и живут, пока набор символов тот же: от них
    зависят расширения движка, и пересоздавать движок ради нового обработчика
    нельзя. Сами мосты тонкие: всё читают из `handlersRef`.
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
  // Объект меняется только вместе со значениями: из него собираются опции
  // движка, и новый объект на каждом рендере переустанавливал бы их заново.
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

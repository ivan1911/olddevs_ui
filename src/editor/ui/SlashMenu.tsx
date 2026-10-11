"use client";

import type { Editor } from "@tiptap/react";
import { useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useFilter } from "react-aria-components";
import { DEFAULT_MESSAGES } from "../../i18n/defaults.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { isApple, shortcutLabel } from "./EditorToolbar.js";
import {
  applyInsertItem,
  INSERT_SECTIONS,
  insertItemHint,
  matchesQuery,
  type InsertItem,
} from "../core/insertItems.js";
import { closeSlashMenu, type SlashBridge, type SlashSession } from "../core/slashCommand.js";
import {
  emptyRect,
  SuggestionList,
  suggestionOptionId,
  type SuggestionGroup,
} from "./SuggestionList.js";

export interface SlashMenu {
  /** Мост для расширения; `undefined` — меню выключено, `/` остаётся символом. */
  bridge: SlashBridge | undefined;
  /** Атрибуты поля — комбобокс-часть паттерна: кому принадлежит список и кто в нём текущий. */
  attributes: Record<string, string>;
  /** Сам список — рисуется рядом с полем. */
  element: ReactNode;
}

/**
 * Меню вставки по `/`: список у курсора.
 *
 * ФОКУС ОСТАЁТСЯ В ПОЛЕ. Пользователь продолжает набирать запрос, поэтому
 * список — не отдельная остановка фокуса, а «всплывающая часть» поля по
 * паттерну комбобокса APG: поле указывает на список `aria-controls`, текущую
 * строку — `aria-activedescendant`, а стрелки и Enter слушает движок
 * (`slashCommand.ts`) и передаёт сюда.
 *
 * `aria-expanded` на поле НЕТ, и это не забывчивость: поле — `role="textbox"`,
 * а ARIA 1.2 этот атрибут текстовому полю не разрешает (axe:
 * `aria-allowed-attr`). Менять роль поля на `combobox` на время меню нельзя —
 * многострочный документ не комбобокс. Остаются разрешённые текстовому полю
 * `aria-autocomplete="list"` (поле умеет показывать список) и пара
 * `aria-controls` + `aria-activedescendant` на время показа.
 *
 * ПОЧЕМУ `Popover` КИТА, А НЕ СВОЙ АБСОЛЮТНЫЙ СПИСОК. Якорь — курсор, и
 * `PopoverAnchor` принимает его виртуальным прямоугольником; а главное, панель
 * Radix — слой стека Radix. Escape при открытом списке забирает верхний слой:
 * список закрывается, а `Dialog` или `Drawer`, в котором лежит поле, остаются
 * открытыми — без нового заслона в окнах (ADR-0041). Свой список вне стека
 * Radix пришлось бы учить этому отдельно, а окна — его различать.
 *
 * Escape через стек приходит раньше движка, и движок его уже не видит
 * (ProseMirror пропускает событие с `defaultPrevented`): сессия закрывается
 * отсюда, `closeSlashMenu`. Набранный `/запрос` остаётся текстом, а
 * повторно меню на нём не откроется, пока не начат новый `/`.
 */
export function useSlashMenu(
  items: readonly InsertItem[],
  editorRef: RefObject<Editor | null>
): SlashMenu {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const { contains } = useFilter({ sensitivity: "base" });
  const listboxId = useId();
  const [session, setSession] = useState<SlashSession | null>(null);
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    if (!session) return [];
    const found = items.filter((item) =>
      matchesQuery(item, session.query, messages, locale, DEFAULT_MESSAGES.editor, contains)
    );
    // Порядок строк на экране — по разделам; стрелки идут в том же порядке.
    return INSERT_SECTIONS.flatMap((section) => found.filter((item) => item.section === section));
  }, [items, session, messages, locale, contains]);

  /*
    Движок спрашивает про клавишу посреди своего обработчика, а не через
    рендер: поэтому то, что он читает, лежит в ref и обновляется каждым
    рендером.
  */
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const activeRef = useRef(active);
  activeRef.current = active;

  const apply = (item: InsertItem) => {
    const editor = editorRef.current;
    const range = sessionRef.current?.range;
    if (editor && range) applyInsertItem(editor, item, range);
  };
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const [bridge] = useState<SlashBridge>(() => ({
    open: (next) => {
      // Новый запрос — новый список: курсор встаёт на первую строку.
      if (next.query !== sessionRef.current?.query) setActive(0);
      setSession(next);
    },
    close: () => setSession(null),
    keyDown: (event) => {
      // Enter, подтверждающий набор IME, принадлежит IME, а не меню.
      if (event.isComposing) return false;
      const list = visibleRef.current;
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
        const item = list[activeRef.current];
        // Пусто — Enter остаётся переводом строки, и меню закрывается само.
        if (!item) return false;
        applyRef.current(item);
        return true;
      }
      return false;
    },
  }));

  /*
    `contextElement` — Документ: по нему положение пересчитывается на прокрутке
    его предков, и меню едет за кареткой и в области Документа, которая
    прокручивается сама (`maxHeight`, ADR-0059), а не только в окне.
  */
  const anchorRef = useRef({
    getBoundingClientRect: () => sessionRef.current?.rect() ?? emptyRect(),
    get contextElement() {
      const editor = editorRef.current;
      return editor && !editor.isDestroyed ? editor.view.dom : undefined;
    },
  });

  const optionId = (item: InsertItem) => suggestionOptionId(listboxId, item.id);
  const current = session ? visible[active] : undefined;

  const enabled = items.length > 0;
  const open = session !== null;
  const activeId = current ? optionId(current) : undefined;
  // Объект меняется только вместе со значениями: из него собираются опции
  // движка, и новый объект на каждом рендере переустанавливал бы их заново.
  const attributes = useMemo(() => {
    const result: Record<string, string> = {};
    if (enabled) result["aria-autocomplete"] = "list";
    if (open) result["aria-controls"] = listboxId;
    if (open && activeId) result["aria-activedescendant"] = activeId;
    return result;
  }, [enabled, open, listboxId, activeId]);

  const apple = isApple();
  const groups: SuggestionGroup[] = INSERT_SECTIONS.map((section) => ({
    id: section,
    label: section === "insert" ? messages.insertSection : messages.turnIntoSection,
    rows: visible
      .filter((item) => item.section === section)
      .map((item) => ({
        id: item.id,
        label: item.label(messages, locale),
        icon: item.icon,
        hint: insertItemHint(item, (keys) => shortcutLabel(keys, apple)),
      })),
  }));
  const element = enabled && (
    <SuggestionList
      open={open}
      onClose={() => {
        const editor = editorRef.current;
        if (editor && !editor.isDestroyed) closeSlashMenu(editor.view);
      }}
      anchorRef={anchorRef}
      editorRef={editorRef}
      listboxId={listboxId}
      label={messages.insertMenu}
      groups={groups}
      active={active}
      onActivate={setActive}
      onApply={(rowId) => {
        const item = visible.find((candidate) => candidate.id === rowId);
        if (item) apply(item);
      }}
      emptyText={messages.nothingFound}
      showEmpty
    />
  );

  return { bridge: enabled ? bridge : undefined, attributes, element };
}

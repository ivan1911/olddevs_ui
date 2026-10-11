"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { ListBox, ListBoxItem, type Selection } from "react-aria-components";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { LISTBOX_ITEM_CLASS } from "../../lib/menu.js";
import { Button } from "../actions/Button.js";
import { TextControl } from "./TextControl.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface TransferItem {
  /**
   * Ключ элемента. Обязан быть уникальным в пределах `items`.
   *
   * Дубликат кит не чинит и не сообщает о нём: два `ListBoxItem` с одним `id`
   * схлопывает сама коллекция react-aria, и один из элементов молча пропадает
   * с экрана. Уникальность — контракт потребителя.
   */
  id: string;
  /** Подпись элемента в колонке. */
  label: string;
  /** Элемент показан, но не переносится и не выбирается. */
  disabled?: boolean;
}

export interface TransferProps {
  /**
   * Все элементы разом, независимо от того, в какой они сейчас колонке.
   *
   * Один список, а не два: два разъехались бы при первой же правке — элемент,
   * забытый в обоих или пропавший из обоих, никак себя не проявит.
   */
  items: TransferItem[];
  /**
   * Ключи, оказавшиеся в целевой колонке. Порядок значим и сохраняется:
   * назначенные права показываются в том порядке, в каком их назначали.
   *
   * Ключ, которого нет в `items`, кит **не выбрасывает**: он не показывается,
   * не считается в счётчике и переживает переносы нетронутым. Выбросить его
   * значило бы молча править чужое значение — а знать, почему потребитель
   * прислал незнакомый ключ, кит не может.
   */
  value: string[];
  /** Вызывается при переносе и получает новый список ключей целевой колонки. */
  onChange: (value: string[]) => void;
  /** Подпись левой колонки. Без неё берётся из каталога. */
  sourceLabel?: string;
  /** Подпись правой колонки. Без неё берётся из каталога. */
  targetLabel?: string;
  /** Поле поиска над каждым списком. */
  searchable?: boolean;
  /**
   * Гасит обе колонки и обе кнопки разом.
   *
   * Отличается от `TransferItem.disabled`: тот про один элемент, который
   * показан, но не переносится; этот про весь контрол — переносить нельзя
   * ничего.
   */
  disabled?: boolean;
  /**
   * Доступное имя всей пары колонок. С ним контрол объявляется группой, без
   * него — нет.
   *
   * Без имени пользователь AT слышит два несвязанных списка и две стрелки между
   * ними, и что это один вопрос, а не два, ниоткуда не следует. Безымянная
   * группа при этом хуже её отсутствия — то же правило, что у `ButtonGroup`.
   */
  "aria-label"?: string;
  /** Классы на корневой элемент. */
  className?: string;
}

const PANEL_CLASS =
  "border-line bg-bg-1 flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border";

const LIST_CLASS = "flex flex-col gap-px overflow-y-auto p-1.5 outline-none";

/**
 * Вид строки списка — общий с меню и палитрой (`lib/menu.ts`).
 *
 * Своя копия здесь была четвёртой в репозитории и единственной с
 * `focus-visible:` вместо `focus:`: у react-aria это `data-focused`, который
 * ставится и стрелками, и мышью, и разводить их значило бы показывать два
 * курсора сразу.
 */
const ITEM_CLASS = LISTBOX_ITEM_CLASS;

/**
 * Что именно уедет по нажатию стрелки: пересечение подсветки с тем, что в
 * колонке **сейчас видно**, за вычетом недоступного.
 *
 * Три вещи, каждая из которых иначе даёт свой дефект.
 *
 * `'all'` — не экзотика: `Ctrl`/`Cmd`+`A` внутри списка это штатная клавиша
 * `useSelectableCollection`, и она отдаёт именно строку, а не набор ключей.
 * Пустой ответ на неё гасил бы обе кнопки ровно в самом частом сценарии —
 * «выделить всё и перенести».
 *
 * Пересечение с колонкой — от рассинхрона: подсветка живёт внутри и переживает
 * внешнюю смену `value`. Ключ, уехавший в другую колонку чужой правкой,
 * остался бы «переносимым» и приехал бы в `value` вторым экземпляром.
 *
 * Пересечение именно с ВИДИМЫМ — от поиска: кнопка не должна переносить то,
 * чего на экране нет. Пользователь отвечает за то, что видит.
 */
function movableKeys(selection: Selection, visible: TransferItem[]): string[] {
  const ids = visible.filter((item) => !item.disabled).map((item) => item.id);
  if (selection === "all") return ids;
  const picked = new Set([...selection].map(String));
  return ids.filter((id) => picked.has(id));
}

/** Отбор по подстроке, регистр не важен. */
function filterItems(list: TransferItem[], query: string): TransferItem[] {
  if (!query) return list;
  const needle = query.toLowerCase();
  return list.filter((item) => item.label.toLowerCase().includes(needle));
}

/**
 * Две колонки и перенос между ними: доступное слева, выбранное справа.
 *
 * Списки — `ListBox` из react-aria: клавиатура, типизация по первым буквам,
 * множественное выделение и роли приходят оттуда, своей коллекции компонент не
 * заводит.
 *
 * СОБСТВЕННОЕ РЕШЕНИЕ ЗДЕСЬ ОДНО, И ОНО ПРО ФОКУС. После переноса выделенные
 * элементы из списка исчезают — вместе с элементом, на котором стоял фокус.
 * react-aria на этот случай ответа не даёт: у неё коллекция сменилась, и фокус
 * уходит на `body`, то есть в начало документа.
 *
 * Правило компонента: **фокус идёт за элементами**. Он переходит в список, куда
 * они переехали, а сами перенесённые становятся там выделением. Отсюда сразу
 * работает возврат: нажать «назад» можно не выделяя заново. Альтернатива —
 * оставить фокус на кнопке — ломается на первом же полном переносе: кнопка
 * гаснет, потому что переносить больше нечего, и фокус всё равно теряется.
 *
 * Выделение (что подсвечено) и значение (что в какой колонке) — РАЗНЫЕ вещи, и
 * компонент их не смешивает: подсветка живёт внутри и не переживает перенос,
 * значение приходит и уходит пропами.
 */
export function Transfer({
  items,
  value,
  onChange,
  sourceLabel,
  targetLabel,
  searchable = false,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: TransferProps) {
  const messages = useMessages();
  const [sourcePicked, setSourcePicked] = useState<Selection>(new Set());
  const [targetPicked, setTargetPicked] = useState<Selection>(new Set());
  const [sourceQuery, setSourceQuery] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const sourceList = useRef<HTMLDivElement>(null);
  const targetList = useRef<HTMLDivElement>(null);
  const headingId = useId();

  // Счётчик переносов, а не `value`: потребитель управляемого компонента вправе
  // отклонить изменение, и тогда `value` не сменится — а фокус увести всё равно
  // надо, иначе он останется на исчезнувшем элементе.
  const [moves, setMoves] = useState(0);
  const pending = useRef<{ side: "source" | "target"; key: string } | null>(null);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const chosen = useMemo(() => new Set(value), [value]);

  // Порядок целевой колонки задаёт `value`, а не `items`: он и есть порядок
  // назначения. Исходная колонка, наоборот, идёт в порядке `items`.
  const source = items.filter((item) => !chosen.has(item.id));
  const target = value.map((id) => byId.get(id)).filter((item) => item !== undefined);

  const sourceShown = filterItems(source, sourceQuery);
  const targetShown = filterItems(target, targetQuery);

  const toTarget = movableKeys(sourcePicked, sourceShown);
  const toSource = movableKeys(targetPicked, targetShown);

  /*
    Фокус переводится ПОСЛЕ коммита, а не в обработчике.

    Синхронный `focus()` попадает в ещё старую коллекцию: react-aria делегирует
    фокус с контейнера внутрь по первому выделенному ключу, а нового выделения
    в тот момент ещё нет. Фокус вставал на случайный элемент, лежавший в колонке
    до переноса, — то есть ровно мимо правила «фокус идёт за элементами».
  */
  useEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;

    /*
      Кадром позже, а не сразу в эффекте.

      `ListBox` строит свою коллекцию отдельным проходом, и на момент этого
      эффекта она ещё прежняя: перенесённого элемента в ней нет, зато есть тот,
      что лежал в колонке до переноса. Синхронная наводка попадала именно в
      него — фокус вставал на случайный старый элемент вместо приехавшего.
    */
    const frame = requestAnimationFrame(() => {
      const list = (next.side === "target" ? targetList : sourceList).current;
      if (!list) return;
      // Опция ищется перебором `data-key`, а не селектором: ключ приходит от
      // потребителя и может содержать что угодно, а `CSS.escape` есть не во
      // всяком окружении.
      const option = [...list.querySelectorAll<HTMLElement>("[data-key]")].find(
        (node) => node.getAttribute("data-key") === next.key
      );
      // Контейнер — запасной путь: если приехавший элемент отфильтрован
      // поиском принимающей колонки, наводить не на что, но и отпускать фокус
      // на `body` нельзя.
      (option ?? list).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [moves]);

  function moveToTarget() {
    const first = toTarget[0];
    if (first === undefined) return;
    onChange([...value, ...toTarget]);
    setSourcePicked(new Set());
    setTargetPicked(new Set(toTarget));
    pending.current = { side: "target", key: first };
    setMoves((n) => n + 1);
  }

  function moveToSource() {
    const first = toSource[0];
    if (first === undefined) return;
    const removed = new Set(toSource);
    onChange(value.filter((id) => !removed.has(id)));
    setTargetPicked(new Set());
    setSourcePicked(new Set(toSource));
    pending.current = { side: "source", key: first };
    setMoves((n) => n + 1);
  }

  function column(props: {
    side: "source" | "target";
    label: string;
    total: number;
    shown: TransferItem[];
    picked: Selection;
    onPick: (selection: Selection) => void;
    query: string;
    onQuery: (query: string) => void;
    listRef: RefObject<HTMLDivElement | null>;
  }) {
    const { side, label, total, shown, picked, onPick, query, onQuery, listRef } = props;
    const labelId = `${headingId}-${side}`;
    const countId = `${headingId}-${side}-count`;

    return (
      <div className={PANEL_CLASS}>
        <div className="border-line bg-bg-2 flex items-center justify-between gap-2 border-b px-3 py-2">
          <span id={labelId} className="text-fg-0 text-[13px] font-semibold">
            {label}
          </span>
          {/*
            Счётчик — всё, что лежит в колонке, а не то, что осталось после
            поиска: он отвечает на вопрос «сколько всего прав доступно», а
            фильтр это лишь взгляд на них. Он же входит в имя списка, иначе
            число на экране есть, а в речи его нет.
          */}
          <span id={countId} className="text-fg-2 text-caption">
            {total}
          </span>
        </div>

        {searchable && (
          <div className="px-2.5 pt-2">
            <TextControl
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              aria-label={messages.transfer.searchIn({ list: label })}
              placeholder={messages.common.searchPlaceholder}
              disabled={disabled}
            />
          </div>
        )}

        <ListBox
          ref={listRef}
          aria-labelledby={`${labelId} ${countId}`}
          selectionMode="multiple"
          selectedKeys={picked}
          onSelectionChange={onPick}
          disabledKeys={
            disabled
              ? shown.map((item) => item.id)
              : shown.filter((item) => item.disabled).map((item) => item.id)
          }
          items={shown}
          className={LIST_CLASS}
          renderEmptyState={() => (
            <p className="text-fg-2 px-2.5 py-6 text-center text-[13px]">
              {query ? messages.common.notFound : messages.common.empty}
            </p>
          )}
        >
          {(item: TransferItem) => (
            <ListBoxItem id={item.id} textValue={item.label} className={ITEM_CLASS}>
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </div>
    );
  }

  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className={cn("flex items-stretch gap-3", className)}
    >
      {column({
        side: "source",
        label: sourceLabel ?? messages.transfer.source,
        total: source.length,
        shown: sourceShown,
        picked: sourcePicked,
        onPick: setSourcePicked,
        query: sourceQuery,
        onQuery: setSourceQuery,
        listRef: sourceList,
      })}

      <div className="flex shrink-0 flex-col justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          iconOnly
          icon={<ChevronRightIcon size={BUTTON_ICON_SIZE.sm} aria-hidden />}
          disabled={disabled || toTarget.length === 0}
          onClick={moveToTarget}
          aria-label={messages.transfer.moveToTarget}
        />
        <Button
          variant="outline"
          size="sm"
          iconOnly
          icon={<ChevronLeftIcon size={BUTTON_ICON_SIZE.sm} aria-hidden />}
          disabled={disabled || toSource.length === 0}
          onClick={moveToSource}
          aria-label={messages.transfer.moveToSource}
        />
      </div>

      {column({
        side: "target",
        label: targetLabel ?? messages.transfer.target,
        total: target.length,
        shown: targetShown,
        picked: targetPicked,
        onPick: setTargetPicked,
        query: targetQuery,
        onQuery: setTargetQuery,
        listRef: targetList,
      })}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import {
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  isTextDropItem,
  useDragAndDrop,
  type DropItem,
  type ItemDropTarget,
  type Key,
} from "react-aria-components";
import { DragHandleIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { insertionIndex, reorder } from "../../lib/reorder.js";

export interface SortableItem {
  /** Стабильный идентификатор строки: по нему список сообщает новый порядок. */
  id: Key;
  /** Содержимое строки. Может быть вёрсткой — тогда задайте `textValue`. */
  label: ReactNode;
  /**
   * Строковое представление строки.
   *
   * Обязателен, когда `label` — не строка: из него собирается и доступное имя
   * строки, и имя её ручки перетаскивания («Перетащить Отчёт за март»), и
   * объявления «Вставить между … и …».
   */
  textValue?: string;
}

/** Переезд строки из одного списка группы в другой — что сообщает `onMove`. */
export interface SortableMove {
  /** Идентификатор строки. */
  id: Key;
  /** `id` списка, из которого строку унесли. */
  from: string;
  /** `id` списка, куда её положили. */
  to: string;
  /** Место в списке-приёмнике: индекс, который строка займёт в нём. */
  index: number;
}

export interface SortableListProps {
  /** Строки в текущем порядке; порядок хранит потребитель. */
  items: SortableItem[];
  /**
   * Новый порядок целиком — список идентификаторов после перестановки.
   *
   * Порядок компонент не хранит: он приходит пропом и уходит отсюда, как
   * сортировка у таблицы (ADR-0023). Отдаём весь список, а не «что куда
   * переехало»: применить готовый порядок проще, чем восстановить его из
   * события, и ошибиться негде.
   */
  onReorder: (ids: Key[]) => void;
  /** Доступное имя списка. Безымянный список скринридер называет только по роли. */
  "aria-label": string;
  /** Что показать при пустом списке. */
  emptyText?: ReactNode;
  /** Классы корневого элемента. */
  className?: string;
  /**
   * Имя группы списков, которые обмениваются строками, — например, колонок
   * одной доски. Без группы список только переставляет свои строки.
   */
  group?: string;
  /**
   * Имя списка внутри группы: его получает `onMove` в `from` и `to`. В DOM не
   * попадает — это ключ состояния экрана, а не `id` элемента.
   */
  id?: string;
  /**
   * Вызывается у списка-приёмника, когда в него перенесли строку из другого списка группы.
   *
   * Состав списков компонент не хранит, как и порядок: экран убирает строку
   * из `from` и ставит её в `to` на `index` — у обоих списков сразу, потому
   * что состояние доски одно и лежит у него.
   */
  onMove?: (move: SortableMove) => void;
}

/** Тип данных перетаскивания группы: чужая группа его не примет. */
const dragType = (group: string) => `application/x-olddevs-sortable+${group}`;

/** Строки, принесённые из другого списка группы, — по одной, в порядке переноса. */
async function readMoves(items: DropItem[], type: string): Promise<{ id: Key; from: string }[]> {
  const texts = await Promise.all(items.filter(isTextDropItem).map((item) => item.getText(type)));
  return texts.map((text) => JSON.parse(text) as { id: Key; from: string });
}

/**
 * Список с перетаскиванием: порядок задаёт пользователь.
 *
 * СТОИТ НА `useDragAndDrop` ИЗ react-aria, а не на сторонней библиотеке
 * (ADR-0028).
 * Это не экономия на зависимости: вместе с dnd-kit пришлось бы взять на себя и
 * доступность, которую react-aria отдаёт даром.
 *
 * РУЧКА ПЕРЕТАСКИВАНИЯ ОБЯЗАТЕЛЬНА, и она здесь не украшение. Без
 * `<Button slot="drag">` строка получает `draggable="true"` и таскается мышью,
 * а с клавиатуры не берётся ВООБЩЕ — react-aria при этом не падает, а пишет
 * предупреждение в консоль. То есть недоступный список выглядит рабочим.
 * Проверено замером перед решением, поэтому ручку рисует сам компонент, а не
 * потребитель по желанию.
 *
 * СВОЕЙ ЖИВОЙ ОБЛАСТИ НЕТ. react-aria объявляет перетаскивание сам и
 * локализованно: под русской локалью замер дал «Начато перетаскивание. Нажмите
 * клавишу Tab для выбора цели…», «Вставить между Строка 1 и Строка 2»,
 * «Перетаскивание завершено». Своя область дублировала бы их и спорила бы с
 * ними. `DragAnnouncer` из фронта не поднимается: он написан под dnd-kit,
 * который молчит.
 *
 * ИМЯ РУЧКИ НЕ ПОВТОРЯЕТ ПОДПИСЬ СТРОКИ — библиотека дописывает её сама, и
 * замер показал «Перетащить Строка 1». Тот же урок, что с кнопками внутри
 * `TagGroup` в ревью 2.1.0.
 *
 * КЛАВИАТУРА: стрелка вправо переводит фокус со строки на ручку, Enter
 * начинает перетаскивание, стрелки выбирают цель, Enter применяет, Escape
 * отменяет. Объявление react-aria предлагает Tab, но в коротком списке Tab
 * уводит фокус из кольца целей и отменяет перетаскивание — проверено в
 * браузере. Всё это — слой поведения, а не наш код.
 */
export function SortableList({
  items,
  onReorder,
  "aria-label": ariaLabel,
  emptyText,
  className,
  group,
  id: listId = "",
  onMove,
}: SortableListProps) {
  const messages = useMessages();
  const type = group != null ? dragType(group) : null;

  /*
    ПЕРЕНОС МЕЖДУ СПИСКАМИ — `onInsert` и `onRootDrop` react-aria, а не свой
    механизм: клавиатура (Tab ведёт к спискам группы), объявления «Вставить
    между … и …» и точка вставки приходят те же, что у перестановки.

    Строка несёт свой ключ и имя списка-источника в типе данных группы. Список
    принимает только этот тип: строку чужой группы — как и файл с рабочего
    стола — он не возьмёт.
  */
  async function receive(dropped: DropItem[], target: ItemDropTarget | null) {
    if (type == null || onMove == null) return;
    const index = insertionIndex(items, target);
    if (index == null) return;
    const moves = await readMoves(dropped, type);
    moves.forEach((move, i) =>
      onMove({ id: move.id, from: move.from, to: listId, index: index + i })
    );
  }

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({
        "text/plain": String(key),
        ...(type != null && { [type]: JSON.stringify({ id: key, from: listId }) }),
      })),
    /*
      Принимает строки из группы только список с `onMove`: без него бросок
      показал бы точку вставки и молча ничего не сделал. Отдавать строки
      список с группой умеет и без `onMove` — в `getItems` выше.
    */
    ...(type != null &&
      onMove != null && {
        acceptedDragTypes: [type],
        onInsert: (e) => receive(e.items, e.target),
        onRootDrop: (e) => receive(e.items, null),
      }),
    /*
      ТОЛЬКО `move`, и это не украшение курсора.

      По умолчанию разрешены и перемещение, и копирование, а операционная
      система рисует для копирования «плюс» — пользователь видит его посреди
      перестановки и ждёт, что строка удвоится. Скопировать строку список не
      умеет и уметь не должен: он меняет порядок, а не состав.

      В WEBKIT ЗНАЧОК ВСЁ РАВНО МЕЛЬКАЕТ, и починить это отсюда нельзя.
      Настройка применяется: `effectAllowed` записывается и читается обратно
      как `move` в обоих движках, react-aria вдобавок пишет `dropEffect: move`
      на каждом `dragover`. Но WebKit теряет её на уровне сессии
      перетаскивания и отдаёт приёмнику `all` (bugs.webkit.org/show_bug.cgi
      ?id=178058), а `all` включает копирование — система и рисует «плюс»,
      пока её не переубедят. Сама перестановка при этом верна: react-aria
      держит настоящий набор операций в своей переменной и пересекает с тем,
      что пришло, — строк после броска столько же, сколько было. Замер обоих
      движков — в справочнике компонента.
    */
    getAllowedDropOperations: () => ["move"],
    onReorder(e) {
      // Перестановка — чистая функция в `lib/reorder.ts`, проверенная на
      // массивах, включая сброс «на себя»: там раньше терялся последний
      // элемент. `null` означает, что сброс ничего не меняет, и наружу
      // ничего не уходит.
      const next = reorder(items, e.keys, e.target);
      if (next != null) onReorder(next.map((item) => item.id));
    },
    renderDropIndicator: (target) => (
      // Точка вставки видна ГЛАЗАМИ, а не только объявляется: перетаскивая
      // мышью, пользователь иначе не знает, куда попадёт строка.
      <DropIndicator
        target={target}
        className="drop-target:bg-accent-strong h-0.5 rounded-full bg-transparent"
      />
    ),
  });

  return (
    <GridList
      aria-label={ariaLabel}
      items={items}
      dragAndDropHooks={dragAndDropHooks}
      renderEmptyState={emptyText != null ? () => emptyText : undefined}
      className={cn("flex flex-col gap-1", className)}
    >
      {(item) => (
        <GridListItem
          id={item.id}
          textValue={item.textValue ?? (typeof item.label === "string" ? item.label : undefined)}
          className={cn(
            "border-line-soft bg-bg-2 flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[13px]",
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
            // Строка под курсором перетаскивания приглушается: она сейчас не
            // на своём месте, и показывать её обычной значило бы врать.
            "dragging:opacity-50"
          )}
        >
          {/*
            Ручка. Имя — только глагол: подпись строки библиотека дописывает
            сама, и «Перетащить Отчёт Отчёт» прозвучало бы дважды.
          */}
          <Button
            slot="drag"
            aria-label={messages.sortableList.drag}
            className="text-fg-3 hover:text-fg-1 focus-visible:outline-accent-strong flex size-6 shrink-0 cursor-grab items-center justify-center rounded-xs focus-visible:outline-2"
          >
            <DragHandleIcon size={14} />
          </Button>
          <span className="min-w-0 flex-1">{item.label}</span>
        </GridListItem>
      )}
    </GridList>
  );
}

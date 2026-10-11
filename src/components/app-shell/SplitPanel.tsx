"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";

export interface SplitPanelProps {
  /**
   * Где встаёт панель: сбоку от содержимого или под ним.
   *
   * Ось меняет направление раскладки, а не только классы: при `bottom` панель
   * занимает всю ширину, а тянется по высоте, и ручка поворачивается вместе с
   * ней.
   */
  position?: "side" | "bottom";
  /** Основная область — список, таблица, сетка. */
  children?: ReactNode;
  /** Содержимое панели деталей. */
  panel?: ReactNode;
  /**
   * Размер панели в пикселях: ширина при `side`, высота при `bottom`.
   *
   * Управляемый размер. Без него панель помнит размер сама, начиная с
   * `defaultSize`, — но помнит только пока жива. Долгая память (адрес страницы,
   * профиль пользователя) остаётся у потребителя: у него состояние уже где-то
   * лежит, и второе хранилище внутри кита разошлось бы с первым молча
   * (ADR-0023).
   */
  size?: number;
  /**
   * Начальный размер, когда `size` не передан. К нему же возвращает двойной
   * щелчок по ручке.
   *
   * Читается **один раз, при монтировании**: смена пропа потом стартовый размер
   * не двигает — иначе панель прыгала бы под пользователем от чужой
   * перерисовки. Цель двойного щелчка при этом берётся текущая, и в управляемом
   * режиме щелчок зовёт `onSizeChange(defaultSize)` — то есть умолчание кита,
   * если своё не передали.
   */
  defaultSize?: number;
  /**
   * Зовётся при каждом изменении размера — и на каждом кадре
   * перетаскивания тоже.
   *
   * Тому, кто пишет размер в адрес страницы или на сервер, отсюда нужен не
   * каждый кадр: throttle или запись по `pointerup` — забота потребителя, кит
   * сообщает намерение так часто, как оно возникает.
   *
   * Сужение границ на лету картинку исправляет, но этого колбэка НЕ зовёт:
   * хранимое у потребителя значение остаётся прежним, а показывается зажатое.
   * Молчание здесь намеренное — событие без действия пользователя выглядело бы
   * как чужая правка его состояния.
   */
  onSizeChange?: (size: number) => void;
  /**
   * Нижняя граница. Панель не станет уже ни перетаскиванием, ни пропом.
   *
   * Перевёрнутый диапазон (`minSize > maxSize`) не роняет ничего: верхняя
   * граница поднимается до нижней. Иначе получился бы контрол, из которого нет
   * выхода ни стрелками, ни тягой, и без единого сообщения о причине.
   */
  minSize?: number;
  /**
   * Верхняя граница.
   *
   * В пикселях, а не в долях: доля потребовала бы знать размер контейнера, то
   * есть измерять его на каждом кадре перетаскивания.
   */
  maxSize?: number;
  /**
   * Панель схлопнута.
   *
   * Содержимое **не размонтируется** — состояние форм и прокрутки внутри
   * переживает схлопывание. Из дерева доступности панель при этом уходит:
   * скрытая панель, до которой доходит Tab, — это фокус, уехавший в невидимое.
   * Ручка вместе с ней тоже исчезает: тянуть нечего.
   */
  collapsed?: boolean;
  /**
   * Доступное имя панели. С ним панель объявляется областью, без него — нет.
   *
   * Безымянная область — лишнее объявление в речи, за которым не следует
   * ничего; то же правило, что у `ButtonGroup`.
   */
  "aria-label"?: string;
  /** Классы на корневой элемент раскладки. */
  className?: string;
}

/** Толщина полосы-ручки в пикселях. */
const HANDLE = 10;

/**
 * Шаг стрелки. Мельче — и дотянуть до нужного размера стоит полусотни нажатий.
 *
 * Живёт в обработчике клавиш, а НЕ в атрибуте `step`. Шаговая база у
 * `input[type=range]` — это `min`, поэтому `step=16` разрешил бы только
 * значения `min + 16n`: `maxSize` не взялся бы ни `End`, ни стрелками, а
 * попиксельный результат тяги браузер молча округлял бы — и `aria-valuenow`
 * разошёлся бы с шириной панели на экране.
 */
const STEP = 16;

/** Точный шаг — для тех, кому нужен ровно тот пиксель. */
const FINE_STEP = 1;

/**
 * Две области с изменяемой границей: содержимое и панель деталей.
 *
 * РАЗМЕР ЖИВЁТ У ПОТРЕБИТЕЛЯ, кит даёт форму — то же разделение, что у
 * состояния таблицы (ADR-0023). Панель умеет помнить размер сама, но только на
 * время своей жизни: у заказчика он обычно уже лежит в адресе страницы или в
 * профиле, и второе хранилище внутри кита разошлось бы с первым молча.
 *
 * РУЧКА — ВИДИМАЯ ПОЛОСА ПЛЮС НАСТОЯЩИЙ `input[type=range]` ПОД НЕЙ, и это
 * главное решение компонента. Резайзера общего назначения react-aria не даёт:
 * `ColumnResizer` и `ResizableTableContainer`, которые уже работают в `Table`,
 * привязаны к таблице и вне её не живут. Взята их модель, а не они сами.
 *
 * Почему именно так, а не `div` с `role="separator"` и обработчиком стрелок:
 * ползунок платформы приносит с собой всё, что иначе пишется руками и
 * забывается по частям — роль, объявление значения и границ, шаг, повтор при
 * удержании, поддержку скринридеров на сенсорном экране. Своя реализация
 * повторяет это в лучшем случае наполовину.
 *
 * Ползунок лежит поверх полосы, прозрачный и без событий указателя: перетаскивание
 * ведёт сама полоса. Если оставить события ползунку, он начнёт менять значение
 * по своей, горизонтальной логике — и при `position="bottom"` панель поедет не
 * в ту сторону. Фокус при этом остаётся настоящим: полоса подсвечивается через
 * `focus-within`.
 *
 * ЗНАЧЕНИЕ ПОЛЗУНКА — РАЗМЕР ПАНЕЛИ, А НЕ КООРДИНАТА ГРАНИЦЫ. Поэтому стрелка
 * вправо всегда увеличивает панель, хотя граница при этом уезжает влево. Модель
 * та же, что у резайзера колонки: пользователь тянет размер, а не разделитель.
 *
 * Обе области получают `min-w-0 min-h-0`. Без этого flex-потомок отказывается
 * становиться меньше своего содержимого, и панель, которую тянут, не
 * уменьшается — вместо неё уезжает вся раскладка.
 *
 * `--topbar-h` компонент не трогает вовсе (ADR-0016): он занимает данную ему
 * область и наверх ни к чему не липнет.
 */
export function SplitPanel({
  position = "side",
  children,
  panel,
  size,
  defaultSize = 280,
  onSizeChange,
  minSize = 120,
  maxSize = 720,
  collapsed = false,
  "aria-label": ariaLabel,
  className,
}: SplitPanelProps) {
  const messages = useMessages();
  const [ownSize, setOwnSize] = useState(defaultSize);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ from: number; size: number } | null>(null);
  const slider = useRef<HTMLInputElement>(null);
  /** Область содержимого — куда переезжает фокус при сворачивании. */
  const contentRef = useRef<HTMLDivElement>(null);
  /** Сворачиваемая панель — чтобы понять, стоял ли фокус внутри неё. */
  const collapsingRef = useRef<HTMLDivElement>(null);
  /** Был ли фокус внутри сворачиваемой части — считается ДО сворачивания. */
  const focusWasInside = useRef(false);
  /** Ручка: она размонтируется вместе со сворачиванием. */
  const handleRef = useRef<HTMLDivElement>(null);

  const side = position === "side";
  // Перевёрнутый диапазон не роняет ничего и молча даёт мёртвый контрол:
  // `min > max` в разметке ползунка — состояние, из которого нет выхода ни
  // стрелками, ни тягой. Верхняя граница поднимается до нижней, чтобы наружу
  // ушёл хотя бы валидный диапазон.
  const hi = Math.max(minSize, maxSize);
  const current = clamp(size ?? ownSize, minSize, hi);

  /*
    Уборка привязана к `collapsed`, а НЕ к размонтированию компонента.

    Тяга живёт в ref компонента, а не элемента, и переживает размонтирование
    одной только ручки — например, когда `collapsed` переключился прямо во время
    тяги. Уборщик с пустым списком зависимостей срабатывал бы, когда следующей
    ручки уже нет, то есть не делал бы ничего: `select-none` оставался бы на
    корне навсегда, а НАВЕДЕНИЕ на новую ручку двигало бы границу без единого
    нажатия.
  */
  useEffect(() => {
    if (!collapsed) return;
    drag.current = null;
    setDragging(false);

    /*
      Фокус, стоявший ВНУТРИ сворачиваемой части, переводится в содержимое.

      Признак ведётся ЗАРАНЕЕ, а не спрашивается постфактум. Первая починка
      смотрела `document.activeElement` в эффекте — то есть уже ПОСЛЕ коммита
      DOM, когда спрашивать поздно: ручка к этому моменту размонтирована
      (она рендерится соседом, под `{!collapsed && …}`), а поле под `hidden`
      браузер уже разфокусировал. Условие было ложным в обоих случаях, ради
      которых писалось, а тест это пропускал, потому что jsdom `hidden` фокус
      не снимает — то есть опирался на расхождение с браузером.

      Область содержимого уже фокусируема (`tabIndex={0}` ради правила axe
      `scrollable-region-focusable`), так что новой мишени не заводится.
    */
    if (!focusWasInside.current) return;
    focusWasInside.current = false;
    contentRef.current?.focus();
  }, [collapsed]);

  function commit(next: number) {
    const value = clamp(Math.round(next), minSize, hi);
    // Тяга за границу зажимается в то же число, и сообщать об этом нечего:
    // тот же довод, по которому сужение границ на лету колбэка не зовёт.
    // Без этой строки одно движение мимо предела давало десятки одинаковых
    // событий подряд — а адресат у них, по документации, запись в адрес
    // страницы или на сервер.
    if (value === current) return;
    // Управляемый размер внутрь не пишется: два источника правды разошлись бы
    // ровно на том кадре, где потребитель отклонит значение.
    if (size === undefined) setOwnSize(value);
    onSizeChange?.(value);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Только основная кнопка: перетаскивание правой кнопкой оставляет полосу
    // приклеенной к курсору после того, как откроется контекстное меню.
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: side ? event.clientX : event.clientY, size: current };
    setDragging(true);
    // Фокус переводится на ползунок руками: сама полоса не фокусируема, а
    // ползунок под ней без событий указателя. Иначе «потянул мышью, дотяну
    // стрелками» не работает вовсе — фокус остаётся на `<body>`.
    slider.current?.focus();
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    // Кнопка отпущена, а `pointerup` до полосы не дошёл — захват потерян где-то
    // ещё. Без этой проверки граница ездит за курсором без нажатия.
    if (event.buttons === 0) {
      endDrag(event);
      return;
    }
    const delta = (side ? event.clientX : event.clientY) - from.from;
    // Панель стоит после содержимого, поэтому движение вправо и вниз её
    // УМЕНЬШАЕТ. Знак здесь, а не в вызове, — чтобы он был один на оба
    // направления.
    commit(from.size - delta);
  }

  function endDrag(event?: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    // Событие есть не всегда: `onLostPointerCapture` приходит уже без цели,
    // за которую можно ухватиться, а очистка обязана произойти всё равно.
    if (event && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /*
    Стрелки перехватываются, потому что при `step=1` родная реакция ползунка —
    один пиксель за нажатие. Shift оставляет её: он и есть «точно тот пиксель».
  */
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const back = event.key === "ArrowLeft" || event.key === "ArrowDown";
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    if (!back && !forward) return;
    const step = event.shiftKey ? FINE_STEP : STEP;
    event.preventDefault();
    commit(current + (forward ? step : -step));
  }

  const panelStyle: CSSProperties = side ? { width: current } : { height: current };

  return (
    <div
      /*
        Признак «фокус внутри сворачиваемой части» ведётся ЗАРАНЕЕ: в момент
        сворачивания спрашивать уже поздно — ручка размонтирована, а поле под
        `hidden` разфокусировано браузером.
      */
      onFocusCapture={(event) => {
        focusWasInside.current =
          collapsingRef.current?.contains(event.target as Node) === true ||
          handleRef.current?.contains(event.target as Node) === true;
      }}
      className={cn(
        "flex h-full w-full overflow-hidden",
        side ? "flex-row" : "flex-col",
        // Пока тянут, выделение текста в соседних областях выключается: иначе
        // движение мимо полосы подсвечивает половину списка.
        dragging && "select-none",
        className
      )}
    >
      {/*
        Обе области объявлены прокручиваемыми самим компонентом, поэтому он же
        обязан сделать их достижимыми с клавиатуры: до содержимого, которое
        прокручивается только указателем, Tab не доводит. Правило axe
        `scrollable-region-focusable`.
      */}
      <div ref={contentRef} tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto">
        {children}
      </div>

      {!collapsed && (
        <div
          ref={handleRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => endDrag()}
          onDoubleClick={() => commit(defaultSize)}
          className={cn(
            "bg-bg-2 border-line relative flex shrink-0 touch-none items-center justify-center",
            "focus-within:bg-accent-strong focus-within:ring-[3px] focus-within:ring-[color:var(--focus-ring)]",
            // Видимая полоса — 10 px, но зона попадания расширена
            // псевдоэлементом до 26: WCAG 2.5.8 требует 24, и на сенсорном
            // экране десятипиксельная цель это не формальность.
            "before:absolute before:content-['']",
            side
              ? "cursor-col-resize border-x before:-inset-x-2 before:inset-y-0"
              : "cursor-row-resize border-y before:inset-x-0 before:-inset-y-2"
          )}
          style={side ? { width: HANDLE } : { height: HANDLE }}
        >
          {/* Хват: единственное, что отличает полосу от обычной границы. */}
          <span
            aria-hidden
            className={cn("bg-fg-1 rounded-full", side ? "h-7 w-0.5" : "h-0.5 w-7")}
          />
          <input
            ref={slider}
            type="range"
            aria-label={
              ariaLabel
                ? messages.splitPanel.resizeNamed({ panel: ariaLabel })
                : messages.splitPanel.resize
            }
            aria-orientation={side ? "horizontal" : "vertical"}
            aria-valuetext={messages.splitPanel.size({ size: current })}
            min={minSize}
            max={hi}
            step={FINE_STEP}
            value={current}
            onKeyDown={onKeyDown}
            onChange={(event) => commit(Number(event.target.value))}
            className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent opacity-0"
          />
        </div>
      )}

      <div
        ref={collapsingRef}
        hidden={collapsed}
        tabIndex={collapsed ? undefined : 0}
        role={ariaLabel ? "region" : undefined}
        aria-label={ariaLabel}
        className="bg-bg-1 min-h-0 min-w-0 shrink-0 overflow-auto"
        style={panelStyle}
      >
        {panel}
      </div>
    </div>
  );
}

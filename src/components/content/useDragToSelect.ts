"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Key, Selection } from "react-aria-components";
import { toPixels } from "../../hooks/useStickyOffset.js";

export interface DragToSelectOptions {
  /** Жест включён: `dragToSelect` и множественный выбор. */
  enabled: boolean;
  /** Порядок ячеек в коллекции: диапазон считается по нему, а не по экрану. */
  order: readonly Key[];
  /** Что прокручивается у края: своя область сетки или окно. */
  scroll: "container" | "window";
  /** Переменная высоты липкой шапки: верхний край окна для автопрокрутки. */
  offsetVar: string;
  /** Текущий выбор — основа, к которой жест добавляет диапазон. */
  selection: () => Selection;
  /** Новый набор: прежний выбор и диапазон от первой ячейки жеста до текущей. */
  onChange: (keys: Selection) => void;
}

/** Сколько держать палец неподвижно, прежде чем жест станет выделением. */
const HOLD_MS = 300;
/** Сдвиг до удержания, после которого это прокрутка, а не жест. */
const SLOP_PX = 8;
/** Полоса у края, где начинается автопрокрутка. */
const EDGE_PX = 56;
/** Наибольший шаг автопрокрутки за кадр. */
const MAX_STEP_PX = 18;

/**
 * Выделение протяжкой пальца по ячейкам сетки.
 *
 * СВОЁ, А НЕ react-aria: у react-aria такого жеста нет
 * (ADR-0028,
 * дополнение). Выбор остаётся осью сетки: жест только сообщает новый набор тем
 * же `onSelectionChange`.
 *
 * НА СОБЫТИЯХ КАСАНИЯ, А НЕ УКАЗАТЕЛЯ. Как только браузер начинает прокрутку,
 * он шлёт `pointercancel`, и жест обрывается. Остановить прокрутку можно только
 * `preventDefault` на `touchmove`, а для этого нужен непассивный слушатель
 * касания.
 *
 * С ДОЛГИМ НАЖАТИЕМ МЕНЮ НЕ СПОРИТ. Удержание лишь взводит жест (300 мс, меню
 * Radix ждёт 700), а выделение начинается, когда палец перешёл на другую
 * ячейку. Палец, который остался на месте, получает меню.
 *
 * НАЧАЛО ЖЕСТА ОТМЕНЯЕТ НАЖАТИЕ — событием `pointercancel` в элемент, где
 * началось касание. Сами они не отменятся: при касании `pointermove` уходит
 * к ячейке под пальцем, а не к стартовой, и таймер меню Radix (он снимается
 * на `pointermove` стартового триггера) открывал меню посреди протяжки;
 * `usePress` ячейки принял бы отпускание за нажатие. Одно событие гасит оба.
 */
export function useDragToSelect(
  gridRef: RefObject<HTMLElement | null>,
  options: DragToSelectOptions
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !options.enabled) return;

    let timer = 0;
    let frame = 0;
    let armed = false;
    let dragging = false;
    let suppressClick = false;
    let suppressTimer = 0;
    let pointerId = -1;
    let start: { x: number; y: number; key: Key; target: EventTarget | null } | null = null;
    let last = { x: 0, y: 0 };
    let base: Set<Key> = new Set();
    let current: Key | null = null;

    // Порядковый номер по строке ключа: на каждом движении пальца и кадре
    // автопрокрутки — без прохода по тысячам ключей. Пересобирается со сменой
    // `order` (новая страница).
    let indexed: readonly Key[] | null = null;
    let positions = new Map<string, number>();
    const positionOf = (key: string) => {
      const { order } = optionsRef.current;
      if (indexed !== order) {
        indexed = order;
        positions = new Map(order.map((k, i) => [String(k), i]));
      }
      return positions.get(key);
    };

    const keyAt = (x: number, y: number): Key | null => {
      const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[role="row"]');
      if (!row || !grid.contains(row) || row.dataset.key == null) return null;
      // `data-key` — строка; ключ коллекции может быть числом.
      const at = positionOf(row.dataset.key);
      return at == null ? null : optionsRef.current.order[at]!;
    };

    const apply = (key: Key) => {
      if (!start || key === current) return;
      current = key;
      const { order, onChange } = optionsRef.current;
      const from = positionOf(String(start.key)) ?? -1;
      const to = positionOf(String(key)) ?? -1;
      if (from < 0 || to < 0) return;
      const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      onChange(new Set<Key>([...base, ...range]));
    };

    const topEdge = () => {
      if (optionsRef.current.scroll === "container") return grid.getBoundingClientRect().top;
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(optionsRef.current.offsetVar)
        .trim();
      // `4rem` и `calc()` — тем же зондом, что у `useStickyOffset`.
      return Number.parseFloat(toPixels(raw, "0px")) || 0;
    };

    const bottomEdge = () =>
      optionsRef.current.scroll === "container"
        ? grid.getBoundingClientRect().bottom
        : window.innerHeight;

    const autoscroll = () => {
      frame = 0;
      if (!dragging) return;
      const top = topEdge() + EDGE_PX;
      const bottom = bottomEdge() - EDGE_PX;
      let step = 0;
      if (last.y < top) step = -Math.min(MAX_STEP_PX, ((top - last.y) / EDGE_PX) * MAX_STEP_PX);
      else if (last.y > bottom)
        step = Math.min(MAX_STEP_PX, ((last.y - bottom) / EDGE_PX) * MAX_STEP_PX);
      if (step !== 0) {
        if (optionsRef.current.scroll === "container") grid.scrollTop += step;
        else window.scrollBy(0, step);
        // Под неподвижным пальцем проехали другие ячейки.
        const key = keyAt(last.x, last.y);
        if (key != null) apply(key);
      }
      frame = requestAnimationFrame(autoscroll);
    };

    const reset = () => {
      window.clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      armed = false;
      dragging = false;
      start = null;
      current = null;
    };

    const onTouchStart = (event: TouchEvent) => {
      reset();
      suppressClick = false;
      if (event.touches.length !== 1) return;
      const touch = event.touches[0]!;
      const key = keyAt(touch.clientX, touch.clientY);
      if (key == null) return;
      start = { x: touch.clientX, y: touch.clientY, key, target: event.target };
      last = { x: touch.clientX, y: touch.clientY };
      timer = window.setTimeout(() => {
        armed = true;
      }, HOLD_MS);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!start) return;
      const touch = event.touches[0];
      if (!touch) return;
      last = { x: touch.clientX, y: touch.clientY };
      if (!armed) {
        // Палец поехал раньше удержания — это прокрутка, не жест.
        if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > SLOP_PX) reset();
        return;
      }
      event.preventDefault();
      const key = keyAt(touch.clientX, touch.clientY);
      if (!dragging) {
        if (key == null || key === start.key) return;
        dragging = true;
        start.target?.dispatchEvent(
          new PointerEvent("pointercancel", { bubbles: true, pointerId, pointerType: "touch" })
        );
        const selection = optionsRef.current.selection();
        // «Выделено всё» — основа из всех ключей: пустая основа сузила бы выбор
        // до диапазона протяжки.
        base = new Set(selection === "all" ? optionsRef.current.order : selection);
        current = null;
        apply(start.key);
        frame = requestAnimationFrame(autoscroll);
      }
      if (key != null) apply(key);
    };

    const onTouchEnd = () => {
      if (dragging) {
        // Сдвинутое касание щелчка обычно не порождает: флаг, оставшийся
        // взведённым, съел бы следующий настоящий тап (кнопку «в избранное»).
        // Синтезированный щелчок приходит сразу — ждать его дольше незачем.
        suppressClick = true;
        window.clearTimeout(suppressTimer);
        suppressTimer = window.setTimeout(() => {
          suppressClick = false;
        }, 400);
      }
      reset();
    };

    // Номер указателя нужен отмене: `usePress` сверяет его со своим.
    const rememberPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") pointerId = event.pointerId;
    };

    // Щелчок, который браузер мог синтезировать после жеста, — не нажатие.
    const swallowClick = (event: Event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
      event.preventDefault();
    };

    grid.addEventListener("touchstart", onTouchStart, { passive: true });
    grid.addEventListener("touchmove", onTouchMove, { passive: false });
    grid.addEventListener("touchend", onTouchEnd);
    grid.addEventListener("touchcancel", reset);
    // Отмена касания до начала протяжки — долгое нажатие ячейки с меню (сетка
    // гасит им выделение react-aria) или прокрутка браузера. Протяжка не
    // начнётся, даже если палец поедет потом: человек работает с меню.
    // Только отмена СВОЕГО касания: стартовый элемент или ячейка, в которой он
    // лежит. Отмена в соседней ячейке (второй палец) протяжку не трогает.
    const disarm = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || dragging || !start) return;
      const own = start.target;
      const at = event.target;
      if (at === own || (at instanceof Node && own instanceof Node && at.contains(own))) reset();
    };

    grid.addEventListener("pointerdown", rememberPointer, true);
    grid.addEventListener("pointercancel", disarm, true);
    grid.addEventListener("click", swallowClick, true);

    return () => {
      reset();
      window.clearTimeout(suppressTimer);
      grid.removeEventListener("touchstart", onTouchStart);
      grid.removeEventListener("touchmove", onTouchMove);
      grid.removeEventListener("touchend", onTouchEnd);
      grid.removeEventListener("touchcancel", reset);
      grid.removeEventListener("pointerdown", rememberPointer, true);
      grid.removeEventListener("pointercancel", disarm, true);
      grid.removeEventListener("click", swallowClick, true);
    };
  }, [gridRef, options.enabled]);
}

"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/*
  ПРИЦЕЛ МЕГАМЕНЮ — приём Amazon, разобранный Беном Каменсом в 2013 году.

  Курсор идёт от Категории к её Витрине наискосок и по пути задевает соседние
  Категории. Наивное «наведение открывает» сменило бы Витрину у человека под
  рукой. Прицел смотрит, КУДА движется курсор: пока он идёт в сторону открытой
  Витрины, соседняя Категория наведение не перехватывает.

  Модель — как у `useSafelyMouseToSubmenu` в react-aria, чтобы подменю `Menu` и
  мегаменю вели себя одинаково: направление последнего шага сравнивается с
  сектором от предыдущей точки к двум углам ближнего края Витрины; смена
  направления прощается; обработка прорежена до кадра; только мышь.

  Два осознанных расхождения с react-aria:

  1. Механизм — ОТЛОЖЕННАЯ СМЕНА Категории, а не `pointer-events: none` на
     Столбце. Отключённые события гасят подсветку под курсором и съедают щелчок
     по соседней Категории, а щелчок должен открывать сразу.
  2. Время сброса — 300 мс (значение Каменса), а не 1000 мс react-aria. Его
     подменю узкое и короткое; Столбец каталога листают, и секунда ожидания на
     каждой остановке ощущается как залипание.
*/

/** Курсор стоит дольше — Категория под ним открывается, даже если он «целился». */
export const AIM_SETTLE_MS = 300;

/** Прореживание: один шаг на кадр. Чаще направление шумит пиксельной дрожью. */
const THROTTLE_MS = 16;

/**
 * Сколько шагов «не туда» подряд прощается. Счётчик растёт на шаг к Витрине и
 * падает на шаг мимо; целится курсор, пока счётчик выше нуля. Отсюда: одно
 * случайное движение вбок прицел не сбрасывает, два подряд — сбрасывают.
 */
const ALLOWED_INVALID_MOVES = 2;

/**
 * Запас сектора по вертикали, пиксели. Без него курсор, идущий точно в угол
 * Витрины, выпадал бы из сектора на дрожании руки.
 */
const SECTOR_PADDING = 24;

interface Point {
  x: number;
  y: number;
}

/**
 * Идёт ли шаг `from → to` к Витрине: направление шага лежит внутри сектора от
 * `from` к двум углам её ближнего края.
 *
 * Векторное произведение, а не `atan2`: тот же сектор без разрыва угла на ±π.
 * Ось y экрана направлена вниз, отсюда знаки.
 */
export function isMovingToward(from: Point, to: Point, rect: DOMRect, side: "left" | "right") {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return false;
  const edge = side === "right" ? rect.left : rect.right;
  // Курсор уже за ближним краем — он в Витрине, а не на пути к ней.
  if (side === "right" ? from.x >= edge : from.x <= edge) return false;
  // Шаг от Витрины по горизонтали не может к ней вести.
  if (side === "right" ? dx <= 0 : dx >= 0) return false;
  const top = { x: edge - from.x, y: rect.top - SECTOR_PADDING - from.y };
  const bottom = { x: edge - from.x, y: rect.bottom + SECTOR_PADDING - from.y };
  const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
  const step = { x: dx, y: dy };
  // Справа: шаг «ниже» луча к верхнему углу и «выше» луча к нижнему. Слева
  // ориентация лучей зеркальна, и знаки меняются местами.
  return side === "right"
    ? cross(top, step) >= 0 && cross(step, bottom) >= 0
    : cross(top, step) <= 0 && cross(step, bottom) <= 0;
}

const NONE = Symbol("none");

interface MenuAimOptions {
  /** Открытая Категория; `null` — Витрины нет, и целиться не во что. */
  value: string | null;
  /** Открытая сейчас Витрина: её прямоугольник — цель. */
  showcaseRef: RefObject<HTMLElement | null>;
  /** Сменить Категорию (или закрыть Витрину — `null`). */
  commit: (next: string | null) => void;
}

/**
 * Прицел: решает, сменить Категорию под курсором сейчас или отложить.
 *
 * `request` зовётся из наведения на строку Столбца. Если Витрины нет или
 * курсор не целится — смена сразу. Если целится — смена откладывается: курсор
 * перестал целиться или стоит `AIM_SETTLE_MS` — открывается то, что под ним
 * сейчас; дошёл до Витрины — смена отменяется.
 *
 * Прямоугольник Витрины берётся заново на каждом шаге, а не кешируется:
 * прокрутка страницы и смена размера окна не оставляют его устаревшим, а цена
 * — одно чтение раскладки на кадр, и только пока Витрина открыта.
 */
export function useMenuAim({ value, showcaseRef, commit }: MenuAimOptions) {
  const previous = useRef<Point | null>(null);
  const lastStep = useRef(0);
  const aim = useRef(0);
  const pending = useRef<string | null | typeof NONE>(NONE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const flush = useCallback(() => {
    clearTimer();
    const next = pending.current;
    pending.current = NONE;
    if (next !== NONE) commitRef.current(next);
  }, []);

  const settleLater = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(flush, AIM_SETTLE_MS);
  }, [flush]);

  // Новая Витрина — новая цель: прежний счёт к ней отношения не имеет.
  useEffect(() => {
    aim.current = 0;
    previous.current = null;
    pending.current = NONE;
    clearTimer();
  }, [value]);

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (value === null) return;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.pointerType === "pen") return;
      const now = Date.now();
      if (now - lastStep.current < THROTTLE_MS) return;
      lastStep.current = now;
      const point = { x: event.clientX, y: event.clientY };
      const showcase = showcaseRef.current;
      const from = previous.current;
      previous.current = point;
      if (!showcase || !from) return;

      // Курсор дошёл до Витрины — отложенная смена больше не нужна.
      if (event.target instanceof Node && showcase.contains(event.target)) {
        pending.current = NONE;
        clearTimer();
        return;
      }

      const rect = showcase.getBoundingClientRect();
      const side = rect.left >= from.x ? "right" : "left";
      aim.current = isMovingToward(from, point, rect, side)
        ? Math.min(aim.current + 1, ALLOWED_INVALID_MOVES)
        : Math.max(aim.current - 1, 0);

      if (pending.current === NONE) return;
      // Перестал целиться — открывается то, над чем он сейчас; иначе ждём
      // остановки заново: каждый шаг откладывает срок.
      if (aim.current === 0) flush();
      else settleLater();
    };
    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [value, showcaseRef, flush, settleLater]);

  /** Курсор наведён на строку Столбца: открыть её (`null` — закрыть Витрину). */
  const request = useCallback(
    (next: string | null) => {
      if (next === value) {
        // Вернулся на открытую Категорию — отложенная смена отменяется.
        pending.current = NONE;
        clearTimer();
        return;
      }
      if (value === null || aim.current === 0) {
        pending.current = NONE;
        clearTimer();
        commitRef.current(next);
        return;
      }
      pending.current = next;
      settleLater();
    },
    [value, settleLater]
  );

  /** Отменить отложенную смену: щелчок, клавиатура, уход из меню решают сами. */
  const cancel = useCallback(() => {
    pending.current = NONE;
    clearTimer();
  }, []);

  return { request, cancel };
}

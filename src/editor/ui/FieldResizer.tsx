"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";

/** Ниже поле не сжимается: Панель и несколько строк Документа (8 rem). */
export const FIELD_MIN_HEIGHT = 128;

/** Шаг стрелок; Shift — по пикселю, как у `SplitPanel`. */
const STEP = 16;
const FINE_STEP = 1;

export interface FieldResizerProps {
  /** Область Документа, высоту которой тянут. */
  area: HTMLElement | null;
  /** Высота, заданная рукой; `null` — стартовая (`maxHeight` или высота Документа). */
  height: number | null;
  onHeight: (height: number | null) => void;
  disabled: boolean;
}

/**
 * Ручка высоты поля (`resizable`, ADR-0059): полоса у нижнего края области
 * Документа с хватом по центру, в словаре полосы `SplitPanel`. Нативный
 * `resize: vertical` браузер рисует своим уголком, который не берёт тему: в
 * тёмной он белый квадрат на рамке поля.
 *
 * Видимая полоса — 10 px, зона попадания расширена псевдоэлементом до 26
 * (WCAG 2.5.8). С клавиатуры — скрытый ползунок `range`: стрелки вверх и вниз
 * по 16 px, с Shift — по пикселю. Двойной щелчок возвращает стартовую высоту.
 */
export function FieldResizer({ area, height, onHeight, disabled }: FieldResizerProps) {
  const messages = useMessages().editor;
  const slider = useRef<HTMLInputElement>(null);
  const drag = useRef<{ from: number; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  /*
    Замер области — в состоянии, а не в рендере: высота на экране и высота
    содержимого (верх ползунка) обновляются наблюдателем размера, на фокусе
    ползунка и в начале тяги. Стартовая высота бывает в `rem` и `vh`, поэтому
    она меряется, а не выводится из `maxHeight`.
  */
  const [measured, setMeasured] = useState({ size: FIELD_MIN_HEIGHT, content: 0 });
  const measure = () => {
    if (!area) return;
    const size = Math.round(area.getBoundingClientRect().height);
    setMeasured((prev) =>
      prev.size === size && prev.content === area.scrollHeight
        ? prev
        : { size, content: area.scrollHeight }
    );
  };
  useEffect(() => {
    // Сразу, не дожидаясь наблюдателя: он срабатывает только с кадром
    // отрисовки, и до него ползунок называл бы нижнюю границу, а не высоту.
    measure();
    if (!area || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(area);
    return () => observer.disconnect();
    // `measure` читает только `area`: наблюдатель пересоздаётся вместе с ней.
  }, [area]);

  const current = height ?? measured.size;
  const commit = (value: number) => onHeight(Math.max(FIELD_MIN_HEIGHT, Math.round(value)));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      from: event.clientY,
      size: Math.round(area?.getBoundingClientRect().height ?? current),
    };
    measure();
    setDragging(true);
    // Потянул мышью — дотянул стрелками: фокус на ползунок, как у `SplitPanel`.
    // Без `preventDefault` следующий за `pointerdown` `mousedown` по
    // нефокусируемой полосе тут же уводит фокус на `body`.
    event.preventDefault();
    slider.current?.focus({ preventScroll: true });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    // Кнопку отпустили мимо полосы, и захват потерян: граница не едет без нажатия.
    if (event.buttons === 0) {
      endDrag(event);
      return;
    }
    commit(from.size + event.clientY - from.from);
  }

  function endDrag(event?: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (event && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const down = event.key === "ArrowDown" || event.key === "ArrowRight";
    const up = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!down && !up) return;
    event.preventDefault();
    const step = event.shiftKey ? FINE_STEP : STEP;
    commit(current + (down ? step : -step));
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={() => endDrag()}
      onDoubleClick={() => !disabled && onHeight(null)}
      className={cn(
        "group relative -mx-3 flex h-2.5 shrink-0 touch-none items-center justify-center",
        "before:absolute before:inset-x-0 before:-inset-y-2 before:content-['']",
        disabled ? "cursor-not-allowed" : "cursor-row-resize",
        dragging && "select-none"
      )}
    >
      {/* Хват: пилюля, как у полосы `SplitPanel`, но тише — это край поля, а не граница областей. */}
      <span
        aria-hidden
        className={cn(
          "bg-line duration-fast h-0.5 w-7 rounded-full transition-colors",
          !disabled && "group-hover:bg-fg-2",
          dragging && "bg-accent-strong",
          "group-has-[:focus-visible]:bg-accent-strong group-has-[:focus-visible]:ring-[3px] group-has-[:focus-visible]:ring-[color:var(--focus-ring)]"
        )}
      />
      <input
        ref={slider}
        type="range"
        aria-label={messages.resizeField}
        aria-orientation="vertical"
        aria-valuetext={messages.fieldHeight({ size: current })}
        min={FIELD_MIN_HEIGHT}
        max={Math.max(current, measured.content, FIELD_MIN_HEIGHT)}
        step={FINE_STEP}
        value={current}
        disabled={disabled}
        onFocus={measure}
        onKeyDown={onKeyDown}
        onChange={(event) => commit(Number(event.target.value))}
        className="pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent opacity-0"
      />
    </div>
  );
}

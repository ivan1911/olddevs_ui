"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface BadgeProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Что показать: число или короткая метка. */
  children?: ReactNode;
  /** Цветовой тон значка: `neutral`, `accent`, `success`, `warning` или `danger`. По умолчанию `danger`. */
  tone?: Tone;
  /**
   * Точка вместо числа: «есть новое», без указания сколько.
   *
   * Нужна там, где число не помогает: значок уведомлений с «237» читается
   * хуже, чем просто отметка о том, что смотреть есть что.
   */
  dot?: boolean;
  /** Предел числа: сверх него показывается «99+». */
  max?: number;
  /**
   * Положить значок поверх иконки: в правый верхний угол родителя, у которого
   * задан `position` (обычно `relative`).
   */
  overlay?: boolean;
}

/**
 * Счётчик или короткая метка.
 *
 * ГРАНИЦА С СОСЕДЯМИ — единственное, что здесь стоит объяснить, потому что
 * три компонента кита выглядят похоже и означают разное:
 *
 *   `Badge`       — СКОЛЬКО. Число рядом с чем-то: непрочитанных пять,
 *                   в очереди двенадцать. Само по себе не кликается.
 *   `StatusBadge` — В КАКОМ СОСТОЯНИИ сущность: черновик, опубликован,
 *                   ошибка. Значение из закрытого набора, не число.
 *   `Chip count`  — счётчик ВНУТРИ фильтра: сколько найдётся, если нажать.
 *                   Часть кликабельной пилюли, а не самостоятельный знак.
 *
 * Перепутать легко, и цена ошибки не косметическая: `StatusBadge` тоном
 * сообщает состояние («ошибка» красным), а `Badge` тоном — важность. Красный
 * счётчик рядом с иконкой означает «срочно», а не «сломалось».
 */
export function Badge({
  children,
  tone = "danger",
  dot,
  max = 99,
  overlay,
  className,
  ...rest
}: BadgeProps) {
  const t = TONE_TOKENS[tone];

  const content = typeof children === "number" && children > max ? `${max}+` : children;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        t.solid,
        dot
          ? "size-2"
          : // Минимальная ширина равна высоте: счётчик «1» обязан быть кругом,
            // а не узкой таблеткой, иначе ряд значков выглядит рваным.
            "text-caption h-4 min-w-4 px-1",
        // Наложение — абсолютное позиционирование в углу соседа; кольцо цветом
        // подложки отделяет значок от иконки под ним.
        overlay && "ring-bg-1 absolute -top-1 -right-1 ring-2",
        className
      )}
      {...rest}
    >
      {dot ? null : content}
    </span>
  );
}

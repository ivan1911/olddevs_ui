"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface ChipProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  /** Подпись чипа. Спрятанная `iconOnly`/`mobileIconOnly`, остаётся доступным именем кнопки. */
  children?: ReactNode;
  /** Только `sm` и `md`: чип крупнее среднего перестаёт читаться как чип. */
  size?: Extract<Size, "sm" | "md">;
  /** Цвет выбранного состояния. На невыбранный чип не влияет — он всегда нейтрален. */
  tone?: Tone;
  /** Было `active`. Переименовано: словарь допускает только `selected`. */
  selected?: boolean;
  /** Иконка перед подписью. */
  icon?: ReactNode;
  /** Счётчик справа. Ноль отображается, `null`/`undefined` — нет. */
  count?: number | null;
  /** Скрыть подпись всегда, оставив иконку. */
  iconOnly?: boolean;
  /** Скрыть подпись только на узких экранах (< 640px). */
  mobileIconOnly?: boolean;
}

const SIZES: Record<"sm" | "md", string> = {
  sm: "h-7 gap-1.5 px-2.5 text-xs",
  md: "h-8 gap-2 px-3 text-[13px]",
};

/**
 * Фильтрующий чип — эталон variant-API дизайн-системы.
 *
 * Три вещи, которые отличают его от версии во фронте и которым следуют
 * остальные примитивы:
 *
 * 1. Все состояния — CSS, а не React. Ни `useState`, ни обработчиков мыши:
 *    hover, focus-visible, disabled и нажатие описаны псевдоклассами. Компонент
 *    не перерисовывается от наведения курсора.
 * 2. Ни одного инлайн-`style`. Только Tailwind-утилиты поверх токенов, поэтому
 *    смена темы работает без участия JS.
 * 3. Явный `:focus-visible`. Глобальное правило в `styles.css` его тоже даёт,
 *    но примитив не должен зависеть от того, подключил ли потребитель базовые стили.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    children,
    size = "md",
    tone = "accent",
    selected = false,
    icon,
    count,
    iconOnly = false,
    mobileIconOnly = false,
    className,
    type = "button",
    ...rest
  },
  ref
) {
  const t = TONE_TOKENS[tone];

  return (
    <button
      ref={ref}
      type={type}
      // Кнопка-переключатель: скринридер должен сообщать состояние, а не только подпись.
      aria-pressed={selected}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center rounded-full border font-semibold",
        "transition-colors",
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        SIZES[size],
        selected
          ? cn(t.border, t.bg, "text-fg-0")
          : "border-line-soft text-fg-1 hover:bg-bg-2 hover:text-fg-0 bg-transparent",
        className
      )}
      {...rest}
    >
      {icon ? <span className="shrink-0 opacity-70">{icon}</span> : null}
      {/*
        Спрятанная подпись остаётся в дереве доступности, а не исчезает из
        разметки. Раньше `iconOnly` выбрасывал `children` совсем, а
        `mobileIconOnly` гасил их через `hidden` (`display: none`) — и то и
        другое убирает узел из дерева, то есть кнопка остаётся БЕЗ ИМЕНИ.
        Видно это было только аудитом: глазами иконка на месте, чип работает.

        `sr-only` прячет визуально, оставляя для скринридера; `sm:not-sr-only`
        возвращает подпись на широком экране. Один узел вместо двух — копия
        рядом читалась бы дважды.
      */}
      {children != null ? (
        <span
          className={
            iconOnly ? "sr-only" : mobileIconOnly ? "sr-only sm:not-sr-only sm:inline" : undefined
          }
        >
          {children}
        </span>
      ) : null}
      {/*
        Счётчик отличается от подписи начертанием, а не цветом. Свой `text-fg-3`
        здесь был фиксированным серым поверх подложки, которая меняется вместе
        с тоном: на `accent-soft` он давал 4.26, на `warning-soft` — 3.85.
        Наследуемый цвет проходит по определению — он тот же, что у подписи,
        а её контраст уже проверен.
      */}
      {count != null ? <span className="font-mono tabular-nums">{count}</span> : null}
    </button>
  );
});

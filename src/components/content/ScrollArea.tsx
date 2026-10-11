"use client";

import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";

export interface ScrollAreaProps extends ComponentPropsWithoutRef<"div"> {
  /** Направление прокрутки: `vertical` или `horizontal`. По умолчанию `vertical`. */
  orientation?: "vertical" | "horizontal";
  /**
   * Доступное имя области.
   *
   * Задавать его стоит там, где прокручиваемый кусок — самостоятельная часть
   * экрана: список пунктов, панель фильтров. Без имени область остаётся просто
   * прокручиваемым блоком — это законно и не хуже: `role="region"` без имени
   * скринридер называет только по роли: «регион».
   */
  label?: string;
}

/**
 * Прокручиваемая область со стилизованной полосой.
 *
 * Своя, а не зависимость. `@radix-ui/react-scroll-area` подменяет родную
 * прокрутку своей: рисует полосу дивами и считает положение в JS. Это даёт
 * одинаковый вид во всех браузерах — и отнимает инерцию прокрутки на
 * тачпадах, `scroll-behavior`, поиск по странице, прокрутку колесом с
 * зажатым Shift. Кит арендует поведение там, где своё было бы второй
 * библиотекой (см. ADR-0005), а здесь родное поведение уже есть и лучше.
 *
 * Полоса красится псевдоэлементами WebKit и `scrollbar-*` в Firefox. В
 * браузерах, где не работает ни то, ни другое, останется системная полоса —
 * это вид, а не поломка.
 */
export function ScrollArea({
  orientation = "vertical",
  label,
  className,
  children,
  ...rest
}: ScrollAreaProps) {
  return (
    <div
      /*
        `tabIndex={0}` обязателен, и это не вкусовщина: прокручиваемый блок,
        до которого нельзя добраться с клавиатуры, — нарушение, которое ловит
        axe правилом `scrollable-region-focusable`. Без фокуса содержимое
        области недоступно тому, кто не пользуется мышью.
      */
      tabIndex={0}
      role={label ? "region" : undefined}
      aria-label={label}
      className={cn(
        "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        orientation === "vertical" ? "overflow-y-auto" : "overflow-x-auto",
        // Firefox: два свойства и всё.
        "[scrollbar-width:thin] [scrollbar-color:var(--border-default)_transparent]",
        // WebKit: полоса, дорожка, бегунок.
        "[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-line [&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb:hover]:bg-fg-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

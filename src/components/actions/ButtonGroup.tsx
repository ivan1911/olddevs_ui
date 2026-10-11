"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface ButtonGroupProps extends ComponentPropsWithRef<"div"> {
  /** Кнопки. Обычные `Button` — своего вида группа им не навязывает. */
  children?: ReactNode;
  /** Направление ряда: `horizontal` — в строку, `vertical` — в столбец. По умолчанию `horizontal`. */
  orientation?: "horizontal" | "vertical";
  /**
   * Доступное имя группы.
   *
   * Задавать стоит там, где кнопки образуют одно решение («Вид: список,
   * плитка»). Без имени группа остаётся просто рядом кнопок — это законно и
   * ничего не ломает.
   */
  "aria-label"?: string;
}

/**
 * Ряд кнопок, сцепленных в один блок.
 *
 * Скругления и рамки правит ГРУППА, а не кнопки: иначе каждая кнопка должна
 * была бы знать, где она стоит в ряду, — то есть получить проп «я первая»,
 * который в одиночном применении не значит ничего.
 *
 * Делается это селекторами по потомкам, а не классами на детях, и поэтому
 * работает с любым содержимым: обычной кнопкой, `iconOnly`, кнопкой-ссылкой
 * через `asChild`. Соседям срезается общая граница (`-ml-px`), чтобы двойная
 * рамка между кнопками не читалась толще внешней.
 *
 * `role="group"` ставится только вместе с именем: безымянная группа — это
 * лишнее объявление в речи скринридера, за которым не следует ничего.
 */
export function ButtonGroup({
  children,
  orientation = "horizontal",
  className,
  ...rest
}: ButtonGroupProps) {
  const horizontal = orientation === "horizontal";

  return (
    <div
      role={rest["aria-label"] ? "group" : undefined}
      className={cn(
        "inline-flex",
        horizontal ? "flex-row" : "flex-col",
        // Внутренние углы срезаются, внешние остаются.
        horizontal
          ? "[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none"
          : "[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none",
        // Кнопка под курсором и в фокусе поднимается над соседями: иначе её
        // рамку и кольцо фокуса перекрывает соседняя, и подсветка выглядит
        // обрезанной с одной стороны.
        "[&>*:focus-visible]:relative [&>*:focus-visible]:z-10 [&>*:hover]:relative [&>*:hover]:z-10",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

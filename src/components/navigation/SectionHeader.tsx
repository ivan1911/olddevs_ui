"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import type { Size } from "../../lib/variants.js";

export interface SectionHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Заголовок: строка или разметка, например иконка с подписью, счётчик, переключатель периода. */
  title: ReactNode;
  /** Действия справа: ссылка, кнопка, счётчик. */
  right?: ReactNode;
  /** Кегль заголовка: `sm` — мельче, `md` — крупнее (по умолчанию). */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Уровень заголовка в документе: `h2`, `h3` (по умолчанию) или `h4`.
   *
   * Уровень заголовка в документе — отдельно от размера, по тому же правилу,
   * что у `Heading`: порядок заголовков обязан быть непрерывным, а кегль к
   * нему не привязан.
   *
   * Умолчание `3` — то, что компонент рисовал всегда. Оно верно для секции
   * внутри карточки, стоящей под заголовком секции страницы, и неверно сразу
   * под `PageHeader`: там между `h1` и `h3` образуется дыра, и оглавление для
   * скринридера рвётся. На таком экране передавайте `level={2}`.
   */
  level?: 2 | 3 | 4;
}

/** Шкала заголовков секции. Обе ступени взяты из фактических вызовов. */
const SIZES = {
  sm: "text-[13px]",
  md: "text-[15px]",
} as const;

/**
 * Заголовок секции внутри карточки: подпись слева, действия справа.
 *
 * `title` типизирован как `ReactNode`, а не как строка, потому что во фронте
 * в него кладут разметку — иконку с подписью, счётчик, переключатель периода.
 * Сузить тип до строки значило бы сломать восемь вызовов из семнадцати.
 */
export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(function SectionHeader(
  { title, right, size = "md", level = 3, className, ...rest },
  ref
) {
  const Comp = `h${level}` as const;

  return (
    <div ref={ref} className={cn("mb-3.5 flex items-center justify-between", className)} {...rest}>
      <Comp className={cn("m-0 font-bold", SIZES[size])}>{title}</Comp>
      {right}
    </div>
  );
});

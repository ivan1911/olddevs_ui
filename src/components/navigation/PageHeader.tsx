"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface PageHeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Заголовок страницы. `ReactNode`: во фронте сюда кладут разметку с иконкой. */
  title: ReactNode;
  /** Пояснение под заголовком. */
  subtitle?: ReactNode;
  /** Кнопки справа; на узких экранах переносятся под заголовок. */
  actions?: ReactNode;
}

/**
 * Шапка страницы: заголовок, пояснение и действия.
 *
 * Размера у него нет и не будет: страница одна, и второй ступени взяться
 * неоткуда. Заводить `size` «на будущее» — ровно то, чего пакет избегает.
 */
export const PageHeader = forwardRef<HTMLDivElement, PageHeaderProps>(function PageHeader(
  { title, subtitle, actions, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        "mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className
      )}
      {...rest}
    >
      <div>
        <h1 className="m-0 text-[26px] font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="text-fg-2 mt-1.5 text-[13px]">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
});

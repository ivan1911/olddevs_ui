"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface StatusBadgeProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Подпись состояния. Сопоставление «статус → тон и подпись» остаётся за потребителем. */
  children: ReactNode;
  /** Цвет подложки, текста и точки из словаря тонов. По умолчанию `neutral`. */
  tone?: Tone;
  // Через Extract от общего Size, а не собственным union: если в словарь добавят
  // размер, здесь это увидит компилятор, а не читатель кода.
  /** Высота бейджа: `sm` — компактный, `md` — выше. По умолчанию `sm`. */
  size?: Extract<Size, "sm" | "md">;
  /** Точка-индикатор слева, цвета тона. По умолчанию показана. */
  dot?: boolean;
}

const SIZES = {
  sm: "h-[18px] gap-1.5 pr-2 pl-1.5 text-[11px]",
  md: "h-[22px] gap-1.5 pr-2.5 pl-2 text-xs",
} as const;

/**
 * Бейдж состояния: приглушённая подложка тона, текст цветом тона, точка слева.
 *
 * Версия во фронте держала внутри словарь из 11 доменных статусов вместе с
 * русскими подписями — `in_progress` → «В процессе», `duplicate` → «Дубль».
 * Пакету знать о доменных статусах нельзя: он не про обои и не про публикации.
 * Поэтому здесь остаётся только форма, а сопоставление «статус → тон + подпись»
 * живёт во фронте, рядом с доменом.
 *
 * Размеры и отступы прежней версии задавались инлайн-числами (`fontSize: 11`,
 * `padding: "3px 8px 3px 6px"`) мимо шкалы токенов — здесь это утилиты.
 */
export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { children, tone = "neutral", size = "sm", dot = true, className, ...rest },
  ref
) {
  const t = TONE_TOKENS[tone];

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full font-semibold tracking-wider whitespace-nowrap",
        SIZES[size],
        t.bg,
        t.fg,
        className
      )}
      {...rest}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dotBg)} />
      ) : null}
      {children}
    </span>
  );
});

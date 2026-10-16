"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";

export interface TooltipProps {
  /** Текст подсказки. Пусто — тултипа нет, `children` рендерится как есть. */
  content?: ReactNode;
  /** Элемент, к которому крепится подсказка. Должен принимать ref. */
  children: ReactElement;
  /** С какой стороны от элемента показать подсказку: `top`, `right`, `bottom` или `left`. Не хватает места — Radix переносит на другую. */
  side?: TooltipPrimitive.TooltipContentProps["side"];
  /** Выравнивание подсказки вдоль стороны: `start`, `center` или `end`. */
  align?: TooltipPrimitive.TooltipContentProps["align"];
  /** Сколько миллисекунд наведение держится до показа. Не задано — задержка из `TooltipProvider`. */
  delayDuration?: number;
}

/**
 * Подсказка при наведении и фокусе.
 *
 * Поведение — `@radix-ui/react-tooltip` из `dependencies` пакета: он приезжает
 * вместе с китом, потребитель его не ставит (ADR-0072). Тултип держит фокус,
 * Escape, порталы и позиционирование у края экрана, и своя реализация этого
 * была бы не примитивом, а второй библиотекой.
 *
 * `TooltipProvider` здесь НЕ встроен в каждый экземпляр намеренно: провайдер
 * задаёт общую задержку и группировку подсказок на всё приложение, и вложенные
 * провайдеры эту группировку ломают. Потребитель ставит один на корень.
 *
 * Пустой `content` возвращает `children` без обёртки — так вызывающему не нужно
 * ветвиться самому, а лишний слой DOM не появляется.
 */
export function Tooltip({ content, children, side, align, delayDuration }: TooltipProps) {
  if (!content) return children;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side} align={align}>
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

export const TooltipContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 6, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          // Полупрозрачная подложка на токенах темы: цвет меняется вместе с
          // `data-theme` без участия JS.
          //
          // `z-[120]` — по той же причине, что у `Popover`: подсказку всегда
          // вызывают из того, что уже на экране, поэтому под оверлеем она не
          // нужна никогда. При `z-[60]` она уходила под `ModalOverlay` (`z-90`)
          // и под ящик редактирования во фронте (`z-100`) — в разметке есть,
          // на экране нет, причём ровно у кнопок с одними иконками, где
          // подсказка и есть подпись.
          OVERLAY_LAYER.popover,
          "text-fg-0 border-line-soft shadow-2 rounded-control max-w-[240px] border px-2.5 py-1.5",
          "bg-[color-mix(in_srgb,var(--bg-1)_85%,transparent)] backdrop-blur-[10px]",
          "text-xs font-medium select-none",
          "origin-[var(--radix-tooltip-content-transform-origin)]",
          "data-[state=delayed-open]:animate-tooltipIn data-[state=instant-open]:animate-tooltipIn",
          "data-[state=closed]:animate-tooltipOut",
          className
        )}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
});

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

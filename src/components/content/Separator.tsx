"use client";

import {
  Separator as RACSeparator,
  SeparatorContext,
  useSlottedContext,
  type SeparatorProps as RACSeparatorProps,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";

export interface SeparatorProps extends Omit<RACSeparatorProps, "elementType"> {
  /** Отступы вокруг черты. `none` — когда расстояние задаёт раскладка снаружи. */
  spacing?: "none" | "sm" | "md";
}

const SPACING_CLASS = {
  horizontal: { none: "", sm: "my-2", md: "my-4" },
  vertical: { none: "", sm: "mx-2", md: "mx-4" },
} as const;

/**
 * Разделительная черта.
 *
 * Взят у react-aria, а не нарисован `<div className="border-t">`, ровно из-за
 * одной вещи: роль. Черта, разделяющая **группы** (пункты меню, блоки панели),
 * обязана быть `role="separator"` — скринридер объявляет ею границу группы.
 * Черта, которая просто украшает, обязана быть скрыта от него совсем.
 *
 * Различать эти два случая — работа вызывающего, и react-aria ставит роль сам,
 * а вертикальной черте добавляет `aria-orientation`. Рукописная версия почти
 * всегда останавливается на `border-t` и не сообщает ни того, ни другого.
 */
export function Separator({
  orientation: orientationProp,
  spacing = "none",
  className,
  ...rest
}: SeparatorProps) {
  /*
    Ось берётся из контекста react-aria, когда пропа нет: `Toolbar` кладёт туда
    направление поперёк своей оси, и черта между группами действий ложится
    нужным боком без подсказки. Явный проп всегда сильнее контекста; вне панели
    контекст пуст, и черта горизонтальна, как раньше.
  */
  // Хук — безусловно: за `??` он вызывался бы не на каждом рендере.
  const fromContext = useSlottedContext(SeparatorContext)?.orientation;
  const orientation = orientationProp ?? fromContext ?? "horizontal";
  return (
    <RACSeparator
      orientation={orientation}
      className={cn(
        "bg-line-soft border-0",
        // Толщина в один пиксель задаётся размером, а не рамкой: рамка на
        // элементе без содержимого даёт разную высоту в разных браузерах.
        orientation === "vertical" ? "h-full w-px self-stretch" : "h-px w-full",
        SPACING_CLASS[orientation][spacing],
        className
      )}
      {...rest}
    />
  );
}

"use client";

import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { cn } from "../../lib/cn.js";

export interface AspectRatioProps extends ComponentPropsWithoutRef<"div"> {
  /**
   * Отношение сторон числом: `16 / 9`, `1`, `9 / 16`.
   *
   * Числом, а не строкой `"16:9"`: строку пришлось бы разбирать, а ошибку в
   * ней («16/9» вместо «16:9») компилятор не поймал бы. Арифметику же он
   * посчитает сам.
   */
  ratio?: number;
}

/**
 * Коробка с заданным отношением сторон — под превью обоев, аватары, миниатюры.
 *
 * Стоит на родном `aspect-ratio`, а не на приёме с `padding-bottom: 56.25%`:
 * тот требует абсолютно позиционированного содержимого, то есть диктует
 * раскладку внутри, и ломается на всём, что должно расти по содержимому.
 *
 * Отношение уходит в inline-стиль, а не в класс `aspect-[16/9]`: класс с
 * произвольным значением Tailwind обязан увидеть в исходнике текстом, а число
 * приходит пропом в рантайме. Тот же случай, что у многострочной обрезки
 * в `Text`.
 */
export function AspectRatio({
  ratio = 16 / 9,
  className,
  style,
  children,
  ...rest
}: AspectRatioProps) {
  return (
    <div
      className={cn("relative w-full overflow-hidden", className)}
      style={{ aspectRatio: String(ratio), ...style } as CSSProperties}
      {...rest}
    >
      {children}
    </div>
  );
}

"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";

export interface SkeletonProps extends ComponentPropsWithoutRef<"div"> {
  /** Ширина. Число трактуется как пиксели, строка — как CSS-значение. */
  width?: number | string;
  /** Высота. Число — пиксели, строка — любое CSS-значение. */
  height?: number | string;
  /** Скругление. По умолчанию `--r-md`. */
  borderRadius?: number | string;
}

/**
 * Плейсхолдер загрузки: прямоугольник с бегущим бликом.
 *
 * Единственный примитив пакета, который принимает размеры числами и кладёт их
 * в инлайн-`style`, — и это не недосмотр. Скелетон повторяет форму того, что
 * подменяет: 43 вызова во фронте задают 12 разных сочетаний ширины, высоты
 * и скругления (`4`, `10`, `3`, `6`, `8`, `0`, `"50%"`, `9999`). Шкала из трёх
 * ступеней здесь не описывает предметную область, а мешает: под каждый новый
 * блок пришлось бы заводить ступень.
 *
 * Сам блик — правило `.skeleton` в `styles.css` (градиент + `shimmer`), а не
 * утилиты: анимация с `background-position` в утилитах не выражается.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { width, height, borderRadius, className, style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("skeleton", className)}
      style={{ width, height, borderRadius: borderRadius ?? "var(--r-md)", ...style }}
      {...rest}
    />
  );
});

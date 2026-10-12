"use client";

import { useCallback, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip } from "../overlays/Tooltip.js";

export interface TruncateProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Текст. Строка, а не вёрстка: подсказка показывает то же самое значение. */
  children: string;
  /** Сколько строк показывать. `1` — обрезка в строку с многоточием. */
  lines?: number;
  /** Сторона, с которой всплывает подсказка с полным текстом. По умолчанию `top`. */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Текст, обрезанный по ширине, с подсказкой полного значения.
 *
 * ПОДСКАЗКА ПОЯВЛЯЕТСЯ ТОЛЬКО КОГДА ТЕКСТ ДЕЙСТВИТЕЛЬНО ОБРЕЗАН. Подсказка на
 * неусечённом тексте — шум: она повторяет то, что и так видно, и приучает её
 * игнорировать. Обрезанность МЕРЯЕТСЯ (`scrollWidth > clientWidth`), а не
 * угадывается по длине строки: сколько символов влезло, зависит от ширины
 * контейнера и шрифта, а не от числа символов.
 *
 * Замер повторяется при изменении размеров через `ResizeObserver`: колонка
 * таблицы, потянутая мышью, меняет обрезанность, не меняя текста.
 *
 * ПОЛНОЕ ЗНАЧЕНИЕ ДОСТУПНО С КЛАВИАТУРЫ. Обрезанный текст получает
 * `tabIndex={0}`, и подсказка открывается по фокусу так же, как по наведению.
 * Без этого значение было бы доступно только мышью — то есть недоступно вовсе
 * для того, кто мышью не пользуется.
 *
 * Скринридер при этом читает текст ЦЕЛИКОМ и без нашей помощи: обрезка
 * визуальная, в DOM лежит вся строка.
 */
export function Truncate({ children, lines = 1, side = "top", className, ...rest }: TruncateProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (el == null) return;
    setTruncated(el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
  }, []);

  /*
    `truncated` в зависимостях — не для перерасчёта, а для ПЕРЕПОДПИСКИ. Когда
    текст впервые оказывается обрезанным, `span` заворачивается в `Tooltip`, и
    React пересоздаёт узел: старый, на который был подписан наблюдатель,
    умирает, а новый остаётся без наблюдателя. Колонка, расширенная после
    обрезки, тогда не снимала ни `tabIndex`, ни подсказку — нашло ревью 2.5.0.
    Повторный `measure()` при этом ничего не меняет: значение то же, и React
    перерисовку пропускает.
  */
  useEffect(() => {
    measure();
    const el = ref.current;
    if (el == null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children, lines, truncated]);

  const text = (
    <span
      ref={ref}
      // Фокус — только у обрезанного: неусечённый текст в порядке обхода
      // клавиатурой не нужен и мешал бы.
      tabIndex={truncated ? 0 : undefined}
      className={cn(
        "focus-visible:outline-accent-strong min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2",
        lines === 1
          ? "block truncate"
          : // `block` сюда нельзя: в CSS он стоит позже `[display:-webkit-box]`,
            // перебивает его, и `line-clamp` молча не работает.
            // Многострочная обрезка: `line-clamp` считает строки сам, и число
            // приходит переменной — иначе класс собирался бы конкатенацией, а
            // такого текста в исходниках нет и Tailwind его не увидит.
            "[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]",
        className
      )}
      style={lines === 1 ? undefined : { WebkitLineClamp: lines }}
      {...rest}
    >
      {children}
    </span>
  );

  // Без обрезки тултипа нет вовсе: `Tooltip` с пустым `content` рендерит
  // ребёнка как есть, но лишняя обёртка ни к чему.
  if (!truncated) return text;

  return (
    <Tooltip content={children} side={side}>
      {text}
    </Tooltip>
  );
}

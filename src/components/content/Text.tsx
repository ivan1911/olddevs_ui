"use client";

import type { ComponentPropsWithRef, CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { NUMERIC_CLASS, TONE_TOKENS, type Numeric, type Tone } from "../../lib/variants.js";

/** Ступени шкалы, доступные тексту. Заголовочные (`xl`, `2xl`) — у `Heading`. */
export type TextSize = "caption" | "xs" | "sm" | "md" | "lg";

export interface TextProps extends Omit<ComponentPropsWithRef<"p">, "color"> {
  /** Ступень размера текста: `caption`, `xs`, `sm`, `md` или `lg`. По умолчанию `md`. */
  size?: TextSize;
  /**
   * Приглушённость: `1` — основной текст, `2` — вторичный, `3` — служебный.
   *
   * Это НЕ уровень заголовка, хотя проп `Heading` называется так же. Разводить
   * их именами было бы честнее, но у `Heading` `level` — понятие HTML, а не
   * выдумка кита, и переименовывать надо было бы именно его. Здесь же за
   * «уровнем» стоит ровно то же слово в бытовом смысле: насколько текст важен.
   *
   * Спутать их на практике нечем: у `Text` нет ни `h1`, ни роли заголовка, а у
   * `Heading` нет приглушённости — заголовок бледнее основного текста не бывает.
   */
  level?: 1 | 2 | 3;
  /**
   * Семантический цвет. `neutral` (по умолчанию) означает «цвет по
   * приглушённости»: тон и `level` — разные оси, и смешивать их нельзя.
   */
  tone?: Tone;
  /** Начертание: `regular`, `medium` или `bold`. По умолчанию `regular`. */
  weight?: "regular" | "medium" | "bold";
  /**
   * Начертание цифр: `tabular` — равной ширины, для того, что тикает,
   * пересчитывается или стоит колонкой.
   *
   * Умолчания нет намеренно: цифры равной ширины шире пропорциональных, и в
   * обычном тексте они читаются хуже. Ось включается там, где числа меняются
   * на месте, а не везде.
   */
  numeric?: Numeric;
  /**
   * Обрезка многоточием. `true` — одна строка, число — столько строк.
   */
  truncate?: boolean | number;
  /** Тег текста: `p`, `span` или `div`. По умолчанию `p`. */
  as?: "p" | "span" | "div";
}

const SIZE_CLASS: Record<TextSize, string> = {
  caption: "text-caption",
  xs: "text-xs",
  sm: "text-sm",
  md: "text-md",
  lg: "text-lg",
};

/**
 * Приглушённость. Ступени взяты те же, что во всём ките: `fg-0` — основной,
 * `fg-1` — вторичный, `fg-2` — служебный. Ниже (`fg-3`, `fg-4`) шкала не идёт:
 * те два уровня не проходят контраст 4.5 на подложках приложения и оставлены
 * для нетекстовых ролей — иконок и разделителей.
 */
const LEVEL_CLASS: Record<1 | 2 | 3, string> = {
  1: "text-fg-0",
  2: "text-fg-1",
  3: "text-fg-2",
};

const WEIGHT_CLASS = {
  regular: "font-normal",
  medium: "font-medium",
  bold: "font-semibold",
} as const;

/**
 * Абзац или строка текста на ступени шкалы.
 *
 * Компонент существует не ради `<p className="text-sm">`, а ради того, чтобы
 * размер и приглушённость брались из двух конечных наборов. До шкалы кит
 * пользовался восемью размерами, три из которых произвольные, и разница между
 * «служебной подписью» и «вторичным текстом» жила в голове автора экрана.
 *
 * Тега по умолчанию два не бывает: `as` меняет только тег и ничего в виде —
 * `<span>` внутри строки и `<p>` в абзаце обязаны выглядеть одинаково.
 */
export function Text({
  size = "md",
  level = 1,
  tone = "neutral",
  weight = "regular",
  numeric,
  truncate,
  as: Comp = "p",
  className,
  style,
  ...rest
}: TextProps) {
  // Ноль строк — это не «без предела», а спрятанный текст: `-webkit-line-clamp: 0`
  // на коробке с `overflow: hidden` не показывает ничего. Считаем это опечаткой
  // вызывающего и обрезаем как одну строку.
  const lines = typeof truncate === "number" && truncate > 0 ? truncate : undefined;
  const oneLine = truncate === true || truncate === 0;

  return (
    <Comp
      className={cn(
        SIZE_CLASS[size],
        // Тон перекрывает приглушённость: у окрашенного текста «вторичность»
        // выражается самим тоном, а не второй краской поверх. Гасить тон
        // прозрачностью нельзя — тона откалиброваны ровно под 4.5.
        tone === "neutral" ? LEVEL_CLASS[level] : TONE_TOKENS[tone].fg,
        WEIGHT_CLASS[weight],
        numeric && NUMERIC_CLASS[numeric],
        oneLine && "truncate",
        // Многострочная обрезка — классы коробки литеральные, а число строк
        // уходит в inline-стиль. Собрать `line-clamp-${lines}` нельзя: Tailwind
        // сканирует исходники как текст, и класс, склеенный в рантайме, молча
        // не попадёт в CSS. Литеральный словарь на 2–6 строк закрыл бы обычные
        // случаи и врал бы на седьмой.
        lines != null && "[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical]",
        className
      )}
      style={lines != null ? ({ WebkitLineClamp: lines, ...style } as CSSProperties) : style}
      {...rest}
    />
  );
}

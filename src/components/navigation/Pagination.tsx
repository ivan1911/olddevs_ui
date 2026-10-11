"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { Button } from "../actions/Button.js";

export interface PaginationProps {
  /** Номер текущей страницы, с единицы. Значение вне диапазона зажимается в него. */
  page: number;
  /** Общее число страниц. При значении 1 и меньше компонент ничего не рисует. */
  pageCount: number;
  /** Вызывается с номером страницы, на которую перешли, — по номеру или стрелкам. */
  onChange: (page: number) => void;
  /** Сколько страниц показывать вокруг текущей с каждой стороны. */
  siblings?: number;
  /** Дополнительные классы на `nav`. */
  className?: string;
  /** Доступное имя навигации. По умолчанию берётся из словаря сообщений. */
  "aria-label"?: string;
}

/**
 * Диапазон страниц для показа.
 *
 * Алгоритм записан здесь, потому что «какие номера видны» — решение, а не
 * деталь: список из тридцати номеров бесполезен, а из трёх — не даёт прыгнуть
 * ни в начало, ни в конец.
 *
 * Правило: ВСЕГДА видны первая и последняя страница; вокруг текущей — по
 * `siblings` соседей; разрывы между этими группами схлопываются в многоточие.
 * Многоточие рисуется только когда за ним прячется БОЛЬШЕ одной страницы:
 * «1 … 3 4 5» вместо «1 2 3 4 5» врёт про длину и экономит ровно ничего.
 *
 * Ширина ряда при этом постоянна — `2×siblings + 5` ячеек, а на коротком
 * диапазоне столько, сколько всего страниц, — и кнопки
 * под курсором не прыгают при переходе на соседнюю страницу.
 */
export function pageRange(page: number, pageCount: number, siblings: number): (number | "gap")[] {
  const first = 1;
  const last = pageCount;
  /*
    Окно ДОБИВАЕТСЯ до постоянной ширины со стороны, где есть запас.

    Без этого ряд шёл 4→5→6→7→7→6→5→4 при `siblings=1` и десяти страницах, и
    переход 4→5 уводил кнопку «5» влево: повторный щелчок по той же точке экрана
    попадал в «4». Докстрока обещала обратное — постоянную ширину, — а постоянен
    был только максимум.

    Ширина СЧИТАЕТСЯ ПО ГОТОВОМУ РЯДУ, а не выводится формулой: крайние
    страницы и многоточия дают то одну ячейку, то две (ровно одну пропущенную
    страницу дешевле показать, чем спрятать), и арифметика «на глаз» здесь
    ошибается.
  */
  const width = Math.min(2 * siblings + 5, pageCount);
  /*
    Страница ЗАЖИМАЕТСЯ здесь, а не только в компоненте.

    Функция публичная (`index.ts`), и прямой вызов — ожидаемый сценарий:
    потребитель собирает свой ряд и берёт `?page=` из адреса. Шаг добивания
    единичный, поэтому со страницей вне диапазона цикл проходил `page −
    pageCount` итераций, каждая со сборкой массива: `page=1e9` не завершался
    вовсе — вкладка вешалась. Зажим в компоненте от этого не спасал, он ниже по
    стеку.
  */
  const current = clamp(page, first, last);
  let from = Math.max(first, current - siblings);
  let to = Math.min(last, current + siblings);

  while (build(from, to, first, last).length < width && (from > first || to < last)) {
    if (to < last) to += 1;
    else from -= 1;
  }
  // Последний шаг мог перескочить через цель: ячейка у края добавляет сразу
  // две (страницу и многоточие). Тогда откатываемся.
  if (build(from, to, first, last).length > width) {
    if (to > Math.min(last, page + siblings)) to -= 1;
    else if (from < Math.max(first, page - siblings)) from += 1;
  }

  return build(from, to, first, last);
}

/** Ряд ячеек для готового окна. Вынесен, чтобы ширину можно было измерить. */
function build(from: number, to: number, first: number, last: number): (number | "gap")[] {
  const out: (number | "gap")[] = [];

  if (from > first) {
    out.push(first);
    // Ровно одна пропущенная страница дешевле показать, чем спрятать.
    if (from === first + 2) out.push(first + 1);
    else if (from > first + 1) out.push("gap");
  }

  for (let p = from; p <= to; p++) out.push(p);

  if (to < last) {
    if (to === last - 2) out.push(last - 1);
    else if (to < last - 1) out.push("gap");
    out.push(last);
  }

  return out;
}

/**
 * Постраничная навигация.
 *
 * **При одной странице не рисуется ничего.** Пагинация из единственной кнопки
 * «1» — это не навигация, а мусор в раскладке: она сообщает о возможности
 * перехода там, где переходить некуда.
 *
 * Собрана руками, а не на react-aria: готового компонента там нет, а всё, что
 * нужно, — это `nav`, список кнопок и `aria-current`. Своей клавиатурной
 * механики здесь не появляется, кнопки ходятся обычным табом.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
  siblings = 1,
  className,
  "aria-label": ariaLabel,
}: PaginationProps) {
  const messages = useMessages();
  if (pageCount <= 1) return null;

  /*
    Страница вне диапазона — обычное дело: фильтр сузил выдачу, а номер
    остался прежним. Без зажима ряд вырождался в «1 …» без текущей страницы
    вовсе, а «предыдущая» вела на несуществующую.
  */
  const current = clamp(page, 1, pageCount);
  const range = pageRange(current, pageCount, siblings);

  return (
    <nav
      aria-label={ariaLabel ?? messages.pagination.label}
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        size="sm"
        iconOnly
        icon={<ChevronLeftIcon size={16} />}
        aria-label={messages.pagination.previous}
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      />

      {range.map((item, index) =>
        item === "gap" ? (
          // Многоточие — не кнопка: нажимать его некуда, а кнопка обещала бы
          // действие. Для скринридера оно скрыто, число страниц он и так знает.
          <span key={`gap-${index}`} aria-hidden className="text-fg-3 px-1 text-sm">
            …
          </span>
        ) : (
          <Button
            key={item}
            size="sm"
            variant={item === current ? "solid" : "ghost"}
            tone={item === current ? "accent" : "neutral"}
            // `aria-current` вместо `aria-selected`: страница — это место, а не
            // выбранный из набора элемент.
            aria-current={item === current ? "page" : undefined}
            onClick={() => onChange(item)}
          >
            {item}
          </Button>
        )
      )}

      <Button
        size="sm"
        iconOnly
        icon={<ChevronRightIcon size={16} />}
        aria-label={messages.pagination.next}
        disabled={current >= pageCount}
        onClick={() => onChange(current + 1)}
      />
    </nav>
  );
}

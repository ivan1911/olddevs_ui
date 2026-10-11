"use client";

import { Slot } from "@radix-ui/react-slot";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "../../lib/cn.js";
import type { Size } from "../../lib/variants.js";

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  /** Размер карточки (отступы): `sm` или `md`. По умолчанию `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Вывести карточку дочерним элементом, который умеет быть нажатым:
   * `<button>`, `<a>`, `next/link`. Пропы и `ref` сливаются с потомком — идиома та же, что у
   * `Button`.
   *
   * Заведено под конкретный дефект: карточка коллекции и карточка категории
   * во фронте были `<div onClick>` без роли и без `tabIndex` — с клавиатуры
   * они недостижимы вовсе, и скринридер о том, что сюда можно нажать, не
   * сообщает. Таких мест во фронте нашлось десять.
   *
   * **`asChild` включает и вид нажимаемого**: курсор, подсветку рамки на
   * наведении и кольцо фокуса. Иначе каждый потребитель дописывал бы это
   * руками — то есть ровно то расхождение, ради устранения которого карточка
   * и лежит в пакете. Карточка-контейнер (без `asChild` и без `interactive`)
   * не меняется ни на пиксель.
   */
  asChild?: boolean;
  /**
   * Карточка нажимаема, но действие живёт внутри неё — растянутой ссылкой
   * (`after:absolute after:inset-0`), а рядом стоят вторичные действия: меню
   * «Ещё», кнопка избранного.
   *
   * Отдельный случай от `asChild`, и различает их одно правило разметки:
   * вкладывать кнопку в кнопку нельзя — вложенная интерактивность недостижима
   * с клавиатуры. Поэтому карточка с меню внутри не может быть кнопкой целиком:
   * она остаётся контейнером, ссылка накрывает её площадь, а меню лежит выше
   * по слою и остаётся отдельной целью.
   *
   * Идиома в пакете не новая: так же устроена пилюля `Select` — внешний бокс,
   * растянутая по нему кнопка и крестик очистки рядом, а не внутри.
   *
   * Кольцо фокуса обводит всю карточку, когда сфокусирована именно растянутая
   * ссылка (`has-[a:focus-visible]`), а не любой потомок: иначе фокус на меню
   * обводил бы карточку целиком, обещая нажатие не туда.
   */
  interactive?: boolean;
}

/**
 * Отступ и радиус движутся парой, поэтому это одна ось, а не две.
 * Значения взяты из фактических вызовов во фронте, а не придуманы.
 */
const SIZES = {
  sm: "p-[14px] rounded-md",
  md: "p-[18px] rounded-lg",
} as const;

/**
 * Общий вид нажимаемого: курсор и подсветка рамки с `border-soft` до
 * `border-default` — тот же приём, что был во фронте руками.
 */
const INTERACTIVE = "cursor-pointer transition-colors hover:border-line";

/**
 * Слот-вариант: кольцо фокуса общее с кнопкой.
 *
 * `w-full text-left` здесь не косметика: `<button>` внутри сетки иначе ужмётся
 * по содержимому и отцентрирует текст, и карточка перестанет быть карточкой.
 */
const AS_CHILD =
  "w-full text-left " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2";

/** Контейнер под растянутую ссылку: ей нужна база позиционирования. */
const CONTAINER =
  "relative " +
  "has-[a:focus-visible]:outline-accent-strong has-[a:focus-visible]:outline-2 " +
  "has-[a:focus-visible]:outline-offset-2";

/**
 * Панель с рамкой и тенью.
 *
 * Прежняя версия принимала `padding` и `radius` отдельными числами и
 * подставляла их в инлайн-`style` — то есть допускала любое значение и шкалы
 * не имела. Разбор всех 16 вызовов во фронте показал, что ступеней ровно две
 * и обе оси всегда меняются вместе: `18/16` (12 вызовов) и `14/12` (4 вызова,
 * все в `SchedulePostCards.jsx`). Поэтому здесь одна ось `size`.
 *
 * Значения намеренно оставлены точными (`p-[14px]`, а не `p-3`): переезд не
 * должен сдвигать вёрстку. Округление до круглых чисел — отдельное визуальное
 * решение, а не часть выноса в пакет.
 *
 * Проп `style` прежней версии не передавался ни разу — не переносится.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { size = "md", asChild = false, interactive = false, className, children, ...rest },
  ref
) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      ref={ref}
      className={cn(
        "border-line-soft bg-bg-1 border shadow-[var(--shadow-1)]",
        SIZES[size],
        (asChild || interactive) && INTERACTIVE,
        asChild && AS_CHILD,
        !asChild && interactive && CONTAINER,
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
});

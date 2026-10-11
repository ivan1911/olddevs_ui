"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { buttonClasses, SPINNER_BASE, SPINNER_SIZES } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import type { ButtonSize, Tone, Variant } from "../../lib/variants.js";

export interface ButtonProps extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  /** Подпись кнопки. При `iconOnly` не рендерится; при `asChild` содержимым распоряжается дочерний элемент. */
  children?: ReactNode;
  /** Подача: `solid`, `soft`, `outline` или `ghost` из словаря кита. По умолчанию `soft`. */
  variant?: Variant;
  /** Тон: цветовая роль кнопки из словаря кита. По умолчанию `neutral`. */
  tone?: Tone;
  /**
   * Размер кнопки из словаря кита. По умолчанию `md`.
   *
   * `xs` — четвёртая ступень, заведённая под кнопку-иконку в строке
   * списка: 20 пикселей вместо 30 у `sm`, иначе строка на 32 растягивается до
   * 42. Подпись в него не предполагается — берите вместе с `iconOnly`.
   */
  size?: ButtonSize;
  /** Иконка перед подписью. Во время `loading` её место занимает кольцо отправки. */
  icon?: ReactNode;
  /**
   * Только иконка: квадрат без горизонтальных отступов, подпись не рендерится.
   *
   * Такой кнопке нужно доступное имя — из `aria-label` или `title`. Компилятор
   * этого не требует (союзный тип ломает вывод в Storybook и в обёртках, см.
   * `Toggle`), зато требует аудит axe: безымянная кнопка роняет его как
   * `critical`. Проверка есть в `tests-visual/a11y.spec.ts`.
   */
  iconOnly?: boolean;
  /**
   * Отправка идёт: вместо иконки крутится кольцо, кнопка не нажимается,
   * а состояние объявляется через `aria-busy`.
   *
   * Выключенность здесь наступает сама — отдельный `disabled` рядом с
   * `loading` писать не нужно. Так было в `ConfirmDialog`, и это же руками
   * повторял экран логина: пятнадцать строк собственной кнопки с shimmer'ом.
   *
   * Индикатор занимает слот иконки. У кнопки без иконки это добавляет слот на
   * время отправки, то есть подпись сдвигается — поэтому кнопке, которая
   * умеет уходить в отправку, иконку лучше дать сразу.
   *
   * При `asChild` смысл тот же, что у `disabled` там же: настоящего атрибута
   * у ссылки нет, поэтому выключенность выражается `aria-disabled` и снятием
   * событий указателя.
   */
  loading?: boolean;
  /**
   * Нажатое состояние кнопки-переключателя: выставляет `aria-pressed` и нажатый вид.
   *
   * Нужно панельной кнопке, которая держит открытым что-то ещё. Не `active`: словарь допускает только `selected`.
   */
  selected?: boolean;
  /**
   * Вывести кнопку дочерним элементом вместо своей `<button>`: ссылкой,
   * `next/link`, триггером чужого компонента. Пропы и `ref` сливаются с потомком.
   *
   * Нужен там, где элемент выглядит кнопкой, но кнопкой не является: «Создать
   * кампанию» ведёт на другой экран, и это ссылка — её открывают в новой
   * вкладке средней кнопкой мыши, копируют адрес, видят в строке состояния.
   * Кнопка с `onClick={() => router.push(…)}` не умеет ничего из этого.
   *
   * ВАЖНО: `type="button"` при `asChild` не проставляется — у ссылки такого
   * атрибута нет вовсе, и React отрисовал бы его в разметку мусором.
   * Клавиатура при этом меняется, и это не дефект, а разница ролей: кнопка
   * жмётся пробелом и Enter, ссылка — только Enter.
   *
   * Два пропа при `asChild` меняют поведение, потому что иначе молча врали бы:
   *
   * - `disabled` у ссылки не существует как атрибут: `<a disabled>` остаётся
   *   и фокусируемой, и переходимой, а `disabled:opacity-50` не срабатывает,
   *   потому что `:disabled` — псевдокласс полей формы. Поэтому здесь он
   *   превращается в `aria-disabled` плюс снятие событий указателя.
   * - `selected` не превращается в `aria-pressed`: у роли `link` этот атрибут
   *   запрещён, и аудит axe ловит его как `aria-allowed-attr`. Нажатой ссылки
   *   не бывает — если состояние нужно, это кнопка, а не ссылка.
   */
  asChild?: boolean;
}

/**
 * Кнопка.
 *
 * Единственный проп `kind` из версии во фронте разложен на две оси словаря.
 * Таблица переезда:
 *
 *   kind="primary"  →  variant="solid"   tone="accent"
 *   kind="ghost"    →  variant="soft"    tone="neutral"   (значение по умолчанию)
 *   kind="quiet"    →  variant="ghost"   tone="neutral"
 *   kind="danger"   →  variant="outline" tone="danger"
 *   kind="success"  →  variant="solid"   tone="success"
 *
 * Главное отличие от прежней версии: она держала hover в `useState` и вешала
 * `onMouseEnter`/`onMouseLeave`, из-за чего наведение курсора вызывало ререндер,
 * а клавиатурный фокус и touch не подсвечивались вовсе. Здесь всё это —
 * псевдоклассы CSS.
 *
 * Проп `iconRight` прежней версии не переносится: из 81 вызова во фронте он не
 * встретился ни разу. `tone="success"` и `size="lg"` тоже не используются, но
 * они часть общих осей словаря и ничего не стоят — в отличие от отдельного
 * пропа, который пришлось бы поддерживать.
 *
 * `iconOnly` вобрал в себя отдельный примитив `IconButton` из фронта. Тот был
 * конкурирующей реализацией той же кнопки: свой hover на `useState`, свой проп
 * `active` вне словаря, свой набор размеров числами — и вдобавок два вызова
 * `Button` во фронте руками делались квадратными через `style={{ width: 36 }}`.
 * Идиома не новая: у `Chip` `iconOnly` был с самого начала.
 */
/**
 * Снять единственного потомка с обхода.
 *
 * Не трогаем ничего, кроме `tabIndex`: остальное решает `Slot`. Не элемент —
 * возвращаем как есть, ронять рендер на этом нельзя.
 */
function disableChild(children: ReactNode): ReactNode {
  return isValidElement<{ tabIndex?: number }>(children)
    ? cloneElement(children, { tabIndex: -1 })
    : children;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    variant = "soft",
    tone = "neutral",
    size = "md",
    icon,
    iconOnly = false,
    loading = false,
    selected = false,
    asChild = false,
    className,
    type,
    ...rest
  },
  ref
) {
  const Comp = asChild ? Slot : "button";
  const { disabled, ...restWithoutDisabled } = rest;
  // Отправка выключает кнопку сама: две причины «не нажимается» — одно
  // состояние на выходе, и вызывающему не нужно держать их синхронными.
  const isDisabled = disabled || loading;
  // При `asChild` выключенность выражается ролью-независимыми средствами, а
  // сам атрибут наружу не идёт — см. докстроку пропа.
  const passthrough = asChild
    ? restWithoutDisabled
    : { ...restWithoutDisabled, disabled: isDisabled };

  return (
    <Comp
      ref={ref}
      // Умолчание `type="button"` живёт здесь, а не в сигнатуре: у потомка при
      // `asChild` тега `button` может не быть вовсе, и атрибут ушёл бы в
      // разметку ссылки. Без умолчания кнопка внутри формы отправляла бы её —
      // ровно тот дефект, ради которого умолчание и заводилось.
      type={asChild ? type : (type ?? "button")}
      // Кнопка-переключатель обязана сообщать состояние, а не только подпись.
      aria-pressed={!asChild && selected ? true : undefined}
      aria-disabled={asChild && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      // Вид общий с триггером меню — см. `lib/button.ts`.
      className={cn(
        buttonClasses({ variant, tone, size, iconOnly, selected }),
        asChild && isDisabled && "pointer-events-none opacity-50",
        className
      )}
      {...passthrough}
      /*
        ПОСЛЕ спреда, и ключи добавляются только когда нужны.

        Выключённость при `asChild` выражалась лишь рекомендательным
        `aria-disabled` и классом `pointer-events-none`, который гасит один
        указатель: ссылка оставалась в обходе и срабатывала по Enter —
        `<Button asChild loading><a href="/pay">` уводила пользователя
        клавиатуры со страницы прямо во время отправки формы.

        Атрибута `disabled` у ссылки нет, поэтому глушим активацию руками.
        Условный спред, а не пропы со значением `undefined`: такой ключ всё
        равно попадает в объект и затирает чужой.

        ПОРЯДОК ЗДЕСЬ НИ НА ЧТО НЕ ВЛИЯЕТ, и первая версия комментария
        утверждала обратное. При `asChild` рендерится `Slot`, а он отдаёт
        приоритет пропам ПОТОМКА независимо от того, где стоит спред: ссылка с
        собственным `tabIndex={0}` оставалась в обходе, сколько её ни двигай.
        Поэтому обход снимается не здесь, а на самом потомке — см. `Slottable`
        ниже.
      */
      {...(asChild && isDisabled
        ? {
            tabIndex: -1,
            onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
              if (event.key === "Enter" || event.key === " ") event.preventDefault();
            },
          }
        : null)}
    >
      {loading ? <span aria-hidden className={cn(SPINNER_BASE, SPINNER_SIZES[size])} /> : icon}
      {/*
        `Slottable` — не украшение, а единственный способ сохранить иконку.
        Slot сливает пропы с ЕДИНСТВЕННЫМ потомком, и пара «иконка + ссылка»
        уронила бы его в рантайме. Обёртка вокруг них решила бы это ценой
        молчаливой потери: иконку пришлось бы выбросить или заставить
        потребителя класть её внутрь ссылки руками — то есть проп `icon` при
        `asChild` перестал бы работать, ничего об этом не сказав.

        С `Slottable` мишенью становится она, а иконка остаётся соседом и
        уезжает внутрь ссылки вместе с её собственным содержимым.

        Подпись при `asChild` не заворачивается в `<span>`: заворачивать нечего,
        содержимое принадлежит потомку. На вид это не влияет — раскладка
        кнопки на `flex` с `gap`, а голый текст участвует в ней анонимным
        элементом наравне со `span`.
      */}
      {asChild ? (
        /*
          У ВЫКЛЮЧЕННОЙ ссылки обход снимается на самом потомке.

          `Slot` отдаёт приоритет пропам потомка, поэтому `tabIndex: -1`,
          переданный кнопке, ссылка с собственным `tabIndex={0}` попросту
          перебивала — и оставалась достижимой табом, хотя выглядела
          выключённой. Клонируем потомка, чтобы решение принимал компонент, а
          не разметка вызывающего.
        */
        <Slottable>{asChild && isDisabled ? disableChild(children) : children}</Slottable>
      ) : children != null && !iconOnly ? (
        <span>{children}</span>
      ) : null}
    </Comp>
  );
});

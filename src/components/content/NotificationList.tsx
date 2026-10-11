"use client";

import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { hasContent } from "../../lib/empty.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

interface NotificationItemBaseProps extends Omit<ComponentPropsWithoutRef<"li">, "title"> {
  /** О чём событие. Первая строка. */
  title: ReactNode;
  /** Подробности. Вторая строка. */
  description?: ReactNode;
  /**
   * Когда — уже отформатированное.
   *
   * «5 минут назад» и «вчера в 14:03» кит не считает: относительное время
   * зависит от локали и часового пояса потребителя, а не от дизайн-системы.
   */
  time?: ReactNode;
  /** Иконка слева. Тип события — знание приложения, поэтому иконка приходит. */
  icon?: ReactNode;
  /**
   * Превью объекта, о котором событие, — второй визуальный слот рядом с
   * текстом.
   *
   * Независим от `icon`: иконка говорит, ЧТО случилось, превью — С ЧЕМ. Размер
   * задаёт потребитель самим элементом (картинка 36px, `Avatar`); слот лишь не
   * даёт ему сжаться и ставит по верхнему краю. Декоративное превью — с
   * `alt=""`: заголовок уже называет объект.
   */
  media?: ReactNode;
  /** Тон иконки и точки непрочитанного. */
  tone?: Tone;
  /**
   * Непрочитанное.
   *
   * Отличается НЕ ТОЛЬКО ЦВЕТОМ: рядом с заголовком встаёт слово для
   * скринридера. Точка и подложка — сигнал для глаз, и человек, который их не
   * видит, иначе не отличит новое событие от старого вовсе.
   */
  unread?: boolean;
}

/**
 * Действие строки: либо `actions` справа, либо `onAction` на всю строку.
 *
 * Вместе нельзя, и это сказано типом: кнопки внутри кнопки — недопустимая
 * разметка, на которой потребитель уже забраковал свою строку очереди.
 */
export type NotificationItemProps = NotificationItemBaseProps &
  (
    | {
        /** Действия справа — «отметить прочитанным», «перейти». */
        actions?: ReactNode;
        onAction?: never;
      }
    | {
        actions?: never;
        /**
         * Вся строка — одна кнопка: щелчок, Enter и Space вызывают обработчик.
         *
         * Доступное имя кнопки — заголовок (и слово «Не прочитано»), а время и
         * подробности — её описание: полным содержимым имя получилось бы на
         * полстраницы. Строка остаётся `<li>`, кнопка лежит внутри неё.
         */
        onAction: () => void;
      }
  );

/**
 * Строка события: что произошло, когда и прочитано ли.
 *
 * ТИПОВ СОБЫТИЙ КИТ НЕ ЗНАЕТ. «Публикация не прошла», «канал отключён»,
 * «модерация завершена» — словарь приложения; сюда приходят иконка, тон и
 * текст. Тот же раздел обязанностей, что у `StatusBadge`, который приехал из
 * фронта, оставив снаружи одиннадцать доменных статусов
 * (ADR-0027).
 *
 * Строка не навигирует и не отмечает себя прочитанной: и переход, и отметка —
 * действия потребителя. Они приходят в `actions`, в `onAction` (вся строка —
 * кнопка) или оборачивают строку.
 */
export const NotificationItem = forwardRef<HTMLLIElement, NotificationItemProps>(
  function NotificationItem(
    {
      title,
      description,
      time,
      icon,
      media,
      tone = "accent",
      unread,
      actions,
      onAction,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    const baseId = useId();
    const t = TONE_TOKENS[tone];

    // Оба пропа пришли только у потребителя на JS: типы это запрещают. `actions`
    // побеждает — вложенная кнопка в кнопке недопустима, а `actions` может быть
    // единственным путём к действию (удалить, открыть), и прятать его из-за
    // лишнего `onAction` хуже, чем потерять щелчок по всей строке. Сбой виден
    // сразу — строка не реагирует на щелчок, — а в разработке о нём ещё и
    // говорит консоль: у потребителя на JS это единственное, что заменяет ошибку
    // типов.
    if (onAction != null && actions != null) {
      devWarn(
        "NotificationItem: both `onAction` and `actions` were passed, but they are mutually " +
          "exclusive (a button cannot contain buttons). `actions` wins and `onAction` is ignored, " +
          "so clicking the row does nothing. Pass only one: `onAction` for a clickable row, or " +
          "`actions` for buttons on the right."
      );
    }
    const asButton = onAction != null && actions == null;

    // `id` нужны только кнопке (имя и описание). Обычной строке они не ставятся:
    // без `onAction` разметка не должна меняться ни на атрибут.
    const idOf = (part: string) => (asButton ? `${baseId}-${part}` : undefined);
    const titleId = idOf("title");
    const unreadId = idOf("unread");
    const descriptionId = idOf("description");
    const timeId = idOf("time");

    // Внутри кнопки допустим только фразовый контент, поэтому блоки строки в
    // режиме кнопки — `span` (у `span` блочность дают классы). Без `onAction`
    // остаются `div`, как были.
    const Block = asButton ? "span" : "div";

    const layout = "flex items-start gap-3 px-3 py-2.5";

    const content = (
      <>
        {icon != null && (
          <span className={cn("flex shrink-0 items-center pt-0.5", t.fg)}>{icon}</span>
        )}

        {hasContent(media) && <span className="flex shrink-0 items-start">{media}</span>}

        <Block className="min-w-0 flex-1">
          <Block className="flex items-baseline gap-2">
            <span id={titleId} className="min-w-0 text-[13px] font-medium">
              {title}
            </span>
            {unread && (
              <>
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full", t.dotBg)}
                />
                <span id={unreadId} className="sr-only">
                  {messages.notifications.unread}
                </span>
              </>
            )}
            {time != null && (
              <span id={timeId} className="text-fg-2 ml-auto shrink-0 text-[11px]">
                {time}
              </span>
            )}
          </Block>
          {description != null && (
            <Block
              id={descriptionId}
              className={cn("text-fg-2 mt-0.5 text-xs leading-relaxed", asButton && "block")}
            >
              {description}
            </Block>
          )}
        </Block>
      </>
    );

    if (asButton) {
      // `hasContent`, а не `!= null`: `""` и `false` из `{note && ...}` рисуют
      // пустой узел, и ссылка на него объявлялась бы пустым описанием.
      const describedBy = [hasContent(description) && descriptionId, hasContent(time) && timeId]
        .filter(Boolean)
        .join(" ");

      return (
        <li
          ref={ref}
          // Подложка непрочитанного — на `li`, а наведение и кольцо фокуса — на
          // кнопке: так они занимают всю строку, а не её внутренность.
          // Отступы и раскладка тоже на кнопке, поэтому `className` потребителя
          // (подложка, граница) их не меняет — это сказано в справочнике.
          className={cn(unread && "bg-accent-soft", className)}
          {...rest}
        >
          <button
            type="button"
            onClick={() => onAction()}
            // Имя из заголовка и слова «Не прочитано», а не `aria-label`: тот
            // продублировал бы текст в разметке и разошёлся бы с ним при правке.
            aria-labelledby={unread ? `${titleId} ${unreadId}` : titleId}
            aria-describedby={describedBy || undefined}
            className={cn(
              layout,
              "focus-visible:outline-accent-strong w-full cursor-pointer text-left transition-colors",
              // Наведение у непрочитанного — затемнение поверх подложки, а не
              // нейтральная заливка: иначе строка на время наведения выглядела
              // бы прочитанной.
              unread ? "hover:bg-accent/10" : "hover:bg-bg-2",
              // Кольцо внутрь строки: снаружи его срежет прокрутка центра.
              "focus-visible:outline-2 focus-visible:-outline-offset-2"
            )}
          >
            {content}
          </button>
        </li>
      );
    }

    return (
      <li
        ref={ref}
        className={cn(
          layout,
          // Подложка у непрочитанного — сигнал для глаз, и он не единственный:
          // слово рядом с заголовком говорит то же самое скринридеру.
          unread && "bg-accent-soft",
          className
        )}
        {...rest}
      >
        {content}

        {actions != null && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </li>
    );
  }
);

export interface NotificationGroup {
  /** Идентификатор группы. */
  id: string;
  /** Подпись группы: «Сегодня», «Вчера», «Раньше». */
  label: ReactNode;
  /** Строки группы — обычно `NotificationItem`. */
  children: ReactNode;
}

export interface NotificationListProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * Группы событий — уже собранные потребителем.
   *
   * Что такое «вчера», знает локаль и часовой пояс потребителя, а не кит: у
   * приложения с ночными сменами граница суток своя, и считать её здесь значило
   * бы навязать чужой календарь.
   */
  groups?: NotificationGroup[];
  /** Строки без группировки. Используется вместо `groups`, а не вместе с ними. */
  children?: ReactNode;
  /** Что показать при пустом списке — обычно `EmptyState`. */
  empty?: ReactNode;
  /** Доступное имя списка для скринридера. По умолчанию — стандартная подпись пакета. */
  "aria-label"?: string;
}

/**
 * Список событий с группировкой по времени и пустым состоянием.
 *
 * ГРУППА — НАСТОЯЩАЯ ГРУППА (`role="group"` с подписью), а не заголовок над
 * набором строк. Заголовок уровня `h3` здесь поставить нельзя: уровень зависит
 * от того, куда список встал — в попап, в ящик или на страницу, — и кит этого
 * не знает. Группа с именем сообщает структуру, не занимая уровня.
 *
 * ПУСТОЕ СОСТОЯНИЕ — существующий `EmptyState`, приходящий пропом: у пустоты
 * «нет уведомлений» и пустоты «ничего не нашлось по фильтру» разный текст и
 * разные действия, и выбирает их потребитель.
 */
export const NotificationList = forwardRef<HTMLDivElement, NotificationListProps>(
  function NotificationList(
    { groups, children, empty, className, "aria-label": ariaLabel, ...rest },
    ref
  ) {
    const messages = useMessages();
    const baseId = useId();
    const label = ariaLabel ?? messages.notifications.label;

    // `hasContent`, а не `== null`: основной способ вызова — `{items.map(...)}`,
    // и при пустом `items` сюда приходит ПУСТОЙ МАССИВ. Он не `null`, поэтому
    // список считался непустым и рисовался пустой `<ul>` вместо слота `empty`.
    const isEmpty = groups != null ? groups.length === 0 : !hasContent(children);
    if (isEmpty) return <>{empty}</>;

    return (
      // Имя стоит на внешнем узле, а не на внутреннем списке: с группами
      // списков несколько, и назвать надо всё вместе. Роль обязательна — у
      // голого `div` с `aria-label` имени нет, атрибут просто игнорируется.
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className={cn("flex flex-col", className)}
        {...rest}
      >
        {groups != null ? (
          groups.map((group, index) => {
            const labelId = `${baseId}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={labelId}>
                <div
                  id={labelId}
                  className={cn(
                    "text-fg-2 px-3 pb-1 text-[11px] font-bold tracking-wide uppercase",
                    index === 0 ? "pt-2" : "pt-4"
                  )}
                >
                  {group.label}
                </div>
                <ul className="flex flex-col">{group.children}</ul>
              </div>
            );
          })
        ) : (
          <ul className="flex flex-col">{children}</ul>
        )}
      </div>
    );
  }
);

"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { Badge } from "./Badge.js";
import { SelectionBar } from "../navigation/SelectionBar.js";

export interface NotificationCenterProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /** Заголовок центра. Умолчание — «Уведомления» из каталога. */
  title?: ReactNode;
  /**
   * Уровень заголовка, 2–4: заголовок становится настоящим `<h2>`–`<h4>`.
   *
   * Уровень зависит от того, куда центр встал, — в поповер под `h1` страницы
   * или в ящик, — и это знает потребитель, а не кит. Без пропа заголовок
   * остаётся обычным текстом и в структуру заголовков страницы не входит.
   *
   * Называется `level`, как у `SectionHeader`: одно понятие — одно имя на весь
   * кит (словарь пропсов в `docs/conventions.md`).
   */
  level?: 2 | 3 | 4;
  /**
   * `id` заголовка — для `aria-labelledby` поповера или ящика потребителя.
   *
   * Ложится на элемент заголовка, какой бы он ни был: с `level` это
   * `<hN>`, без него — обычный текст, и имя поверхности всё равно приходит от
   * него.
   */
  titleId?: string;
  /**
   * Сколько непрочитанных всего — пропом, а не счётом по строкам.
   *
   * Список бывает страницей, а счётчик относится ко всей коллекции: посчитав по
   * детям, центр показывал бы «3» там, где непрочитанных триста.
   */
  unreadCount?: number;
  /** Фильтры — слот. Их состав доменный: типы событий знает приложение. */
  filters?: ReactNode;
  /** Действия шапки — обычно «прочитать всё». */
  actions?: ReactNode;
  /** Сколько строк выбрано. При нуле полосы массовых действий нет вовсе. */
  selectedCount?: number;
  /** Вызывается, когда пользователь снимает выделение. */
  onClearSelection?: () => void;
  /** Действия над выбранным — обычно `Button size="sm"`. */
  selectionActions?: ReactNode;
  /** Список событий — обычно `NotificationList`. */
  children?: ReactNode;
  /** Низ: «Показать все», ссылка на страницу событий. */
  footer?: ReactNode;
}

/**
 * Оболочка ленты событий: заголовок, счётчик непрочитанных, фильтры, массовые
 * действия.
 *
 * ПОВЕРХНОСТИ У ЦЕНТРА НЕТ, и это главное решение
 * (ADR-0027). Он не
 * попап, не ящик и не страница — он их содержимое. Потребитель ставит его
 * внутрь существующих `Popover` или `Drawer` либо прямо на страницу, и центр не
 * открывает и не закрывает себя: состояние поверхности живёт снаружи.
 *
 * Иначе пришлось бы выбрать одну поверхность за все приложения сразу — а в
 * админке лента чаще страница, в клиентском приложении чаще попап.
 *
 * МАССОВЫЕ ДЕЙСТВИЯ — СУЩЕСТВУЮЩИЙ `SelectionBar`, а не своя полоса: он уже
 * несёт счётчик, снятие выделения, два слота действий и правило «при нуле
 * полосы нет вовсе». Липкость у него здесь выключена — центр стоит в попапе
 * или в ящике, где прилипать не к чему.
 *
 * СЧЁТЧИК ПРИХОДИТ ПРОПОМ. Считать его по детям нельзя: список бывает страницей
 * коллекции, и «3» вместо «300» — не округление, а неправда.
 */
export const NotificationCenter = forwardRef<HTMLDivElement, NotificationCenterProps>(
  function NotificationCenter(
    {
      title,
      level,
      titleId,
      unreadCount,
      filters,
      actions,
      selectedCount = 0,
      onClearSelection,
      selectionActions,
      children,
      footer,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    // Без уровня остаётся `span`, как было: разметка тех, кто новых пропов не
    // передаёт, не меняется, и заголовков на их странице не прибавляется.
    // Уровень вне 2–4 (потребитель на JS, `depth + 1`) — тоже `span`: элемента
    // `<h7>` нет, и заголовок молча пропал бы из структуры вместе с именем.
    const Title = level === 2 || level === 3 || level === 4 ? (`h${level}` as const) : "span";

    return (
      <div ref={ref} className={cn("flex min-h-0 flex-col", className)} {...rest}>
        <div className="border-line-soft flex items-center gap-2 border-b px-3 py-2.5">
          <Title id={titleId} className="text-[13px] font-semibold">
            {/* Пустая строка — не заголовок: `??` пропустил бы её, и центр остался бы безымянным. */}
            {hasContent(title) ? title : messages.notifications.label}
          </Title>
          {unreadCount != null && unreadCount > 0 && (
            /*
              Имя даётся `sr-only`-текстом, а НЕ `aria-label` на бейдже.

              `Badge` — это `<span>` без роли, то есть роль `generic`, а у неё
              имя от автора не поддерживается: браузер `aria-label` просто
              отбрасывает. Скринридер объявлял голое «3» — ровно то, что
              комментарий обещал предотвратить. Тест давал ложную уверенность:
              `getByLabelText` читает DOM-атрибут напрямую и проходит
              независимо от того, признаёт ли его дерево доступности.

              Число при этом прячется от озвучки, чтобы не читалось дважды.
            */
            <>
              <Badge tone="accent" aria-hidden>
                {unreadCount}
              </Badge>
              <span className="sr-only">
                {messages.notifications.unreadCount({ count: unreadCount })}
              </span>
            </>
          )}
          {actions != null && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
        </div>

        {filters != null && (
          <div className="border-line-soft flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            {filters}
          </div>
        )}

        {/*
          Полоса массовых действий: своей не заводим. `sticky={false}` —
          центр живёт в попапе или ящике, где липнуть не к чему, а зашитое
          `--topbar-h` увело бы полосу под чужую шапку.
        */}
        {selectedCount > 0 && (
          <div className="px-3 pt-2">
            <SelectionBar
              count={selectedCount}
              onClear={onClearSelection}
              sticky={false}
              className="mb-0"
            >
              {selectionActions}
            </SelectionBar>
          </div>
        )}

        {/* Прокручивается СПИСОК, а не центр целиком: шапка и фильтры обязаны
            остаться на виду, иначе фильтровать приходится вслепую. */}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer != null && (
          <div className="border-line-soft border-t px-3 py-2 text-center">{footer}</div>
        )}
      </div>
    );
  }
);

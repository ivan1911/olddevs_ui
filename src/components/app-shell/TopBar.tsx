"use client";

import { forwardRef, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { NavigationIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { usePublishedHeight } from "../../lib/published-height.js";
import { useAppShell } from "./AppShell.js";
import { Button } from "../actions/Button.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface TopBarProps extends Omit<ComponentPropsWithoutRef<"header">, "children"> {
  /** Крайний левый слот: логотип, название продукта. */
  brand?: ReactNode;
  /** Центральный слот: поиск. Занимает свободное место. */
  search?: ReactNode;
  /** Действия справа: уведомления, настройки, меню пользователя. */
  actions?: ReactNode;
  /**
   * Имя переменной, в которую публикуется измеренная высота шапки.
   *
   * Парная сторона контракта: то же имя читает `useStickyOffset` (там оно
   * зовётся `offsetVar`), и его же по умолчанию ждёт `SelectionBar`.
   *
   * `null` **отключает публикацию**. Нужно там, где шапок в документе две —
   * шапка приложения и шапка встроенного виджета: молча перебивая значение
   * друг друга, они сдвинули бы липкие полосы на чужую высоту, причём это
   * проявилось бы не ошибкой, а кривой раскладкой.
   */
  heightVar?: string | null;
  /** Доступное имя шапки. Не задано — берётся из каталога сообщений. */
  label?: string;
  /** Дополнительное содержимое шапки: выводится после слота `actions`. */
  children?: ReactNode;
}

/**
 * Шапка приложения: бренд, поиск, действия.
 *
 * ПУБЛИКУЕТ СВОЮ ВЫСОТУ в CSS-переменную — то, чего до 2.1.0 кит делать не мог,
 * потому что шапки у него не было, и контракт [ADR-0016] был односторонним:
 * высоту публиковало приложение, кит только читал.
 *
 * Это НЕ отвергнутый в ADR-0016 вариант «кит измеряет шапку сам». Там кит
 * опознавал бы чужой элемент — искал бы по селектору или атрибуту то, что
 * приложение считает шапкой. Здесь компонент измеряет себя, и знание «какой
 * элемент в этом приложении шапка» у кита так и не появляется. Разбор —
 * [ADR-0019].
 *
 * Высота идёт в `document.documentElement`, а не в ближайшего предка: там её
 * ищет `useStickyOffset`, и разойтись эти два места не должны.
 */
export const TopBar = forwardRef<HTMLElement, TopBarProps>(function TopBar(
  { brand, search, actions, heightVar = "--topbar-h", label, className, style, children, ...rest },
  ref
) {
  const messages = useMessages();
  const { openNavigation } = useAppShell();
  const innerRef = useRef<HTMLElement | null>(null);

  // Наблюдатель, а не замер на монтировании: высота меняется от брейкпоинта,
  // от переноса содержимого слотов и от появления второй строки в поиске —
  // и каждый раз липкая полоса под шапкой должна переехать вместе с ней.
  usePublishedHeight(innerRef, heightVar);

  return (
    <header
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      aria-label={label ?? messages.topbar.label}
      className={cn(
        "border-line-soft sticky top-0 z-30 flex items-center gap-3.5 border-b px-4 py-1.5",
        "backdrop-blur-md md:px-7",
        className
      )}
      {...rest}
      /*
       * Токен, а не класс: подложка шапки полупрозрачная и меняется вместе с
       * темой без участия JS.
       *
       * СТОИТ ПОСЛЕ `{...rest}`, и `style` вынут из него в пропсы отдельно.
       * Раньше было наоборот, и `style` потребителя перезаписывал атрибут
       * целиком: шапка теряла подложку, а липкий блюр показывал уезжающий
       * контент насквозь. Слияние `...rest.style` внутри объекта при этом
       * выглядело работающим, хотя его результат тут же затирался.
       */
      style={{ background: "var(--topbar-bg)", ...style }}
    >
      {/*
        Кнопка появляется САМА, когда шапка стоит в `AppShell` с навигацией:
        каркас сообщает через контекст, как её открыть. Слотом это не сделать —
        шапку каркас получает уже собранной потребителем и вложить в неё ничего
        не может. Вне каркаса кнопки нет вовсе.
      */}
      {openNavigation ? (
        <Button
          variant="ghost"
          iconOnly
          size="sm"
          icon={<NavigationIcon size={BUTTON_ICON_SIZE.sm} />}
          aria-label={messages.shell.openNavigation}
          onClick={openNavigation}
          className="md:hidden"
        />
      ) : null}
      {brand != null ? <div className="flex shrink-0 items-center">{brand}</div> : null}
      {search != null ? <div className="min-w-0 flex-1">{search}</div> : <div className="flex-1" />}
      {actions != null ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      {children}
    </header>
  );
});

"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { Button } from "../actions/Button.js";
import { NavCollapsedContext, NavCollapsedProvider } from "./NavItem.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

/**
 * Навигация нарисована внутри оверлея — ящика мобильного режима, а не колонкой
 * страницы. Ставит `AppShell` вокруг своей копии; вне его значение `false`.
 *
 * @internal Частью публичного API не является.
 */
const NavInOverlayContext = createContext(false);

/** @internal Провайдер для `AppShell`. */
export const NavInOverlayProvider = NavInOverlayContext.Provider;

export interface NavGroupProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /**
   * Заголовок раздела — и доступное имя группы, поэтому строка, а не `ReactNode`.
   *
   * В иконочном режиме заголовок с экрана уходит: места под него нет. Имя
   * группы при этом остаётся — разделитель без имени превратил бы структуру
   * навигации в набор непонятно чем разделённых иконок.
   */
  label?: string;
  /** Пункты раздела — обычно `NavItem`. */
  children: ReactNode;
}

/**
 * Раздел навигации: заголовок и пункты под ним.
 *
 * В схлопнутом виде заголовок заменяется чертой. Это не украшение: без неё
 * иконочная навигация теряет структуру целиком, а с подписью — не помещается.
 */
export const NavGroup = forwardRef<HTMLDivElement, NavGroupProps>(function NavGroup(
  { label, children, className, ...rest },
  ref
) {
  const collapsed = useContext(NavCollapsedContext);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn("flex flex-col gap-0.5", className)}
      {...rest}
    >
      {label != null ? (
        collapsed ? (
          <hr aria-hidden className="border-line-soft mx-2 my-1.5" />
        ) : (
          <div className="text-fg-3 px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
            {label}
          </div>
        )
      ) : null}
      {children}
    </div>
  );
});

export interface SideNavProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /** Содержимое колонки между шапкой и подвалом: `NavGroup` и `NavItem`; прокручивается, если не помещается. */
  children: ReactNode;
  /** Слот шапки: логотип, название продукта. */
  header?: ReactNode;
  /** Слот подвала: пользователь, ссылки, что угодно ещё. */
  footer?: ReactNode;
  /**
   * Схлопнутость в управляемом режиме. Задана — компонент своё состояние не
   * держит вовсе и слушается потребителя.
   */
  collapsed?: boolean;
  /** Начальная схлопнутость в неуправляемом режиме. */
  defaultCollapsed?: boolean;
  /** Вызывается с новым значением, когда пользователь нажал кнопку сворачивания; в ящике мобильного режима не зовётся. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /**
   * Показывать встроенную кнопку сворачивания. `false` — навигация схлопывается
   * только снаружи (например кнопкой в шапке приложения) или не схлопывается.
   */
  collapsible?: boolean;
  /** Доступное имя навигации. Не задано — берётся из каталога сообщений. */
  label?: string;
}

/**
 * Боковая навигация приложения: шапка, разделы с пунктами, подвал.
 *
 * СОСТОЯНИЕ. Схлопнутость — состояние виджета, а не домена, поэтому компонент
 * умеет держать её сам: пара `defaultCollapsed` / `collapsed` +
 * `onCollapsedChange` — обычная для кита. А вот **персистентность остаётся у
 * потребителя**: кит не знает ни про `localStorage`, ни про хранилище
 * приложения, и знать не должен (ADR-0018).
 *
 * МОБИЛЬНЫЙ РЕЖИМ здесь не живёт. Ниже `md` навигация уезжает в `Drawer`, и
 * решает это `AppShell`: сама по себе `SideNav` — просто колонка, которую можно
 * положить куда угодно, в том числе внутрь ящика.
 *
 * Ширины приходят из токенов `--sidenav-w` и `--sidenav-w-collapsed`, а не из
 * пропов: то же значение нужно сетке `AppShell`, и гонять его через React
 * значило бы ререндерить ради того, что CSS читает сам.
 */
export const SideNav = forwardRef<HTMLElement, SideNavProps>(function SideNav(
  {
    children,
    header,
    footer,
    collapsed,
    defaultCollapsed = false,
    onCollapsedChange,
    collapsible = true,
    label,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const inOverlay = useContext(NavInOverlayContext);
  const [uncontrolled, setUncontrolled] = useState(defaultCollapsed);
  // Управляемым режим делает НАЛИЧИЕ пропа, а не его значение: `collapsed={false}`
  // — это «я управляю, сейчас развёрнуто», а не «управления нет».
  const isControlled = collapsed !== undefined;

  /*
   * В ОВЕРЛЕЕ НАВИГАЦИЯ ВСЕГДА РАЗВЁРНУТА, и схлопнуть её нечем.
   *
   * Иконочный режим существует ради одного — отдать ширину содержимому
   * страницы. В ящике содержимого рядом нет, отдавать ширину некому, и
   * схлопывание превращается в способ спрятать подписи без всякой выгоды.
   *
   * Форсируется именно ЗНАЧЕНИЕ, а не только кнопка. Убрать кнопку и оставить
   * `collapsed` в силе было бы хуже исходного дефекта: потребитель, который
   * держит схлопнутость снаружи (обычный случай — она пережила перезагрузку),
   * получил бы в ящике иконки без единого способа их развернуть.
   *
   * `onCollapsedChange` при этом НЕ зовётся: состояние потребителя относится к
   * колонке, и ящик не вправе его менять.
   */
  const isCollapsed = inOverlay ? false : isControlled ? collapsed : uncontrolled;
  const showToggle = collapsible && !inOverlay;

  const toggle = useCallback(() => {
    const next = !isCollapsed;
    if (!isControlled) setUncontrolled(next);
    onCollapsedChange?.(next);
  }, [isCollapsed, isControlled, onCollapsedChange]);

  return (
    <NavCollapsedProvider value={isCollapsed}>
      <nav
        ref={ref}
        aria-label={label ?? messages.nav.label}
        // Атрибут — для потребителя, которому нужно подстроить своё содержимое
        // слотов под режим. Компонент по нему ничего не стилизует сам:
        // схлопнутость уже разошлась контекстом.
        data-collapsed={isCollapsed || undefined}
        className={cn(
          "bg-bg-1 flex h-full shrink-0 flex-col",
          // Граница отделяет колонку от содержимого страницы. В ящике справа
          // ничего нет, и линия висела бы по краю оверлея ни от чего.
          !inOverlay && "border-line-soft border-r",
          isCollapsed ? "w-[var(--sidenav-w-collapsed)]" : "w-[var(--sidenav-w)]",
          className
        )}
        {...rest}
      >
        {header != null ? <div className="shrink-0">{header}</div> : null}

        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-1">{children}</div>

        {footer != null || showToggle ? (
          <div className="border-line-soft shrink-0 border-t p-2.5">
            {footer}
            {showToggle ? (
              <div className={cn("flex", isCollapsed ? "justify-center" : "justify-end")}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={
                    isCollapsed ? (
                      <ChevronRightIcon size={BUTTON_ICON_SIZE.sm} />
                    ) : (
                      <ChevronLeftIcon size={BUTTON_ICON_SIZE.sm} />
                    )
                  }
                  // Подпись называет ДЕЙСТВИЕ, а не состояние: у кнопки с двумя
                  // состояниями следующий шаг выводится из иконки, и дублировать
                  // его текущим состоянием значит удлинять имя без пользы.
                  aria-label={isCollapsed ? messages.nav.expand : messages.nav.collapse}
                  onClick={toggle}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
    </NavCollapsedProvider>
  );
});

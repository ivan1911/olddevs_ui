"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { cn } from "../../lib/cn.js";
import { Tooltip } from "../overlays/Tooltip.js";

/**
 * Схлопнутость навигации: её задаёт `SideNav`, а читает каждый пункт.
 *
 * Контекст, а не проп на пункте, потому что иначе потребитель протаскивал бы
 * одно и то же значение в каждый из десяти пунктов руками — и однажды забыл бы
 * в одном. Вне `SideNav` пункт считается развёрнутым: это состояние по
 * умолчанию, а не признак ошибки.
 */
/** @internal Читают `NavItem` и `NavGroup`; частью публичного API не является. */
export const NavCollapsedContext = createContext(false);

/** @internal Провайдер для `SideNav`; частью публичного API не является. */
export const NavCollapsedProvider = NavCollapsedContext.Provider;

export interface NavItemProps extends Omit<ComponentPropsWithoutRef<"a">, "children"> {
  /**
   * Подпись пункта — и его доступное имя.
   *
   * Отдельным пропом, а не содержимым, и причина в схлопнутом режиме: там
   * подпись прячется от глаз, но обязана остаться для скринридера, то есть
   * компонент должен её ЗАВЕРНУТЬ. Содержимое при `asChild` принадлежит
   * потомку, и завернуть его нельзя — у `Button` ровно поэтому подпись при
   * `asChild` и не оборачивается.
   */
  label: ReactNode;
  /** Иконка слева от подписи; скрыта от скринридера, цвет следует за состоянием `active`. */
  icon?: ReactNode;
  /**
   * Пункт ведёт на текущую страницу: подсвечен и получает `aria-current="page"`.
   *
   * Проп, а не вычисление: кит не знает ни маршрутизатора, ни правил сравнения
   * путей (хвостовой слэш, query, вложенные маршруты, локаль в префиксе). У
   * каждого маршрутизатора они свои, а ошибка выражается не падением, а тихо
   * неподсвеченным пунктом. Решение — ADR-0018.
   */
  active?: boolean;
  /** Счётчик или отметка справа от подписи: `Badge`, число, точка. */
  badge?: ReactNode;
  /**
   * Слот горячей клавиши — обычно `Kbd`. Прячется вместе с подписью: в
   * иконочном режиме показывать сочетание некуда, а озвучивать его в имени
   * пункта значит удлинять имя ради того, чего на экране нет.
   */
  shortcut?: ReactNode;
  /**
   * Вывести пункт дочерним элементом: `next/link`, `<Link>` роутера, что угодно
   * ещё. Иконка и подпись уезжают внутрь потомка через `Slottable`, поэтому
   * потомок передаётся пустым: `<NavItem label="…" asChild><Link href="/x" /></NavItem>`.
   */
  asChild?: boolean;
  /** Нужен только при `asChild`: там это пустой потомок-ссылка, в который уезжают иконка и подпись. */
  children?: ReactNode;
}

const BASE =
  "focus-visible:outline-accent-strong flex items-center gap-3 rounded-control border " +
  "px-3 py-[9px] text-[13px] leading-5 no-underline transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  // Недоступный пункт красится по `aria-disabled`, как у `Button`: у ссылки нет
  // родного `disabled`, и без этого правила пункт, выключенный атрибутом ARIA,
  // выглядел бы рабочим — с тем же цветом и курсором-указателем.
  "aria-disabled:opacity-50 aria-disabled:cursor-default " +
  "aria-disabled:hover:bg-transparent aria-disabled:hover:text-fg-1";

const STATE = {
  active: "border-line bg-bg-3 text-fg-0 font-semibold",
  idle: "text-fg-1 hover:bg-bg-2 hover:text-fg-0 border-transparent font-medium",
} as const;

/**
 * Пункт навигации: иконка, подпись, счётчик и слот горячей клавиши.
 *
 * Маршрутизации не знает вовсе — ни адреса, ни того, какой пункт сейчас
 * открыт. И то и другое приходит снаружи: адрес элементом через `asChild` или
 * `href`, текущий пункт — пропом `active`.
 *
 * В схлопнутом режиме подпись уходит из виду, но остаётся доступным именем, а
 * рядом появляется подсказка. Прятать её `title`-атрибутом было бы дешевле и
 * неверно: `title` не показывается при фокусе с клавиатуры и не читается
 * частью скринридеров.
 *
 * ТРЕБОВАНИЕ К ПОТРЕБИТЕЛЮ: схлопнутая навигация обязана стоять внутри
 * `TooltipProvider` — иначе Radix бросает на первом же пункте. Провайдер здесь
 * не разворачивается сам по той же причине, по которой его не разворачивает
 * `Segmented`: он задаёт группировку подсказок на всё приложение, и вложенный
 * её ломает. В развёрнутом режиме подсказки нет, и требования тоже нет.
 */
export const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(function NavItem(
  { label, icon, active = false, badge, shortcut, asChild = false, children, className, ...rest },
  ref
) {
  const collapsed = useContext(NavCollapsedContext);
  const Comp = asChild ? Slot : "a";

  const item = (
    <Comp
      ref={ref}
      // `page`, а не `true`: пункт ведёт на страницу, и это ровно тот случай,
      // для которого значение существует.
      aria-current={active ? "page" : undefined}
      className={cn(
        BASE,
        active ? STATE.active : STATE.idle,
        collapsed && "justify-center px-0",
        className
      )}
      {...rest}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn("flex shrink-0", active ? "text-accent-strong" : "text-fg-2")}
        >
          {icon}
        </span>
      ) : null}
      {/*
        В схлопнутом режиме подпись прячется классом `sr-only`, а не
        выбрасывается из разметки: выброшенная оставила бы пункт без имени, и
        вся навигация превратилась бы в набор безымянных иконок — тот же
        дефект, что аудит ловит у кнопок с одной иконкой.
      */}
      <span className={cn(collapsed ? "sr-only" : "truncate")}>{label}</span>
      {!collapsed && badge != null ? <span className="ml-auto flex shrink-0">{badge}</span> : null}
      {!collapsed && shortcut != null ? (
        <span className={cn("shrink-0", badge == null && "ml-auto")}>{shortcut}</span>
      ) : null}
      {/*
        `Slottable` — единственный способ сохранить иконку и подпись при
        `asChild`: Slot сливает пропы с ЕДИНСТВЕННЫМ потомком, и пара «иконка +
        ссылка» уронила бы его в рантайме. С `Slottable` мишенью становится
        она, а соседи уезжают внутрь ссылки. Тот же приём — в `Button`.
      */}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Comp>
  );

  // Подсказка вешается ТОЛЬКО в схлопнутом режиме: в развёрнутом подпись видна,
  // и подсказка повторяла бы её — шум, а не помощь.
  return collapsed ? <Tooltip content={label}>{item}</Tooltip> : item;
});

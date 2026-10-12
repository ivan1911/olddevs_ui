"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  forwardRef,
  isValidElement,
  useContext,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { BottomBarSlotContext } from "../../lib/bottom-bar-slot.js";
import { cn } from "../../lib/cn.js";
import { devWarn } from "../../lib/dev-warn.js";
import { Badge } from "../content/Badge.js";

interface MobileTabBarBaseProps extends Omit<
  ComponentPropsWithoutRef<"nav">,
  "aria-label" | "aria-labelledby"
> {
  /** Пункты полосы — обычно `MobileTabBarItem`; делят ширину поровну. */
  children: ReactNode;
}

/**
 * Имя навигации: `aria-label` или `aria-labelledby`, но не оба (`AccessibleName`).
 *
 * Необязательное — `Partial`: не задано ни то ни другое, и имя берётся из
 * каталога сообщений («Разделы»). Видимой подписи у полосы нет, поэтому и
 * `label` нет: в ките он значит только видимую подпись.
 */
export type MobileTabBarProps = MobileTabBarBaseProps & Partial<AccessibleName>;

/**
 * Подложка полосы: в слоте `bottomBar` — с хвостом на высоту выреза, вне слота
 * — ровно по полосе. Разница и есть контракт, которого jsdom иначе не увидит
 * (`env()` он не считает), поэтому словарь, а не условие внутри строки: тест
 * сверяет класс с ним (`docs/conventions.md`, «Что проверяют тесты»).
 *
 * @internal Экспорт для теста; из пакета не выходит.
 */
export const BACKDROP_CLASS = {
  inSlot:
    "bg-bg-1 absolute inset-x-0 top-0 bottom-[calc(-1*env(safe-area-inset-bottom,0px))] -z-10",
  standalone: "bg-bg-1 absolute inset-0 -z-10",
} as const;

/**
 * Нижняя полоса главных разделов для телефона: пункты в ряд, поровну.
 *
 * ЧЕГО ЗДЕСЬ НЕТ, И ЭТО РЕШЕНИЕ. Ни `fixed`, ни скрытия на `md` и шире, ни
 * отступа под вырез экрана: всё это даёт слот `bottomBar` у `AppShell`, и
 * полоса, повторившая любое из трёх, разошлась бы с каркасом молча — отступ
 * под вырез, например, оказался бы двойным. Вне `AppShell` полоса — обычная
 * строка в потоке: положить её можно куда угодно, но тогда прилипание и
 * скрытие остаются на потребителе.
 *
 * ПОДЛОЖКА — токен поверхности кита, без размытия: `backdrop-filter` на
 * каждом мобильном экране стоит перерисовки при прокрутке, а читаемость
 * подписей ему не нужна. В слоте `bottomBar` подложка спускается ниже полосы на
 * высоту выреза: отступ под него добавляет обёртка слота, и подложка,
 * обрезанная по самой полосе, оставляла бы под ней прозрачную щель, сквозь
 * которую виден уезжающий контент. Вне слота отступа нет, и подложка ровно по
 * полосе — иначе на телефоне с вырезом она перекрыла бы то, что стоит под
 * полосой в потоке. Где стоит полоса, говорит `BottomBarSlotContext`.
 *
 * Маршрутизации не знает вовсе, как и `NavItem`: адрес приходит элементом
 * через `asChild`, текущий пункт — пропом `active` (ADR-0018).
 */
export const MobileTabBar = forwardRef<HTMLElement, MobileTabBarProps>(function MobileTabBar(
  { "aria-label": ariaLabel, "aria-labelledby": labelledBy, children, className, ...rest },
  ref
) {
  const messages = useMessages();
  const inSlot = useContext(BottomBarSlotContext);

  return (
    <nav
      ref={ref}
      // Умолчание — только когда имени не дали никак: пустая строка не имя
      // (`||`, а не `??`), а при `aria-labelledby` строка из каталога была бы
      // вторым источником, который спецификация всё равно отбросит.
      aria-label={labelledBy ? undefined : ariaLabel || messages.mobileTabBar.label}
      aria-labelledby={labelledBy || undefined}
      // `isolate` держит отрицательный слой подложки внутри полосы: без него
      // подложка уходила бы под соседей по обёртке слота.
      className={cn("relative isolate flex items-stretch justify-around", className)}
      {...rest}
    >
      <div aria-hidden className={inSlot ? BACKDROP_CLASS.inSlot : BACKDROP_CLASS.standalone} />
      {children}
    </nav>
  );
});

interface MobileTabBarItemBaseProps extends Omit<ComponentPropsWithoutRef<"a">, "children"> {
  /**
   * Подпись пункта — и его доступное имя, целиком, даже когда на экране она
   * обрезана многоточием.
   *
   * Отдельным пропом, а не содержимым, по той же причине, что у `NavItem`:
   * подпись компонент обязан завернуть сам, а содержимое при `asChild`
   * принадлежит потомку.
   */
  label: ReactNode;
  /** Иконка над подписью; скрыта от скринридера, к её углу крепится значок `badge`. */
  icon?: ReactNode;
  /**
   * Текущий раздел: `aria-current="page"`.
   *
   * Проп, а не вычисление: кит не знает маршрутизатора и правил сравнения
   * путей (хвостовой слэш, вложенные маршруты, локаль в префиксе). Ошибка тут
   * выражается не падением, а тихо неподсвеченным пунктом — ADR-0018.
   * Называется `active`, как у `NavItem`: одна и та же идея в двух пунктах
   * навигации не должна иметь двух имён. Атрибут `aria-current` ставится от него.
   */
  active?: boolean;
  /**
   * Вывести пункт дочерним элементом: `next/link`, `<Link>` роутера. Иконка и
   * подпись уезжают внутрь потомка через `Slottable`, поэтому потомок
   * передаётся пустым: `<MobileTabBarItem label="…" asChild><Link href="/x" /></MobileTabBarItem>`.
   */
  asChild?: boolean;
  /** Нужен только при `asChild`: там это пустой потомок-ссылка, в который уезжают иконка и подпись. */
  children?: ReactNode;
}

/**
 * Значок: штатный или свой.
 *
 * ШТАТНЫЙ — число, `true` или строка. Число показывает счётчик (больше 99 —
 * «99+»), `true` — точку «есть новое», строка — короткую надпись в той же
 * «таблетке» `Badge`. `0`, `false` и пустая строка — ничего: пункт без новостей
 * не должен носить пустой кружок. Положение, предел и текст для скринридера
 * здесь решает компонент: у вкладки значок лежит поверх иконки.
 *
 * СВОЙ — любой элемент (`<Badge tone="success">`, иконка), встаёт в угол
 * иконки как есть. Тогда `badgeLabel` ОБЯЗАТЕЛЕН, и это сказано типом: значок
 * спрятан от скринридера вместе с иконкой, и свой узел без текста звучал бы как
 * отсутствие значка. Видимое содержимое чужого узла кит прочитать за
 * потребителя не может — это может быть картинка.
 */
export type MobileTabBarItemProps = MobileTabBarItemBaseProps &
  (
    | {
        /** Штатный значок: число — счётчик, `true` — точка, строка — короткая надпись; `0`, `false` и пустая строка — без значка. */
        badge?: number | boolean | string | null;
        /**
         * Текст значка для скринридера вместо «Новых: 3» из каталога (или
         * вместо самой строки), когда значку нужен смысл («3 непрочитанных
         * сообщения»). Значок на экране остаётся тем же. Обязателен, если
         * `badge` — свой элемент.
         */
        badgeLabel?: string;
      }
    | {
        /** Свой значок — любой элемент; встаёт в угол иконки как есть, `badgeLabel` тогда обязателен. */
        badge: ReactElement;
        /**
         * Текст значка для скринридера вместо «Новых: 3» из каталога (или
         * вместо самой строки), когда значку нужен смысл («3 непрочитанных
         * сообщения»). Значок на экране остаётся тем же. Обязателен, если
         * `badge` — свой элемент.
         */
        badgeLabel: string;
      }
  );

const BASE =
  "focus-visible:outline-accent-strong text-caption relative flex min-w-0 flex-1 flex-col " +
  "items-center gap-0.5 px-1 py-2 font-medium no-underline transition-colors " +
  "focus-visible:outline-2";

// Текущий пункт отличается не одним цветом: полоска сверху — признак, который
// переживает и ахроматическое зрение, и принудительные цвета.
const STATE = {
  active:
    "text-accent-strong before:bg-accent-strong before:absolute before:inset-x-3 " +
    "before:top-0 before:h-0.5 before:rounded-full",
  idle: "text-fg-2 hover:text-fg-0",
} as const;

/**
 * Пункт нижней полосы: иконка над подписью, поверх иконки — счётчик.
 *
 * ПОДПИСЬ — СТУПЕНЬ `text-caption` (11px) И ОБРЕЗАЕТСЯ МНОГОТОЧИЕМ. Это
 * измеренный компромисс, а не недосмотр: потребитель замерил, что на 360px
 * колонка вкладки при пяти пунктах даёт 50px под подпись, а «Библиотека» и
 * «Расписание» на 11px занимают 64–65px против 58–59px на 10px, — то есть
 * две подписи из пяти обрезаются, и он держит у себя 10px мимо шкалы. Кит идёт
 * по шкале; нужна ли полосе своя ступень, решит первое внедрение.
 * Обрезка вредит глазу, но не слуху: полная подпись остаётся доступным именем.
 */
export const MobileTabBarItem = forwardRef<HTMLAnchorElement, MobileTabBarItemProps>(
  function MobileTabBarItem(
    {
      label,
      icon,
      active = false,
      badge,
      badgeLabel,
      asChild = false,
      children,
      className,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    // `asChild` без элемента внутри (потребитель на JS забыл ссылку) уронил бы
    // `Slot` и всё дерево страницы. Пункт тогда остаётся своей ссылкой: видно
    // подпись, а не белый экран.
    const slotted = asChild && isValidElement(children);
    const Comp = slotted ? Slot : "a";

    // `true` — точка; число больше нуля — счётчик; непустая строка — надпись в
    // «таблетке»; элемент — свой значок; всё прочее — значка нет.
    const dot = badge === true;
    const count = typeof badge === "number" && badge > 0 ? badge : null;
    const text = typeof badge === "string" && badge !== "" ? badge : null;
    const custom = isValidElement(badge) ? badge : null;
    const shown = dot || count != null || text != null || custom != null;
    // Свой элемент без `badgeLabel` не пропускает тип; потребитель на JS получит
    // значок без текста, а не падение, — и предупреждение в разработке: значок
    // виден, но не слышен, и сам он этого не заметит.
    if (custom && !badgeLabel) {
      devWarn(
        "MobileTabBarItem: a custom element was passed as `badge` without `badgeLabel`. " +
          "The badge is hidden from screen readers together with the icon, so it is shown " +
          "but never announced. Pass `badgeLabel` with what the badge means, e.g. " +
          '"Needs attention".'
      );
    }
    // `||`, а не `??`: пустой `badgeLabel` не текст — тогда говорит умолчание.
    const spoken =
      badgeLabel ||
      (count != null
        ? messages.mobileTabBar.newCount({ count })
        : dot
          ? messages.mobileTabBar.new
          : text);

    return (
      <Comp
        ref={ref}
        // `page`, а не `true`: пункт ведёт на страницу, для этого случая
        // значение и существует.
        aria-current={active ? "page" : undefined}
        className={cn(BASE, active ? STATE.active : STATE.idle, className)}
        {...rest}
      >
        {icon ? (
          // Иконка вместе со значком скрыта от скринридера целиком: имя даёт
          // подпись, а значок говорит через `sr-only` ниже. Видимое число,
          // озвученное ещё и как есть, прозвучало бы дважды.
          <span
            aria-hidden
            className={cn("relative flex shrink-0", active ? "text-accent-strong" : "text-fg-2")}
          >
            {icon}
            {custom ? (
              <span className="absolute top-[-2px] -right-1.5 flex">{custom}</span>
            ) : shown ? (
              // Значок держится ЛЕВОЙ кромкой у правого верхнего угла иконки и растёт
              // вправо: привязка правой кромкой (`-right-1.5`) растила широкий «99+» или
              // «Beta» влево, на иконку. Сдвиг `-ml-*` повторяет прежнее положение точки
              // (8px) и короткого числа (16px): они выглядят как раньше.
              <Badge
                overlay
                dot={dot}
                className={cn("top-[-2px] right-auto left-full", dot ? "-ml-0.5" : "-ml-2.5")}
              >
                {count ?? text}
              </Badge>
            ) : null}
          </span>
        ) : null}
        {/*
          БЕЗ ИКОНКИ значку не за что зацепиться: угол пустого узла — это точка
          над серединой подписи. Тогда значок встаёт в строку подписи, после неё,
          и подпись обрезается раньше значка, а не наоборот.
        */}
        <span className="flex w-full min-w-0 items-center justify-center gap-1">
          <span className="min-w-0 truncate text-center">{label}</span>
          {!icon && shown ? (
            <span aria-hidden className="flex shrink-0">
              {custom ?? <Badge dot={dot}>{count ?? text}</Badge>}
            </span>
          ) : null}
        </span>
        {/*
          Пробел между подписью и текстом значка — не опечатка: это соседние
          строчные узлы, и без него вычисленное имя склеилось бы в «Входящие3».
          В раскладке пробел между элементами флекса не виден, в имени — нужен.
        */}
        {shown && spoken ? (
          <>
            {" "}
            <span className="sr-only">{spoken}</span>
          </>
        ) : null}
        {/*
          `Slottable` — единственный способ сохранить иконку и подпись при
          `asChild`: Slot сливает пропы с ЕДИНСТВЕННЫМ потомком, и пара «иконка
          + ссылка» уронила бы его в рантайме. Тот же приём — в `NavItem`.
        */}
        {slotted ? <Slottable>{children}</Slottable> : asChild ? null : children}
      </Comp>
    );
  }
);

"use client";

import { Slot, Slottable } from "@radix-ui/react-slot";
import {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useMenuAim } from "./useMenuAim.js";

/*
  МЕГАМЕНЮ — НАВИГАЦИЯ, А НЕ МЕНЮ КОМАНД.

  Отсюда шаблон WAI-ARIA Disclosure Navigation, а не `role="menu"`: Категория
  с Витриной — кнопка с `aria-expanded`, Витрина — регион со ссылками, ссылки
  — настоящие `a`. Роль `menu` обещает скринридеру меню действий с его
  клавиатурной моделью (стрелки по всем пунктам, Tab закрывает), и ссылки в
  нём перестают быть ссылками: их нельзя открыть в новой вкладке, их не видно
  в списке ссылок страницы. `Menu` кита по той же причине навигацию запрещает.

  Поведение своё, а не react-aria: готового «раскрывающегося каталога» у неё
  нет, а `Menu` на её основе — ровно та роль `menu`, от которой мы уходим.
*/

/** Задержка закрытия, когда курсор ушёл и со Столбца, и с Витрины. */
const LEAVE_GRACE_MS = 150;

/** Что считается фокусируемым внутри Витрины при переходе в неё с клавиатуры. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface MegaMenuContextValue {
  baseId: string;
  /** Открытая Категория. */
  value: string | null;
  /** Категория — единственная остановка Tab в Столбце (roving tabindex). */
  tabStop: string | null;
  /** Открыть Категорию щелчком или с клавиатуры — сразу, мимо Прицела. */
  openCategory: (id: string, focusShowcase?: boolean) => void;
  close: () => void;
  /** Курсор наведён на строку Столбца: решает Прицел. `null` — строка без Витрины. */
  hoverCategory: (target: string | null) => void;
  /** Витрина перевёрнута на другую сторону: со стороны конца строки ей не хватило места. */
  flipped: boolean;
  onCategoryKeyDown: (event: KeyboardEvent<HTMLElement>, id: string, hasShowcase: boolean) => void;
  onShowcaseKeyDown: (event: KeyboardEvent<HTMLElement>, id: string) => void;
  onCategoryFocus: (id: string) => void;
  /** Категория хочет перевести фокус в свою Витрину, как только та смонтируется. */
  pendingFocus: MutableRefObject<string | null>;
}

const MegaMenuContext = createContext<MegaMenuContextValue | null>(null);

function useMegaMenu(part: string): MegaMenuContextValue {
  const context = useContext(MegaMenuContext);
  if (!context) throw new Error(`${part} must be rendered inside MegaMenu`);
  return context;
}

/** id для DOM: id Категории приходит от потребителя и может содержать что угодно. */
function domId(baseId: string, kind: "category" | "showcase", id: string): string {
  return `${baseId}-${kind}-${encodeURIComponent(id)}`;
}

/** Категории Столбца по порядку, с раскрытием фрагментов. */
function categoryChildren(children: ReactNode): ReactElement<MegaMenuCategoryProps>[] {
  const result: ReactElement<MegaMenuCategoryProps>[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      result.push(...categoryChildren((child.props as { children?: ReactNode }).children));
    } else if (child.type === MegaMenuCategory) {
      result.push(child as ReactElement<MegaMenuCategoryProps>);
    }
  });
  return result;
}

/**
 * Стрелка «к Витрине» — по тому, где Витрина стоит на экране: при письме справа
 * налево она слева, а перевёрнутая у края — на другой стороне.
 */
function forwardKey(node: HTMLElement, flipped: boolean): "ArrowRight" | "ArrowLeft" {
  const rtl = getComputedStyle(node).direction === "rtl";
  return rtl === flipped ? "ArrowRight" : "ArrowLeft";
}

/** Зазор между Столбцом и Витриной (`ms-1`) и запас до края окна, пиксели. */
const SHOWCASE_GAP = 4;
const VIEWPORT_MARGIN = 8;

/** Клавиши, которые поле ввода в Витрине (поиск, промо с формой) обязано оставить себе. */
function isTextEntry(target: EventTarget): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

export interface MegaMenuProps extends Omit<
  ComponentPropsWithoutRef<"nav">,
  "children" | "defaultValue"
> {
  /** Доступное имя навигации: на странице с несколькими `nav` они различимы только по нему. */
  "aria-label": string;
  /** Категории — `MegaMenuCategory`, прямыми детьми (фрагменты допустимы). */
  children?: ReactNode;
  /** Открытая Категория — управляемо. `null` — Витрина закрыта. */
  value?: string | null;
  /** Открытая Категория при монтировании, без управления. */
  defaultValue?: string | null;
  /** Открылась другая Категория или Витрина закрылась. */
  onValueChange?: (value: string | null) => void;
  /**
   * Ширина Витрины — длина CSS или пиксели. Одна на все Категории: каталог не
   * должен прыгать, когда у соседних Категорий разный объём.
   */
  showcaseWidth?: number | string;
}

/**
 * Мегаменю в духе Amazon: Столбец категорий слева, Витрина наведённой
 * Категории справа.
 *
 * СОСТАВНОЙ API, как у `Menu`: Витрина разнородна — колонки ссылок, промо,
 * своё содержимое, — и описывать её массивом значило бы завести второй язык
 * разметки рядом с JSX.
 *
 * Витрина — потомок своей Категории в DOM, а не портал. Отсюда сразу три
 * следствия, и все нужные: порядок Tab идёт «Категория → её ссылки → дальше
 * по странице», уход указателя из Столбца в Витрину не считается уходом из
 * меню, а Витрина встаёт вплотную к Столбцу без расчёта позиции — она
 * `absolute` от корня.
 */
export const MegaMenu = forwardRef<HTMLElement, MegaMenuProps>(function MegaMenu(
  {
    children,
    value: valueProp,
    defaultValue = null,
    onValueChange,
    showcaseWidth = "40rem",
    className,
    style,
    onPointerEnter,
    onPointerLeave,
    onBlur,
    ...rest
  },
  forwardedRef
) {
  const baseId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  const [innerValue, setInnerValue] = useState<string | null>(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : innerValue;
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories = categoryChildren(children);
  const firstEnabled = categories.find((category) => !category.props.disabled)?.props.id ?? null;
  // Остановка Tab: где пользователь был последним, иначе открытая, иначе первая.
  const tabStop = focusedId ?? value ?? firstEnabled;

  const valueRef = useRef(value);
  valueRef.current = value;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const setValue = useCallback(
    (next: string | null) => {
      if (next === valueRef.current) return;
      if (!controlled) setInnerValue(next);
      onValueChangeRef.current?.(next);
    },
    [controlled]
  );

  const cancelLeave = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  useEffect(() => cancelLeave, []);

  /** Категории Столбца в DOM-порядке; выключенные — по запросу. */
  const categoryNodes = useCallback((withDisabled = false): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-mega-category]")).filter(
      (node) => withDisabled || node.getAttribute("aria-disabled") !== "true"
    );
  }, []);

  // Прицелу нужна открытая Витрина; ищется по id, а не ref'ом: её рисует Категория.
  const showcaseRef = useMemo(
    () => ({
      get current(): HTMLElement | null {
        return value === null ? null : document.getElementById(domId(baseId, "showcase", value));
      },
    }),
    [baseId, value]
  );
  const aim = useMenuAim({ value, showcaseRef, commit: setValue });
  const { cancel: cancelAim, request: requestAim } = aim;

  /*
    ПЕРЕВОРОТ У КРАЯ. Витрина встаёт со стороны конца строки; если там не
    хватает места, а с другой стороны хватает — она переходит туда. Не хватает
    ни там, ни там — остаётся на своей стороне: `max-w` её ужмёт.

    Меряется ДО открытия, на монтировании и при смене размера окна, а не по
    открытой Витрине: стрелка «к Витрине» должна знать сторону уже при первом
    открытии с клавиатуры. Ширину даёт зонд с той же длиной, что у Витрины, —
    длина приходит строкой CSS (`40rem`, `min(…)`), и посчитать её может только
    браузер.
  */
  const [flipped, setFlipped] = useState(false);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const probe = document.createElement("div");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      probe.style.width = "var(--mega-menu-showcase-w)";
      root.appendChild(probe);
      const showcase = Math.min(probe.offsetWidth, window.innerWidth - 32);
      probe.remove();
      const need = showcase + SHOWCASE_GAP + VIEWPORT_MARGIN;
      const rect = root.getBoundingClientRect();
      const rtl = getComputedStyle(root).direction === "rtl";
      const endRoom = rtl ? rect.left : window.innerWidth - rect.right;
      const startRoom = rtl ? window.innerWidth - rect.right : rect.left;
      setFlipped(endRoom < need && startRoom >= need);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [showcaseWidth]);

  const focusCategory = useCallback(
    (id: string) => {
      const node = categoryNodes(true).find((candidate) => candidate.dataset.megaCategory === id);
      node?.focus();
    },
    [categoryNodes]
  );

  const context = useMemo<MegaMenuContextValue>(() => {
    const openCategory = (id: string, focusShowcase = false) => {
      cancelAim();
      if (focusShowcase) pendingFocus.current = id;
      setValue(id);
    };
    const close = () => {
      cancelAim();
      setValue(null);
    };

    const onCategoryKeyDown = (
      event: KeyboardEvent<HTMLElement>,
      id: string,
      hasShowcase: boolean
    ) => {
      const node = event.currentTarget;
      const enabled = categoryNodes();
      const index = enabled.indexOf(node);
      let target: HTMLElement | undefined;
      switch (event.key) {
        case "ArrowDown":
          target = enabled[Math.min(index + 1, enabled.length - 1)];
          break;
        case "ArrowUp":
          target = enabled[Math.max(index - 1, 0)];
          break;
        case "Home":
          target = enabled[0];
          break;
        case "End":
          target = enabled[enabled.length - 1];
          break;
        case "Escape":
          if (valueRef.current !== null) {
            event.preventDefault();
            close();
          }
          return;
        case "Enter":
        case " ":
          // У ссылки-Категории Enter — переход, Пробел — прокрутка страницы:
          // обе роли браузерные, отнимать их незачем.
          if (!hasShowcase || node.getAttribute("aria-disabled") === "true") return;
          event.preventDefault();
          openCategory(id, true);
          return;
        default:
          if (event.key === forwardKey(node, flipped) && hasShowcase) {
            if (node.getAttribute("aria-disabled") === "true") return;
            event.preventDefault();
            openCategory(id, true);
          }
          return;
      }
      event.preventDefault();
      if (!target || target === node) return;
      target.focus();
      // Витрина открыта — она следует за фокусом, как следует за наведением:
      // иначе подсвечена одна Категория, а открыта другая.
      if (valueRef.current !== null) {
        const targetId = target.dataset.megaCategory ?? null;
        cancelAim();
        setValue(target.dataset.megaShowcase === "true" ? targetId : null);
      }
    };

    const onShowcaseKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
      if (isTextEntry(event.target)) return;
      const back =
        forwardKey(event.currentTarget, flipped) === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      if (event.key === "Escape") {
        event.preventDefault();
        // Фокус — до закрытия: закрытие размонтирует ссылку под фокусом, и
        // фокус упал бы на `body`.
        focusCategory(id);
        close();
      } else if (event.key === back) {
        event.preventDefault();
        focusCategory(id);
      }
    };

    return {
      baseId,
      value,
      tabStop,
      openCategory,
      close,
      hoverCategory: requestAim,
      flipped,
      onCategoryKeyDown,
      onShowcaseKeyDown,
      onCategoryFocus: setFocusedId,
      pendingFocus,
    };
  }, [
    baseId,
    value,
    tabStop,
    flipped,
    setValue,
    categoryNodes,
    focusCategory,
    cancelAim,
    requestAim,
  ]);

  // Щелчок или касание вне каталога закрывают Витрину. Уход указателя этого
  // не покрывает: у касания ухода нет.
  useEffect(() => {
    if (value === null) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setValue(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [value, setValue]);

  return (
    <MegaMenuContext.Provider value={context}>
      <nav
        ref={(node) => {
          rootRef.current = node;
          if (typeof forwardedRef === "function") forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        className={cn("relative w-64 text-[13px]", className)}
        style={{ "--mega-menu-showcase-w": cssLength(showcaseWidth), ...style } as CSSProperties}
        onPointerEnter={(event: PointerEvent<HTMLElement>) => {
          cancelLeave();
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event: PointerEvent<HTMLElement>) => {
          onPointerLeave?.(event);
          if (event.pointerType === "touch" || event.pointerType === "pen") return;
          // Не сразу: курсор, на миг вышедший за край Витрины или в зазор у
          // Столбца, не должен сбрасывать каталог.
          cancelLeave();
          leaveTimer.current = setTimeout(() => {
            cancelAim();
            setValue(null);
          }, LEAVE_GRACE_MS);
        }}
        onBlur={(event: FocusEvent<HTMLElement>) => {
          onBlur?.(event);
          // Фокус ушёл со страницы каталога (Tab за последней ссылкой) — Витрина
          // закрывается. `relatedTarget` пуст при щелчке по нефокусируемому
          // месту внутри Витрины: это не уход, а его закрывает щелчок снаружи.
          const next = event.relatedTarget;
          if (next instanceof Node && !event.currentTarget.contains(next)) setValue(null);
        }}
        {...rest}
      >
        <ul className={COLUMN_CLASS}>{children}</ul>
      </nav>
    </MegaMenuContext.Provider>
  );
});

function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

const COLUMN_CLASS =
  "bg-surface-elevated border-line flex flex-col gap-px rounded-md border p-1 list-none m-0";

/**
 * Строка Категории. Подсветка — по `aria-expanded`, а не по `:hover`:
 * подсвечено ровно то, чья Витрина открыта. При «Прицеле» курсор стоит над
 * соседней Категорией, а Витрина ещё прежняя — две подсветки разом читались бы
 * как два выбора.
 */
const CATEGORY_CLASS =
  "text-fg-0 flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent " +
  "px-2.5 py-2 text-start text-[13px] leading-5 no-underline select-none " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2 " +
  "aria-expanded:bg-bg-2 aria-expanded:font-semibold " +
  "aria-disabled:cursor-default aria-disabled:opacity-50";

/** Ссылка-Категория без Витрины подсвечивается наведением: открывать ей нечего. */
const CATEGORY_LINK_CLASS = "hover:bg-bg-2";

const CATEGORY_ICON_CLASS = "text-fg-2 flex shrink-0";

/** Подпись переносится, а не обрезается: длинное название раздела читается целиком. */
const CATEGORY_LABEL_CLASS = "min-w-0 flex-1 break-words";

const CATEGORY_CHEVRON_CLASS = "text-fg-3 flex shrink-0 rtl:rotate-180";

/**
 * Витрина: вплотную к Столбцу со стороны конца строки, не ниже его, одна ширина
 * на все Категории. Поверхность и тень — как у панели `Menu`: три меню кита
 * должны читаться одной системой.
 */
const SHOWCASE_CLASS =
  "bg-surface-elevated border-line absolute top-0 min-h-full " +
  "w-[var(--mega-menu-showcase-w)] max-w-[calc(100vw-2rem)] rounded-md border p-4 " +
  `shadow-[var(--shadow-2)] ${OVERLAY_LAYER.popover}`;

/** Сторона Витрины: со стороны конца строки или, перевёрнутая у края, — начала. */
const SHOWCASE_SIDE = { end: "start-full ms-1", start: "end-full me-1" } as const;

const SHOWCASE_HEADING_CLASS =
  "text-fg-0 hover:text-accent-strong mb-3 inline-flex items-center gap-1 text-[15px] " +
  "font-semibold no-underline";

const SHOWCASE_GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-5";

export interface MegaMenuCategoryProps {
  /** Ключ Категории — им же её открывают через `value`. */
  id: string;
  /** Подпись в Столбце; она же — доступное имя Витрины. */
  label: ReactNode;
  /** Иконка слева от подписи; скрыта от скринридера. */
  icon?: ReactNode;
  /**
   * Адрес раздела целиком. С Витриной — заголовок-ссылка в её начале, без
   * Витрины — сама строка Столбца становится ссылкой.
   */
  href?: string;
  /**
   * Ссылка роутера вместо `href`: пустой элемент (`<Link href="/x" />`),
   * подпись уезжает внутрь. Отдельным пропом, а не `asChild`: дети Категории —
   * это её Витрина.
   */
  link?: ReactElement;
  /** Видна, но не открывается и пропускается стрелками. */
  disabled?: boolean;
  /** Содержимое Витрины: `MegaMenuGroup` и что угодно своё. Без детей Витрины нет. */
  children?: ReactNode;
  /** Классы на строку Столбца. */
  className?: string;
}

/**
 * Категория Столбца и её Витрина.
 *
 * Содержимое Витрины монтируется только у открытой Категории: каталог из
 * сотни ссылок и картинок не должен грузить всё разом. Сам регион при этом
 * есть всегда (скрытым): на него указывает `aria-controls` кнопки.
 */
export function MegaMenuCategory({
  id,
  label,
  icon,
  href,
  link,
  disabled = false,
  children,
  className,
}: MegaMenuCategoryProps) {
  const menu = useMegaMenu("MegaMenuCategory");
  const hasShowcase = Children.toArray(children).length > 0;
  const open = hasShowcase && menu.value === id;
  const categoryId = domId(menu.baseId, "category", id);
  const showcaseId = domId(menu.baseId, "showcase", id);
  const showcaseRef = useRef<HTMLElement | null>(null);

  // Переход в Витрину с клавиатуры: фокус на её первый фокусируемый элемент,
  // как только содержимое смонтировалось.
  useEffect(() => {
    if (!open || menu.pendingFocus.current !== id) return;
    menu.pendingFocus.current = null;
    showcaseRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [open, id, menu.pendingFocus]);

  const shared = {
    id: categoryId,
    "data-mega-category": id,
    "data-mega-showcase": hasShowcase ? "true" : "false",
    tabIndex: menu.tabStop === id ? 0 : -1,
    "aria-disabled": disabled || undefined,
    onFocus: () => menu.onCategoryFocus(id),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) =>
      menu.onCategoryKeyDown(event, id, hasShowcase),
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      if (disabled || event.pointerType === "touch" || event.pointerType === "pen") return;
      // Решает Прицел: курсор, идущий к открытой Витрине наискосок, задевает
      // соседние строки — они не должны её перехватывать.
      menu.hoverCategory(hasShowcase ? id : null);
    },
  };

  const content = (
    <>
      {icon != null && (
        <span aria-hidden className={CATEGORY_ICON_CLASS}>
          {icon}
        </span>
      )}
      <span className={CATEGORY_LABEL_CLASS}>{label}</span>
    </>
  );

  if (!hasShowcase) {
    const Comp = link ? Slot : "a";
    return (
      <li>
        <Comp
          {...shared}
          href={link ? undefined : href}
          className={cn(CATEGORY_CLASS, !disabled && CATEGORY_LINK_CLASS, className)}
        >
          {content}
          {link ? <Slottable>{link}</Slottable> : null}
        </Comp>
      </li>
    );
  }

  return (
    <li>
      <button
        {...shared}
        type="button"
        aria-expanded={open}
        aria-controls={showcaseId}
        className={cn(CATEGORY_CLASS, className)}
        onClick={() => {
          // Открывает, а не переключает: повторное касание открытой Категории
          // не должно прятать Витрину, которую человек только что открыл.
          if (!disabled) menu.openCategory(id);
        }}
      >
        {content}
        <span aria-hidden className={CATEGORY_CHEVRON_CLASS}>
          <ChevronRightIcon size={14} />
        </span>
      </button>
      <section
        ref={showcaseRef}
        id={showcaseId}
        aria-labelledby={categoryId}
        hidden={!open}
        className={cn(SHOWCASE_CLASS, SHOWCASE_SIDE[menu.flipped ? "start" : "end"])}
        onKeyDown={(event) => menu.onShowcaseKeyDown(event, id)}
      >
        {open && (
          <>
            {(href != null || link != null) && (
              <ShowcaseHeading href={href} link={link}>
                {label}
              </ShowcaseHeading>
            )}
            <div className={SHOWCASE_GRID_CLASS}>{children}</div>
          </>
        )}
      </section>
    </li>
  );
}

function ShowcaseHeading({
  href,
  link,
  children,
}: {
  href?: string;
  link?: ReactElement;
  children: ReactNode;
}) {
  const Comp = link ? Slot : "a";
  return (
    <div>
      <Comp href={link ? undefined : href} className={SHOWCASE_HEADING_CLASS}>
        {children}
        <span aria-hidden className={CATEGORY_CHEVRON_CLASS}>
          <ChevronRightIcon size={14} />
        </span>
        {link ? <Slottable>{link}</Slottable> : null}
      </Comp>
    </div>
  );
}

export interface MegaMenuGroupProps {
  /** Заголовок колонки; он же подписывает её список ссылок. */
  title: ReactNode;
  /** Адрес подраздела целиком: заголовок становится ссылкой. */
  href?: string;
  /** Ссылки колонки — `MegaMenuLink`. Каждая уезжает в свой пункт списка. */
  children?: ReactNode;
  /** Классы на колонку. */
  className?: string;
}

const GROUP_TITLE_CLASS = "text-fg-0 mb-1.5 text-[13px] font-semibold";
const GROUP_TITLE_LINK_CLASS = "hover:text-accent-strong text-inherit no-underline";
const GROUP_LIST_CLASS = "m-0 flex list-none flex-col p-0";

/**
 * Колонка Витрины: заголовок и список ссылок под ним.
 *
 * Список подписан заголовком (`aria-labelledby`): скринридер объявляет
 * «Смартфоны, список, 5 пунктов», а не безымянный список посреди Витрины.
 */
export function MegaMenuGroup({ title, href, children, className }: MegaMenuGroupProps) {
  const titleId = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <div id={titleId} className={GROUP_TITLE_CLASS}>
        {href != null ? (
          <a href={href} className={GROUP_TITLE_LINK_CLASS}>
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      <ul aria-labelledby={titleId} className={GROUP_LIST_CLASS}>
        {Children.map(children, (child) => (child == null ? null : <li>{child}</li>))}
      </ul>
    </div>
  );
}

export interface MegaMenuLinkProps extends ComponentPropsWithoutRef<"a"> {
  /** Ссылка ведёт на текущую страницу: `aria-current="page"` и вид текущей. */
  current?: boolean;
  /** Иконка слева от подписи; скрыта от скринридера. */
  icon?: ReactNode;
  /**
   * Вывести ссылку элементом роутера: `<MegaMenuLink asChild><Link href="/x">Подпись</Link></MegaMenuLink>`.
   * Стили, пропы и `ref` переходят на него, иконка — внутрь.
   */
  asChild?: boolean;
}

const LINK_CLASS =
  "text-fg-1 hover:text-fg-0 flex items-center gap-2 rounded-sm py-1 text-[13px] leading-5 " +
  "no-underline hover:underline " +
  "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "aria-[current=page]:text-accent-strong aria-[current=page]:font-semibold";

/**
 * Ссылка Витрины.
 *
 * Текущую страницу кит не вычисляет — проп `current`, как `active` у
 * `NavItem`: правила сравнения адресов у каждого роутера свои (ADR-0018).
 */
export const MegaMenuLink = forwardRef<HTMLAnchorElement, MegaMenuLinkProps>(function MegaMenuLink(
  { current = false, icon, asChild = false, children, className, ...rest },
  ref
) {
  const Comp = asChild ? Slot : "a";
  return (
    <Comp
      ref={ref}
      aria-current={current ? "page" : undefined}
      className={cn(LINK_CLASS, className)}
      {...rest}
    >
      {icon != null && (
        <span aria-hidden className="text-fg-2 flex shrink-0">
          {icon}
        </span>
      )}
      {asChild ? <Slottable>{children}</Slottable> : children}
    </Comp>
  );
});

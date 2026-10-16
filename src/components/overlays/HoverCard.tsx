"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  getInteractionModality,
  trackInteractionModality,
} from "../../lib/interaction-modality.js";
import { Popover, PopoverAnchor, PopoverContent, type PopoverContentProps } from "./Popover.js";

/**
 * Карточка-превью: подробности о том, на что навели курсор или поставили фокус.
 *
 * Собрана на китовом `Popover`, а не на `@radix-ui/react-hover-card`: новая
 * зависимость ради ста строк таймеров — цена выше пользы (решение
 * владельца, ADR-0048 запрещает компоненту «на будущее» стоить потребителю
 * зависимость). Слой, вид, анимации и позиционирование — те же, что у
 * `PopoverContent`.
 *
 * Радикс-поповер здесь УПРАВЛЯЕМЫЙ, а триггер — `PopoverAnchor`, а не
 * `PopoverTrigger`. Триггер поповера переключает панель по клику и вешает на
 * элемент `aria-haspopup="dialog"` с `aria-expanded`. Для ссылки, у которой
 * есть своё действие, это двойная ложь: клик должен вести по ссылке, а не
 * открывать панель, и скринридер не должен обещать диалог. Якорь только даёт
 * панели точку привязки.
 */

const DEFAULT_OPEN_DELAY = 700;
const DEFAULT_CLOSE_DELAY = 300;

export interface HoverCardProps {
  /**
   * Сколько миллисекунд курсор или фокус должны задержаться на триггере, чтобы
   * карточка открылась. Не даёт ей выскакивать от случайного пролёта курсора.
   * Ориентир — `HoverCard` из Radix.
   */
  openDelay?: number;
  /**
   * Сколько миллисекунд карточка живёт после того, как курсор ушёл и с триггера,
   * и с карточки. За это время курсор успевает перейти с одного на другое.
   */
  closeDelay?: number;
  /** Управляемое состояние. Задержки при этом по-прежнему считает компонент. */
  open?: boolean;
  /** Открыта ли карточка в начале, если состоянием управляет сам компонент. По умолчанию закрыта. */
  defaultOpen?: boolean;
  /**
   * Вызывается, когда карточка просит открыться или закрыться: по таймеру
   * наведения и фокуса, по Escape, по клику и фокусу вне карточки.
   */
  onOpenChange?: (open: boolean) => void;
  /** Состав карточки: `HoverCardTrigger` и `HoverCardContent`. */
  children: ReactNode;
}

interface HoverCardContextValue {
  open: boolean;
  onTriggerEnter: (event: PointerEvent) => void;
  onTriggerLeave: (event: PointerEvent) => void;
  onTriggerFocus: () => void;
  onTriggerBlur: () => void;
  onContentEnter: (event: PointerEvent) => void;
  onContentLeave: (event: PointerEvent) => void;
  onContentFocus: () => void;
  onContentBlur: () => void;
  /** Узел триггера: нужен панели, чтобы отличить фокус на нём от фокуса «вовне». */
  triggerRef: MutableRefObject<HTMLElement | null>;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCardContext(part: string): HoverCardContextValue {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`${part} must be used within HoverCard`);
  return context;
}

/**
 * Устройство без наведения: основной указатель — палец. Запрещает открытие по
 * НАВЕДЕНИЮ; клавиатурный фокус это не отменяет — у планшета бывает аппаратная
 * клавиатура, и Tab на ссылке должен открывать карточку так же, как на
 * компьютере. Тап по ссылке — нажатие, а не клавиша, поэтому карточку по-прежнему
 * не открывает.
 *
 * Медиазапрос здесь осознанно читается из JS, в отличие от раскладок
 * (ADR-0018): карточка и без того появляется только после взаимодействия,
 * гидратации ждать нечего, а CSS управлять таймерами не умеет. Проверка идёт в
 * момент запроса открытия, а не подпиской: пользователь может подключить мышь к
 * планшету между двумя наведениями.
 */
function hoverUnavailable(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: none)").matches;
}

export function HoverCard({
  openDelay = DEFAULT_OPEN_DELAY,
  closeDelay = DEFAULT_CLOSE_DELAY,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: HoverCardProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  // Слушатели модальности должны стоять до первого фокуса на триггере: событие,
  // что уже прошло, задним числом не прочитать. Ставятся лениво и один раз.
  useEffect(trackInteractionModality, []);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;

  // Таймеры срабатывают позже рендера и должны видеть актуальные значения, а не
  // замкнутые на момент установки. Ссылки обновляются после коммита.
  const latest = useRef({ open, controlled, openDelay, closeDelay, onOpenChange });
  useEffect(() => {
    latest.current = { open, controlled, openDelay, closeDelay, onOpenChange };
  });

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Кто сейчас «держит» карточку: курсор на триггере, курсор на карточке,
  // фокус на любом из них. Закрытие запрашивается, когда не держит никто.
  const holds = useRef({ triggerHover: false, contentHover: false, focus: false });
  const triggerRef = useRef<HTMLElement | null>(null);

  /*
    Закрытая карточка никого не держит.

    Закрыть её можно, пока курсор лежит на панели или фокус стоит в ней, — по
    Escape или из управляемого родителя. Узел панели при этом уходит из
    документа, и ни `pointerleave`, ни `blur` React уже не пошлёт: флаг
    остался бы поднятым, и при следующем наведении `requestClose` видел бы
    «держат» и не закрывал карточку никогда. Тот же след оставляет Escape при
    фокусе на триггере: фокус остался, флаг тоже.
  */
  useEffect(() => {
    if (open) return;
    holds.current = { triggerHover: false, contentHover: false, focus: false };
  }, [open]);

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) clearTimeout(openTimer.current);
    openTimer.current = null;
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const change = useCallback((next: boolean) => {
    const current = latest.current;
    if (current.open === next) return;
    if (!current.controlled) setInnerOpen(next);
    current.onOpenChange?.(next);
  }, []);

  const requestOpen = useCallback(
    (source: "hover" | "focus") => {
      clearCloseTimer();
      // Запрет `(hover: none)` касается только наведения. Фокус сюда доходит уже
      // отфильтрованным по модальности (только от клавиши), так что на планшете
      // с клавиатурой Tab карточку открывает, а тап и скринридер — нет.
      if (source === "hover" && hoverUnavailable()) return;
      if (latest.current.open || openTimer.current !== null) return;
      openTimer.current = setTimeout(() => {
        openTimer.current = null;
        change(true);
      }, latest.current.openDelay);
    },
    [change, clearCloseTimer]
  );

  const requestClose = useCallback(() => {
    const { triggerHover, contentHover, focus } = holds.current;
    if (triggerHover || contentHover || focus) return;
    clearOpenTimer();
    clearCloseTimer();
    if (!latest.current.open) return;
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      change(false);
    }, latest.current.closeDelay);
  }, [change, clearCloseTimer, clearOpenTimer]);

  // Размонтирование с висящим таймером не должно звать `onOpenChange` и
  // трогать состояние уже убранного компонента.
  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearOpenTimer, clearCloseTimer]);

  /*
    Радикс просит закрыть сам: Escape, щелчок вне карточки, фокус ушёл на другой
    элемент. Это закрытие немедленное и перебивает любые таймеры. Escape при
    этом идёт тем же путём, что у `Popover` и `Tooltip`: слушает его Radix, а
    не отдельный обработчик здесь (ADR-0041 стек слоёв кита не оборачивает
    Radix, а решает стык двух библиотек).
  */
  const handleRadixOpenChange = useCallback(
    (next: boolean) => {
      clearOpenTimer();
      clearCloseTimer();
      change(next);
    },
    [change, clearCloseTimer, clearOpenTimer]
  );

  const value = useMemo<HoverCardContextValue>(
    () => ({
      open,
      onTriggerEnter: (event) => {
        // Касание — не наведение: браузеры шлют `pointerenter` и от пальца.
        if (event.pointerType === "touch") return;
        holds.current.triggerHover = true;
        requestOpen("hover");
      },
      onTriggerLeave: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.triggerHover = false;
        requestClose();
      },
      onTriggerFocus: () => {
        /*
          Открывает только фокус от клавиши. Нажатие мышью или пальцем — действие
          уже совершено, и карточка поверх него мигала бы. Фокус без клавиши и
          указателя пришёл от скринридера (свайп, виртуальный курсор): он не
          должен всплывать с содержимым без объявления, а при экранной лупе —
          закрывать соседний текст. Содержимое карточки по контракту
          дополнительное и доступно иначе. `:focus-visible` для этого не годится:
          он истинен и для фокуса скринридера.
        */
        if (getInteractionModality() !== "keyboard") return;
        holds.current.focus = true;
        requestOpen("focus");
      },
      onTriggerBlur: () => {
        holds.current.focus = false;
        requestClose();
      },
      onContentEnter: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.contentHover = true;
        // Курсор дошёл до карточки — запланированное закрытие отменяется.
        clearCloseTimer();
      },
      onContentLeave: (event) => {
        if (event.pointerType === "touch") return;
        holds.current.contentHover = false;
        requestClose();
      },
      onContentFocus: () => {
        holds.current.focus = true;
        clearCloseTimer();
      },
      onContentBlur: () => {
        holds.current.focus = false;
        requestClose();
      },
      triggerRef,
    }),
    [open, requestOpen, requestClose, clearCloseTimer]
  );

  return (
    <HoverCardContext.Provider value={value}>
      <Popover open={open} onOpenChange={handleRadixOpenChange}>
        {children}
      </Popover>
    </HoverCardContext.Provider>
  );
}

/**
 * Четыре обработчика принадлежат карточке: потребительские на самом триггере
 * ставятся на потомка (`asChild`) и сохраняются, а здесь они затёрли бы таймеры.
 */
type RadixAnchorProps = Omit<
  ComponentPropsWithoutRef<typeof PopoverAnchor>,
  "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
>;

export interface HoverCardTriggerProps extends RadixAnchorProps {
  /** Отдать роль триггера вашему элементу вместо встроенного `div`: свойства и `ref` сливаются с его собственными. Здесь по умолчанию `true` — триггер должен быть ссылкой или кнопкой. */
  asChild?: RadixAnchorProps["asChild"];
  /** Элемент или объект с `getBoundingClientRect`, возле которого открывается карточка вместо самого триггера. */
  virtualRef?: RadixAnchorProps["virtualRef"];
}

/**
 * Триггер карточки (`asChild` по умолчанию включён: обёртка `div` без роли и без
 * фокуса была бы триггером, до которого не добраться с клавиатуры): слушает наведение и фокус, ничего не переключает по клику.
 *
 * Потомок обязан быть интерактивным (ссылка, кнопка) и принимать `ref` и
 * обработчики событий: собственные его обработчики сохраняются.
 */
export const HoverCardTrigger = forwardRef<HTMLDivElement, HoverCardTriggerProps>(
  function HoverCardTrigger({ asChild = true, ...rest }, ref) {
    const context = useHoverCardContext("HoverCardTrigger");
    return (
      <PopoverAnchor
        ref={(node) => {
          context.triggerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        asChild={asChild}
        data-state={context.open ? "open" : "closed"}
        onPointerEnter={context.onTriggerEnter}
        onPointerLeave={context.onTriggerLeave}
        onFocus={context.onTriggerFocus}
        onBlur={context.onTriggerBlur}
        {...rest}
      />
    );
  }
);

export type HoverCardContentProps = PopoverContentProps;

/**
 * Панель карточки. Вид, слой и анимации — `PopoverContent`.
 *
 * Отличия от поповера, и все они про то, что карточка дополняет триггер, а не
 * забирает управление:
 * - фокус при открытии остаётся на месте (`onOpenAutoFocus` отменён), а при
 *   закрытии не возвращается на триггер — закрытие от указателя не должно
 *   перетаскивать фокус; при Escape он и так стоит на триггере;
 * - роли `dialog` нет: диалог без перехода фокуса — обещание, которого панель не
 *   держит, а безымянный `role="dialog"` ещё и нарушает axe;
 * - курсор на панели удерживает её открытой.
 */
export const HoverCardContent = forwardRef<HTMLDivElement, HoverCardContentProps>(
  function HoverCardContent(
    {
      className,
      onPointerEnter,
      onPointerLeave,
      onFocus,
      onBlur,
      onOpenAutoFocus,
      onCloseAutoFocus,
      onFocusOutside,
      ...rest
    },
    ref
  ) {
    const context = useHoverCardContext("HoverCardContent");
    return (
      <PopoverContent
        ref={ref}
        role={undefined}
        className={className}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          onFocusOutside?.(event);
          /*
            Фокус на самом триггере — не «вовне». Якорь Radix, в отличие от
            `PopoverTrigger`, не числится триггером, и без этого Tab на ссылку
            при уже открытой (от курсора) карточке закрывал её, после чего
            таймер фокуса открывал снова — карточка мигала.
          */
          if (context.triggerRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          context.onContentEnter(event);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          context.onContentLeave(event);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          context.onContentFocus();
        }}
        onBlur={(event) => {
          onBlur?.(event);
          context.onContentBlur();
        }}
        {...rest}
      />
    );
  }
);

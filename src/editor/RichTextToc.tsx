"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/overlays/HoverCard.js";
import { toPixels } from "../hooks/useStickyOffset.js";
import { useMessages } from "../i18n/useMessages.js";
import { cn } from "../lib/cn.js";
import { watchHandleEditor } from "./core/handleWatchers.js";
import type { RichTextEditorHandle } from "./RichTextEditor.js";
import { collectHeadings, documentRoot, type TocHeading } from "./features/toc/headings.js";

export interface RichTextTocProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Ref на Просмотр (`RichTextView`) или на Хэндл Редактора (`RichTextEditor`),
   * чьи заголовки показывает Оглавление. Заголовки читаются из DOM цели после
   * монтирования: до гидратации полосы нет.
   *
   * Список следит за Документом: новый `html` Просмотра, новое значение
   * Редактора и правка в нём пересобирают его с короткой задержкой. Редактор
   * в `readOnly` работает так же, как Просмотр. Редактор в правке тоже
   * поддержан — список пересобирается, а переход не двигает каретку, — но
   * контрактом этот режим не обещан. Движок Редактора появляется после
   * монтирования, и Оглавление ждёт его само.
   */
  target: RefObject<HTMLElement | RichTextEditorHandle | null>;
  /**
   * Имя CSS-переменной с высотой липкой шапки экрана ([ADR-0016]). Переход
   * ставит заголовок под шапку, а не за неё, и подсветка считает раздел
   * текущим от нижнего края шапки. Переменной нет — отступом служит
   * `scroll-margin-top` заголовка. По умолчанию `--topbar-h`: её публикует `TopBar`.
   */
  offsetVar?: string;
}

/**
 * Длина штриха по глубине: чем глубже уровень, тем короче штрих. Ступеней
 * четыре — по числу уровней H1–H4, так что у каждого уровня своя длина.
 */
const STROKE_WIDTH = ["w-3.5", "w-3", "w-2.5", "w-2"] as const;
/**
 * Штрих текущего раздела толще и чуть длиннее старшего уровня: его видно в
 * полосе с первого взгляда, но он не выпирает из неё.
 */
const CURRENT_STROKE = "bg-accent-strong h-[3px] w-4";
/** Отступ текста пункта по глубине. */
const ITEM_INDENT = ["pl-0", "pl-3", "pl-6", "pl-9"] as const;

const strokeWidth = (depth: number) => STROKE_WIDTH[Math.min(depth, STROKE_WIDTH.length - 1)];
const itemIndent = (depth: number) => ITEM_INDENT[Math.min(depth, ITEM_INDENT.length - 1)];

/*
  Задержки наведения короче, чем у `HoverCard` по умолчанию (700 и 300 мс).
  Карточка висит на ссылке посреди текста, и курсор пролетает её случайно;
  полоса Оглавления стоит в своей колонке, и навели на неё — значит, хотят
  список. Механика та же, что у карточки, — компонент собран на ней.
*/
const OPEN_DELAY = 200;
const CLOSE_DELAY = 300;

/** Пауза после последней правки Документа, по которой список пересобирается. */
const REBUILD_DELAY = 150;

/**
 * Шаг между штрихами полосы и его границы. Ячейка штриха — 3px (см. полосу),
 * `p-1` даёт по 4px сверху и снизу; запас оставляет воздух над и под полосой.
 */
const STRIP_GAP = 6;
const STRIP_CELL = 3;
const STRIP_PADDING = 8;
const STRIP_MARGIN = 16;

/** Запас под строкой отсчёта: заголовок, вставший вплотную под шапку, уже текущий. */
const SPY_SLACK = 8;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Ближайший прокручиваемый предок цели; `null` — прокручивается окно. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (parent === document.body || parent === document.documentElement) return null;
    const { overflowY } = getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
  }
  return null;
}

/** Высота липкой шапки в пикселях; переменной нет — `null`. */
function stickyOffset(offsetVar: string): number | null {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(offsetVar).trim();
  if (!raw) return null;
  const px = parseFloat(toPixels(raw, "0px"));
  return Number.isFinite(px) && px > 0 ? px : null;
}

/**
 * Перейти к заголовку: прокрутить к нему и поставить на него фокус.
 *
 * Без якорей: адрес страницы не меняется, `id` в Документе не появляются
 * (ADR-0066). Фокус нужен скринридеру и клавиатуре — следующий Tab идёт от
 * заголовка, а не от Оглавления. `tabindex="-1"` ставится только на время
 * фокуса: в Документе после ухода фокуса не остаётся следа.
 */
function jumpTo(heading: HTMLElement, offsetVar: string) {
  /*
    В Редакторе в правке заголовок лежит внутри `contenteditable`, и ProseMirror
    следит за его DOM: чужой `tabindex` он счёл бы правкой, перерисовал заголовок
    без атрибута, и фокус пропал бы вместе с ним. Фокус на заголовок здесь и не
    нужен: поставить его, не тронув каретку, нельзя, а каретка остаётся там, где
    её оставил автор. Прокрутка работает как обычно.
  */
  if (!heading.parentElement?.closest('[contenteditable="true"]')) {
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    heading.focus({ preventScroll: true });
  }

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const offset = stickyOffset(offsetVar);
  // Без шапки браузер сам учтёт `scroll-margin-top` заголовка.
  if (offset === null) {
    heading.scrollIntoView({ behavior, block: "start" });
    return;
  }
  const scroller = scrollParent(heading);
  const top = heading.getBoundingClientRect().top;
  if (scroller) {
    const edge = scroller.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + top - edge, behavior });
  } else {
    window.scrollTo({ top: window.scrollY + top - offset, behavior });
  }
}

/**
 * Текущий раздел: последний заголовок, поднявшийся до строки отсчёта — нижнего
 * края шапки или верха прокручиваемого контейнера. Ни один не поднялся —
 * текущий первый. Документ докручен до конца — текущий последний видимый:
 * короткие последние разделы до строки отсчёта не доезжают никогда.
 */
function currentIndex(headings: TocHeading[], offsetVar: string): number {
  const first = headings[0];
  if (!first) return -1;
  const scroller = scrollParent(first.element);
  const edge = scroller ? scroller.getBoundingClientRect().top : (stickyOffset(offsetVar) ?? 0);
  const line = edge + SPY_SLACK;

  const atEnd = scroller
    ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2
    : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;

  let current = 0;
  headings.forEach((heading, index) => {
    const top = heading.element.getBoundingClientRect().top;
    if (top <= line || (atEnd && top < bottom)) current = index;
  });
  return current;
}

/**
 * Элемент Документа по ref цели. Просмотр — сам элемент; Редактор — корень
 * ProseMirror его движка: Панель и строка статуса вокруг в Документ не входят.
 * Движка ещё нет (или он уничтожен) — `null`.
 */
function resolveTarget(target: RefObject<HTMLElement | RichTextEditorHandle | null>) {
  const value = target.current;
  if (!value) return null;
  if (!("editor" in value)) return value;
  const { editor } = value;
  return editor && !editor.isDestroyed ? editor.view.dom : null;
}

/** Тот же набор заголовков: правка текста вне заголовков не должна ничего перерисовывать. */
function sameHeadings(a: TocHeading[], b: TocHeading[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (heading, index) =>
        heading.element === b[index]!.element &&
        heading.text === b[index]!.text &&
        heading.depth === b[index]!.depth
    )
  );
}

/**
 * Шаг между штрихами, при котором полоса не выше окна. Хватает места — обычный
 * шаг; не хватает — он сжимается вплоть до нуля. Ячейки остаются постоянного
 * размера, меняется только промежуток между ними, и считается он лишь от
 * размера окна и числа заголовков, но не от текущего раздела: полоса не
 * вздрагивает при прокрутке.
 */
function stripGap(count: number, offsetVar: string): number {
  if (count < 2) return STRIP_GAP;
  const room =
    window.innerHeight -
    (stickyOffset(offsetVar) ?? 0) -
    STRIP_MARGIN * 2 -
    STRIP_PADDING -
    count * STRIP_CELL;
  return Math.max(0, Math.min(STRIP_GAP, room / (count - 1)));
}

/**
 * Помещается ли полоса слева от текста: целиком в окне и не заходит на
 * Документ. Колонка под Оглавление бывает полем страницы, которое сужается
 * вместе с окном, — тогда полоса наползла бы на текст или ушла за край.
 */
function fitsBeside(strip: HTMLElement, target: HTMLElement): boolean {
  const own = strip.getBoundingClientRect();
  const text = documentRoot(target).getBoundingClientRect();
  return own.left >= 0 && own.right <= text.left;
}

/**
 * Оглавление Документа: полоса штрихов, по одному на заголовок, штрих текущего
 * раздела подсвечен. Наведение раскрывает список заголовков, пункт ведёт к
 * заголовку.
 *
 * Отдельный компонент, а не проп Просмотра (ADR-0066): `RichTextView` остаётся
 * серверным, а место Оглавления — колонку, липкость, скрытие на узком экране —
 * решает вёрстка экрана. Меньше двух заголовков — компонент ничего не рисует.
 */
export const RichTextToc = forwardRef<HTMLDivElement, RichTextTocProps>(function RichTextToc(
  { target, offsetVar = "--topbar-h", className, ...rest },
  ref
) {
  const messages = useMessages();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [gap, setGap] = useState(STRIP_GAP);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(true);
  const stripRef = useRef<HTMLButtonElement>(null);
  /** Список открыт с клавиатуры: фокус уходит в него, на текущий пункт. */
  const focusOnOpen = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);

  // Элемент цели. У Редактора движок появляется после монтирования (и лениво),
  // поэтому на его смену подписка: Редактор сообщает по тому же `ref`.
  useEffect(() => {
    const resolve = () => setElement(resolveTarget(target));
    resolve();
    return watchHandleEditor(target, resolve);
  }, [target]);

  // Заголовки следуют за Документом. Наблюдатель стоит на корне Документа и не
  // зависит от того, нарисована ли полоса: меньше двух заголовков она не
  // рисуется, а появиться должна, когда пришёл второй. Атрибуты не наблюдаются:
  // переход сам ставит и снимает `tabindex` на заголовке, и пересборка по нему
  // подменила бы узлы списка под рукой.
  useEffect(() => {
    if (!element) {
      setHeadings((prev) => (prev.length ? [] : prev));
      return;
    }
    const read = () => {
      const next = collectHeadings(element);
      setHeadings((prev) => (sameHeadings(prev, next) ? prev : next));
    };
    read();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(read, REBUILD_DELAY);
    });
    observer.observe(documentRoot(element), {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [element]);

  // Шаг полосы зависит от высоты окна и числа заголовков.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setGap(stripGap(headings.length, offsetVar));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
    };
  }, [headings.length, offsetVar]);

  // Подсветка текущего раздела. Слушатель прокрутки — на документе с захватом:
  // так его достигает прокрутка и окна, и любого контейнера вокруг цели.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setCurrent(currentIndex(headings, offsetVar));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    document.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
  }, [headings, offsetVar]);

  // Места слева нет — Оглавление прячется само (ADR-0066). `visibility`, а не
  // размонтирование: полоса продолжает занимать своё место, и замер остаётся
  // верным, когда место появится снова.
  useEffect(() => {
    const strip = stripRef.current;
    const node = element;
    if (!strip || !node) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next = fitsBeside(strip, node);
      setFits(next);
      if (!next) setOpen(false);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(node);
    observer?.observe(document.documentElement);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [element, headings.length]);

  const listRef = useCallback(
    (node: HTMLElement | null) => {
      navRef.current = node;
      if (!node) return;
      const items = node.querySelectorAll<HTMLButtonElement>("button");
      // Длинный список прокручивается: текущий пункт держится в видимой части
      // списка, когда он открылся и когда раздел сменился при открытом списке.
      // `nearest` не двигает то, что уже видно, а страницу — не двигает вовсе.
      items[current]?.scrollIntoView({ block: "nearest" });
      if (!focusOnOpen.current) return;
      focusOnOpen.current = false;
      (items[current] ?? items[0])?.focus();
    },
    [current]
  );

  if (headings.length < 2) return null;

  const label = messages.editor.toc;

  const onStripKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (open && navRef.current) {
      // Список уже открыт наведением: фокус переводится в него сразу.
      const items = navRef.current.querySelectorAll<HTMLButtonElement>("button");
      (items[current] ?? items[0])?.focus();
      return;
    }
    focusOnOpen.current = true;
    setOpen(true);
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, items.length - 1)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div
      ref={ref}
      data-hidden={fits ? undefined : ""}
      className={cn("inline-flex", !fits && "invisible", className)}
      {...rest}
    >
      <HoverCard open={open} onOpenChange={setOpen} openDelay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
        <HoverCardTrigger asChild>
          <button
            ref={stripRef}
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={(event) => {
              // Enter и Space разобраны выше; сюда доходят мышь и касание.
              if (event.detail === 0) return;
              setOpen(true);
            }}
            onKeyDown={onStripKeyDown}
            style={{ rowGap: gap }}
            className="focus-visible:outline-accent-strong flex cursor-pointer flex-col items-start rounded-sm p-1 outline-offset-2 focus-visible:outline-2"
          >
            {/* Ячейка штриха постоянного размера: толщина и длина текущего
                анимируются, а габариты полосы — нет. Иначе список, привязанный
                к её краю, вздрагивал бы при каждой смене раздела. */}
            {headings.map((heading, index) => (
              <span key={index} className="flex h-[3px] w-4 items-center">
                <span
                  data-toc-stroke=""
                  data-depth={heading.depth}
                  data-current={index === current || undefined}
                  className={cn(
                    "rounded-full transition-[width,height,background-color] duration-150",
                    index === current
                      ? CURRENT_STROKE
                      : cn("bg-fg-3 h-0.5", strokeWidth(heading.depth))
                  )}
                />
              </span>
            ))}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={8}
          className="max-h-[min(70dvh,32rem)] w-max max-w-72 overflow-y-auto overscroll-contain p-1"
          onEscapeKeyDown={() => stripRef.current?.focus()}
          onFocusOutside={(event) => {
            // Переход ставит фокус на заголовок, а список остаётся открытым:
            // его закрывает уход курсора, а не выбор пункта. С клавиатуры фокус
            // в списке больше не держит его, и он закрывается тем же таймером.
            if (element?.contains(event.target as Node)) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            // Полоса — якорь, а не триггер Radix: без этого нажатие на неё при
            // открытом от наведения списке считалось бы нажатием «вовне» и
            // закрывало список, который это же нажатие просит открыть.
            if (stripRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <nav ref={listRef} aria-label={label} onKeyDown={onListKeyDown}>
            <ul>
              {headings.map((heading, index) => (
                <li key={index}>
                  <button
                    type="button"
                    data-depth={heading.depth}
                    aria-current={index === current ? "location" : undefined}
                    className={cn(
                      "hover:bg-bg-2 focus-visible:bg-bg-2 flex w-full cursor-pointer items-center gap-2.5 rounded-sm py-0.5 pr-2 pl-1.5 text-left text-[13px] leading-[18px] outline-none",
                      index === current ? "bg-bg-2 text-fg-0" : "text-fg-2 hover:text-fg-0"
                    )}
                    onClick={() => jumpTo(heading.element, offsetVar)}
                  >
                    {/* Штрихи стоят в колонке одной ширины: текст пунктов начинается ровно, а отступ даёт глубина. */}
                    <span aria-hidden className="flex w-4 shrink-0 items-center">
                      <span
                        className={cn(
                          "rounded-full",
                          index === current
                            ? CURRENT_STROKE
                            : cn("bg-fg-3 h-0.5", strokeWidth(heading.depth))
                        )}
                      />
                    </span>
                    <span className={cn("min-w-0 truncate", itemIndent(heading.depth))}>
                      {heading.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
});

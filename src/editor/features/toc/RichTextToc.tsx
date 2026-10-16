"use client";

import type { Editor } from "@tiptap/core";
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/overlays/HoverCard.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { watchHandleEditor } from "../../core/handleWatchers.js";
import type { RichTextEditorHandle } from "../../RichTextEditor.js";
import { tocDocumentHeadings } from "./documentHeadings.js";
import { collectHeadings, documentRoot, type TocHeading } from "./headings.js";
import { stickyOffset } from "./stickyOffset.js";

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
  /**
   * Ширина списка — длина CSS или пиксели. Постоянная, а не по самому длинному
   * заголовку: список не меняет размер от Документа к Документу. Заголовок, что
   * не помещается, обрезается многоточием, полный текст — в подсказке пункта.
   * По умолчанию 240px.
   */
  listWidth?: number | string;
  /**
   * Уровни заголовков, которые попадают в Оглавление: подмножество 1–4. Заголовка
   * другого уровня нет ни в полосе, ни в списке, а отступ пунктов считается от
   * самого крупного из оставшихся. Читается при каждой сборке списка, поэтому
   * смена набора уровней пересобирает его. По умолчанию все четыре.
   */
  levels?: readonly (1 | 2 | 3 | 4)[];
}

/**
 * Длина штриха по глубине: чем глубже уровень, тем короче штрих. Ступеней
 * четыре — по числу уровней H1–H4, так что у каждого уровня своя длина.
 */
const STROKE_WIDTH = ["w-3.5", "w-3", "w-2.5", "w-2"] as const;
/**
 * Штрих текущего раздела той же толщины, что остальные (ячейка 2px), но длиннее
 * старшего уровня и цвета акцента: его видно в полосе с первого взгляда, а он не
 * выпирает из неё.
 */
const CURRENT_STROKE = "bg-accent-strong h-0.5 w-4";
/** Отступ текста пункта по глубине. */
const ITEM_INDENT = ["pl-0", "pl-2.5", "pl-5", "pl-7.5"] as const;

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

/** Все уровни заголовков: Оглавление без `levels`. */
const ALL_LEVELS = [1, 2, 3, 4] as const;

/** Пауза после последней правки Документа, по которой список пересобирается. */
const REBUILD_DELAY = 150;

/**
 * Шаг между штрихами полосы и его границы. Ячейка штриха — 2px, ровно в штрих
 * (см. полосу; решение владельца на превью 4.7.0, OLDSUI-289: было 3px), между
 * ячейками — 5px. `p-1` даёт по 4px сверху и снизу; запас оставляет воздух над
 * и под полосой.
 */
const STRIP_GAP = 5;
const STRIP_CELL = 2;
const STRIP_PADDING = 8;
const STRIP_MARGIN = 16;

/** Сколько прокрутка от перехода должна молчать, чтобы считаться законченной. */
const PIN_SETTLE = 150;

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

/** Сколько гаснет подсветка заголовка после перехода. */
const FLASH_DURATION = 1600;

/**
 * Подсветить заголовок, к которому перешли: фон цветом акцента гаснет до
 * прозрачного. Глаз находит, куда приехала страница, — особенно когда
 * заголовок не встал к верхнему краю (конец Документа).
 *
 * Анимацией Web Animations, а не классом: в Документе не появляется ни класса,
 * ни `style` — Схема и сохранённый HTML прежние, а Редактор не принимает
 * подсветку за правку. Цвет читается из токена на самом заголовке: так он
 * верен и на Листе, и во вложенной теме. Нет API — нет и подсветки.
 */
/** Кривая шкалы движения, прочитанная с узла; нет токена — штатная `ease`. */
function scaleCurve(node: HTMLElement, token: string): string {
  return getComputedStyle(node).getPropertyValue(token).trim() || "ease";
}

function flash(heading: HTMLElement) {
  if (typeof heading.animate !== "function") return;
  const accent = getComputedStyle(heading).getPropertyValue("--accent-strong").trim();
  const color = accent ? `color-mix(in srgb, ${accent} 24%, transparent)` : "transparent";
  // Поле вокруг текста — тенью без размытия, а не `padding`: заголовок не
  // сдвигается ни на пиксель, пока подсветка гаснет.
  heading.animate(
    [
      { backgroundColor: color, boxShadow: `0 0 0 6px ${color}`, borderRadius: "4px" },
      { backgroundColor: "transparent", boxShadow: "0 0 0 6px transparent", borderRadius: "4px" },
    ],
    // Кривая — ступень шкалы `--ease-enter` (ADR-0047): гаснет быстро и
    // дотягивает медленно. Длительность вне шкалы намеренно: это не переход
    // между состояниями, а след, который глаз должен успеть заметить.
    { duration: FLASH_DURATION, easing: scaleCurve(heading, "--ease-enter") }
  );
}

/**
 * Перейти к заголовку: прокрутить к нему и поставить на него фокус.
 *
 * Без якорей: адрес страницы не меняется, `id` в Документе не появляются
 * (ADR-0066). Фокус нужен скринридеру и клавиатуре — следующий Tab идёт от
 * заголовка, а не от Оглавления. `tabindex="-1"` ставится только на время
 * фокуса: в Документе после ухода фокуса не остаётся следа.
 */
function jumpTo(
  heading: HTMLElement,
  offset: number | null,
  focusHeading?: (heading: HTMLElement) => boolean
) {
  /*
    В Редакторе в правке заголовок лежит внутри `contenteditable`, и ProseMirror
    следит за его DOM: чужой `tabindex` он счёл бы правкой, перерисовал заголовок
    без атрибута, и фокус пропал бы вместе с ним. Фокус на заголовок здесь и не
    нужен: поставить его, не тронув каретку, нельзя, а каретка остаётся там, где
    её оставил автор. Прокрутка работает как обычно.
  */
  // Хозяин поля (Инструмент `toc` Редактора) может поставить фокус сам — каретку
  // в заголовок; иначе — фокус на сам заголовок, если он не в правке.
  if (focusHeading?.(heading)) {
    // Фокус поставлен.
  } else if (!heading.parentElement?.closest('[contenteditable="true"]')) {
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    heading.focus({ preventScroll: true });
  }
  // Подсветка — анимацией, без следа в DOM: годится и Редактору в правке.
  flash(heading);

  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  const scroller = scrollParent(heading);
  if (offset === null) {
    // Без шапки отступ задаёт `scroll-margin-top` заголовка (ADR-0016). Окно
    // прокручивает браузер. Но `scrollIntoView` двигает ещё и всех
    // прокручиваемых предков, а значит, при Документе в своей прокручиваемой
    // области уехала бы и страница, — поэтому область прокручивается сама,
    // а окно не трогается.
    if (!scroller) {
      heading.scrollIntoView({ behavior, block: "start" });
      return;
    }
    const margin = parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
    const edge = scroller.getBoundingClientRect().top;
    const top = heading.getBoundingClientRect().top;
    scroller.scrollTo({ top: scroller.scrollTop + top - edge - margin, behavior });
    return;
  }
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
function currentIndex(headings: TocHeading[], offset: number | null): number {
  const first = headings[0];
  if (!first) return -1;
  const scroller = scrollParent(first.element);
  const edge = scroller ? scroller.getBoundingClientRect().top : (offset ?? 0);
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

/** Прокрутить `box` ровно настолько, чтобы `item` был виден целиком. */
function keepVisible(item: HTMLElement | undefined, box: HTMLElement | null) {
  if (!item || !box) return;
  const itemRect = item.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  if (itemRect.top < boxRect.top) box.scrollTop -= boxRect.top - itemRect.top;
  else if (itemRect.bottom > boxRect.bottom) box.scrollTop += itemRect.bottom - boxRect.bottom;
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
function stripGap(count: number, offset: number | null): number {
  if (count < 2) return STRIP_GAP;
  const room =
    window.innerHeight - (offset ?? 0) - STRIP_MARGIN * 2 - STRIP_PADDING - count * STRIP_CELL;
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
export const RichTextToc = forwardRef<HTMLDivElement, RichTextTocProps>(
  function RichTextToc(props, ref) {
    return <TocCore ref={ref} {...props} />;
  }
);

/**
 * Ядро Оглавления: общее у `RichTextToc` и Инструмента `toc` Редактора
 * (ADR-0068). Две настройки — только для кита, наружу не выходят: Редактор
 * сам знает, где край его липкой Панели, и сам ставит каретку при переходе.
 */
export interface TocCoreProps extends RichTextTocProps {
  /**
   * Нижний край липкого верха в пикселях: от него считают подсветка, переход и
   * шаг полосы. Нет — высота из `offsetVar`.
   */
  stickyTop?: () => number | null;
  /** Поставить фокус при переходе самому; `true` — поставлен. */
  focusHeading?: (heading: HTMLElement) => boolean;
  /**
   * Опустить полосу так, чтобы первый штрих стоял на середине первой строки
   * первого заголовка: в поле Редактора полоса и заголовок начинаются с одного
   * уровня, а не полоса выше текста.
   */
  alignToFirstHeading?: boolean;
  /**
   * Текущий раздел сменился (в том числе при первом показе): Редактор кладёт
   * индекс в Состояние Инструмента `toc`. Индекс считается по списку, который
   * видит `TocCore`; пока заголовков меньше двух, он остаётся прежним.
   */
  onCurrentChange?: (index: number) => void;
  /**
   * Движок Редактора. Нужен команде `jumpTo` (`jumpRef`): индекс команды — это
   * индекс заголовка в снимке Состояния `toc`, а снимок читает Документ движка
   * на каждой транзакции. Список ядра пересобирается из DOM с задержкой
   * (`REBUILD_DELAY`), и сразу после правки индексы двух списков расходились бы.
   * Без движка `jumpTo` считает по списку ядра.
   */
  editor?: Editor;
  /**
   * Куда ядро кладёт переход к заголовку по индексу снимка Состояния (команда
   * `jumpTo` Инструмента): ведёт себя как клик по пункту. Пока ядро смонтировано,
   * там функция, после — `null`. Нет заголовка с таким индексом — `false`.
   */
  jumpRef?: MutableRefObject<((index: number) => boolean) | null>;
}

export const TocCore = forwardRef<HTMLDivElement, TocCoreProps>(function TocCore(
  {
    target,
    offsetVar = "--topbar-h",
    listWidth = 240,
    levels,
    stickyTop,
    focusHeading,
    alignToFirstHeading = false,
    onCurrentChange,
    editor,
    jumpRef,
    className,
    style,
    ...rest
  },
  ref
) {
  // Настройки хозяина читаются в обработчиках прокрутки: последние значения —
  // через ссылку, чтобы новая функция на каждом рендере не пересоздавала слушателей.
  const latest = useRef({ stickyTop, focusHeading, offsetVar, levels, onCurrentChange, editor });
  useEffect(() => {
    latest.current = { stickyTop, focusHeading, offsetVar, levels, onCurrentChange, editor };
  });
  // Набор уровней сравнивается по значению: массив-литерал новый на каждом рендере.
  const levelsKey = levels ? levels.join(",") : "";
  const offsetNow = useCallback(() => {
    const own = latest.current;
    return own.stickyTop ? own.stickyTop() : stickyOffset(own.offsetVar);
  }, []);
  const messages = useMessages();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [gap, setGap] = useState(STRIP_GAP);
  const [current, setCurrent] = useState(0);
  // Текущий раздел — в Состояние Инструмента (`useRichTextToolState`).
  useEffect(() => {
    latest.current.onCurrentChange?.(current);
  }, [current]);
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(true);
  const stripRef = useRef<HTMLButtonElement>(null);
  /** Список открыт с клавиатуры: фокус уходит в него, на текущий пункт. */
  const focusOnOpen = useRef(false);
  const navRef = useRef<HTMLElement | null>(null);
  /** Enter или Space уже открыли список: следующий за ними клик — их же эхо. */
  const keyHandled = useRef(false);

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
      const next = collectHeadings(element, latest.current.levels);
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
  }, [element, levelsKey]);

  // Шаг полосы зависит от высоты окна и числа заголовков.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setGap(stripGap(headings.length, offsetNow()));
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
  }, [headings.length, offsetVar, offsetNow]);

  /*
    Раздел, выбранный переходом, держится подсвеченным, пока идёт прокрутка от
    самого перехода. Иначе у конца Документа правило «докручено до конца —
    текущий последний видимый» отдавало подсветку соседнему заголовку, и
    читатель, выбравший «Поверхности», видел подсвеченным «Что дальше».
    Пересчёт возвращается со следующей прокрутки после того, как переход
    улёгся (`settled`).
  */
  const pinned = useRef<{ heading: HTMLElement; settled: boolean; timer: number } | null>(null);
  /** (Пере)запустить ожидание: прокрутка перехода молчит `PIN_SETTLE` — переход улёгся. */
  const settle = (lock: { settled: boolean; timer: number }) => {
    window.clearTimeout(lock.timer);
    lock.timer = window.setTimeout(() => {
      lock.settled = true;
    }, PIN_SETTLE);
  };
  /*
    Раздел перехода помнится узлом, а не индексом: список может пересобраться,
    пока идёт прокрутка (правка моложе `REBUILD_DELAY`), и индекс повёл бы к
    соседнему заголовку.
  */
  const pin = (index: number, heading: HTMLElement) => {
    if (pinned.current) window.clearTimeout(pinned.current.timer);
    pinned.current = { heading, settled: false, timer: 0 };
    settle(pinned.current);
    setCurrent(index);
  };
  /*
    Переход к пункту списка: клик и команда `jumpTo` Инструмента идут одним
    путём. Заголовок, уже вышедший из Документа (правка моложе `REBUILD_DELAY`),
    не пункт: список вот-вот пересоберётся.
  */
  const go = (index: number): boolean => {
    const heading = headings[index];
    if (!heading?.element.isConnected) return false;
    pin(index, heading.element);
    jumpTo(heading.element, offsetNow(), latest.current.focusHeading);
    return true;
  };
  /*
    Команда `jumpTo(index)`: индекс — из снимка Состояния, а снимок читает
    Документ движка (`tocDocumentHeadings`, тот же обход), поэтому заголовок
    берётся оттуда: `view.nodeDOM` отдаёт его узел, ProseMirror обновляет DOM
    синхронно с транзакцией. Список ядра при этом может отставать до
    `REBUILD_DELAY`, поэтому читается заново, а не из состояния: от него нужен
    только индекс пункта для подсветки.
  */
  const goToSnapshotIndex = (index: number): boolean => {
    const { editor: engine, levels: shown } = latest.current;
    if (!engine) return go(index);
    if (engine.isDestroyed) return false;
    const found = tocDocumentHeadings(engine, { levels: shown ?? ALL_LEVELS })[index];
    const node = found && engine.view.nodeDOM(found.pos);
    if (!(node instanceof HTMLElement) || !node.isConnected || !element) return false;
    const fresh = collectHeadings(element, shown);
    setHeadings((prev) => (sameHeadings(prev, fresh) ? prev : fresh));
    const listed = fresh.findIndex((heading) => heading.element === node);
    if (listed >= 0) pin(listed, node);
    jumpTo(node, offsetNow(), latest.current.focusHeading);
    return true;
  };
  const goRef = useRef(goToSnapshotIndex);
  useEffect(() => {
    goRef.current = goToSnapshotIndex;
  });
  useEffect(() => {
    if (!jumpRef) return;
    jumpRef.current = (index) => goRef.current(index);
    return () => {
      jumpRef.current = null;
    };
  }, [jumpRef]);

  // Подсветка текущего раздела. Слушатель прокрутки — на документе с захватом:
  // так его достигает прокрутка и окна, и любого контейнера вокруг цели.
  useEffect(() => {
    if (headings.length < 2) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Список пересобрался, пока идёт прокрутка перехода: раздел перехода тот
      // же заголовок, но под новым индексом. Замер посреди прокрутки назвал бы
      // соседний, и он остался бы текущим, когда прокрутка уляжется.
      const lock = pinned.current;
      const held =
        lock && !lock.settled ? headings.findIndex((h) => h.element === lock.heading) : -1;
      setCurrent(held >= 0 ? held : currentIndex(headings, offsetNow()));
    };
    const schedule = (event?: Event) => {
      // Считается только прокрутка, которая двигает Документ: окна или
      // контейнера вокруг него. Прокрутка самого списка или чужой карусели на
      // странице подсветку не трогает — и не снимает раздел перехода.
      const scrolled = event?.target;
      if (scrolled instanceof Element && !scrolled.contains(headings[0]!.element)) {
        return;
      }
      const lock = pinned.current;
      if (lock && !lock.settled) {
        // Прокрутка самого перехода: ждём, пока она уляжется.
        settle(lock);
        return;
      }
      pinned.current = null;
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
  }, [headings, offsetVar, offsetNow]);

  // Уборка таймера выбранного раздела при размонтировании.
  useEffect(() => () => window.clearTimeout(pinned.current?.timer), []);

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

  // Выравнивание по первому заголовку: отступ сверху меряется от верха колонки,
  // в которой стоит Оглавление, до середины первой строки заголовка, и
  // пересчитывается при смене Документа и ширины поля (перенос строк).
  const [lead, setLead] = useState(0);
  useEffect(() => {
    const first = headings[0]?.element;
    const root = stripRef.current?.parentElement;
    const column = root?.parentElement;
    if (!alignToFirstHeading || !first || !column || !element) return;
    const measure = () => {
      const box = first.getBoundingClientRect();
      const line = parseFloat(getComputedStyle(first).lineHeight) || box.height;
      const center = box.top + Math.min(line, box.height) / 2;
      const next = center - column.getBoundingClientRect().top - STRIP_PADDING / 2 - STRIP_CELL / 2;
      setLead(Math.max(0, Math.round(next)));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [alignToFirstHeading, headings, element]);

  const listRef = useCallback(
    (node: HTMLElement | null) => {
      navRef.current = node;
      if (!node) return;
      const items = node.querySelectorAll<HTMLButtonElement>("button");
      // Длинный список прокручивается: текущий пункт держится в видимой части
      // списка, когда он открылся и когда раздел сменился при открытом списке.
      // Прокручивается только сам список: `scrollIntoView` двигал бы и страницу.
      keepVisible(items[current], node.parentElement);
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
    keyHandled.current = true;
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
      style={alignToFirstHeading ? { ...style, marginTop: lead } : style}
      {...rest}
    >
      <HoverCard open={open} onOpenChange={setOpen} openDelay={OPEN_DELAY} closeDelay={CLOSE_DELAY}>
        <HoverCardTrigger asChild>
          <button
            ref={stripRef}
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={() => {
              // Enter и Space уже разобраны в `onKeyDown`; их клик пропускается.
              if (keyHandled.current) {
                keyHandled.current = false;
                return;
              }
              /*
                Мышь, касание — и скринридер: NVDA, JAWS и VoiceOver нажимают
                кнопку синтетическим кликом без клавиши (`detail === 0`). Для
                него фокус уходит в список, как с клавиатуры: иначе открытый
                список остался бы ему недоступен.
              */
              if (!open) focusOnOpen.current = true;
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
              <span key={index} className="flex h-0.5 w-4 items-center">
                <span
                  data-toc-stroke=""
                  data-depth={heading.depth}
                  data-current={index === current || undefined}
                  className={cn(
                    "rounded-full transition-[width,height,background-color]",
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
          className="max-h-[min(70dvh,32rem)] overflow-y-auto overscroll-contain p-1"
          style={{ width: listWidth }}
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
                    onClick={(event) => {
                      go(index);
                      /*
                        В Редакторе в правке фокус на заголовок не переходит и
                        остаётся на пункте, а фокус в списке держит его открытым:
                        уход курсора его бы не закрыл. После клика мышью пункт
                        фокус отпускает; с клавиатуры (`detail === 0`) фокус
                        остаётся в списке — по нему ещё ходят стрелками.
                      */
                      const item = event.currentTarget;
                      if (event.detail > 0 && document.activeElement === item) item.blur();
                    }}
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
                    <span
                      className={cn("min-w-0 truncate", itemIndent(heading.depth))}
                      title={heading.text}
                    >
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

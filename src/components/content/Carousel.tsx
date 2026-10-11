"use client";

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import type { AccessibleName } from "../../lib/accessible-name.js";
import { clamp } from "../../lib/clamp.js";
import { cn } from "../../lib/cn.js";
import {
  responsiveClasses,
  type Responsive,
  type ResponsiveClassMap,
} from "../../lib/responsive.js";
import { Button } from "../actions/Button.js";

/** Сколько слайдов видно разом. Закрытый набор: класс на каждое значение написан в словаре. */
export type CarouselSlidesPerView = 1 | 2 | 3 | 4;

interface CarouselBaseProps extends Omit<
  ComponentPropsWithoutRef<"section">,
  "children" | "aria-label" | "aria-labelledby" | "aria-roledescription"
> {
  /**
   * Слайды: каждый прямой потомок — один слайд. Фрагмент считается одним
   * потомком, поэтому слайды в нём не разойдутся; `null`, `false` и пустые
   * строки слайдом не становятся.
   */
  children?: ReactNode;
  /**
   * Сколько слайдов видно разом: число или объект по брейкпойнтам кита —
   * `{ base: 1, md: 2, xl: 4 }`. По умолчанию 1.
   *
   * Зазора между слайдами нет намеренно: ширина слайда — доля строки, и зазор
   * сделал бы её зависимой от числа слайдов в видимой части. Отступ между
   * карточками — внутренний отступ содержимого слайда.
   */
  slidesPerView?: Responsive<CarouselSlidesPerView>;
  /**
   * Текущий слайд — управляемый режим. Это левый видимый слайд, считая с нуля:
   * при `slidesPerView={3}` и пяти слайдах достижимы индексы 0–2, потому что
   * карусель не прокручивается дальше своего конца.
   */
  index?: number;
  /** Слайд при первом показе — неуправляемый режим. */
  defaultIndex?: number;
  /**
   * Сообщает индекс слайда, на котором пользователь остановил карусель.
   *
   * Вызывается, когда прокрутка остановилась на другом слайде, — по кнопке, по
   * жесту или по клавише. Не вызывается на каждый кадр прокрутки и не
   * вызывается, когда карусель доехала до слайда, который назначили ей сами через
   * `index` или `defaultIndex`. В управляемом режиме родитель, не принявший
   * новый индекс, получит карусель обратно на прежнем.
   */
  onIndexChange?: (index: number) => void;
}

/**
 * Имя региона обязательно, и это сказано типом: без него скринридер объявит
 * просто «регион» (а при `aria-roledescription` — безымянную «карусель»), и
 * пользователь не узнает, какая из двух каруселей на экране перед ним.
 *
 * Видимой подписи у карусели нет, поэтому имя — ровно одно из `aria-label` и
 * `aria-labelledby` (`AccessibleName`); `label` в ките значит только видимую
 * подпись. `aria-labelledby` — когда над лентой уже стоит заголовок.
 */
export type CarouselProps = CarouselBaseProps & AccessibleName;

/*
  Ширина слайда — доля строки, целиком и литералом, включая префикс брейкпойнта:
  Tailwind сканирует исходник как текст, и `md:basis-1/${n}` в CSS не попал бы.
  Матрица `tests/matrix.tsx` перебирает все клетки, и тест покрытия классов
  уронит прогон, если хоть одна не дошла до собранного CSS.
*/
const BASIS_CLASS: ResponsiveClassMap<CarouselSlidesPerView> = {
  base: { 1: "basis-full", 2: "basis-1/2", 3: "basis-1/3", 4: "basis-1/4" },
  sm: { 1: "sm:basis-full", 2: "sm:basis-1/2", 3: "sm:basis-1/3", 4: "sm:basis-1/4" },
  md: { 1: "md:basis-full", 2: "md:basis-1/2", 3: "md:basis-1/3", 4: "md:basis-1/4" },
  lg: { 1: "lg:basis-full", 2: "lg:basis-1/2", 3: "lg:basis-1/3", 4: "lg:basis-1/4" },
  xl: { 1: "xl:basis-full", 2: "xl:basis-1/2", 3: "xl:basis-1/3", 4: "xl:basis-1/4" },
};

/**
 * Пауза после последнего события прокрутки, по истечении которой лента считается
 * остановившейся. Короче кадра анимации быть не может, длиннее — заметна
 * задержка отклика; 100 мс — запас над промежутком между событиями при
 * плавной прокрутке и инерции тачпада.
 */
const SETTLE_MS = 100;

/** Допуск в пикселях: положение прокрутки дробное, а `scrollWidth` целый. */
const EDGE_EPSILON = 1;

/**
 * Что знает о ленте её раскладка.
 *
 * Все слайды ОДНОЙ ширины и без зазора, поэтому шаг — это `scrollWidth /
 * count`, а не измерение каждого слайда. Так положение читается из трёх
 * чисел (`scrollLeft`, `scrollWidth`, `clientWidth`), и jsdom, который
 * раскладки не считает, подменяет ровно их.
 */
function measure(viewport: HTMLElement, count: number) {
  const stride = count > 0 ? viewport.scrollWidth / count : 0;
  // `scrollLeft` в RTL отрицателен — модуль отдаёт расстояние от начала ленты.
  const offset = Math.abs(viewport.scrollLeft);
  const perView = stride > 0 ? Math.max(1, Math.round(viewport.clientWidth / stride)) : 1;
  const max = Math.max(0, count - perView);
  return {
    stride,
    max,
    index: stride > 0 ? clamp(Math.round(offset / stride), 0, max) : 0,
    atStart: offset <= EDGE_EPSILON,
    atEnd: offset + viewport.clientWidth >= viewport.scrollWidth - EDGE_EPSILON,
  };
}

/**
 * Плавно — если пользователь не просил обратного.
 *
 * Предпочтение читается В МОМЕНТ прокрутки, а не подпиской: оно нужно только
 * здесь, и подписка принесла бы состояние, которое не рисуется. ADR-0043 гасит
 * движение CSS-вариантом `motion-reduce:`, но прокрутку, начатую из JS, класс не
 * остановит — `behavior` задаётся вызовом. `"auto"` без `scroll-behavior` в CSS
 * — мгновенный переход. Метода `matchMedia` нет в jsdom и на сервере.
 */
function scrollBehavior(): ScrollBehavior {
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? "auto" : "smooth";
}

/**
 * Карусель: лента слайдов на нативной прокрутке с привязкой.
 *
 * ЛИСТАЕТ БРАУЗЕР, А НЕ МЫ. Лента — обычный контейнер с `overflow-x` и CSS
 * scroll-snap: колесо, тачпад, свайп и стрелки клавиатуры работают сами, с
 * инерцией и с остановкой ровно на слайде. Компонент их не перехватывает —
 * только читает результат и добавляет кнопки. Поэтому нет ни автопрокрутки, ни
 * бесконечной ленты, ни точек-индикаторов (вне объёма), и кнопка паузы не нужна.
 *
 * ТЕКУЩИЙ СЛАЙД ЧИТАЕТСЯ ИЗ ПОЛОЖЕНИЯ ПРОКРУТКИ (событие `scroll` и геометрия),
 * а не из `IntersectionObserver`. Наблюдатель отвечает на вопрос «какая часть
 * слайда видна», а нам нужен «какой слайд у начального края» — для двух и более
 * слайдов в кадре он потребовал бы порогов и выбора из нескольких. Положение
 * даёт ответ одним делением. Плюс наблюдателя нет в jsdom, а положение там
 * подменяется тремя числами.
 *
 * О ТЕКУЩЕМ СЛАЙДЕ СООБЩАЕТСЯ ПОСЛЕ ОСТАНОВКИ, а не на каждый кадр. Иначе при
 * управляемом режиме смена `index` запускала бы плавную прокрутку, та по пути
 * вызывала бы `onIndexChange` с промежуточными слайдами, родитель выставлял бы
 * их обратно — и прокрутка бодалась бы сама с собой.
 *
 * ДОСТУПНОСТЬ — паттерн APG Carousel: регион с `aria-roledescription` и именем,
 * слайды — группы с `aria-roledescription="slide"` и именем «N из M». Слайды,
 * не попавшие в кадр, от скринридера НЕ скрываются: без автопрокрутки лента
 * читается целиком, и фокус из невидимого слайда браузер сам докрутит до виду.
 */
export const Carousel = forwardRef<HTMLElement, CarouselProps>(function Carousel(
  { children, slidesPerView = 1, index, defaultIndex = 0, onIndexChange, className, ...rest },
  ref
) {
  const messages = useMessages().carousel;
  // `Children.toArray` отбрасывает `null` и `false`, но оставляет пустую строку:
  // `{title && <Slide />}` при пустом `title` иначе давал бы пустой слайд и
  // сбивал шаг (`scrollWidth / count`), а с ним и каждый индекс.
  const slides = Children.toArray(children).filter((slide) => slide !== "");
  const count = slides.length;
  // Строка классов ширины — и разметка, и ключ зависимости: объект по
  // брейкпойнтам новый на каждый рендер, а строка меняется только по делу.
  const basis = responsiveClasses(slidesPerView, BASIS_CLASS);

  const viewportRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Края до первого замера: на нуле «назад» выключена. «Вперёд» включена, пока
  // не доказано обратное, — первый замер идёт до отрисовки (`useLayoutEffect`).
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  /** Слайд, о котором наружу уже сообщено (или который задан снаружи). */
  const known = useRef(index ?? defaultIndex);
  /** Слайд, к которому лента едет по нашей команде, пока не остановилась. */
  const pending = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /**
   * Слайд, который не удалось поставить: у ленты ещё нет раскладки. Карусель,
   * смонтированная в скрытом контейнере (неактивная вкладка, `display: none`),
   * меряет `scrollWidth` нулём — и начальный слайд терялся бы молча. Его ставит
   * первый замер с ненулевой шириной (`ResizeObserver`).
   */
  const deferred = useRef<number | null>(null);

  // Обработчик читается через ссылку: таймер остановки живёт дольше рендера, и
  // замкнутая в нём копия вызвала бы устаревший колбэк.
  const onIndexChangeRef = useRef(onIndexChange);
  const controlledRef = useRef(index !== undefined);
  useLayoutEffect(() => {
    onIndexChangeRef.current = onIndexChange;
    controlledRef.current = index !== undefined;
  });
  // Счётчик остановок: перерисовка после колбэка, чтобы управляемый `index`
  // был применён заново, даже если родитель оставил его прежним.
  const [stops, setStops] = useState(0);

  const updateEdges = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    setAtStart(m.atStart);
    setAtEnd(m.atEnd);
  }, [count]);

  const armSettle = useCallback(() => {
    clearTimeout(settleTimer.current);
    const armedAt = Math.abs(viewportRef.current?.scrollLeft ?? 0);
    settleTimer.current = setTimeout(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      // Остановка — это «положение перестало меняться», а не «событий не было
      // 100 мс»: при долгом простое потока событие опаздывает, а плавная
      // прокрутка тем временем едет. Сдвинулось — ждём ещё.
      if (Math.abs(viewport.scrollLeft) !== armedAt) {
        armSettle();
        return;
      }
      pending.current = null;
      const { index: reached, stride } = measure(viewport, count);
      // Спрятанная лента (ширина ноль) стоит «на нуле» не по воле пользователя.
      if (stride === 0 || reached === known.current) return;
      known.current = reached;
      onIndexChangeRef.current?.(reached);
      if (controlledRef.current) setStops((n) => n + 1);
    }, SETTLE_MS);
  }, [count]);

  const scrollToIndex = useCallback(
    (target: number, behavior: ScrollBehavior) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const m = measure(viewport, count);
      const to = clamp(target, 0, m.max);
      // В RTL лента растёт влево, и `scrollTo` принимает отрицательное смещение.
      const sign = getComputedStyle(viewport).direction === "rtl" ? -1 : 1;
      pending.current = to;
      viewport.scrollTo({ left: sign * to * m.stride, behavior });
      // Событий прокрутки может не быть вовсе (уже на месте): таймер всё равно
      // снимет `pending`, иначе следующая кнопка считала бы от несуществующей цели.
      armSettle();
    },
    [count, armSettle]
  );

  /** «Назад» и «вперёд»: от цели текущей прокрутки, если она идёт, — быстрые нажатия копятся. */
  const step = (delta: 1 | -1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const base = pending.current ?? measure(viewport, count).index;
    scrollToIndex(base + delta, scrollBehavior());
  };

  // Первое положение и смена `index` снаружи. На монтировании — мгновенно:
  // анимация от нуля к начальному слайду выглядела бы как ошибка.
  const mounted = useRef(false);
  useLayoutEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    const target = index ?? (first ? defaultIndex : undefined);
    if (target === undefined) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    // Раскладки нет — ставить не на что: цель ждёт первого замера с шириной.
    // Запоминается как известная, чтобы и до того не сойти за смену слайда.
    if (m.stride === 0 && count > 0) {
      deferred.current = target;
      known.current = target;
      return;
    }
    deferred.current = null;
    // Недостижимый индекс заменяется ближайшим достижимым ДО запоминания:
    // иначе остановка на нём выглядела бы сменой слайда и порождала колбэк о
    // прокрутке, которую начали мы сами.
    const reachable = clamp(target, 0, m.max);
    known.current = reachable;
    // Уже там: прокручивать нечего.
    if (m.index === reachable) return;
    scrollToIndex(reachable, first ? "instant" : scrollBehavior());
    // `count` и `defaultIndex` в зависимостях нет намеренно: слайд меняет
    // только `index`, а смена числа слайдов не должна дёргать ленту. `stops` —
    // есть: управляемый режим возвращает ленту на `index`, если родитель
    // отклонил смену, — иначе лента показывала бы слайд, которого нет в
    // состоянии родителя, и вернуть её было бы нечем.
  }, [index, stops]);

  /** Размер ленты сменился: края заново; получив ширину — слайд, который ждёт. */
  const onResize = useCallback(() => {
    updateEdges();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const m = measure(viewport, count);
    if (m.stride === 0) {
      // Ленту спрятали (`display: none` сбрасывает прокрутку в ноль): при
      // следующем показе она вернётся на известный слайд, а не на первый.
      if (count > 0 && deferred.current === null) deferred.current = known.current;
      return;
    }
    const target = deferred.current;
    if (target === null) return;
    deferred.current = null;
    const reachable = clamp(target, 0, m.max);
    known.current = reachable;
    // Мгновенно, как на монтировании: для пользователя это первый показ ленты.
    if (m.index !== reachable) scrollToIndex(reachable, "instant");
  }, [updateEdges, count, scrollToIndex]);

  // Края: после отрисовки слайдов, при смене `slidesPerView` и при изменении
  // размера ленты. Смена `slidesPerView` пропом ширину ленты не меняет —
  // меняется ширина слайдов, и наблюдатель её не видит; поэтому `basis` в
  // зависимостях. Брейкпойнт меняет и ширину ленты — это ловит наблюдатель.
  useLayoutEffect(() => {
    updateEdges();
    const viewport = viewportRef.current;
    // Наблюдателя нет в jsdom и на сервере; без него края обновляет прокрутка.
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(onResize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateEdges, onResize, basis]);

  // Таймер остановки не должен пережить компонент.
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  /*
    Нажатая кнопка, ставшая выключенной на краю, роняла бы фокус на `body`:
    пользователь клавиатуры дошёл до конца и оказался в начале страницы. Фокус
    переходит к противоположной кнопке, а если и та выключена — на ленту.
    `useLayoutEffect`: до того, как браузер сам разберётся с выключенным элементом.
  */
  useLayoutEffect(() => {
    const active = document.activeElement;
    if (atEnd && active === nextRef.current) {
      (atStart ? viewportRef.current : previousRef.current)?.focus();
    } else if (atStart && active === previousRef.current) {
      (atEnd ? viewportRef.current : nextRef.current)?.focus();
    }
  }, [atStart, atEnd]);

  return (
    <section
      ref={ref}
      aria-roledescription={messages.roleDescription}
      className={cn("flex items-center gap-2", className)}
      {...rest}
    >
      <Button
        ref={previousRef}
        size="sm"
        iconOnly
        icon={<ChevronLeftIcon size={16} className="rtl:rotate-180" />}
        aria-label={messages.previous}
        disabled={atStart}
        onClick={() => step(-1)}
      />

      <div
        ref={viewportRef}
        /*
          `tabIndex={0}`: прокручиваемый блок обязан быть достижим с клавиатуры
          (axe `scrollable-region-focusable`), и стрелки на нём листают родной
          прокруткой, с привязкой. Кнопки этого не заменяют: на слайдах без
          фокусируемого содержимого лента иначе осталась бы без остановки в обходе.
        */
        tabIndex={0}
        onScroll={() => {
          updateEdges();
          armSettle();
        }}
        className={cn(
          "flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto",
          // Не отдавать горизонтальный перелёт браузеру: свайп у края ленты
          // иначе уходил бы в «назад по истории».
          "overscroll-x-contain",
          // Полосы нет: листают кнопки, жесты и клавиши, а полоса в ленте
          // карточек — шум. Firefox и WebKit прячут её разными способами.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
        )}
      >
        {slides.map((slide, i) => (
          <div
            // Ключ даёт `Children.toArray`: он стабилен для данного потомка.
            key={isValidElement(slide) ? slide.key : i}
            role="group"
            aria-roledescription={messages.slideRoleDescription}
            aria-label={messages.slide({ index: i + 1, total: count })}
            className={cn("shrink-0 grow-0 snap-start", basis)}
          >
            {slide}
          </div>
        ))}
      </div>

      <Button
        ref={nextRef}
        size="sm"
        iconOnly
        icon={<ChevronRightIcon size={16} className="rtl:rotate-180" />}
        aria-label={messages.next}
        disabled={atEnd}
        onClick={() => step(1)}
      />
    </section>
  );
});

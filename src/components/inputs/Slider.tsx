"use client";

import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderStateContext,
  SliderThumb,
  SliderTrack,
  type DOMRenderFunction,
  type SliderProps as AriaSliderProps,
  type SliderRenderProps,
} from "react-aria-components";
import { useContext, useEffect, useRef, type RefObject } from "react";
import { useFieldDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

/**
 * `orientation` есть только у `Slider`. Раньше его не было нигде:
 * дорожка и заливка были заданы одной горизонтальной геометрией, и
 * вертикальный ползунок просто отрисовался бы горизонтальным. У одиночного
 * ползунка теперь своя вертикальная геометрия; у `RangeSlider` её нет, и проп
 * из его типа по-прежнему убран — проп, который компилируется и ничего не
 * делает, хуже отсутствующего.
 */
interface SliderLookProps {
  /** Подпись в шапке ползунка, слева от значения. */
  label?: string;
  /**
   * Где показывать значение.
   *
   * `side` — в строке подписи справа: значение видно всегда и не прыгает.
   * `none` — не показывать: когда рядом стоит поле с тем же числом, две копии
   * одного значения расходятся в глазах читающего.
   *
   * Подписи НАД ползунком нет намеренно: она ездит вместе с ним, и на краях
   * шкалы вылезает за габарит контрола.
   */
  valuePosition?: "side" | "none";
  /** Формат значения. По умолчанию — как есть. */
  formatValue?: (value: number) => string;
  /** Классы на корневой элемент. */
  className?: string;
}

export type SliderProps = SliderLookProps &
  Omit<AriaSliderProps<number>, "children" | "className" | "style">;

export type RangeSliderProps = SliderLookProps &
  Omit<AriaSliderProps<number[]>, "children" | "className" | "style" | "orientation"> & {
    /**
     * Наименьшее расстояние между концами в единицах значения.
     *
     * react-aria не даёт концам перепрыгнуть друг друга, но упереться вплотную
     * позволяет, а нулевой диапазон почти всегда бессмыслен: «от 500 до 500»
     * это не фильтр, а точное совпадение, которого в данных нет.
     */
    minGap?: number;
  };

/*
  Выключенный ползунок приглушается ЦЕЛИКОМ, на корне: подпись, значение,
  дорожка и бегунок — одной прозрачностью, как прочие поля кита и как
  `State=disabled` в Figma. `disabled:` здесь срабатывает на `data-disabled`,
  который react-aria ставит на корень. Раньше вида не было вовсе —
  отличался только курсор над бегунком.
*/
const DIMMED_WHEN_DISABLED = "disabled:opacity-50";
const ROOT_CLASS = `flex w-full flex-col gap-2 ${DIMMED_WHEN_DISABLED}`;
const TRACK_CLASS = "bg-bg-3 relative h-1.5 w-full rounded-full";
const FILL_CLASS = "bg-accent absolute h-full rounded-full";
const THUMB_BASE_CLASS =
  "border-accent bg-bg-1 size-4 cursor-grab rounded-full border-2 shadow-[var(--shadow-1)] transition-shadow " +
  "dragging:cursor-grabbing focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed";
// Вдоль оси бегунок ставит react-aria (`left` или `top`), поперёк — мы.
const THUMB_CLASS = `${THUMB_BASE_CLASS} top-1/2`;

/*
  Геометрия одиночного ползунка по ориентации — одна карта вместо ветвления
  в каждом узле. `RangeSlider` берёт горизонтальные классы напрямую: вертикали
  у него нет.

  Вертикаль. Высоту задаёт корень: вертикальной дорожке, в отличие от
  горизонтальной, не во что тянуться, и без явной высоты она схлопывается в
  точку. Умолчание `h-48`, потребитель меняет его через `className`. Ширина —
  по шапке, а не `w-full`: столбик на всю ширину формы выглядит ошибкой
  вёрстки. Заливка растёт от нижнего края: «больше» на вертикальной шкале —
  выше.
*/
const GEOMETRY = {
  horizontal: {
    root: ROOT_CLASS,
    track: TRACK_CLASS,
    fill: FILL_CLASS,
    fillSize: "width",
    thumb: THUMB_CLASS,
  },
  vertical: {
    root: `flex h-48 w-max flex-col gap-2 ${DIMMED_WHEN_DISABLED}`,
    track: "bg-bg-3 relative w-1.5 flex-1 self-center rounded-full",
    fill: "bg-accent absolute bottom-0 w-full rounded-full",
    fillSize: "height",
    thumb: `${THUMB_BASE_CLASS} left-1/2`,
  },
} as const;

/**
 * Корень, объявляющий группу выключенной (`aria-disabled`).
 *
 * Приглушённые подпись и значение — текст неактивного элемента, к контрасту
 * по WCAG 1.4.3 не обязанный; но узнать об этом и скринридер, и axe могут
 * только по `aria-disabled` у группы. react-aria его не ставит, а переданный
 * пропом — отфильтровывает, поэтому атрибут кладётся через `render`.
 * `render` потребителя не теряется: он получает уже дополненные пропсы.
 */
function withDisabledGroup(
  render?: DOMRenderFunction<"div", SliderRenderProps>
): DOMRenderFunction<"div", SliderRenderProps> {
  return (props, renderProps) => {
    const merged = { ...props, "aria-disabled": renderProps.isDisabled || undefined };
    return render ? render(merged, renderProps) : <div {...merged} />;
  };
}

function Header({
  label,
  valuePosition,
  formatValue,
}: {
  label?: string;
  valuePosition: "side" | "none";
  formatValue?: (value: number) => string;
}) {
  if (!label && valuePosition === "none") return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      {label ? <Label className="text-fg-1 text-sm">{label}</Label> : <span />}
      {valuePosition === "side" ? (
        <SliderOutput className="text-fg-2 text-caption font-mono">
          {/*
            Своё форматирование идёт через рендер-проп, а не подменяет вывод
            снаружи: `SliderOutput` — это и есть `<output>`, связанный с
            ползунком, и текст обязан лежать внутри него, иначе связь теряется
            и скринридер читает пустой вывод.
          */}
          {formatValue
            ? ({ state }) => state.values.map((v) => formatValue(v)).join(" — ")
            : undefined}
        </SliderOutput>
      ) : null}
    </div>
  );
}

/*
  Колесо двигает значение на шаг. react-aria колеса не знает, поэтому слушатель
  вешается на корень и ходит в состояние ползунка через контекст: так `onChange`,
  `onChangeEnd` и зажим концов у `RangeSlider` отрабатывают как от клавиатуры.

  Слушатель нативный и не пассивный: React вешает `wheel` пассивным, и
  `preventDefault` в нём молча не работает — страница ехала бы вместе со значением.
*/
const WHEEL_NOTCH = 40;
// Пауза, после которой недокрученный остаток жеста считается чужим.
const WHEEL_IDLE_MS = 200;

function WheelStep({
  rootRef,
  trackRef,
  vertical,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  vertical: boolean;
}) {
  const state = useContext(SliderStateContext);
  // Свежее состояние читается из ref: слушатель вешается один раз.
  const stateRef = useRef(state);
  stateRef.current = state;
  const accumulated = useRef(0);
  const lastWheelAt = useRef(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      const current = stateRef.current;
      // Ctrl + колесо — это зум страницы (и щипок тачпада тоже): не отнимаем его.
      if (!current || current.isDisabled || event.ctrlKey) return;
      // Ось ползунка главная; на горизонтальном берём и боковую прокрутку тачпада.
      const raw = vertical
        ? -event.deltaY
        : Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : -event.deltaY;
      if (raw === 0) return;
      const direction = raw > 0 ? 1 : -1;

      const count = current.values.length;
      let index = 0;
      if (count > 1) {
        const rect = trackRef.current?.getBoundingClientRect();
        const along = vertical ? rect?.height : rect?.width;
        if (rect && along) {
          const fraction = vertical
            ? 1 - (event.clientY - rect.top) / along
            : (event.clientX - rect.left) / along;
          const at =
            current.getThumbMinValue(0) +
            fraction * (current.getThumbMaxValue(0) - current.getThumbMinValue(0));
          // При равном расстоянии (концы сошлись) берём тот, что может уйти
          // в сторону прокрутки: вверх — верхний, вниз — нижний.
          index = current.values.reduce((best, value, i) => {
            const distance = Math.abs(value - at);
            const bestDistance = Math.abs(current.values[best]! - at);
            return distance < bestDistance || (distance === bestDistance && direction > 0)
              ? i
              : best;
          }, 0);
        }
      }

      const value = current.values[index]!;
      const atEdge =
        direction > 0
          ? value >= current.getThumbMaxValue(index)
          : value <= current.getThumbMinValue(index);
      // На краю шкалы колесо не держим: иначе курсор «залипает» и страница не листается.
      if (atEdge) return;
      event.preventDefault();

      // Один щелчок мыши — один шаг; тачпад сыплет мелкие дельты, их копим.
      // Остаток старого жеста не переносим: после паузы или при смене
      // направления копим заново, иначе первый щелчок «съедается».
      const now = Date.now();
      if (
        now - lastWheelAt.current > WHEEL_IDLE_MS ||
        Math.sign(accumulated.current) === -direction
      ) {
        accumulated.current = 0;
      }
      lastWheelAt.current = now;
      accumulated.current += raw * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(accumulated.current) < WHEEL_NOTCH) return;
      accumulated.current = 0;

      current.setThumbDragging(index, true);
      current.setThumbValue(index, value + direction * current.step);
      current.setThumbDragging(index, false);
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [rootRef, trackRef, vertical]);

  return null;
}

/**
 * Ползунок одного значения.
 *
 * Поведение целиком у react-aria: перетаскивание указателем и касанием,
 * клавиатура (стрелки на шаг, Shift — крупным шагом, Home/End на края),
 * `aria-valuetext` и объявление подписи. Кит держит вид и два решения выше —
 * где стоит значение и что делать с нулевым диапазоном у пары.
 */
export function Slider({
  label,
  valuePosition = "side",
  formatValue,
  className,
  ...rest
}: SliderProps) {
  // Подсказка и ошибка `FormField` не доходили до ползунка вовсе: он не читал
  // контекст описания, хотя в форме стоит рядом с полями, которые читают.
  /*
    Здесь берётся ТОЛЬКО описание формы, без склейки с пользовательским.

    Склеивать не надо: `aria-describedby` потребителя уезжает в `{...rest}` на
    группу, а react-aria сама сносит его на бегунок и объединяет со своим.
    Добавив к этому ещё и слитое значение, мы получали `own own _r_0_` — тот же
    идентификатор дважды, и подсказка читалась два раза подряд.
  */
  const describedBy = useFieldDescribedBy();
  // Ориентацию читаем, а не деструктурируем: проп обязан доехать до
  // react-aria в `{...rest}` — от него зависят стрелки и `aria-orientation`.
  const geometry = GEOMETRY[rest.orientation ?? "horizontal"];
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  return (
    <AriaSlider
      {...rest}
      ref={rootRef}
      render={withDisabledGroup(rest.render)}
      className={cn(geometry.root, className)}
    >
      <WheelStep rootRef={rootRef} trackRef={trackRef} vertical={rest.orientation === "vertical"} />
      <Header label={label} valuePosition={valuePosition} formatValue={formatValue} />
      <SliderTrack ref={trackRef} className={geometry.track}>
        {({ state }) => (
          <>
            <div
              data-fill
              className={geometry.fill}
              style={{ [geometry.fillSize]: `${state.getThumbPercent(0) * 100}%` }}
            />
            {/*
              Описание висит на БЕГУНКЕ, а не на группе: фокусируется он, и
              `role="slider"` тоже на нём. Группе react-aria атрибут не ставит
              вовсе — проверено, он туда не доходит.
            */}
            <SliderThumb
              className={geometry.thumb}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}

/**
 * Ползунок диапазона: два конца на одной дорожке.
 *
 * Отдельный компонент, а не проп `range` у `Slider`: у пары другой тип значения
 * (`number[]` против `number`), и уния по булеву пропу превратила бы `onChange`
 * в «что-то одно из двух» для каждого вызывающего. Та же логика, по которой у
 * `Select` оси `multiple` разведены типами.
 */
export function RangeSlider({
  label,
  valuePosition = "side",
  minGap = 0,
  formatValue,
  className,
  onChange,
  ...rest
}: RangeSliderProps) {
  const min = rest.minValue ?? 0;
  const max = rest.maxValue ?? 100;
  // Как и выше: склейку делает react-aria, наше дело — описание формы.
  const describedBy = useFieldDescribedBy();
  /*
    ПРЕДЫДУЩАЯ пара, а не начальная.

    База для «какой конец двигали» бралась из `rest.value ?? rest.defaultValue`.
    У НЕУПРАВЛЯЕМОГО ползунка `value` всегда `undefined`, а `defaultValue` не
    меняется никогда — после первого же движения сравнение шло с начальным
    значением, и зажимался не тот конец: пользователь тянул верхний, а уезжал
    тоже верхний.
  */
  const previous = useRef<[number, number] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  return (
    <AriaSlider
      {...rest}
      ref={rootRef}
      render={withDisabledGroup(rest.render)}
      onChange={(value) => {
        /*
          Зазор держится ЗДЕСЬ: react-aria не даёт концам поменяться местами,
          но сводит их вплотную, и «от 500 до 500» уезжает в фильтр как
          валидное значение.

          Значение ЗАЖИМАЕТСЯ, а не отбрасывается. Отбрасывание ломалось двумя
          способами сразу, и оба нашлись ревью:

          1. Управляемый ползунок заклинивало насмерть. Проверка смотрела на
             итоговый зазор, а не на то, стало ли лучше: из состояния, уже
             нарушающего `minGap` (сохранённый фильтр, умолчание сервера),
             отвергались ВСЕ движения, включая те, что его исправляют.
          2. У неуправляемого расходились вид и данные. Внутреннее состояние
             react-aria меняется независимо от нашего колбэка: ползунки
             съезжались вплотную на экране, а вызывающий не получал ничего и
             считал значение прежним.

          ЧТО ОСТАЁТСЯ. Зажатая пара уходит в `onChange`, но внутреннее
          состояние react-aria мы поправить не можем — им владеет библиотека.
          У НЕУПРАВЛЯЕМОГО ползунка концы на экране всё ещё могут встать ближе
          зазора, хотя наружу уехало правильное значение. С `minGap` держите
          ползунок управляемым; это записано и на странице компонента.

          Зажимаем тот конец, которого не касались: двигавшийся остаётся под
          пальцем, а уезжает сосед.
        */
        if (minGap > 0 && Array.isArray(value) && value.length === 2) {
          const [low, high] = value as [number, number];
          if (high - low < minGap) {
            const [prevLow] = (rest.value ??
              previous.current ??
              rest.defaultValue ?? [low, high]) as [number, number];
            const lowerThumbMoved = low !== prevLow;
            const clamped: [number, number] = lowerThumbMoved
              ? [low, Math.min(low + minGap, max)]
              : [Math.max(high - minGap, min), high];
            previous.current = clamped;
            onChange?.(clamped);
            return;
          }
        }
        if (Array.isArray(value) && value.length === 2) {
          previous.current = value as [number, number];
        }
        onChange?.(value);
      }}
      className={cn(ROOT_CLASS, className)}
    >
      <WheelStep rootRef={rootRef} trackRef={trackRef} vertical={false} />
      <Header label={label} valuePosition={valuePosition} formatValue={formatValue} />
      <SliderTrack ref={trackRef} className={TRACK_CLASS}>
        {({ state }) => (
          <>
            <div
              className={FILL_CLASS}
              style={{
                left: `${state.getThumbPercent(0) * 100}%`,
                width: `${(state.getThumbPercent(1) - state.getThumbPercent(0)) * 100}%`,
              }}
            />
            {/* Описание на ПЕРВОМ бегунке: повторять его на обоих значило бы
                прочитать подсказку дважды при переходе между концами. */}
            <SliderThumb
              index={0}
              className={THUMB_CLASS}
              {...(describedBy ? { "aria-describedby": describedBy } : {})}
            />
            <SliderThumb index={1} className={THUMB_CLASS} />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}

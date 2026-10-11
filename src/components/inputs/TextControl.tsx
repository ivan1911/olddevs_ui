"use client";

import {
  forwardRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import {
  FIELD_INPUT_CLASS,
  FIELD_INPUT_COMPACT_CLASS,
  FIELD_SHELL_CLASS,
} from "../../lib/field.js";

export interface TextControlProps extends Omit<ComponentPropsWithoutRef<"input">, "size"> {
  /** `input` — однострочное поле, `textarea` — многострочное. */
  as?: "input" | "textarea";
  /**
   * Ступень высоты: `md` — 42 пикселя, `sm` — 36.
   *
   * Тридцать шесть — рост `Button size="md"` и пилюли-триггера `Select`: в
   * одной строке панели управления поле до этой ступени выпадало из ряда в
   * одиночку. Меняется ровно вертикальный отступ; рамка, скругление, тень,
   * шрифт и строчный бокс те же.
   *
   * ТОЛЬКО ДЛЯ ОДНОСТРОЧНОГО ПОЛЯ. У `as="textarea"` высотой распоряжаются
   * `rows` и `autosize`, и ступень там означала бы третью систему, спорящую с
   * ними за одно и то же число.
   */
  size?: "sm" | "md";
  /** Высота в строках. Имеет смысл только при `as="textarea"`. */
  rows?: number;
  /** Классы на оболочку с рамкой — ширина, скругление, внутренние отступы. */
  shellClassName?: string;
  /** Иконка слева внутри рамки: лупа у поиска, единица измерения у числа. */
  icon?: ReactNode;
  /** Элемент справа внутри рамки: кнопка очистки, счётчик символов. */
  trailing?: ReactNode;
  /**
   * Подложка под значением, в той же строке: трафарет маски, подсказка формата.
   *
   * Не слот рядом с полем, а слой под ним — поэтому и не `icon`/`trailing`.
   * Выравнивание держится тем, что подложка несёт тот же `FIELD_INPUT_CLASS`,
   * что и поле, и лежит с ним в одной ячейке сетки: отступы и типографика
   * совпадают по построению, а не по подгонке. Эталонная реализация USWDS
   * ставит такой слой абсолютно, с необъяснённым `left: 2px`, — и ломается на
   * первом же поле с иконкой.
   *
   * ЧИТАТЬ ЕЁ НЕЧЕГО: `aria-hidden` вешает сам компонент. Слой под значением
   * повторяет то, что уже сказано подписью и подсказкой; прочитанный вслух, он
   * дал бы «подчёркивание подчёркивание подчёркивание» посреди поля.
   *
   * Кликов и выделения не перехватывает — иначе поле переставало бы
   * фокусироваться по щелчку в собственный текст.
   *
   * Только для однострочного поля: вместе с `autosize` не действует, потому что
   * ту же ячейку сетки занимает зеркало, считающее высоту.
   */
  underlay?: ReactNode;
  /**
   * Растёт по содержимому. Имеет смысл только при `as="textarea"`.
   *
   * `rows` при этом становится МИНИМУМОМ, а не фиксированной высотой, и ручная
   * тяга за угол выключается: две системы, одновременно распоряжающиеся высотой,
   * дают поле, которое схлопывается после каждого нажатия.
   */
  autosize?: boolean;
  /** Предел роста в строках; дальше появляется прокрутка. Только с `autosize`. */
  maxRows?: number;
  /**
   * Счётчик символов. С `maxLength` показывает «N/M», без него — просто «N».
   *
   * Компилятор `maxLength` не требует: союзный тип ради этого сломал бы `Omit`
   * в обёртках — тот же случай, что у `Checkbox.label`. Да и «сколько уже
   * набрано» осмысленно само по себе, без предела.
   */
  showCount?: boolean;
}

/**
 * Текстовое поле: рамка живёт на оболочке, а не на самом `input`.
 *
 * Разделение не косметическое. Рамка на оболочке позволяет положить внутрь
 * иконку или счётчик символов, не воюя с браузерным оформлением поля; сам
 * `input` при этом полностью обнулён (`appearance: none`, снятые тени и
 * контуры) — иначе Safari и Chrome рисуют разное.
 *
 * Подсветка фокуса — на оболочке через `focus-within`, и цвет берётся из
 * `--accent-strong`, а не из `--accent`: индикатор фокуса это не-текст под
 * порогом 3:1, а `--accent` рассчитан на белый текст поверх и на подложке
 * тусклее нужного.
 *
 * `icon` и `trailing` — те самые слоты, ради которых рамка вынесена на
 * оболочку. Раскладка переключается на `flex` только когда слот действительно
 * передан: голое поле обязано давать ту же разметку, что и до появления
 * слотов, иначе визуальный бейзлайн разъезжается на компоненте, который никто
 * не трогал.
 *
 * Цвет иконки задаётся на обёртке слота, а не на самой иконке: словарь
 * `@olddevs/ui/icons` рисует `currentColor`, и потребителю, которому нужен другой
 * цвет, достаточно передать иконку с собственным классом.
 *
 * ВЫКЛЮЧЕННОЕ СОСТОЯНИЕ ГАСИТСЯ НА ОБОЛОЧКЕ (см. `lib/field.ts`), а не на
 * самом поле. `disabled:opacity-50` на `input` приглушил бы только текст, а
 * рамка осталась бы такой же яркой, как у соседнего рабочего поля — то есть
 * ровно того сигнала, который отличает выключенное поле от пустого, и не было
 * бы. До этой правки состояния не было вовсе: в матрице строка «выключено»
 * отличалась от обычной только тем, что в неё нельзя печатать.
 *
 * `readOnly` намеренно не гасится: поле только для чтения — это показанное
 * значение, а не недоступный контрол, и приглушать его значит прятать данные,
 * которые показаны специально.
 */
export const TextControl = forwardRef<HTMLInputElement, TextControlProps>(function TextControl(
  {
    as = "input",
    size = "md",
    rows,
    className,
    shellClassName,
    icon,
    trailing,
    underlay,
    autosize,
    maxRows,
    showCount,
    ...rest
  },
  ref
) {
  const Comp = as as "input";
  const grows = autosize === true && as === "textarea";
  /*
    Ступень идёт ВО ВСЕ ТРИ копии `FIELD_INPUT_CLASS` — поле, зеркало автороста
    и подложку маски: у них общая типографика и общие отступы, и разойтись им
    нельзя, иначе остаток маски уедет относительно набранного. Многострочное
    поле ступени не знает: там высотой распоряжаются `rows` и `autosize`.
  */
  const compact = size === "sm" && as === "input" ? FIELD_INPUT_COMPACT_CLASS : undefined;

  // Текст нужен зеркалу и счётчику. Управляемое поле отдаёт его пропом,
  // неуправляемое — только через события, поэтому второй источник заводится
  // ЛЕНИВО: без `autosize` и без `showCount` ни состояния, ни обёртки над
  // `onChange` не появляется, и разметка обычного поля остаётся прежней.
  const [inner, setInner] = useState(() => String(rest.defaultValue ?? ""));
  const tracks = grows || showCount === true;
  const text = rest.value !== undefined ? String(rest.value) : inner;

  /*
    Подсказка или ошибка `FormField`. СЛИВАЕТСЯ с описанием, пришедшим пропом,
    а не заменяет его: `aria-describedby` — список, и потребитель, описавший
    поле своим узлом, вправе рассчитывать, что тот никуда не денется.

    Вне `FormField` значение `undefined`, спред пустой, и разметка та же, что
    и до появления описаний.
  */
  const fieldDescribedBy = useFieldDescribedBy();
  /*
    Невалидность объявляет раскладка формы, но ЯВНЫЙ проп сильнее: потребитель
    знает про своё поле больше, чем `FormField`. Без этого `FIELD_SHELL_CLASS`
    не мог покраснеть — он ищет `aria-invalid` на самом поле, а ставить его
    было некому.
  */
  const fieldInvalid = useFieldInvalid();
  const invalid = rest["aria-invalid"] ?? (fieldInvalid || undefined);
  const describedBy =
    [rest["aria-describedby"], fieldDescribedBy].filter(Boolean).join(" ") || undefined;

  const counter = showCount ? (
    // `text-fg-2`, а не `text-fg-3`: счётчик стоит ВНУТРИ поля, на `bg-2`, а
    // не на фоне страницы. `fg-3` рассчитан на второе и на первом даёт 4.0 при
    // требуемых 4.5 — нашёл аудит axe.
    <span className="text-fg-2 shrink-0 text-[11px] tabular-nums">
      {rest.maxLength != null ? `${text.length}/${rest.maxLength}` : text.length}
    </span>
  ) : null;

  // У однострочного поля счётчик встаёт в слот справа, у многострочного — под
  // текстом: в строке он отъедал бы ширину у самого длинного значения.
  /*
    Счётчик и `trailing` стоят РЯДОМ, а не вытесняют друг друга.

    Было `counter ?? trailing`: при `showCount` переданный `trailing` не попадал
    в разметку вовсе и без предупреждения — кнопка очистки просто исчезала. На
    `textarea` тот же вызов работал, потому что счётчик уезжает вниз, и
    расхождение между двумя формами одного компонента ничем не объяснялось.
  */
  const inlineTrailing =
    as === "input" && counter != null ? (
      <span className="inline-flex items-center gap-1.5">
        {counter}
        {trailing}
      </span>
    ) : (
      trailing
    );
  const hasSlots = icon != null || inlineTrailing != null;

  const control = (
    <Comp
      ref={ref}
      {...(as === "textarea" && rows ? { rows } : {})}
      // Глобальное правило `:focus-visible` в styles.css рисует контур вокруг
      // самого поля — здесь он лишний, подсветку даёт оболочка.
      data-disable-focus-ring="true"
      className={cn(
        FIELD_INPUT_CLASS,
        as === "textarea" && !grows && "min-h-[96px] resize-y",
        // Тяга за угол выключена: высотой распоряжается содержимое, и две
        // системы, одновременно ею командующие, дают поле, которое схлопывается
        // после каждого нажатия.
        grows && "col-start-1 row-start-1 resize-none overflow-y-auto",
        // Поле ложится поверх подложки: фон у него прозрачный, и сквозь него
        // виден остаток маски, а набранное рисуется самим полем.
        underlay != null && "col-start-1 row-start-1",
        // `w-full` сам по себе не ужимается ниже содержимого — рядом со
        // слотами поле выдавило бы крестик за рамку на длинном значении.
        hasSlots && "min-w-0 flex-1",
        compact,
        className
      )}
      {...rest}
      // После спреда: значение слито выше, и спред не должен его вытеснить —
      // тот же порядок, что у `onChange` ниже.
      {...(fieldDescribedBy ? { "aria-describedby": describedBy } : {})}
      {...(invalid != null ? { "aria-invalid": invalid } : {})}
      {...(tracks
        ? {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setInner(e.target.value);
              rest.onChange?.(e);
            },
          }
        : {})}
    />
  );

  return (
    <div
      className={cn(
        // Классы оболочки и поля общие с `NumberInput` — см. `lib/field.ts`.
        FIELD_SHELL_CLASS,
        as === "textarea" && "py-0.5",
        hasSlots && "flex items-center gap-2",
        shellClassName
      )}
    >
      {icon != null && <span className="text-fg-3 flex shrink-0 items-center">{icon}</span>}
      {grows ? (
        /*
          Зеркало вместо измерения высоты.

          Обычный способ — на каждое нажатие сбросить height в auto, прочитать
          `scrollHeight` и выставить обратно; это принудительный пересчёт
          раскладки в обработчике ввода, то есть на каждый символ. Здесь высоту
          считает сам браузер: невидимый близнец с той же типографикой лежит в
          той же ячейке грида и задаёт её высоту, а поле растянуто на ячейку.
          JS-измерений ноль.

          Хвостовой перевод строки обязателен: без него последняя пустая строка
          не учитывается, и поле дёргается на каждом Enter.

          `maxRows` в строках, а не в пикселях, потому что предел задаётся
          единицей `lh` — высотой строки этого самого поля. Пересчитывать её в
          пиксели пришлось бы вручную и заново при каждой смене шрифта.
        */
        <div
          className="grid w-full"
          style={maxRows != null ? ({ "--tc-max-rows": maxRows } as CSSProperties) : undefined}
        >
          {control}
          <div
            aria-hidden
            className={cn(
              FIELD_INPUT_CLASS,
              "invisible col-start-1 row-start-1 break-words whitespace-pre-wrap",
              // Потолок стоит НА ЗЕРКАЛЕ, а не на гриде: высоту ячейки задаёт
              // зеркало, и ограничение контейнера дорожку не сжимает — поле
              // просто вылезло бы наружу. Здесь же `1lh` разрешается по строке
              // самого зеркала, а его типографика совпадает с полем; на гриде
              // это была строка контейнера, то есть другое число.
              //
              // `+1.25rem` компенсирует `py-[10px]` из `FIELD_INPUT_CLASS`:
              // `box-sizing: border-box`, и без добавки предел в четыре строки
              // показывал бы три с половиной.
              maxRows != null && "max-h-[calc(var(--tc-max-rows)*1lh+1.25rem)] overflow-hidden",
              compact,
              className
            )}
          >
            {text + "\n"}
          </div>
        </div>
      ) : underlay != null ? (
        /*
          Подложка и поле — в одной ячейке сетки, а не друг поверх друга через
          `position: absolute`. Отступы и типографика приходят обоим одним и тем
          же `FIELD_INPUT_CLASS`, поэтому начало текста совпадает по построению:
          подгонять нечего, и подгонка не разъедется при смене шкалы или шрифта.

          `whitespace-pre` обязателен: в маске есть пробелы (`+7 (___) ___`), и
          схлопывание их сдвинуло бы остаток влево относительно набранного.

          Подложка идёт ПЕРВОЙ, то есть под полем: иначе она закрыла бы и текст,
          и каретку.
        */
        <div className={cn("grid w-full", hasSlots && "min-w-0 flex-1")}>
          <div
            aria-hidden
            className={cn(
              FIELD_INPUT_CLASS,
              "pointer-events-none col-start-1 row-start-1 overflow-hidden whitespace-pre select-none",
              compact,
              className
            )}
          >
            {underlay}
          </div>
          {control}
        </div>
      ) : (
        control
      )}
      {inlineTrailing != null && (
        <span className="flex shrink-0 items-center">{inlineTrailing}</span>
      )}
      {as === "textarea" && counter != null && (
        <div className="flex justify-end pb-1.5">{counter}</div>
      )}
    </div>
  );
});

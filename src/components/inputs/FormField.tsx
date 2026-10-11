"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import {
  FieldDescriptionProvider,
  FieldInvalidProvider,
  FieldLabelProvider,
} from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

/** Раскладка поля: подпись над полем или в колонке слева. */
export type FieldLayout = "stack" | "side";

/**
 * Ось раскладки, приходящая от `FormLayout`.
 *
 * @internal Провайдер ставит `FormLayout`; напрямую он потребителю не нужен —
 * поле берёт ось у ближайшей раскладки, а явный проп её перекрывает.
 */
const FieldLayoutContext = createContext<FieldLayout | null>(null);

/** @internal */
export const FieldLayoutProvider = FieldLayoutContext.Provider;

export interface FormFieldProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Подпись над полем. */
  label: ReactNode;
  /**
   * `id` поля, к которому относится подпись.
   *
   * Без него подпись остаётся просто текстом: клик по ней не фокусирует поле,
   * а скринридер не называет поле её словами. Проп необязателен, потому что
   * `id` знает только вызывающий, а придумывать его здесь через `useId` нечем —
   * поле лежит в `children`, и подставить ему атрибут отсюда невозможно.
   */
  htmlFor?: string;
  /** Пояснение под полем. */
  hint?: ReactNode;
  /**
   * Сообщение об ошибке. По умолчанию заменяет `hint`; с `hintPersistent` подсказка
   * остаётся, и ошибка встаёт под ней.
   *
   * Две строки под полем, одна из которых противоречит другой, — источник шума:
   * пояснение говорит, как заполнять, ошибка — что заполнено неверно, и вместе
   * они заставляют читать обе, чтобы понять, какая ещё действует.
   */
  error?: ReactNode;
  /**
   * Подсказка остаётся под полем и при ошибке; ошибка встаёт под ней.
   *
   * Для подсказки-ПРАВИЛА (формат, ограничение: «8–64 символа, цифра и
   * буква»): прятать её ровно тогда, когда пользователь ошибся, значит отнять
   * инструкцию в момент, когда она нужнее всего. Подсказка-пояснение («как к
   * вам обращаться») по-прежнему заменяется ошибкой — это умолчание
   * (ADR-0065).
   */
  hintPersistent?: boolean;
  /**
   * Отметка обязательного поля рядом с подписью.
   *
   * Только отметка: валидацию она не включает и не заменяет. Кит показывает
   * состояние формы, а вычисляет его потребитель — правила обязательности это
   * знание домена.
   */
  required?: boolean;
  /**
   * Раскладка: `stack` — подпись над полем, `side` — подпись в колонке слева.
   *
   * Ось живёт ЗДЕСЬ, а не в `FormLayout`, потому что подпись рисует это поле:
   * перенести её в левую колонку снаружи невозможно — она лежит внутри
   * собственного флекса компонента. Разбор — ADR-0025.
   *
   * Без пропа ось берётся у ближайшего `FormLayout`, а без него — `stack`, и
   * разметка не меняется ни на узел.
   */
  layout?: FieldLayout;
  /** Поле, к которому относится подпись. */
  children?: ReactNode;
}

/**
 * Подпись, поле и пояснение — одним блоком.
 *
 * СВЯЗЬ ПОДПИСИ С ПОЛЕМ — ЧЕРЕЗ `htmlFor`, и её стоит проставлять всегда:
 *
 *     <FormField label="Название" htmlFor="cat-name">
 *       <TextControl id="cat-name" … />
 *     </FormField>
 *
 * Раньше связи не было вовсе и подделывать её было нечем — отсюда прежняя
 * докстрока «связать может только вызывающий». Это верно и сейчас: `id`
 * по-прежнему приходит снаружи. Изменилось то, что теперь для этого есть проп,
 * а не только совет обернуть весь блок в `<label>` на стороне вызова.
 *
 * ШИРИНА КОЛОНКИ ПОДПИСЕЙ — ПЕРЕМЕННАЯ `--form-label-w`, а не `subgrid`.
 * `subgrid` выровнял бы подписи по общему треку, но требует, чтобы поле было
 * прямым элементом внешнего грида с известным числом дорожек, — а при двух
 * колонках и строке во всю ширину их то две, то четыре. Переменная же
 * работает и вне `FormLayout`: поле с `layout="side"` стоит само по себе.
 *
 * Длинная подпись переносится ВНУТРИ своей колонки и не двигает поле — это и
 * есть требование «не ломает соседний ряд».
 *
 * Прежняя версия экспортировала ещё и `inputStyle` — объект инлайн-стилей
 * поля. Он не переносится: разбор показал ноль использований во всём фронте,
 * то есть экспорт держался сам за себя.
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { label, htmlFor, hint, error, hintPersistent, required, layout, children, className, ...rest },
  ref
) {
  const inherited = useContext(FieldLayoutContext);
  const side = (layout ?? inherited ?? "stack") === "side";

  /*
    Одно сообщение — один `id`: по умолчанию под полем ровно одна строка,
    ошибка ЗАМЕНЯЕТ подсказку. Второй `id` нужен только подсказке, которая
    остаётся рядом с ошибкой (`hintPersistent`).
  */
  const messageId = useId();
  const hintId = useId();
  const keepHint = hintPersistent === true && error != null && Boolean(hint);
  // `id` подписи уходит в контекст: поле, которое нельзя назвать через
  // `<label for>` (`contenteditable`), ссылается на неё `aria-labelledby`.
  const labelId = useId();

  const message =
    error != null ? (
      // `role="alert"` — иначе скринридер не объявит появившуюся ошибку вовсе:
      // она возникает после отправки, когда фокус уже не на этом поле.
      //
      // Роль и `aria-describedby` тут не спорят, а делят обязанности: роль
      // объявляет ошибку В МОМЕНТ ПОЯВЛЕНИЯ, описание — при входе в поле
      // позже. Без второго пользователь, вернувшийся к полю через Tab, не
      // услышит, что с ним не так.
      <div id={messageId} role="alert" className="text-danger-strong text-[11px]">
        {error}
      </div>
    ) : hint ? (
      <div id={messageId} className="text-fg-3 text-[11px]">
        {hint}
      </div>
    ) : null;

  /*
    Описания нет — в контекст уходит `undefined`, и поле не получает
    `aria-describedby` вовсе. Пустая строка или висящий `id` несуществующего
    узла хуже отсутствия: скринридер молча пропускает ссылку в никуда, и
    дефект не виден ни в разметке, ни в тесте.
  */
  const describedBy =
    message != null ? (keepHint ? `${hintId} ${messageId}` : messageId) : undefined;
  // Подсказка над ошибкой: её читают первой, ошибку дочитывают в конце.
  const messages = keepHint ? (
    <>
      <div id={hintId} className="text-fg-3 text-[11px]">
        {hint}
      </div>
      {message}
    </>
  ) : (
    message
  );
  const invalid = error != null;

  return (
    <div
      ref={ref}
      className={cn(
        side
          ? // Колонка подписей фиксированной ширины, поле — во всё остальное.
            // `minmax(0,1fr)` вместо `1fr`: без него длинное значение внутри
            // поля растягивает дорожку и выдавливает поле за пределы формы.
            "grid grid-cols-[var(--form-label-w,12rem)_minmax(0,1fr)] items-start gap-x-4"
          : "flex flex-col gap-1.5",
        className
      )}
      {...rest}
    >
      <label
        id={labelId}
        htmlFor={htmlFor}
        className={cn(
          "text-fg-2 text-[11px] font-bold tracking-wide uppercase",
          // Отступ равен верхнему отступу поля (`py-[10px]`): без него подпись
          // висела бы над первой строкой значения, а не рядом с ней.
          side && "pt-2.5"
        )}
      >
        {label}
        {required && (
          // `aria-hidden`: звёздочка это визуальный сигнал, а обязательность
          // объявляет само поле через `required`/`aria-required`. Прочитанная
          // вслух, она превратилась бы в «звёздочка» посреди подписи.
          <span aria-hidden className="text-danger-strong ml-0.5">
            *
          </span>
        )}
      </label>
      {/*
        Провайдеры не добавляют ни одного узла: разметка поля без подсказки и
        без ошибки остаётся ровно такой же, какой была до появления описаний.
        Единственное отличие от прежней — `id` на самой подписи.
      */}
      <FieldLabelProvider value={labelId}>
        <FieldDescriptionProvider value={describedBy}>
          <FieldInvalidProvider value={invalid}>
            {side ? (
              // Поле, пояснение и ошибка уезжают в ОДНУ колонку целиком, а не по
              // ячейке на узел. Иначе второй ребёнок (диапазон «от» и «до», поле с
              // кнопкой рядом) попадал в следующий ряд под подпись — грид
              // раскладывает детей по ячейкам, а не по смыслу.
              <div className="flex flex-col gap-1.5">
                {children}
                {messages}
              </div>
            ) : (
              <>
                {children}
                {messages}
              </>
            )}
          </FieldInvalidProvider>
        </FieldDescriptionProvider>
      </FieldLabelProvider>
    </div>
  );
});

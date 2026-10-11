"use client";

import { createContext, forwardRef, useContext, useMemo, type ReactNode } from "react";
import {
  RadioGroup as AriaRadioGroup,
  FieldError,
  Label,
  RadioButton,
  RadioField,
  Text,
} from "react-aria-components";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { ChoiceCardBody } from "./ChoiceCardBody.js";
import {
  CHOICE_CARD_BASE,
  CHOICE_CARD_FOCUS_RING,
  CHOICE_CARD_IDLE_BORDER,
  CHOICE_CARD_INVALID_BORDER,
  CHOICE_CARD_LABEL,
  CHOICE_CARD_ROW,
  CHOICE_CARD_SELECTED_BORDER,
  type ChoiceAppearance,
} from "../../lib/choice-card.js";
import { TONE_TOKENS, type Size, type Tone } from "../../lib/variants.js";

export interface RadioGroupProps {
  /** `null` — не выбрано ничего. Такое состояние бывает только начальным. */
  value: string | null;
  /** Вызывается при выборе варианта и получает его `value`. */
  onChange: (value: string) => void;
  /** Вопрос, на который отвечает набор. Обязателен: кнопки без вопроса нечитаемы. */
  label: ReactNode;
  /** Пояснение под подписью набора. */
  description?: ReactNode;
  /** Сообщение об ошибке. Заменяет `description`, когда задано. */
  errorMessage?: ReactNode;
  /** Раскладка вариантов: `vertical` — столбцом, `horizontal` — в ряд. По умолчанию `vertical`. */
  orientation?: "vertical" | "horizontal";
  /** Выключает весь набор. Перекрывает `disabled` отдельных кнопок. */
  disabled?: boolean;
  /** Размер кружков и подписей: `sm` или `md`. По умолчанию `md`. */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Цвет выбранной кнопки (в карточке — рамки выбранной карточки). Невыбранные
   * всегда нейтральны — правило `Checkbox`.
   */
  tone?: Tone;
  /**
   * Вид набора: `default` — строки с кружком, `card` — карточки.
   *
   * Вид набора: `default` — строки с кружком, `card` — карточки с подписью,
   * описанием и необязательной иконкой. Живёт у группы и приходит вариантам
   * контекстом: набор не может разъехаться по виду. Не `variant`: тот в ките
   * уже значит подачу тона.
   */
  appearance?: ChoiceAppearance;
  /** `<Radio value="…">` — по одной на вариант. */
  children?: ReactNode;
  /** Классы на корневой элемент набора. */
  className?: string;
}

export interface RadioProps {
  /** Значение варианта; именно оно приходит в `onChange` группы. */
  value: string;
  /** Подпись варианта. */
  children?: ReactNode;
  /** Пояснение под подписью варианта. */
  description?: ReactNode;
  /**
   * Иконка варианта. Декоративная: из доступного имени исключена, имя несёт
   * подпись. В карточке стоит в её начале, в обычном виде — между кружком и
   * подписью.
   */
  icon?: ReactNode;
  /** Выключает один вариант; остальные работают. */
  disabled?: boolean;
  /** Классы на элемент варианта. */
  className?: string;
}

const SIZES: Record<"sm" | "md", { box: string; dot: string; label: string }> = {
  sm: { box: "size-4", dot: "size-1.5", label: "text-xs" },
  md: { box: "size-[18px]", dot: "size-2", label: "text-[13px]" },
};

/**
 * Тон и размер идут от группы к вариантам контекстом, а не пропами на каждой
 * кнопке: набор обязан выглядеть одинаково, и позволить одному варианту
 * разъехаться с соседями — значит завести дефект, который никто не заметит.
 * Контекст свой, а не `data-*` на группе: из CSS достать тон можно было бы
 * только склейкой класса из префикса и атома, а склейку Tailwind не видит.
 */
const RadioStyleContext = createContext<{
  size: "sm" | "md";
  tone: Tone;
  appearance: ChoiceAppearance;
  orientation: "vertical" | "horizontal";
}>({
  size: "md",
  tone: "accent",
  appearance: "default",
  orientation: "vertical",
});

/**
 * Радиогруппа: выбор одного из набора.
 *
 * ЗНАЧЕНИЕ ДЕРЖИТ ГРУППА, а не каждая кнопка: `value`/`onChange` здесь, а у
 * `Radio` нет ни `checked`, ни `selected`. Выбор одного из набора — это
 * значение, и словарь кита для этого уже имеет форму (`Select`, `Segmented`).
 * Хранить его по кнопкам означало бы допустить состояние «выбраны две».
 *
 * ОЧИСТКИ НЕТ, и это не упущение: снять выбор в радиогруппе нельзя по
 * определению — набор отвечает на вопрос, а «не отвечать» это тоже ответ и
 * заводится явным вариантом («не важно», «любой»). Поэтому `onChange` отдаёт
 * `string`, а не `string | null`: `null` бывает только начальным значением,
 * пришедшим снаружи.
 *
 * Собрана на `RadioField` + `RadioButton`, а не на `Radio` из
 * react-aria-components: последний в 1.19 помечен `@deprecated` в пользу этой
 * пары — ровно как `Checkbox`.
 */
export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(function RadioGroup(
  {
    value,
    onChange,
    label,
    description,
    errorMessage,
    orientation = "vertical",
    disabled,
    size = "md",
    tone = "accent",
    appearance = "default",
    children,
    className,
  },
  ref
) {
  const card = appearance === "card";
  // Значение контекста — новым объектом только при смене осей: иначе каждый
  // рендер группы перерисовывал бы все варианты, даже когда вид не менялся.
  const style = useMemo(
    () => ({ size, tone, appearance, orientation }),
    [size, tone, appearance, orientation]
  );
  return (
    <AriaRadioGroup
      ref={ref}
      // `null` в RAC означает «управляемая группа без значения», а `undefined` —
      // неуправляемая. Разница видна только в консоли React, поэтому сводим явно.
      value={value ?? null}
      onChange={onChange}
      isDisabled={disabled}
      isInvalid={errorMessage != null || undefined}
      orientation={orientation}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className="text-fg-2 text-[11px] font-bold tracking-wide uppercase">{label}</Label>
      <div
        className={cn(
          "flex",
          card ? "gap-3" : "gap-2",
          orientation === "vertical"
            ? "flex-col"
            : // Карточки в строке тянутся до высоты самой высокой, а обычные
              // варианты выравниваются по центру.
              cn("flex-row flex-wrap", card ? "items-stretch" : "items-center")
        )}
      >
        <RadioStyleContext.Provider value={style}>{children}</RadioStyleContext.Provider>
      </div>
      {errorMessage != null ? (
        <FieldError className="text-danger-strong text-[11px]">{errorMessage}</FieldError>
      ) : (
        description != null && (
          <Text slot="description" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )
      )}
    </AriaRadioGroup>
  );
});

/**
 * Вариант радиогруппы.
 *
 * Вне `RadioGroup` не работает и не должен: react-aria берёт состояние из
 * контекста группы, и одиночная кнопка без него — это флажок, притворившийся
 * радио. Тон и размер тоже приходят от группы — контекстом: держать их пропами
 * на каждой кнопке значило бы позволить набору разъехаться по виду.
 */
export const Radio = forwardRef<HTMLDivElement, RadioProps>(function Radio(
  { value, children, description, icon, disabled, className },
  ref
) {
  const { size, tone, appearance, orientation } = useContext(RadioStyleContext);

  if (appearance === "card") {
    return (
      <RadioField
        ref={ref}
        value={value}
        isDisabled={disabled}
        className={({ isSelected, isInvalid, isDisabled }) =>
          cn(
            CHOICE_CARD_BASE,
            isInvalid
              ? CHOICE_CARD_INVALID_BORDER
              : isSelected
                ? CHOICE_CARD_SELECTED_BORDER[tone]
                : CHOICE_CARD_IDLE_BORDER,
            isDisabled ? "opacity-50" : "hover:bg-bg-3",
            orientation === "horizontal" && CHOICE_CARD_ROW,
            className
          )
        }
      >
        <RadioButton
          className={({ isFocusVisible }) =>
            cn(CHOICE_CARD_LABEL, isFocusVisible && CHOICE_CARD_FOCUS_RING)
          }
        >
          {({ isSelected, isInvalid }) => (
            <ChoiceCardBody
              icon={icon}
              label={children}
              labelClassName={SIZES[size].label}
              description={description}
              indicator={
                <RadioBox selected={isSelected} invalid={isInvalid} focusVisible={false} card />
              }
            />
          )}
        </RadioButton>
      </RadioField>
    );
  }

  return (
    <RadioField
      ref={ref}
      value={value}
      isDisabled={disabled}
      className={cn("flex flex-col", className)}
    >
      <RadioButton className="hover:bg-bg-2 flex w-fit cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 transition-colors disabled:cursor-default disabled:opacity-50">
        {({ isSelected, isInvalid, isFocusVisible }) => (
          <>
            <RadioBox selected={isSelected} invalid={isInvalid} focusVisible={isFocusVisible} />
            {hasContent(icon) && (
              <span aria-hidden="true" className="text-fg-2 flex shrink-0">
                {icon}
              </span>
            )}
            <RadioLabel label={children} />
          </>
        )}
      </RadioButton>
      {description != null && (
        <Text slot="description" className="text-fg-3 pl-[26px] text-[11px]">
          {description}
        </Text>
      )}
    </RadioField>
  );
});

/**
 * Кружок с точкой.
 *
 * Состояние приходит рендер-пропом, а тон и размер — контекстом группы. Иначе
 * не сходится: точка это потомок, а `data-selected` висит на `<label>` снаружи,
 * и дотянуться до него из CSS можно было бы только формой `group-selected:`,
 * склеенной из префикса и атома тона. Склейку Tailwind не видит — он сканирует
 * исходники как текст.
 *
 * В карточке кружок остаётся: выбранность не должна жить одним цветом рамки.
 * Кольца фокуса у него в этом случае нет — ориентир клавиатуры там вся карточка.
 */
function RadioBox({
  selected,
  invalid,
  focusVisible,
  card = false,
}: {
  selected: boolean;
  invalid: boolean;
  focusVisible: boolean;
  card?: boolean;
}) {
  const { size, tone } = useContext(RadioStyleContext);
  const s = SIZES[size];
  const t = TONE_TOKENS[tone];

  return (
    <span
      data-indicator=""
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border transition-colors",
        card && "mt-0.5",
        s.box,
        // Невыбранный вариант нейтрален при любом тоне — правило `Checkbox`.
        selected ? t.border : "border-line bg-bg-2",
        invalid && "border-danger-strong",
        focusVisible && "ring-accent-strong ring-offset-bg-1 ring-2 ring-offset-1"
      )}
    >
      {selected && <span className={cn("rounded-full", s.dot, t.dotBg)} />}
    </span>
  );
}

/** Подпись обычного варианта. */
function RadioLabel({ label }: { label: ReactNode }) {
  const { size } = useContext(RadioStyleContext);
  if (!hasContent(label)) return null;
  return <span className={SIZES[size].label}>{label}</span>;
}

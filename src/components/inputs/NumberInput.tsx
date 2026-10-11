"use client";

import { forwardRef } from "react";
import { Button, Group, Input, NumberField } from "react-aria-components";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_INPUT_CLASS, FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface NumberInputProps {
  /** `null` — поле пусто. Это не то же самое, что введённый ноль. */
  value: number | null;
  /** Вызывается при смене числа; `null` — поле очищено. */
  onChange: (value: number | null) => void;
  /** Наименьшее допустимое значение. */
  min?: number;
  /** Наибольшее допустимое значение. */
  max?: number;
  /** Шаг изменения кнопками и стрелками клавиатуры. */
  step?: number;
  /** Формат отображения: проценты, валюта, единицы. Идёт в `Intl.NumberFormat`. */
  formatOptions?: Intl.NumberFormatOptions;
  /** Плейсхолдер в пустом поле. */
  placeholder?: string;
  /** Выключает поле и кнопки шага. */
  disabled?: boolean;
  /** Показывает поле в состоянии ошибки. */
  invalid?: boolean;
  /**
   * Доступное имя. Обязательно и проверяется компилятором — как у `Toggle`.
   *
   * Подпись из `FormField` сюда не дотягивается: react-aria генерирует `id`
   * внутреннему полю сам, и связать с ним чужой `<label htmlFor>` нечем.
   * Поэтому имя компонент держит у себя.
   */
  label: string;
  /** Классы на оболочку с рамкой — ширина, скругление, внутренние отступы. */
  shellClassName?: string;
  /** Классы на корневой элемент. */
  className?: string;
}

const STEP_BUTTON_CLASS =
  "text-fg-2 hover:text-fg-0 hover:bg-bg-3 flex size-6 shrink-0 items-center justify-center " +
  "rounded-xs text-[15px] leading-none transition-colors disabled:pointer-events-none disabled:opacity-40";

/**
 * Числовое поле со ступенями.
 *
 * ПУСТОЕ ПОЛЕ ОТДАЁТ `null`, А НЕ НОЛЬ. Ноль — это введённое значение, и
 * отличать его от «ничего не введено» обязано само значение, а не догадка
 * потребителя. Та же логика, по которой `Select` отдаёт `null` при очистке.
 * Внутри react-aria пустоту выражает `NaN`; наружу он не выходит — `NaN`
 * не равен сам себе, и потребитель, сравнивший его с чем угодно, получил бы
 * тихо неверный результат.
 *
 * Вид рамки, фокуса и выключенного состояния — общий с `TextControl`, из
 * `lib/field.ts`. Не копия: два поля, стоящие в одной форме рядом, обязаны
 * фокусироваться одинаково, а копипаст классов расходится — во фронте до
 * пакета так и вышло с пятью полями поиска.
 *
 * Разбор и форматирование по `formatOptions` держит react-aria: локаль, разряды,
 * знак процента, ввод «1 234,5» — всё это его работа, и повторять её здесь
 * означало бы писать вторую библиотеку.
 */
export const NumberInput = forwardRef<HTMLDivElement, NumberInputProps>(function NumberInput(
  {
    value,
    onChange,
    min,
    max,
    step,
    formatOptions,
    placeholder,
    disabled,
    invalid,
    label,
    shellClassName,
    className,
  },
  ref
) {
  const messages = useMessages();
  // Подсказка или ошибка `FormField`. `NumberField` доводит атрибут до своего
  // `Input` сам — своего пропа описания у компонента нет, и сливать нечего.
  const describedBy = useFieldDescribedBy();
  // Ошибка `FormField` доходит до поля так же, как у `TextControl`; явный
  // `invalid` сильнее формы.
  const fieldInvalid = useFieldInvalid();
  return (
    <NumberField
      ref={ref}
      value={value ?? Number.NaN}
      onChange={(next) => onChange(Number.isNaN(next) ? null : next)}
      minValue={min}
      maxValue={max}
      step={step}
      formatOptions={formatOptions}
      isDisabled={disabled}
      isInvalid={invalid ?? (fieldInvalid || undefined)}
      aria-label={label}
      aria-describedby={describedBy}
      className={className}
    >
      <Group
        className={cn(
          FIELD_SHELL_CLASS,
          "flex items-center gap-1",
          // Красная рамка невалидного поля переехала в `FIELD_SHELL_CLASS`: там
          // же живёт сама рамка, и там правило достаётся всем полям на этой
          // оболочке, а не одному числовому. Атрибут `data-invalid`, который
          // ловит вариант `invalid:`, по-прежнему висит на этой группе.
          shellClassName
        )}
      >
        <Button
          slot="decrement"
          className={STEP_BUTTON_CLASS}
          aria-label={messages.numberInput.decrement({ label: label ?? "" })}
        >
          −
        </Button>
        <Input
          data-disable-focus-ring="true"
          placeholder={placeholder}
          className={cn(FIELD_INPUT_CLASS, "min-w-0 flex-1 text-center tabular-nums")}
        />
        <Button
          slot="increment"
          className={STEP_BUTTON_CLASS}
          aria-label={messages.numberInput.increment({ label: label ?? "" })}
        >
          +
        </Button>
      </Group>
    </NumberField>
  );
});

"use client";

import { forwardRef, useMemo, type ReactNode } from "react";
import { CheckboxGroup as AriaCheckboxGroup, FieldError, Label, Text } from "react-aria-components";
import { cn } from "../../lib/cn.js";
import type { ChoiceAppearance } from "../../lib/choice-card.js";
import type { Tone } from "../../lib/variants.js";
import { CheckboxGroupStyleContext } from "./Checkbox.js";
import { CheckboxCard, CheckboxCardLayoutContext } from "./CheckboxCard.js";

export interface CheckboxGroupProps {
  /** Отмеченные пункты: массив `value` отмеченных флажков группы. */
  value: string[];
  /** Вызывается при смене набора и получает новый массив значений. */
  onChange: (value: string[]) => void;
  /** Подпись всей группы. Обязательна: набор флажков без общего вопроса нечитаем. */
  label: ReactNode;
  /** Пояснение под подписью. */
  description?: ReactNode;
  /** Сообщение об ошибке. Заменяет `description`, когда задано. */
  errorMessage?: ReactNode;
  /** Раскладка флажков. Горизонтальная — для двух-трёх коротких подписей. */
  orientation?: "vertical" | "horizontal";
  /**
   * Выключает всю группу целиком: недоступен каждый её пункт.
   *
   * Выключает всю группу целиком. Перекрывает `disabled` отдельных флажков, а
   * не складывается с ним: недоступна вся группа — недоступен каждый её пункт,
   * и обратного прочтения тут быть не может.
   */
  disabled?: boolean;
  /** Помечает группу обязательной для заполнения (передаётся в `react-aria-components`). */
  isRequired?: boolean;
  /**
   * Тон отмеченных флажков набора — один на всех.
   *
   * Цвет отмеченных флажков набора (в карточках — ещё и рамки отмеченной
   * карточки). Один на весь набор и приходит флажкам контекстом, как у
   * `RadioGroup`: тон `Checkbox` внутри группы с этим пропом игнорируется —
   * набор не может разъехаться по виду. Не задан — каждый флажок красится своим
   * `tone`, как и вне группы. Неотмеченные всегда нейтральны.
   */
  tone?: Tone;
  /**
   * Вид группы: `default` — строки с коробкой, `card` — карточки.
   *
   * Вид группы: `default` — строки с коробкой, `card` — карточки с подписью,
   * описанием и необязательной иконкой. Живёт у группы и приходит флажкам
   * контекстом. Не `variant`: тот в ките уже значит подачу тона.
   */
  appearance?: ChoiceAppearance;
  /** `<Checkbox value="…">` — по одному на пункт. */
  children?: ReactNode;
  /** Классы на корневой элемент группы. */
  className?: string;
}

/**
 * Группа флажков.
 *
 * СОБИРАЕТСЯ ИЗ `children`, А НЕ ИЗ МАССИВА `items` — и это осознанное
 * расхождение с `Select` и `Segmented`.
 *
 * Те два рисуют однородные строки: у пункта есть подпись, иногда картинка и
 * счётчик, и всё это описывается объектом. У флажка в группе бывает своё
 * пояснение, свой `disabled`, своя иконка и своя вложенная разметка подписи —
 * описать это объектом можно только заведя второй язык разметки рядом с JSX,
 * который уже есть.
 *
 * Значение группы — массив, а состояние отдельного флажка внутри неё
 * определяется вхождением его `value` в этот массив: `checked` у детей группы
 * не задаётся вовсе. Это тот же принцип, по которому `RadioGroup` держит
 * значение у группы, а не у каждой кнопки.
 */
export const CheckboxGroup = forwardRef<HTMLDivElement, CheckboxGroupProps>(function CheckboxGroup(
  {
    value,
    onChange,
    label,
    description,
    errorMessage,
    orientation = "vertical",
    disabled,
    isRequired,
    tone,
    appearance = "default",
    children,
    className,
  },
  ref
) {
  // Значение контекста не пересоздаётся на каждый рендер: иначе каждый флажок
  // набора перерисовывался бы от любого рендера группы.
  const style = useMemo(
    () => ({ tone, Card: appearance === "card" ? CheckboxCard : undefined }),
    [tone, appearance]
  );
  return (
    <AriaCheckboxGroup
      ref={ref}
      value={value}
      onChange={onChange}
      isDisabled={disabled}
      isRequired={isRequired}
      isInvalid={errorMessage != null || undefined}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className="text-fg-2 text-[11px] font-bold tracking-wide uppercase">{label}</Label>
      <div
        className={cn(
          "flex",
          appearance === "card" ? "gap-3" : "gap-2",
          orientation === "vertical"
            ? "flex-col"
            : cn("flex-row flex-wrap", appearance === "card" ? "items-stretch" : "items-center")
        )}
      >
        <CheckboxGroupStyleContext.Provider value={style}>
          <CheckboxCardLayoutContext.Provider value={orientation}>
            {children}
          </CheckboxCardLayoutContext.Provider>
        </CheckboxGroupStyleContext.Provider>
      </div>
      {/*
          Ошибка ВЫТЕСНЯЕТ пояснение, а не встаёт под ним: две строки под
          группой, одна из которых противоречит другой, — источник шума.
          То же правило, что у `FormField`.
        */}
      {errorMessage != null ? (
        <FieldError className="text-danger-strong text-[11px]">{errorMessage}</FieldError>
      ) : (
        description != null && (
          <Text slot="description" className="text-fg-3 text-[11px]">
            {description}
          </Text>
        )
      )}
    </AriaCheckboxGroup>
  );
});

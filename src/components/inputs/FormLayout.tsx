"use client";

import { forwardRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";
import { cn } from "../../lib/cn.js";
import { FieldLayoutProvider } from "./FormField.js";

export interface FormLayoutProps extends ComponentPropsWithoutRef<"div"> {
  /** Число колонок. На узких экранах колонка всегда одна — это делает CSS. */
  columns?: 1 | 2;
  /** Где стоят подписи полей: над полем или в колонке слева. */
  labels?: "top" | "side";
  /**
   * Ширина колонки подписей — любая длина CSS.
   *
   * Проп, а не только переменная, потому что ширина зависит от самых длинных
   * подписей ЭТОЙ формы, а не от темы: подобрать её глобально нельзя.
   */
  labelWidth?: string;
}

/**
 * Раскладка формы: колонки и место подписей.
 *
 * ОТВЕЧАЕТ ТОЛЬКО ЗА ПОЗИЦИЮ УЗЛОВ. Ни валидации, ни состава полей, ни
 * состояния: `Form` отказался от собственной валидации осознанно, и раскладка
 * этого не пересматривает. Признак нарушения границы проверяемый — проп,
 * который влияет не на позицию узлов, а на их состав (ADR-0025).
 *
 * СЕТКА НА CSS, А НЕ РАСЧЁТ В JS. Одна колонка на узких экранах включается
 * медиазапросом: раскладка, зависящая от `matchMedia`, до гидратации
 * показывает неверную, и первый кадр формы приходится на неё.
 *
 * ПОДПИСИ СЛЕВА — ЭТО ОСЬ `FormField`, А НЕ ЭТОГО КОМПОНЕНТА. Раскладка лишь
 * передаёт её контекстом: подпись рисует поле, и перенести её снаружи
 * невозможно. Отсюда следствие, которое стоит знать заранее: `labels="side"`
 * действует на `FormField` и молча не применяется к чужим детям — `<input>`
 * потребителя раскладка позиционирует, но подписи у него не видит.
 *
 * `Fieldset` отдельным компонентом не заводится: группировка с подписью — это
 * родные `<fieldset>` и `<legend>`, и обёртка вокруг них не добавила бы
 * ничего, кроме имени в экспорте.
 */
export const FormLayout = forwardRef<HTMLDivElement, FormLayoutProps>(function FormLayout(
  { columns = 1, labels = "top", labelWidth, className, style, ...rest },
  ref
) {
  return (
    // «Сверху» у поля называется `stack`: у раскладки это место подписи, у поля
    // — способ сложить свои узлы. Переименовывать одно в другое хуже, чем
    // сопоставить их в одной строке.
    <FieldLayoutProvider value={labels === "side" ? "side" : "stack"}>
      <div
        ref={ref}
        className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", className)}
        // Свой проп сильнее чужого `style`: он именованный и явный, а
        // переменная в `style` — способ обойти отсутствие пропа.
        style={
          labelWidth != null ? ({ ...style, "--form-label-w": labelWidth } as CSSProperties) : style
        }
        {...rest}
      />
    </FieldLayoutProvider>
  );
});

export type FieldRowProps = ComponentPropsWithoutRef<"div">;

/**
 * Поле во всю ширину раскладки: адрес, длинное описание, блок кнопок.
 *
 * `col-span-full`, а не `col-span-2`: строка обязана занимать столько колонок,
 * сколько их есть. Фиксированные две в одноколоночной раскладке создали бы
 * неявную вторую колонку — форма разъехалась бы там, где ничего не меняли.
 */
export const FieldRow = forwardRef<HTMLDivElement, FieldRowProps>(function FieldRow(
  { className, ...rest },
  ref
) {
  return <div ref={ref} className={cn("col-span-full", className)} {...rest} />;
});

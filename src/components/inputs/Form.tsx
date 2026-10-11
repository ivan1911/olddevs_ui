"use client";

import { forwardRef, type FormEvent, type ReactNode } from "react";
import { Form as AriaForm } from "react-aria-components";
import { cn } from "../../lib/cn.js";

export interface FormProps {
  /**
   * Вызывается при отправке формы; перезагрузка страницы уже отменена. Пока
   * идёт `pending`, не вызывается.
   */
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /**
   * Идёт отправка.
   *
   * Выключает форму целиком через `<fieldset disabled>`, а не перебором полей.
   * Перебор потребовал бы, чтобы форма знала свой состав, — а она его не знает
   * и не должна: поля приходят в `children`. Плюс родной `fieldset` выключает
   * и то, что появится позже, без единой строки кода.
   */
  pending?: boolean;
  /** Поля формы и кнопка отправки. */
  children?: ReactNode;
  /** Классы на элемент `form`. */
  className?: string;
}

/**
 * Обвязка формы: отправка и блокировка на время запроса.
 *
 * СВОЕЙ ВАЛИДАЦИИ НЕТ И НЕ БУДЕТ. Правила «название обязательно», «дата не
 * раньше сегодня», «канал должен быть подключён» — знание предметной области.
 * Кит, взявшийся их описывать, превратился бы в библиотеку форм, а его словарь
 * тонов и размеров к валидации отношения не имеет.
 *
 * ПРОПА `validationErrors` ЗДЕСЬ НЕТ, хотя react-aria его принимает, и это
 * решение, а не упущение. Он раздаёт ошибки полям через свой контекст — то
 * есть доходит до `Checkbox`, `CheckboxGroup`, `RadioGroup` и `NumberInput`,
 * но не до `TextControl` и `Select`: те в ките рукописные и контекста не
 * читают. Проп, который для половины полей формы не делает ничего и молча, —
 * хуже отсутствующего: потребитель узнал бы об этом на проде.
 *
 * Ошибки поэтому передаются явно, пропами, и это уже идиома пакета:
 * `FormField error`, `CheckboxGroup errorMessage`, `RadioGroup errorMessage`.
 * Один канал вместо двух, и компилятор видит оба конца.
 *
 * Что кит берёт на себя: показать ошибку в нужном месте, объявить её
 * скринридеру и не дать отправить форму дважды.
 *
 * `validationBehavior="aria"` — а не родное `native`. Браузерные пузырьки
 * появляются у первого невалидного поля, выглядят системно, не переводятся и
 * не поддаются стилизации; аккуратно оформленное сообщение под полем рядом с
 * таким пузырьком выглядит ошибкой вёрстки, а не решением.
 */
export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { onSubmit, pending, children, className },
  ref
) {
  return (
    <AriaForm
      ref={ref}
      onSubmit={(event) => {
        event.preventDefault();
        // Повторная отправка во время запроса отсекается здесь, а не только
        // выключением кнопки: Enter в текстовом поле отправляет форму мимо неё.
        if (pending) return;
        onSubmit(event);
      }}
      validationBehavior="aria"
      className={cn("flex flex-col gap-4", className)}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </AriaForm>
  );
});

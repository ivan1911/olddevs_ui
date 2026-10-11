"use client";

import { createContext, useContext } from "react";

/**
 * Идентификатор сообщения под полем — подсказки или ошибки, — чтобы поле могло
 * сослаться на него в `aria-describedby`.
 *
 * ЗАЧЕМ КОНТЕКСТ, А НЕ ПРОП. Сообщение рисует `FormField`, а поле лежит у него
 * в `children`: поставить атрибут на чужой узел снаружи нечем. `cloneElement`
 * ломается на любой обёртке — а поле обёрнуто почти всегда, хотя бы
 * `MaskedInput` в `TextControl`. Поэтому `id` придумывает тот, кто рисует
 * сообщение, а забирают его поля — тем же приёмом, что ось раскладки
 * (`FieldLayoutContext`) и режим навигации (`NavCollapsedContext`).
 *
 * ОТДЕЛЬНЫЙ МОДУЛЬ, А НЕ СТРОКА В `FormField.tsx`, по той же причине, по
 * которой отделён контекст `UiProvider`: иначе `TextControl` импортировал бы
 * `FormField`, то есть каждое голое поле тащило бы в бандл раскладку формы,
 * которая ему не нужна.
 *
 * Без `FormField` значение `undefined` — это законное состояние, а не ошибка:
 * поле бывает и вне формы, и описывать там нечего.
 */
const FieldDescriptionContext = createContext<string | undefined>(undefined);

/** @internal Ставит `FormField`, когда под полем есть подсказка или ошибка. */
export const FieldDescriptionProvider = FieldDescriptionContext.Provider;

/**
 * `id` сообщения под полем — для `aria-describedby`.
 *
 * @internal Читают поля кита. Потребителю не нужен: он передаёт полю свой
 * `aria-describedby` пропом, и поле сливает его с этим значением, а не
 * заменяет.
 */
export function useFieldDescribedBy(): string | undefined {
  return useContext(FieldDescriptionContext);
}

/**
 * Признак невалидности поля, объявленный `FormField`.
 *
 * Отдельный контекст рядом с описанием и по той же причине: ошибку рисует
 * `FormField`, а поле лежит у него в `children` — поставить `aria-invalid` на
 * чужой узел снаружи нечем.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ НУЖНО. `FIELD_SHELL_CLASS` красит рамку по
 * `has-[input[aria-invalid=true]]`, то есть дотягивается до атрибута НА САМОМ
 * ПОЛЕ. В контекст же уходило только описание, и поле атрибут не ставило:
 * `<FormField error="…"><TextControl/></FormField>` рисовал красный текст под
 * полем и обычную рамку у поля. Чтобы она покраснела, потребитель обязан был
 * передать `aria-invalid` сам — а строки `aria-invalid` нет ни в одном файле
 * `docs/`, то есть узнать об этой обязанности было неоткуда.
 */
const FieldInvalidContext = createContext(false);

/** @internal Ставит `FormField`, когда под полем есть ошибка. */
export const FieldInvalidProvider = FieldInvalidContext.Provider;

/**
 * Объявлено ли поле невалидным раскладкой формы.
 *
 * @internal Читают поля кита и сливают со своим пропом: явный `aria-invalid` от
 * потребителя сильнее — он знает про своё поле больше, чем форма.
 */
export function useFieldInvalid(): boolean {
  return useContext(FieldInvalidContext);
}

/**
 * Описание поля: СЛИЯНИЕ своего и того, что объявила форма.
 *
 * Вытеснение здесь ошибается в обе стороны, и обе встречались в ките:
 *
 * - спред `{...rest}` ПОСЛЕ условного — пользовательский `aria-describedby`
 *   затирал контекстный, и ошибка формы не объявлялась вовсе;
 * - спред ПЕРЕД условным — контекстный затирал пользовательский, и терялась
 *   подсказка потребителя.
 *
 * Склейка снимает вопрос порядка целиком: оба идентификатора попадают в
 * атрибут, скринридер читает оба. Приём был расписан в `TextControl` и
 * `TagInput`, но не вынесен — и пять компонентов, подключённых к контексту
 * позже, повторили его каждый по-своему.
 */
export function useDescribedBy(own?: string): string | undefined {
  const fromField = useContext(FieldDescriptionContext);
  /*
    Идентификаторы ещё и РАЗДВАИВАТЬСЯ не должны.

    Тот же `id` приходит дважды, когда библиотека спускает описание группы на
    свой внутренний узел, а мы добавляем его же (так делает `Slider`
    react-aria с бегунком). Скринридер прочитал бы подсказку два раза подряд.
  */
  const ids = `${own ?? ""} ${fromField ?? ""}`.trim().split(/\s+/).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}

/**
 * `id` подписи `FormField` — для полей, которые нельзя назвать через
 * `<label for>`.
 *
 * Браузер связывает `for` только с «labelable»-элементами (`input`, `textarea`,
 * `select`…); `contenteditable` к ним не относится, и безымянным он остаётся,
 * сколько ни проставляй `htmlFor`. Такое поле ссылается на подпись через
 * `aria-labelledby`, а `id` подписи придумывает тот, кто её рисует, — тем же
 * приёмом, что описание выше. Раньше поле искало подпись в DOM по `for` и
 * дописывало ей `id` само, то есть правило жило на чужом узле и ломалось от
 * любой обёртки между ними.
 *
 * Без `FormField` — `undefined`: подписи нет, поле называется своим
 * `aria-label`.
 */
const FieldLabelContext = createContext<string | undefined>(undefined);

/** @internal Ставит `FormField` всегда: подпись у него обязательна. */
export const FieldLabelProvider = FieldLabelContext.Provider;

/**
 * `id` подписи объемлющего `FormField`.
 *
 * @internal Читают поля, которые не называются через `<label for>`
 * (сейчас — `RichTextEditor`). Остальным хватает `htmlFor`.
 */
export function useFieldLabelId(): string | undefined {
  return useContext(FieldLabelContext);
}

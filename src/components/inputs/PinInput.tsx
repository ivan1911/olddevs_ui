"use client";

import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { useDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { FIELD_SHELL_CLASS } from "../../lib/field.js";

export interface PinInputProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children" | "defaultValue"
> {
  /** Введённый код. Значение уходит строкой, а не массивом: потребителю нужен код. */
  value: string;
  /** Вызывается при вводе, стирании и вставке и получает код целиком строкой. */
  onChange: (value: string) => void;
  /** Сколько полей. */
  length?: number;
  /**
   * Доступное имя группы. Обязательно и проверяется компилятором — как у
   * `SearchControl`: без него скринридер объявляет группу безымянной.
   */
  label: string;
  /** Выключает все поля кода. */
  disabled?: boolean;
  /** Ставит фокус в первое поле при появлении. */
  autoFocus?: boolean;
  /**
   * Показывает код в состоянии ошибки: рамки полей краснеют, на каждом поле
   * стоит `aria-invalid`. Внутри `FormField` с `error` признак берётся из формы,
   * явный `invalid={false}` его снимает. Правило проверки остаётся у потребителя.
   */
  invalid?: boolean;
}

/** Код — цифровой: всё, кроме цифр, отбрасывается на вводе и на вставке. */
const digitsOnly = (raw: string) => raw.replace(/\D/g, "");

/**
 * Ввод кода подтверждения: N полей по символу, наружу — одна строка.
 *
 * ЗНАЧЕНИЕ — СТРОКА, А НЕ МАССИВ. Потребителю нужен код целиком: он уходит в
 * запрос одной строкой, и разбирать массив на стороне вызова пришлось бы
 * каждому. Отсюда следствие, которое стоит знать заранее: **дыр в значении не
 * бывает.** Поля — это показ одного значения, а не N независимых, и удаление
 * символа в середине сдвигает остальные влево, как в обычном текстовом поле.
 *
 * ВСТАВКА ОБЯЗАТЕЛЬНА, А НЕ ЖЕЛАТЕЛЬНА. Код приходит из СМС целиком, и
 * пользователь вставляет его в первое поле; без разбора вставки он получил бы
 * одну цифру из шести. Браузер здесь не помогает: при `maxLength=1` он сам
 * обрезает вставленное до первого символа, поэтому событие перехватывается.
 *
 * `autocomplete="one-time-code"` стоит на ПЕРВОМ поле — так браузер и iOS
 * предлагают код из уведомления. На остальных он не нужен и мешал бы.
 *
 * КОД ЦИФРОВОЙ. `inputMode="numeric"` и `one-time-code` — про цифры, и фильтр
 * ввода здесь тот же. Буквенный код потребовал бы второй оси и правил
 * регистра; он придёт вместе с экраном, которому нужен, а не раньше.
 *
 * Каждое поле НАЗВАНО («цифра 3 из 6»): иначе скринридер читает шесть
 * безымянных полей подряд и место в коде теряется.
 */
export function PinInput({
  value,
  onChange,
  length = 6,
  label,
  disabled,
  autoFocus,
  invalid,
  className,
  ...rest
}: PinInputProps) {
  const messages = useMessages();
  /*
    Явный проп сильнее формы — как у `TextControl`: потребитель знает про своё
    поле больше, чем `FormField`. Без `aria-invalid` на самих полях оболочка не
    краснеет: `FIELD_SHELL_CLASS` ищет атрибут на `input`, а не на группе.
  */
  const fieldInvalid = useFieldInvalid();
  const ariaInvalid = invalid ?? (fieldInvalid || undefined);
  const describedBy = useDescribedBy((rest as { "aria-describedby"?: string })["aria-describedby"]);
  const fields = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusAt = (index: number) => {
    const target = fields.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const commit = (next: string, focus: number) => {
    onChange(next.slice(0, length));
    focusAt(focus);
  };

  const handleChange = (index: number, raw: string) => {
    const typed = digitsOnly(raw);
    const head = chars.slice(0, index).join("");
    const tail = chars.slice(index + 1).join("");

    if (typed === "") {
      // Пустая строка и «набрали не цифру» — РАЗНЫЕ события, и различать их
      // обязательно. Фокус выделяет содержимое поля, поэтому буква поверх
      // занятого поля приходит сюда как замена: не различая, компонент стирал
      // цифру за букву, которую даже не показал.
      if (raw !== "") return;
      // Поле очистили — символ уходит, остальные сдвигаются: значение одно.
      commit(head + tail, index);
      return;
    }
    commit(head + typed + tail, index + typed.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && chars[index] === "" && index > 0) {
      // Backspace на пустом поле — шаг назад с удалением: иначе фокус упирается
      // в пустое поле и стереть предыдущую цифру нечем.
      event.preventDefault();
      commit(chars.slice(0, index - 1).join("") + chars.slice(index).join(""), index - 1);
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusAt(index - 1);
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = digitsOnly(event.clipboardData.getData("text"));
    if (pasted === "") return;
    event.preventDefault();
    const head = chars.slice(0, index).join("");
    commit(head + pasted, index + pasted.length);
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex gap-2", className)}
      {...rest}
      /*
        ПОСЛЕ `{...rest}`: значение уже слито с пользовательским выше, и спред
        не должен его вытеснить. Раньше условный спред стоял ПЕРЕД `rest` —
        единственный такой в ките — и чужой `aria-describedby` затирал
        контекстный: поле кода внутри `<FormField error="…">` не объявляло
        ошибку вовсе.

        Подсказка `FormField` относится ко ВСЕЙ группе полей кода, а не к одной
        клетке: шесть `aria-describedby` на шести `input` прочитались бы шесть
        раз подряд.
      */
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
    >
      {chars.map((char, index) => (
        <div key={index} className={cn(FIELD_SHELL_CLASS, "w-10 px-0")}>
          <input
            ref={(node) => {
              fields.current[index] = node;
            }}
            value={char}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={messages.pinInput.digit({ index: index + 1, total: length })}
            maxLength={1}
            aria-invalid={ariaInvalid}
            data-disable-focus-ring="true"
            // Содержимое выделяется на фокусе: при `maxLength=1` набор поверх
            // занятого поля иначе не проходит вовсе — браузеру некуда писать.
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={
              "text-fg-0 w-full [appearance:none] border-0 bg-transparent px-0 py-[10px] " +
              "text-center text-[15px] leading-5 tabular-nums shadow-none outline-none " +
              "[-webkit-tap-highlight-color:transparent] focus:outline-none " +
              "focus-visible:outline-none disabled:cursor-not-allowed"
            }
          />
        </div>
      ))}
    </div>
  );
}

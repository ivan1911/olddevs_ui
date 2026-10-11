"use client";

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { HiddenIcon, VisibleIcon, WarningIcon } from "../../icons.js";
import { TextControl } from "./TextControl.js";

export interface PasswordInputProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "type" | "size"
> {
  /**
   * Подпись кнопки показа. Одна на оба состояния — состояние объявляет
   * `aria-pressed`.
   */
  toggleLabel?: string;
  /**
   * Показывает предупреждение, когда включён Caps Lock. По умолчанию включено.
   *
   * Предупреждение о включённом Caps Lock. Выключается пропом, потому что поле
   * пароля встречается и там, где подсказка неуместна, — например в диалоге
   * подтверждения из одного поля.
   */
  capsLockWarning?: boolean;
  /** Классы на оболочку с рамкой — ширина, скругление, внутренние отступы. */
  shellClassName?: string;
}

/**
 * Поле пароля: кнопка показа в слоте, предупреждение о Caps Lock под полем.
 *
 * СТОИТ НА `TextControl` СЛОТАМИ, а не на своей оболочке — прямой прецедент
 * `SearchControl` (ADR-0009). Рамка, фокус, выключенное и невалидное состояния
 * остаются у `TextControl`; своей рамки компонент не рисует вовсе, иначе
 * поле пароля фокусировалось бы не так, как соседнее поле в той же форме.
 *
 * ЧТО КОМПОНЕНТ ДОБАВЛЯЕТ СВЕРХ СЛОТА — ровно три вещи, и каждая есть причина
 * его существования:
 *
 * 1. **Переключение показа с сохранением каретки.** Смена `type` сбрасывает
 *    выделение в конец значения, и пользователь, открывший пароль посреди
 *    правки, терял место. Позиция снимается до переключения и возвращается
 *    после — без переноса фокуса: кнопку нажали намеренно, и увозить с неё
 *    фокус значит ломать повторное нажатие с клавиатуры.
 * 2. **Предупреждение о Caps Lock** — читается из `getModifierState` на
 *    клавиатурном событии, а не угадывается по регистру введённого: в поле
 *    пароля символов не видно, а «все заглавные» — законный пароль.
 * 3. **`autocomplete` пропом.** Значения по умолчанию нет намеренно: вход это
 *    или смена пароля, знает вызывающий, а кит — нет. Ставьте
 *    `autoComplete="current-password"` на входе и `"new-password"` в смене.
 *
 * У КНОПКИ ПОКАЗА `aria-pressed`, А ПОДПИСЬ ПОСТОЯННАЯ. Без признака
 * скринридер не сообщит, что пароль сейчас открыт на экране, — а это состояние
 * безопасности, а не украшение. Подпись при этом не меняется: кнопка, у
 * которой меняются и имя, и состояние, читается противоречиво («Скрыть
 * пароль, нажато»).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { toggleLabel, capsLockWarning = true, className, shellClassName, disabled, ...rest },
    ref
  ) {
    const messages = useMessages();
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
    const [visible, setVisible] = useState(false);
    const [capsLock, setCapsLock] = useState(false);
    // Позиция каретки живёт в `ref`, а не в состоянии: она нужна ровно один
    // раз, сразу после смены `type`, и лишний рендер ради неё не нужен.
    const caret = useRef<[number, number] | null>(null);

    useLayoutEffect(() => {
      const el = innerRef.current;
      const at = caret.current;
      caret.current = null;
      // `setSelectionRange` не переносит фокус — поле остаётся там, где было,
      // а нажатая кнопка не теряет своего.
      if (el && at) el.setSelectionRange(at[0], at[1]);
    }, [visible]);

    // Отслеживание Caps Lock заводится ЛЕНИВО: без предупреждения обработчики
    // не появляются вовсе, и поле остаётся тем же `TextControl` со слотом.
    const track = capsLockWarning
      ? {
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            setCapsLock(event.getModifierState("CapsLock"));
            rest.onKeyDown?.(event);
          },
          onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => {
            setCapsLock(event.getModifierState("CapsLock"));
            rest.onKeyUp?.(event);
          },
          onBlur: (event: FocusEvent<HTMLInputElement>) => {
            // Ушли из поля — предупреждение снимается: оно относится к вводу,
            // а не к состоянию клавиатуры вообще.
            setCapsLock(false);
            rest.onBlur?.(event);
          },
        }
      : {};

    const control = (
      <TextControl
        ref={innerRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={className}
        shellClassName={shellClassName}
        trailing={
          <button
            type="button"
            disabled={disabled}
            aria-pressed={visible}
            aria-label={toggleLabel ?? messages.passwordInput.toggle}
            onClick={() => {
              const el = innerRef.current;
              caret.current = el ? [el.selectionStart ?? 0, el.selectionEnd ?? 0] : null;
              setVisible((shown) => !shown);
            }}
            className={
              "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs " +
              "transition-colors " +
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
              "disabled:pointer-events-none disabled:opacity-50"
            }
          >
            {visible ? <VisibleIcon size={14} aria-hidden /> : <HiddenIcon size={14} aria-hidden />}
          </button>
        }
        {...rest}
        {...track}
      />
    );

    if (!capsLockWarning) return control;

    return (
      <div className="flex flex-col gap-1">
        {control}
        {/*
          Область объявляется ПУСТОЙ и существует всегда: живой регион,
          появившийся в разметке вместе со своим текстом, скринридер не
          объявляет — он обязан быть на месте до того, как текст в нём
          возникнет. `empty:hidden` убирает её из раскладки, пока текста нет.
        */}
        <p role="status" className="text-fg-2 flex items-center gap-1 text-[11px] empty:hidden">
          {capsLock ? (
            <>
              <WarningIcon size={12} aria-hidden />
              {messages.passwordInput.capsLock}
            </>
          ) : null}
        </p>
      </div>
    );
  }
);

"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TextControl } from "./TextControl.js";

export interface InlineEditProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange" | "children" | "defaultValue"
> {
  /** Подтверждённое значение. Компонент его не хранит. */
  value: string;
  /** Подтверждение правки. Вызывается, только когда значение изменилось. */
  onChange: (value: string) => void;
  /**
   * Доступное имя поля. Обязательно и проверяется компилятором: без него
   * правка по месту даёт поле без имени ровно в момент ввода. Имя кнопки
   * строится из значения и слова «изменить» из каталога сообщений.
   */
  label: string;
  /** Режим правки. Без пропа компонент ведёт его сам. */
  editing?: boolean;
  /** Вызывается при входе в режим правки и выходе из него и получает новое состояние. */
  onEditingChange?: (editing: boolean) => void;
  /** Что показать на кнопке, когда значение пустое. */
  placeholder?: string;
  /** Выключает правку: кнопка-значение не открывает поле. */
  disabled?: boolean;
}

/**
 * Правка значения по месту: кнопка-значение → поле → подтверждение.
 *
 * ПОДТВЕРЖДЁННОЕ ЗНАЧЕНИЕ НЕ ХРАНИТСЯ. Внутри живёт только черновик правки — то,
 * что набирают прямо сейчас; подтверждение уходит наружу, и следующим кадром
 * значение приходит пропом. Компонент, хранящий подтверждённое, показывал бы
 * своё после отказа сервера сохранить.
 *
 * ОТМЕНА ПО ESCAPE — ТРЕБОВАНИЕ, А НЕ УДОБСТВО. Без неё пользователь, начавший
 * править по ошибке, не может выйти, не сохранив: щелчок мимо подтверждает,
 * Enter подтверждает, и выхода без записи не остаётся.
 *
 * ФОКУС — ГЛАВНОЕ, ЧТО ЗДЕСЬ ЕСТЬ, и потому проверяется в живом браузере:
 *
 * - открытие ставит курсор в поле, а не оставляет его на кнопке — иначе
 *   пользователь клавиатуры открыл поле и печатает в никуда;
 * - Escape возвращает и значение, и фокус на кнопку;
 * - Enter подтверждает и тоже возвращает фокус на кнопку: поле исчезает, и без
 *   возврата фокус уезжает на `<body>`;
 * - щелчок мимо подтверждает и фокус НЕ забирает: пользователь ушёл туда,
 *   куда хотел.
 *
 * Режим правки можно вести снаружи (`editing` + `onEditingChange`) — так же,
 * как сворачивание у `SideNav`. Без пропа компонент ведёт его сам: три строки
 * состояния, повторённые каждым потребителем, — это не «состояние у
 * потребителя», а переписанный компонент.
 */
export function InlineEdit({
  value,
  onChange,
  label,
  editing,
  onEditingChange,
  placeholder,
  disabled,
  className,
  ...rest
}: InlineEditProps) {
  const messages = useMessages();
  const [uncontrolled, setUncontrolled] = useState(false);
  const isControlled = editing !== undefined;
  const open = isControlled ? editing : uncontrolled;

  const [draft, setDraft] = useState(value);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  // Возврат фокуса нужен НЕ всегда: после щелчка мимо забирать фокус обратно
  // значит уводить его оттуда, куда пользователь только что ушёл.
  const returnFocus = useRef(false);
  // Escape снимает режим сам, и вслед за ним не должно сработать подтверждение
  // по потере фокуса.
  const cancelling = useRef(false);

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    onEditingChange?.(next);
  };

  useLayoutEffect(() => {
    if (open) {
      /*
        Черновик берётся из значения на КАЖДОМ открытии, а не только в `start()`.

        `start()` — обработчик кнопки, и открытие снаружи (`editing` пропом —
        документированный сценарий: правка из меню строки) до него не доходило.
        В поле оставался черновик с монтирования: пришедшее с сервера значение
        не подхватывалось, а blur подтверждал устаревший текст поверх нового —
        тихий откат. Отменённый Escape'ом текст возвращался тем же путём.
      */
      setDraft(value);
      cancelling.current = false;
      /*
        Значение кладётся в DOM СИНХРОННО, до `select()`.

        `setDraft` — это запрос на рендер, а не запись: к моменту `select()` в
        поле ещё старый текст, и React дофлашивает новый сразу после эффекта,
        схлопывая выделение в конец. Видно это ровно в том сценарии, ради
        которого синхронизация и заводилась: открытие снаружи, когда значение
        успело смениться. В обычном пути (щелчок по кнопке) `setDraft` —
        no-op, рендера нет, и выделение случайно уцелевало.
      */
      if (fieldRef.current) fieldRef.current.value = value;
      fieldRef.current?.focus();
      fieldRef.current?.select();
      return;
    }
    if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
    // Зависимость ТОЛЬКО `open`, и это намеренно: правка значения снаружи при
    // уже открытой форме не должна затирать то, что пользователь набрал.
    // Эффект стреляет на переходе режима, а не на смене значения.
  }, [open]);

  const start = () => setOpen(true);

  const confirm = (withFocus: boolean) => {
    returnFocus.current = withFocus;
    setOpen(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    cancelling.current = true;
    returnFocus.current = true;
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      confirm(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <div className={cn("min-w-0", className)} {...rest}>
      {open ? (
        <TextControl
          ref={fieldRef}
          aria-label={label}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (cancelling.current) {
              cancelling.current = false;
              return;
            }
            confirm(false);
          }}
          shellClassName="w-full"
        />
      ) : (
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={start}
          className={
            "text-fg-0 rounded-control hover:bg-bg-2 flex w-full cursor-pointer items-center " +
            "px-2 py-[10px] text-left text-[13px] leading-5 transition-colors " +
            "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "disabled:cursor-not-allowed disabled:opacity-50"
          }
        >
          {value === "" ? (
            <span className="text-fg-3">{placeholder ?? messages.inlineEdit.empty}</span>
          ) : (
            value
          )}
          {/*
            Имя кнопки строится из содержимого: значение обязано быть в имени.
            `aria-label` вытеснил бы его, и скринридер объявлял бы «изменить
            название», не читая того, что там написано.
          */}
          <span className="sr-only">, {messages.inlineEdit.edit}</span>
        </button>
      )}
    </div>
  );
}

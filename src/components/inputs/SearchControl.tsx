"use client";

import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ChangeEvent,
} from "react";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CloseIcon, KeyboardIcon, SearchIcon } from "../../icons.js";
import { Keyboard, type KeyboardLayout, type KeyboardSelection } from "../content/Keyboard.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TextControl } from "./TextControl.js";

export interface SearchKeyboardConfig {
  /** Текущая раскладка управляется потребителем так же, как значение поиска. */
  layout: KeyboardLayout;
  /** Вызывается, когда пользователь переключает раскладку; сохранить новую должен потребитель. */
  onLayoutChange: (nextLayout: KeyboardLayout) => void;
  /** Открывает панель при первом рендере — для заранее раскрытого сценария. */
  defaultOpen?: boolean;
  /** Подтверждает запрос по Enter экранной клавиатуры. */
  onSubmit?: () => void;
  /**
   * Доступное имя кнопки, открывающей экранную клавиатуру. Без него берётся из
   * каталога сообщений.
   */
  triggerLabel?: string;
  /** Доступное имя панели экранной клавиатуры. Без него берётся из каталога сообщений. */
  keyboardLabel?: string;
}

export interface SearchControlProps extends Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "type" | "size" | "aria-label"
> {
  /** Текст запроса. Поле управляемое: значение хранит потребитель. */
  value: string;
  /**
   * Вызывается при изменении текста и получает строку.
   *
   * Отдаёт строку, а не событие. У поля поиска значение — это и есть смысл;
   * все пять рукописных копий во фронте первым делом доставали `e.target.value`.
   */
  onChange: (value: string) => void;
  /**
   * Доступное имя. Обязательно, и это проверяет компилятор — как у `Toggle`.
   *
   * Плейсхолдер именем не считается: он исчезает при первом же символе, и
   * скринридер остаётся с безымянным полем ровно тогда, когда в нём есть что
   * читать. Если нужен `aria-labelledby` — он проходит насквозь через `...rest`.
   */
  label: string;
  /** Кнопка очистки, когда в поле что-то есть. */
  clearable?: boolean;
  /** Доступное имя кнопки очистки. Без него берётся из каталога сообщений. */
  clearLabel?: string;
  /** Классы на оболочку с рамкой — ширина, скругление, вертикальные внутренние отступы. */
  shellClassName?: string;
  /**
   * Ступень высоты поля: `md` — 42 пикселя, `sm` — 36. Проброс в `TextControl`.
   *
   * Ступень живёт у него, а не здесь: поиск намеренно стоит на `TextControl`, и
   * своя высота у поиска означала бы второй способ считать её внутри самого
   * пакета — ровно то расхождение, ради которого `SearchControl` и заведён.
   */
  size?: "sm" | "md";
  /** Добавляет экранную клавиатуру; без этого пропса разметка поиска не меняется. */
  keyboard?: SearchKeyboardConfig;
}

/**
 * Поле поиска: лупа слева, крестик очистки справа.
 *
 * СТОИТ НА `TextControl`, А НЕ НА СВОЕЙ ОБОЛОЧКЕ — и это главное решение здесь.
 * Во фронте таких полей было пять рукописных (диалог смены категории, диалог
 * коллекций, пикер обоев, фильтр библиотеки, глобальный поиск в шапке), и все
 * пять красили фокус в `--tg`, тогда как обычные поля через `TextControl` —
 * в `--accent-strong`. То есть поиск во всём приложении фокусировался не так,
 * как остальные поля, и заметить это по коду было нельзя: расхождение видно
 * только если открыть пять файлов рядом. Собственная оболочка здесь означала
 * бы шестую копию — уже внутри пакета.
 *
 * ЧЕГО КОМПОНЕНТ НАМЕРЕННО НЕ ДЕЛАЕТ:
 *
 * — **Не перехватывает Escape.** Соблазнительно чистить поле по Escape, как
 *   это делает фильтр библиотеки. Но поиск чаще всего стоит внутри модального
 *   окна, а там Escape закрывает окно; перехват сломал бы закрытие ровно тогда,
 *   когда фокус в поиске, — то есть почти всегда. Кому нужна очистка по Escape,
 *   вешает `onKeyDown` сам: он проходит насквозь.
 *
 * — **Не откладывает вызовы.** Дебаунс зависит от того, что за поиском стоит:
 *   локальная фильтрация массива в диалоге не нуждается в задержке вовсе,
 *   запрос в API нуждается. Пакет этого не знает, а зашитая задержка не
 *   отключается ничем.
 *
 * ОЧИСТКА ВОЗВРАЩАЕТ ФОКУС В ПОЛЕ. Крестик при этом размонтируется, и без
 * явного возврата фокус уезжает на `<body>` — пользователь клавиатуры теряет
 * место в диалоге и начинает обход заново.
 */
export const SearchControl = forwardRef<HTMLInputElement, SearchControlProps>(
  function SearchControl(
    {
      value,
      onChange,
      label,
      clearable = true,
      clearLabel,
      placeholder,
      shellClassName,
      size,
      className,
      disabled,
      keyboard,
      onSelect,
      ...rest
    },
    ref
  ) {
    const messages = useMessages();
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);
    const [keyboardOpen, setKeyboardOpen] = useState(() => keyboard?.defaultOpen ?? false);
    const [selection, setSelection] = useState<KeyboardSelection>({
      start: value.length,
      end: value.length,
    });

    const showClear = clearable && value !== "" && !disabled;
    // Подпись раскладки берётся из ключа `keyboard.*`, а не пишется здесь
    // второй раз: до 2.0.0 эта же строка жила и в `Keyboard.tsx`, и две копии
    // разошлись бы молча.
    const keyboardLabel =
      keyboard?.keyboardLabel ??
      messages.keyboard.label({ layout: keyboard?.layout === "ru" ? "ru" : "en" });
    /*
      ЧУЖАЯ смена значения двигает позицию в конец.

      Позиция обновлялась по `onChange`, `onSelect` и `onPointerDown` у
      кнопки-триггера, то есть только при указательном взаимодействии.
      Пользователь клавиатуры доходил до кнопки табом и жал Enter —
      `pointerdown` не приходил, и позиция оставалась с монтирования, `{0,0}`.
      Значение при этом бывает непустым (восстановленный запрос), и первый же
      символ с экранной клавиатуры вставлялся в НАЧАЛО строки.

      Читать позицию из DOM вместо состояния НЕЛЬЗЯ: при наборе экранной
      клавиатурой фокус стоит на её кнопке, а не в поле, и каретка в DOM
      оказывается в конце — замена выделения ломается. Поэтому состояние
      остаётся источником правды, а синхронизация происходит только когда
      значение сменилось НЕ нами.
    */
    const ownValue = useRef<string | null>(null);
    useEffect(() => {
      if (ownValue.current === value) return;
      setSelection({ start: value.length, end: value.length });
    }, [value]);

    const emit = (next: string) => {
      ownValue.current = next;
      onChange(next);
    };

    const rememberSelection = (target: HTMLInputElement) => {
      setSelection({ start: target.selectionStart ?? 0, end: target.selectionEnd ?? 0 });
    };
    const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
      rememberSelection(event.currentTarget);
      onSelect?.(event);
    };

    const control = (
      <TextControl
        ref={innerRef}
        // `type="search"` даёт роль `searchbox` и поисковую клавиатуру на
        // телефоне. Родной крестик WebKit при этом убран классом ниже — иначе
        // в Safari очисток было бы две, рядом и разного вида.
        type="search"
        value={value}
        onChange={(event) => {
          emit(event.target.value);
          rememberSelection(event.currentTarget);
        }}
        onSelect={handleSelect}
        aria-label={label}
        placeholder={placeholder ?? messages.common.searchPlaceholder}
        disabled={disabled}
        icon={<SearchIcon size={14} aria-hidden />}
        trailing={
          keyboard || showClear ? (
            <div className="flex items-center gap-1">
              {keyboard ? (
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={keyboard.triggerLabel ?? messages.searchControl.openKeyboard}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (innerRef.current) rememberSelection(innerRef.current);
                    }}
                    className={cn(
                      "text-fg-3 hover:text-fg-0 hidden cursor-pointer items-center rounded-xs md:flex",
                      "transition-colors",
                      "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
                      "disabled:pointer-events-none disabled:opacity-50"
                    )}
                  >
                    <KeyboardIcon size={16} aria-hidden />
                  </button>
                </PopoverTrigger>
              ) : null}
              {showClear ? (
                <button
                  type="button"
                  aria-label={clearLabel ?? messages.searchControl.clear}
                  onClick={() => {
                    onChange("");
                    innerRef.current?.focus();
                  }}
                  className={cn(
                    "text-fg-3 hover:text-fg-0 flex cursor-pointer items-center rounded-xs",
                    "transition-colors",
                    "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2"
                  )}
                >
                  <CloseIcon size={14} aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null
        }
        shellClassName={shellClassName}
        size={size}
        className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
        {...rest}
      />
    );

    if (!keyboard) return control;

    return (
      <Popover open={keyboardOpen} onOpenChange={setKeyboardOpen}>
        {control}
        <PopoverContent
          aria-label={keyboardLabel}
          className="pointer-events-none w-auto max-w-[calc(100vw-2rem)] border-0 bg-transparent shadow-none"
          onClickCapture={(event) => {
            if (event.detail !== 0) innerRef.current?.focus();
          }}
          onFocusOutside={(event) => {
            if (event.target === innerRef.current) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <Keyboard
            value={value}
            selection={selection}
            onChange={emit}
            onSelectionChange={setSelection}
            layout={keyboard.layout}
            onLayoutChange={keyboard.onLayoutChange}
            onSubmit={keyboard.onSubmit}
            disabled={disabled}
            preserveFocus
            label={keyboardLabel}
            onRequestClose={() => setKeyboardOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  }
);

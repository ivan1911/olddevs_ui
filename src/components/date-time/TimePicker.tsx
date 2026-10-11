"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useFieldDescribedBy, useFieldInvalid } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { CheckIcon } from "../../icons.js";
import {
  formatTime12,
  maskTime,
  maskTime12,
  normalizeTime,
  normalizeTime12,
} from "../../lib/time.js";
import { Popover, PopoverAnchor, PopoverContent } from "../overlays/Popover.js";

export interface TimePickerProps {
  /** Время в формате `ЧЧ:ММ`. */
  value?: string | null;
  /** Вызывается со временем `ЧЧ:ММ`, когда ввод закончен (потеря фокуса, Enter) или выбран слот из списка. */
  onChange: (time: string) => void;
  /** Шаг слотов в минутах. Должен делить сутки нацело. */
  step?: number;
  /**
   * Часы поля и списка: `24` (умолчание, `14:30`) или `12` (`2:30 PM`). Влияет только на показ
   * и ввод: `value` и `onChange` остаются `ЧЧ:ММ`.
   */
  hourCycle?: 12 | 24;
  /** Блокирует поле, список слотов не открывается. */
  disabled?: boolean;
  /** Плейсхолдер в пустом поле; по умолчанию стандартная подпись кита. */
  placeholder?: string;
  /** Доступное имя поля и списка слотов; по умолчанию стандартная подпись кита. */
  "aria-label"?: string;
  /**
   * Показывает поле в состоянии ошибки: линия под временем краснеет, ставится
   * `aria-invalid`. Внутри `FormField` с `error` признак берётся из формы, явный
   * `invalid={false}` его снимает. Правило проверки остаётся у потребителя.
   */
  invalid?: boolean;
  /** Классы на поле ввода. */
  className?: string;
}

/**
 * Слоты суток с шагом `step` минут, начиная с первого строго после `now`,
 * дальше по кругу через полночь: в 14:07 список открывается с `14:30`,
 * в 23:45 — с `00:00`, ровно в 14:30 — с `15:00`.
 *
 * «Сейчас» — часы браузера, не зона сервера: пакет зоны не знает принципиально
 * (см. `timeZoneLabel` у `DateTimePicker`). Функция чистая и отвязана от
 * компонента, чтобы порядок проверялся тестами без рендера.
 */
/** Шаг по умолчанию — он же умолчание пропа. */
const DEFAULT_STEP = 30;

export function upcomingSlots(step: number, now: Date): string[] {
  /*
    Неположительный шаг ОТБРАСЫВАЕТСЯ на границе.

    Цикл ниже идёт `m += step`: при нуле он не завершается никогда, при
    отрицательном уходит в минус, и массив растёт до исчерпания памяти — то
    есть вкладка намертво виснет при первом же фокусе поля (`openList` зовётся
    из `onFocus`). Проп публичный и типизирован просто числом, а приходит он из
    настроек: `step={settings.slotMinutes}` с не пришедшей настройкой даёт ноль.
  */
  const safeStep = Number.isFinite(step) && step > 0 ? Math.floor(step) : DEFAULT_STEP;
  const all: string[] = [];
  for (let m = 0; m < 24 * 60; m += safeStep) {
    all.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const first = all.findIndex((_, i) => i * safeStep > nowMinutes);
  if (first <= 0) return all;
  return [...all.slice(first), ...all.slice(0, first)];
}

/**
 * Время: поле с маской + список слотов.
 *
 * Гибрид, а не «или пикер, или ввод»: печатать быстрее тем, кто знает точное
 * время, а список избавляет от попадания в цифры тех, кто выбирает «во сколько
 * примерно». Ручной ввод — прежний контракт поля из `DateTimePicker`: маска
 * на каждое нажатие, нормализация и `onChange` по уходу фокуса.
 *
 * Список — паттерн combobox с `aria-activedescendant`, а не roving focus как
 * в `Select`: фокус обязан оставаться в поле, потому что выбор из списка и
 * набор текста здесь одно действие, а не два режима.
 *
 * Набранный текст фильтрует слоты по префиксу («21» → 21:00, 21:30); фильтр —
 * только то, что напечатано после открытия, иначе уже выбранное значение
 * сворачивало бы список до самого себя. Пустой результат фильтра прячет
 * панель целиком: подсказать нечего, мешать вводу незачем.
 */
export function TimePicker({
  value,
  onChange,
  step = DEFAULT_STEP,
  hourCycle = 24,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  invalid,
  className,
}: TimePickerProps) {
  const messages = useMessages();
  // Подсказка и ошибка `FormField`, как у остальных полей кита; явный проп
  // `invalid` сильнее формы.
  const describedBy = useFieldDescribedBy();
  const fieldInvalid = useFieldInvalid();
  const ariaInvalid = invalid ?? (fieldInvalid || undefined);
  const twelve = hourCycle === 12;
  const labels = useMemo(
    () => ({ am: messages.timePicker.am, pm: messages.timePicker.pm }),
    [messages.timePicker.am, messages.timePicker.pm]
  );
  /** Как значение выглядит в поле и в списке: `14:30` либо `2:30 PM`. */
  const display = (time: string) =>
    twelve && /^\d{1,2}:\d{2}$/.test(time) ? formatTime12(time, labels) : time;
  const [inputTime, setInputTime] = useState(display(value ?? ""));
  const [open, setOpen] = useState(false);
  /** Что напечатано после открытия — по нему фильтруются слоты. */
  const [filter, setFilter] = useState("");
  /** Индекс подсвеченного слота; −1 — ничего, Enter коммитит набранное. */
  const [active, setActive] = useState(-1);

  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Порядок вычисляется на открытие, а не на рендер: список, в котором слоты
   * пересортировываются под курсором из-за тикнувших часов, выглядит сломанным.
   */
  const [slots, setSlots] = useState<string[]>([]);
  const openList = () => {
    if (disabled || open) return;
    setSlots(upcomingSlots(step, new Date()));
    setFilter("");
    setActive(-1);
    setOpen(true);
  };
  const closeList = () => {
    setOpen(false);
    setFilter("");
    setActive(-1);
  };

  const visible = useMemo(
    () =>
      filter
        ? slots.filter((s) =>
            twelve
              ? formatTime12(s, labels)
                  .toLowerCase()
                  // Ведущий ноль («02») не часть 12-часового показа («2:00 AM»).
                  .startsWith(filter.toLowerCase().replace(/^0+(?=\d)/, ""))
              : s.startsWith(filter)
          )
        : slots,
    [slots, filter, twelve, labels]
  );

  const commit = (next: string) => {
    setInputTime(display(next));
    if (next !== value) onChange(next);
  };

  /*
    Текст поля следует за `value` — но ПОСЛЕ ответа родителя, а не в момент
    потери фокуса.

    `commit` пишет в локальное состояние сразу, и если родитель значение
    отклонил (ограничил рабочими часами, подправил), проп не менялся, эффект
    по `[value]` не срабатывал, и в поле навсегда оставался отвергнутый текст.
    Первая починка звала синхронизацию прямо в `onBlur` — и затирала только что
    ПРИНЯТОЕ значение: проп там ещё старый, оба `setState` в одном батче, и
    побеждал второй. У неуправляемого вызова (`value` необязателен) поле после
    ввода просто пустело.

    Поэтому сверка живёт в эффекте и срабатывает, только когда правка кончилась:
    к тому моменту родитель либо прислал новый проп, либо не прислал — и тогда
    поле возвращается к принятому.
  */
  const [editing, setEditing] = useState(false);
  /*
    Сверка только у УПРАВЛЯЕМОГО поля. `value` необязателен, и при
    неуправляемом вызове «принятого значения» не существует вовсе — правдой
    остаётся собственный текст поля. Без этого условия набранное просто
    стиралось на потере фокуса.
  */
  const controlled = value !== undefined;
  useEffect(() => {
    if (editing || !controlled) return;
    setInputTime(display(value ?? ""));
  }, [value, editing, controlled, twelve, labels]);

  const selectSlot = (slot: string) => {
    commit(slot);
    closeList();
  };

  const commitTyped = () => {
    /*
      Пустой ввод при пустом значении НЕ коммитится.

      `normalizeTime("", value ?? "00:00")` на пустом значении отдавал `00:00`,
      и `next !== value` было истинно (`"00:00" !== null`): пользователь
      проходил форму табом, задев поле и ничего не напечатав, — и наружу
      прилетало `onChange("00:00")`. Форма становилась грязной, публикация
      уезжала на полночь, хотя время не выбирали.
    */
    if (inputTime.trim() === "" && !value) return;
    commit(
      twelve
        ? normalizeTime12(inputTime, value ?? "00:00", labels)
        : normalizeTime(inputTime, value ?? "00:00")
    );
  };

  const optionId = (slot: string) => `${listboxId}-${slot.replace(":", "")}`;

  // Подсвеченный слот держится в кадре при навигации стрелками.
  useEffect(() => {
    if (active < 0) return;
    const slot = visible[active];
    // `?.` на методе — jsdom в тестах его не реализует.
    if (slot) document.getElementById(optionId(slot))?.scrollIntoView?.({ block: "nearest" });
  }, [active, visible]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else if (visible.length > 0) setActive((a) => Math.min(a + 1, visible.length - 1));
        return;
      case "ArrowUp":
        if (!open) return;
        e.preventDefault();
        // Края не зацикливаются — как в списке `Select`.
        setActive((a) => Math.max(a - 1, 0));
        return;
      case "Enter":
        if (!open) return;
        e.preventDefault();
        if (active >= 0 && visible[active]) selectSlot(visible[active]);
        else {
          commitTyped();
          closeList();
        }
        return;
      case "Escape":
        // Закрывается здесь, а не силами Radix: фокус в поле, а не в панели,
        // и до слоя поповера событие не доходит.
        //
        // Всплытие не гасится: в диалоге Escape закроет и его — ровно как
        // у `Select`. Слой Radix слушает документ на перехвате, до нашего
        // обработчика, так что `stopPropagation` здесь ничего бы не изменил.
        if (!open) return;
        e.preventDefault();
        closeList();
        return;
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => (v ? openList() : closeList())}>
      <PopoverAnchor asChild>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          role="combobox"
          aria-label={ariaLabel ?? messages.timePicker.label}
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-activedescendant={
            open && active >= 0 && visible[active] ? optionId(visible[active]) : undefined
          }
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          aria-describedby={describedBy}
          placeholder={
            placeholder ??
            (twelve ? messages.timePicker.placeholder12 : messages.timePicker.placeholder)
          }
          maxLength={twelve ? 6 + Math.max(labels.am.length, labels.pm.length) : 5}
          value={inputTime}
          onClick={openList}
          onChange={(e) => {
            const masked = twelve
              ? maskTime12(e.target.value, labels, inputTime)
              : maskTime(e.target.value);
            setInputTime(masked);
            setFilter(masked);
            setActive(-1);
            if (!open) openList();
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setEditing(true);
            openList();
          }}
          onBlur={() => {
            // Правка кончилась. Сверку с принятым значением делает эффект по
            // `[value]`: здесь проп ещё старый, и синхронизация на месте
            // затирала бы только что принятое.
            setEditing(false);
            commitTyped();
            closeList();
          }}
          disabled={disabled}
          className={cn(
            twelve ? "w-[88px]" : "w-[60px]",
            "border-line-soft text-fg-2 hover:border-line hover:text-fg-1 placeholder:text-fg-4 cursor-text border-b bg-transparent pb-px font-mono text-[13px] transition-colors outline-none",
            "focus-visible:border-accent-strong disabled:cursor-not-allowed disabled:opacity-50",
            // Линия под временем и есть «рамка» поля; красная и в фокусе — как оболочка других полей.
            "aria-[invalid=true]:border-danger-strong",
            className
          )}
        />
      </PopoverAnchor>

      {visible.length > 0 ? (
        <PopoverContent
          className={twelve ? "w-[132px]" : "w-[96px]"}
          align="start"
          // Фокус остаётся в поле: панель — подсказка к вводу, а не отдельный шаг.
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // Немодальный поповер закрывает себя, когда фокус или клик «снаружи»
          // контента — а здесь фокус по определению снаружи: он в поле-якоре.
          // Без этих двух перехватов панель гаснет в момент открытия.
          onFocusOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target === inputRef.current) e.preventDefault();
          }}
          // Клик по слоту не должен уводить фокус из поля (и вызывать blur-коммит
          // раньше выбора) — гасим mousedown до того, как браузер переставит фокус.
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel ?? messages.timePicker.label}
            className="max-h-[240px] overflow-y-auto p-1"
          >
            {visible.map((slot, index) => {
              const isSelected = slot === value;
              return (
                <button
                  key={slot}
                  id={optionId(slot)}
                  type="button"
                  tabIndex={-1}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectSlot(slot)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2.5 py-[7px] text-left font-mono text-[13px] whitespace-nowrap tabular-nums transition-colors",
                    index === active && "bg-bg-2",
                    isSelected ? "bg-bg-3 text-fg-0" : "text-fg-1 hover:bg-bg-2"
                  )}
                >
                  {display(slot)}
                  {isSelected ? (
                    <CheckIcon size={14} aria-hidden className="text-accent-strong shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

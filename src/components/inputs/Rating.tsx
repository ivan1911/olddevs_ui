"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { RatingStarIcon } from "../../icons.js";
import { clamp } from "../../lib/clamp.js";
import type { Size } from "../../lib/variants.js";
import { useDescribedBy } from "../../hooks/useFieldDescription.js";
import { cn } from "../../lib/cn.js";

export interface RatingProps {
  /**
   * Оценка. Наружу и внутрь идёт число, а не набор звёзд: звёзды это способ
   * показать величину, а не сама величина.
   */
  value: number;
  /** Без него компонент только показывает оценку и в табуляцию не попадает. */
  onChange?: (value: number) => void;
  /**
   * Сколько звёзд всего.
   *
   * Меньше одной не бывает: шкала из нуля делений не шкала, а `max={0}` дал бы
   * радиогруппу без единой опции и подпись «из 0». Значение приводится, а не
   * запрещается типом: число приходит из данных потребителя, и падать на нём
   * компонент не должен.
   */
  max?: number;
  /**
   * Размер звезды: `sm` или `md`.
   *
   * Размер звезды. Крупнее `md` оценка не бывает: ряд из пяти звёзд в размере
   * `lg` занимает ширину поля ввода, а величину читают, а не рассматривают.
   */
  size?: Extract<Size, "sm" | "md">;
  /**
   * Показ без ввода: значение видно, но изменить его нельзя.
   *
   * Не то же, что `disabled`. Только для чтения — это показанные данные, и
   * гасить их значит прятать то, что показано специально; выключенный контрол —
   * это недоступное сейчас действие, и его приглушают.
   */
  readOnly?: boolean;
  /** Выключает ввод и приглушает звёзды. */
  disabled?: boolean;
  /** Подпись рядом: «4,2 · 128 оценок». Домен потребителя, кит её не считает. */
  caption?: string;
  /** Доступное имя. Обязательно: безымянная группа называется только по роли. */
  "aria-label": string;
  /** Классы на корневой элемент. */
  className?: string;
}

const STAR_SIZE = { sm: 14, md: 20 } as const;

/**
 * Оценка звёздами.
 *
 * КЛАВИАТУРНАЯ МОДЕЛЬ — РАДИОГРУППА, а не набор кнопок. Стрелки меняют
 * значение, `Home` и `End` уводят на края, а Tab выводит из группы целиком:
 * пять табстопов на один вопрос — это пять остановок там, где ответ один.
 * Роль `radiogroup` и берётся именно поэтому.
 *
 * ЗНАЧЕНИЕ ОБЪЯВЛЯЕТСЯ СЛОВАМИ. Цвет и число закрашенных звёзд — единственный
 * визуальный носитель величины, и без строки «Оценка 4 из 5» скринридер
 * прочитал бы пять одинаковых элементов. Строка приходит из каталога; склонения
 * ей не нужно — обе подстановки числовые и стоят перед предлогом.
 *
 * ЦВЕТ ЗВЕЗДЫ — СВОЙ ТОКЕН `--rating-star` компонентного слоя
 * (ADR-0040), а не
 * `--warning`. Сегодня они указывают на один и тот же янтарный примитив, и в
 * этом ловушка: правка цвета предупреждения молча перекрасила бы все оценки в
 * продукте, а причину искали бы здесь. Незакрашенная звезда берёт
 * `--fg-3` — она читается как «не выбрано», а не как «недоступно».
 *
 * ДРОБНЫХ ОЦЕНОК НЕТ, и это решение. Половина звезды нужна показу среднего
 * значения, а не вводу; показ среднего решается подписью («4,2 · 128 оценок»),
 * которая точнее половины звезды и не требует объяснять, что означает
 * закрашенная наполовину звезда при вводе.
 */
export function Rating({
  value,
  onChange,
  max = 5,
  size = "md",
  readOnly = false,
  disabled = false,
  caption,
  "aria-label": ariaLabel,
  className,
}: RatingProps) {
  const messages = useMessages();
  const describedBy = useDescribedBy(undefined);
  const groupId = useId();
  const textId = `${groupId}-text`;
  // Приведение обоих чисел до всякого использования: и `max`, и `value`
  // приходят из данных потребителя, а тип у них — обычное число.
  const total = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : 5;
  const stars = Array.from({ length: total }, (_, index) => index + 1);
  const starRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Роль — свойство контрола, а не его доступности прямо сейчас. Выключенная
  // оценка остаётся радиогруппой и помечается `aria-disabled`: `role="img"`
  // прочитался бы как картинка, а не как недоступное действие.
  const isGroup = onChange !== undefined && !readOnly;
  const editable = isGroup && !disabled;

  // Роуминг табиндекса: в табуляции ровно одна звезда — выбранная, а при
  // нулевой оценке первая. Без него группа объявлена радиогруппой, но
  // построена как ряд неинтерактивных элементов: стрелка меняла бы значение
  // молча, потому что фокус остаётся на контейнере, чьё имя не меняется.
  // Округление обязательно: звёзды целые, и дробное значение не совпадало бы ни
  // с одной из них — тогда роуминг не ставит табстоп никуда, и радиогруппа
  // становится недостижимой с клавиатуры целиком. Дробное `value` тип
  // разрешает, а закраску компонент от него принимает (`star <= 4.2` даёт
  // четыре звезды), так что запретить его молча нельзя — надо выдержать.
  const rounded = Number.isFinite(value) ? Math.round(value) : 0;
  const active = rounded >= 1 && rounded <= total ? rounded : 1;

  function pick(next: number) {
    if (!editable || !onChange) return;
    const clamped = clamp(next, 0, total);
    // Молчим, когда сообщать нечего: стрелка у края и щелчок по уже выбранной
    // звезде значения не меняют, а событие без изменения читается адресатом как
    // правка.
    if (clamped === rounded) return;
    onChange(clamped);
    // Фокус идёт за значением: иначе следующая стрелка отсчитывала бы от
    // прежней звезды, а объявлено было бы новое значение.
    starRefs.current[Math.max(clamped, 1) - 1]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!editable) return;
    const back = event.key === "ArrowLeft" || event.key === "ArrowDown";
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    const home = event.key === "Home";
    const end = event.key === "End";
    if (!back && !forward && !home && !end) return;
    event.preventDefault();
    // `Home` уводит на ноль, а не на единицу: ноль объявлен законным значением,
    // и нижний край группы — это он.
    if (home) return pick(0);
    /*
      `total` и `rounded`, а НЕ сырые `max` и `value`.

      Файл приводит оба числа выше и объявляет это правилом — а здесь считал от
      пропов. `max={NaN}` давал `pick(NaN)`, и `clamp(NaN, …)` тоже `NaN`:
      проверка «значение не изменилось» на нём ложна, и наружу уходило
      `onChange(NaN)` — оценка потребителя портилась навсегда. `max={0}` давал
      `pick(0)`, то есть НОЛЬ вместо верхнего края шкалы. А шаг от дробного
      `value` выносил `5.2` за пятизвёздочную шкалу и не переносил фокус:
      индекс `starRefs` по дробному числу — `undefined`.
    */
    if (end) return pick(total);
    pick(rounded + (forward ? 1 : -1));
  }

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <div
        role={isGroup ? "radiogroup" : "img"}
        // Имя СКЛЕИВАЕТСЯ из подписи потребителя и величины, а не подменяется
        // ею: «Оценка 4 из 5» без предмета — величина без ответа на вопрос
        // «чего».
        aria-labelledby={`${groupId}-label ${textId}`}
        {...(describedBy ? { "aria-describedby": describedBy } : {})}
        aria-disabled={isGroup && disabled ? true : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex items-center rounded-sm",
          size === "sm" ? "gap-0.5" : "gap-1",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span id={`${groupId}-label`} className="sr-only">
          {ariaLabel}
        </span>

        {stars.map((star) => (
          <span
            key={star}
            ref={(node) => {
              starRefs.current[star - 1] = node;
            }}
            role={isGroup ? "radio" : undefined}
            // От `rounded`, как закраска и роуминг: на дробном `value` сравнение с
            // сырым числом не совпадало ни с одной звездой, и радиогруппа
            // объявлялась без выбранного варианта.
            aria-checked={isGroup ? star === rounded : undefined}
            aria-label={isGroup ? messages.rating.star({ index: star, total }) : undefined}
            tabIndex={editable ? (star === active ? 0 : -1) : undefined}
            onClick={editable ? () => pick(star) : undefined}
            className={cn(
              "inline-flex shrink-0 items-center rounded-sm outline-none",
              editable && "cursor-pointer",
              // Кольцо фокуса — общий приём кита, а не состояние React:
              // `:focus-visible` для того и существует, чтобы не рисовать
              // кольцо по клику мышью.
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2",
              star <= rounded ? "text-rating-star" : "text-fg-3"
            )}
          >
            <RatingStarIcon
              size={STAR_SIZE[size]}
              aria-hidden
              fill={star <= rounded ? "currentColor" : "none"}
            />
          </span>
        ))}
      </div>

      {/*
        Величина словами. Входит в имя группы через `aria-labelledby` — и в
        интерактивном режиме тоже: без неё стрелка меняла бы `aria-checked` на
        элементе, а вслух не звучало бы ничего.
      */}
      <span id={textId} className="sr-only">
        {messages.rating.value({ value: rounded, total })}
      </span>

      {caption ? <span className="text-fg-2 text-caption">{caption}</span> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, type Key } from "react-aria-components";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import type { Size, Tone } from "../../lib/variants.js";

export interface ToggleGroupOption {
  /** Ключ переключателя: по нему набор выбранных попадает в `value` и в `onChange`. */
  id: Key;
  /** Подпись переключателя. Без неё кнопка квадратная, и нужен `aria-label`. */
  label?: ReactNode;
  /** Иконка перед подписью. */
  icon?: ReactNode;
  /** Доступное имя, когда подписи нет. */
  "aria-label"?: string;
  /** Гасит один переключатель; остальные остаются рабочими. */
  disabled?: boolean;
}

export interface ToggleGroupProps {
  /** Переключатели по порядку. */
  options: ToggleGroupOption[];
  /** Ключи (`id`) выбранных переключателей: группа управляемая, своего состояния не держит. */
  value: Key[];
  /** Вызывается с полным новым набором ключей выбранных переключателей. */
  onChange: (value: Key[]) => void;
  /**
   * Сколько можно выбрать одновременно.
   *
   * `multiple` — то, ради чего компонент и существует: `Segmented` умеет
   * ровно один выбранный, потому что это переключатель режима — «список или
   * плитка», «день, неделя, месяц». Здесь же выбирают НАБОР: фильтр по
   * нескольким статусам, включённые типы уведомлений.
   *
   * `single` оставлен не для симметрии, а для случая «один или ни одного»:
   * у `Segmented` снять выбор нельзя вовсе, а фильтр обязан сниматься.
   */
  selectionMode?: "multiple" | "single";
  /** Размер кнопок: `sm` или `md`. По умолчанию `md`. */
  size?: Extract<Size, "sm" | "md">;
  /** Тон выбранных переключателей; невыбранные всегда нейтральны. По умолчанию `accent`. */
  tone?: Tone;
  /** Гасит всю группу разом. */
  disabled?: boolean;
  /** Классы на контейнер группы. */
  className?: string;
  /** Доступное имя группы. */
  "aria-label"?: string;
}

/**
 * Группа переключателей: выбирается набор, а не режим.
 *
 * ЧЕМ ОТЛИЧАЕТСЯ ОТ `Segmented` — множественностью, и это единственное
 * отличие, ради которого стоит держать два компонента:
 *
 *   `Segmented`   — ровно один выбранный, снять нельзя. Переключатель режима:
 *                   «список / плитка», «день / неделя / месяц». Выбранное
 *                   значение всегда есть, потому что режим есть всегда.
 *   `ToggleGroup` — набор от нуля до всех. Фильтр по статусам, включённые
 *                   типы уведомлений. Пустой набор — законное состояние.
 *
 * Свести их в один компонент с пропом `multiple` мешает не техника, а смысл:
 * у режима не бывает «ничего не выбрано», и общий компонент пришлось бы учить
 * состоянию, которое для половины его применений — ошибка.
 */
export function ToggleGroup({
  options,
  value,
  onChange,
  selectionMode = "multiple",
  size = "md",
  tone = "accent",
  disabled,
  className,
  ...rest
}: ToggleGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  /*
    Внутри `Toolbar` группа с несколькими выбранными получает роль `group`, а
    от хука панели — `aria-orientation`. Для `group` этот атрибут недопустим, и
    axe роняет его как `critical` (`aria-allowed-attr`); react-aria так отдаёт
    сам, поэтому лишнее снимается здесь. Роль выставляется уже после первого
    рендера (панель узнаёт о себе в layout-эффекте), так что следим за
    атрибутами, а не чистим один раз.
  */
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const strip = () => {
      if (group.getAttribute("role") === "group") group.removeAttribute("aria-orientation");
    };
    strip();
    const observer = new MutationObserver(strip);
    observer.observe(group, { attributes: true, attributeFilter: ["role", "aria-orientation"] });
    return () => observer.disconnect();
  }, []);

  return (
    <ToggleButtonGroup
      {...rest}
      ref={ref}
      selectionMode={selectionMode}
      selectedKeys={value}
      onSelectionChange={(keys) => onChange([...keys])}
      isDisabled={disabled}
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        // Ось приходит из `Toolbar` через контекст react-aria; сам по себе
        // компонент всегда горизонтален. В вертикальной панели группа встаёт
        // столбцом и не переносится: перенос столбца зависел бы от высоты.
        "data-[orientation=vertical]:flex-col data-[orientation=vertical]:flex-nowrap data-[orientation=vertical]:items-start",
        className
      )}
    >
      {options.map((option) => (
        <ToggleButton
          key={String(option.id)}
          id={option.id}
          isDisabled={option.disabled}
          aria-label={option["aria-label"]}
          className={({ isSelected }) =>
            cn(
              // Вид общий с кнопкой: выбранный переключатель — это `solid`
              // своего тона, невыбранный — `outline` нейтрального. Собирается
              // рендер-пропом, потому что вариант зависит от состояния целиком,
              // а не добавляет к нему класс.
              buttonClasses({
                variant: isSelected ? "solid" : "outline",
                tone: isSelected ? tone : "neutral",
                size,
                iconOnly: !hasContent(option.label),
              })
            )
          }
        >
          {option.icon}
          {hasContent(option.label) ? <span>{option.label}</span> : null}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

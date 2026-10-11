"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn.js";

export interface TabItem {
  /** Идентификатор вкладки; по нему сверяется `value` и строится `{id}-panel` для `aria-controls`. */
  id: string;
  /** Подпись вкладки. */
  label: string;
  /** Иконка слева от подписи; скрыта от скринридера. */
  icon?: ReactNode;
}

export interface TabsProps {
  /** Вкладки по порядку. */
  items: TabItem[];
  /** `id` активной вкладки. Компонент управляемый: состояние ведёт потребитель. */
  value: string;
  /** Вызывается с `id` вкладки при клике и при переходе стрелками, Home и End. */
  onChange: (id: string) => void;
  /**
   * `vertical` — сайдбар (колонка, стрелки ↑↓); `horizontal` — лента со
   * скроллом (стрелки ←→). Компонент рендерит только вкладки: панели, их
   * разметка и адаптив — забота потребителя.
   */
  orientation?: "vertical" | "horizontal";
  /** Дополнительные классы на ленту вкладок. */
  className?: string;
}

/**
 * Лента вкладок. Controlled-only: единственный потребитель и так держит
 * активную вкладку в своём стейте, uncontrolled-режим был бы кодом про запас.
 *
 * Выбор следует за фокусом (automatic activation): панели здесь рендерятся
 * мгновенно, ждать отдельного Enter после стрелки незачем. Фокус ходит по
 * roving tabindex — табом попадаешь только на активную вкладку, дальше
 * стрелками; края не зацикливаются, как везде в ките.
 *
 * `aria-controls` проставляется ТОЛЬКО выбранной вкладке и указывает на
 * `{id}-panel`. Потребители рендерят панель лишь для активной вкладки, и
 * ссылка с остальных указывала бы на отсутствующий в разметке элемент —
 * это невалидное значение атрибута, аудит axe роняет его как `critical`.
 * Спецификация такой пропуск допускает прямо для этого случая.
 *
 * Контейнер содержимого на стороне потребителя обязан иметь `id={`${value}-panel`}`
 * и `role="tabpanel"`.
 */
export function Tabs({ items, value, onChange, orientation = "horizontal", className }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const vertical = orientation === "vertical";

  const moveTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    const item = items[clamped];
    if (!item) return;
    tabRefs.current[clamped]?.focus();
    if (item.id !== value) onChange(item.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = items.findIndex((t) => t.id === value);
    const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";

    switch (e.key) {
      case prevKey:
        e.preventDefault();
        moveTo(current - 1);
        return;
      case nextKey:
        e.preventDefault();
        moveTo(current + 1);
        return;
      case "Home":
        e.preventDefault();
        moveTo(0);
        return;
      case "End":
        e.preventDefault();
        moveTo(items.length - 1);
        return;
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(vertical ? "flex flex-col gap-px" : "flex gap-0.5 overflow-x-auto", className)}
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={selected ? `${item.id}-panel` : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "flex cursor-pointer items-center rounded-lg",
              vertical
                ? "gap-2.5 px-3 py-[9px] text-left text-[13px]"
                : "shrink-0 gap-1.5 px-3 py-1.5 text-[12px] whitespace-nowrap",
              "focus-visible:outline-accent-strong focus-visible:outline-2 focus-visible:-outline-offset-2",
              selected
                ? "border-line-soft bg-bg-2 text-fg-0 border font-semibold"
                : "text-fg-2 border border-transparent font-medium"
            )}
          >
            {item.icon ? (
              <span aria-hidden className={cn("flex", selected ? "text-accent" : "text-fg-3")}>
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

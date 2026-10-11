"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";
import { EMOJI_CATEGORIES, EMOJI_COLUMNS, EMOJI_SET, type Emoji } from "./emoji.js";

export interface EmojiGridProps {
  /** Эмодзи выбран: `Enter` или пробел в сетке, щелчок по ячейке. */
  onPick: (emoji: Emoji) => void;
  /**
   * Взять фокус при монтировании. Хозяину, у которого фокус ставит ловушка
   * (поповер Radix), — `false`: сетка, взявшая его раньше ловушки, внутри
   * `Dialog` теряет его обратно.
   */
  autoFocus?: boolean;
  className?: string;
}

/** Все эмодзи набора подряд, как их обходит клавиатура. */
const FLAT: readonly { emoji: Emoji; category: (typeof EMOJI_CATEGORIES)[number] }[] =
  EMOJI_CATEGORIES.flatMap((category) => EMOJI_SET[category].map((emoji) => ({ emoji, category })));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Сетка эмодзи: категории по порядку, в каждой — строки по десять.
 *
 * ARIA: ШАБЛОН GRID ИЗ APG, КАК У `TableSizeGrid`. `role="grid"` — группы строк
 * (`rowgroup`, по одной на категорию, с именем категории), строки (`row`) и
 * ячейки (`gridcell`); фокус остаётся на самой сетке, а текущую ячейку называет
 * `aria-activedescendant`. Roving tabindex отвергнут по той же причине: ячеек
 * восемьдесят, и Tab, проходящий по каждой, — это восемьдесят остановок вместо
 * одной. Стрелки двигают выбор на ячейку и на строку, `Home` и `End` — по
 * строке (с `Ctrl` — в углы сетки), `Enter` и пробел вставляют. `Escape` сетка
 * не слушает: закрывает поповер Radix, а вместе с ним — стек слоёв (ADR-0041).
 *
 * ИМЯ ЯЧЕЙКИ — СЛОВАМИ. Символ эмодзи скринридеры читают по-разному, а то и
 * молчат, поэтому имя ячейки — из каталога сообщений (`emojiName`), а сам
 * символ только рисуется. Подпись категории видна глазу, а слуху её читает
 * имя группы строк: дубль в дереве доступности был бы шумом.
 *
 * ОДИН ЭМОДЗИ В ДВУХ КАТЕГОРИЯХ — ДВЕ ЯЧЕЙКИ. Идентификатор ячейки берётся по
 * её месту в сетке, а не по имени: «Избранное» повторяет часть остальных.
 */
export function EmojiGrid({ onPick, autoFocus = true, className }: EmojiGridProps) {
  const messages = useMessages().editor;
  const id = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (autoFocus) gridRef.current?.focus();
  }, [autoFocus]);

  // Активная ячейка не уходит из виду, когда сетка прокручивается стрелками.
  const activeId = `${id}-${active}`;
  useEffect(() => {
    const node = document.getElementById(activeId);
    // В jsdom метода нет; в браузере он есть всегда.
    node?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const last = FLAT.length - 1;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter, которым IME подтверждает слово, и сочетания с Alt и Meta — не наши.
    if (event.nativeEvent.isComposing || event.altKey || event.metaKey) return;
    const rowStart = active - (active % EMOJI_COLUMNS);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = active + 1;
        break;
      case "ArrowLeft":
        next = active - 1;
        break;
      case "ArrowDown":
        next = active + EMOJI_COLUMNS;
        break;
      case "ArrowUp":
        next = active - EMOJI_COLUMNS;
        break;
      case "Home":
        next = event.ctrlKey ? 0 : rowStart;
        break;
      case "End":
        next = event.ctrlKey ? last : rowStart + EMOJI_COLUMNS - 1;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onPick(FLAT[active]!.emoji);
        return;
      default:
        return;
    }
    event.preventDefault();
    setActive(clamp(next, 0, last));
  };

  let index = 0;
  return (
    <div
      ref={gridRef}
      role="grid"
      tabIndex={0}
      aria-label={messages.emojiGrid}
      aria-activedescendant={activeId}
      onKeyDown={onKeyDown}
      className={cn(
        "focus-visible:ring-focus flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xs p-1",
        "outline-none focus-visible:ring-2",
        className
      )}
    >
      {EMOJI_CATEGORIES.map((category) => {
        const items = EMOJI_SET[category];
        const rows = Array.from({ length: items.length / EMOJI_COLUMNS }, (_, row) =>
          items.slice(row * EMOJI_COLUMNS, (row + 1) * EMOJI_COLUMNS)
        );
        const label = messages.emojiCategory[category];
        return (
          <div key={category} role="rowgroup" aria-label={label} className="flex flex-col gap-0.5">
            <div aria-hidden="true" className="text-fg-2 text-caption px-1 font-medium">
              {label}
            </div>
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} role="row" className="flex gap-0.5">
                {row.map((emoji) => {
                  const position = index++;
                  const name = messages.emojiName[emoji.name];
                  return (
                    <div
                      key={position}
                      id={`${id}-${position}`}
                      role="gridcell"
                      aria-selected={position === active}
                      aria-label={name}
                      title={name}
                      onMouseEnter={() => setActive(position)}
                      onClick={() => onPick(emoji)}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-xs",
                        "text-lg leading-none select-none",
                        position === active ? "bg-accent-soft" : "hover:bg-bg-2"
                      )}
                    >
                      <span aria-hidden="true">{emoji.char}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

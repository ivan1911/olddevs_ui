"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Button } from "../../../components/actions/Button.js";
import { NumberInput } from "../../../components/inputs/NumberInput.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";

/** Размер таблицы в столбцах и строках. */
export interface TableSize {
  cols: number;
  rows: number;
}

export interface TableSizeGridProps {
  /** С какого размера открыться; по умолчанию 3×3. */
  initial?: TableSize;
  /** Наибольшая сторона сетки в ячейках; по умолчанию 10. */
  max?: number;
  /**
   * Числовые поля «Столбцы» и «Строки» с кнопкой «Вставить» под сеткой — для
   * таблиц больше сетки. Значения — пределы полей. Нет — только сетка.
   */
  fields?: { maxCols: number; maxRows: number };
  /** Размер выбран: `Enter` в сетке, щелчок по ячейке, «Вставить». */
  onPick: (cols: number, rows: number) => void;
  /** `Escape` в сетке. Закрывать ли хозяина — решает он сам. */
  onCancel?: () => void;
  /** Взять фокус при монтировании. Хозяину, который ставит его сам, — `false`. */
  autoFocus?: boolean;
  className?: string;
}

/** Сетка не уже этого, пока выбор мал: пустые ячейки показывают, куда расти. */
const MIN_VISIBLE = 5;
const DEFAULT_MAX = 10;
const DEFAULT_SIZE: TableSize = { cols: 3, rows: 3 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Сетка выбора размера таблицы: пять на пять ячеек, растёт до десяти на десять.
 *
 * РОСТ. Сторона сетки — выбранный размер плюс одна ячейка запаса (не меньше
 * пяти и не больше `max`): дошли до края — появилась следующая, ушли назад —
 * сетка сжалась. Пустые ячейки за выбором — то, ради чего сетка рисуется:
 * она показывает, что можно взять больше.
 *
 * ARIA: ШАБЛОН GRID ИЗ APG. `role="grid"` — строки (`row`) и ячейки (`gridcell`);
 * фокус остаётся на самой сетке, а текущую ячейку называет
 * `aria-activedescendant`, как у списков кита. Roving tabindex отвергнут: ячеек
 * до ста, и Tab, проходящий по каждой, — это сто остановок вместо одной. Стрелки
 * двигают выбор и растят сетку, `Home` и `End` — по строке (с `Ctrl` — в углы
 * сетки), `Enter` выбирает, `Escape` отменяет. `Tab` уходит дальше — к полям.
 *
 * ЧТО ВЫБРАНО — СЛОВАМИ. Имя ячейки и живая область (`role="status"`) читают
 * один текст: «3 столбца, 4 строки», склонение — по локали (`tableSize`).
 * Мышь не единственный путь: наведение лишь двигает тот же выбор, что стрелки.
 * Видимая подпись «3 × 4» скрыта от скринридера — она повторяет живую область.
 *
 * ПЕРВАЯ СТРОКА — ЗАГОЛОВОК. Вставка всегда делает первую строку из `th`, и
 * сетка это показывает: верхний ряд закрашен иначе и подчёркнут. Это подсказка
 * глазам, а не переключатель.
 *
 * ПОЛЯ — для таблиц больше сетки (до `fields.maxCols` × `fields.maxRows`).
 * Выбор один на сетку и поля: правка любого двигает другое. Пустое поле выбор
 * не меняет — «Вставить» берёт последний допустимый размер.
 *
 * ФОКУС НА МОНТИРОВАНИИ — на сетку, а в подменю react-aria (он закрывает меню,
 * если фокус уходит в первый же кадр) хозяин ставит его сам: `autoFocus={false}`
 * и `ref` на сетку.
 */
export const TableSizeGrid = forwardRef<HTMLDivElement, TableSizeGridProps>(function TableSizeGrid(
  {
    initial = DEFAULT_SIZE,
    max = DEFAULT_MAX,
    fields,
    onPick,
    onCancel,
    autoFocus = true,
    className,
  },
  ref
) {
  const messages = useMessages().editor;
  const id = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => gridRef.current!);
  const [size, setSize] = useState<TableSize>(() => ({
    cols: Math.max(1, initial.cols),
    rows: Math.max(1, initial.rows),
  }));
  // Поля хранят набранное, в том числе пустоту; выбор — только допустимое.
  const [draft, setDraft] = useState<{ cols: number | null; rows: number | null }>(size);

  useEffect(() => {
    if (autoFocus) gridRef.current?.focus();
  }, [autoFocus]);

  const visibleCols = clamp(size.cols + 1, MIN_VISIBLE, max);
  const visibleRows = clamp(size.rows + 1, MIN_VISIBLE, max);

  const choose = (next: TableSize) => {
    setSize(next);
    setDraft(next);
  };

  /** Шаг на одну ячейку. Выше `max` (число из поля) вниз — на сторону сетки. */
  const step = (value: number, delta: 1 | -1) =>
    delta > 0 ? Math.min(max, value + 1) : clamp(Math.min(value, max + 1) - 1, 1, max);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter, которым IME подтверждает слово, и сочетания с Alt и Meta — не наши.
    if (event.nativeEvent.isComposing || event.altKey || event.metaKey) return;
    const { cols, rows } = size;
    let next: TableSize | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = { cols: step(cols, 1), rows };
        break;
      case "ArrowLeft":
        next = { cols: step(cols, -1), rows };
        break;
      case "ArrowDown":
        next = { cols, rows: step(rows, 1) };
        break;
      case "ArrowUp":
        next = { cols, rows: step(rows, -1) };
        break;
      case "Home":
        next = { cols: 1, rows: event.ctrlKey ? 1 : rows };
        break;
      case "End":
        next = { cols: visibleCols, rows: event.ctrlKey ? visibleRows : rows };
        break;
      case "Enter":
        event.preventDefault();
        onPick(cols, rows);
        return;
      case "Escape":
        onCancel?.();
        return;
      default:
        return;
    }
    event.preventDefault();
    choose(next);
  };

  const activeId = `${id}-${Math.min(size.rows, visibleRows)}-${Math.min(size.cols, visibleCols)}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/*
        Фокус — на сетке, а не на ячейках: см. «ARIA» в описании. Обработчик
        клавиш — на ней же; ячейки только мышь.
      */}
      <div
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label={messages.tableGrid}
        aria-activedescendant={activeId}
        onKeyDown={onKeyDown}
        className="focus-visible:ring-focus flex w-fit flex-col gap-0.5 rounded-xs outline-none focus-visible:ring-2"
      >
        {Array.from({ length: visibleRows }, (_, rowIndex) => {
          const row = rowIndex + 1;
          return (
            <div
              key={row}
              role="row"
              data-header={row === 1 ? "true" : undefined}
              className="flex gap-0.5"
            >
              {Array.from({ length: visibleCols }, (_, colIndex) => {
                const col = colIndex + 1;
                const inside = col <= size.cols && row <= size.rows;
                return (
                  <div
                    key={col}
                    id={`${id}-${row}-${col}`}
                    role="gridcell"
                    aria-selected={inside}
                    aria-label={messages.tableSize({ cols: col, rows: row })}
                    onMouseEnter={() => choose({ cols: col, rows: row })}
                    onClick={() => onPick(col, row)}
                    className={cn(
                      "size-5 cursor-pointer rounded-xs border transition-colors",
                      inside ? "border-accent bg-accent-soft" : "border-line bg-bg-1",
                      // Заголовок — другой оттенок и плотное основание, а не цвет
                      // один: различие держится и без различения цветов.
                      row === 1 && !inside && "bg-bg-3",
                      row === 1 && "border-b-2"
                    )}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="text-fg-2 text-caption tabular-nums">
        {size.cols} × {size.rows}
      </div>
      {/* Живая область есть всегда: скринридер читает смену текста, а не появление узла. */}
      <div role="status" className="sr-only">
        {messages.tableSize(size)}
      </div>
      {fields && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label className="text-fg-2 text-caption flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true">{messages.tableColumns}</span>
              <NumberInput
                label={messages.tableColumns}
                value={draft.cols}
                onChange={(cols) => {
                  setDraft((current) => ({ ...current, cols }));
                  if (cols !== null) setSize((current) => ({ ...current, cols }));
                }}
                min={1}
                max={fields.maxCols}
                step={1}
                shellClassName="h-8"
              />
            </label>
            <label className="text-fg-2 text-caption flex min-w-0 flex-1 flex-col gap-1">
              <span aria-hidden="true">{messages.tableRows}</span>
              <NumberInput
                label={messages.tableRows}
                value={draft.rows}
                onChange={(rows) => {
                  setDraft((current) => ({ ...current, rows }));
                  if (rows !== null) setSize((current) => ({ ...current, rows }));
                }}
                min={1}
                max={fields.maxRows}
                step={1}
                shellClassName="h-8"
              />
            </label>
          </div>
          <Button
            type="button"
            size="sm"
            variant="solid"
            tone="accent"
            onClick={() => onPick(size.cols, size.rows)}
          >
            {messages.tableInsert}
          </Button>
        </div>
      )}
    </div>
  );
});

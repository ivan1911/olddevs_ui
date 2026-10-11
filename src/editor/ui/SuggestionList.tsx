"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, type ComponentType, type RefObject } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "../../components/overlays/Popover.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_SHORTCUT_CLASS,
  MENU_ITEM_TONE,
  MENU_PANEL_CLASS,
  MENU_SECTION_LABEL_CLASS,
} from "../../lib/menu.js";
import { keyGlyphs } from "../../components/content/Kbd.js";
import type { IconProps } from "../../icons.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

/** Нулевой прямоугольник: якорь, пока курсор на экране не найден. */
export function emptyRect(): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  };
}

/** Строка списка: иконка, подпись и необязательная подсказка (шорткат). */
export interface SuggestionRow {
  /** Ключ строки, уникальный во всём списке: из него собран `id` в DOM. */
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  /** Подсказка для глаз (Markdown или сочетание): имя строки — её подпись. */
  hint?: string;
}

/** Раздел списка; без `label` строки стоят без заголовка и без группы. */
export interface SuggestionGroup {
  id: string;
  label?: string;
  rows: readonly SuggestionRow[];
}

/** Виртуальный якорь списка — курсор в Документе. */
export interface SuggestionAnchor {
  getBoundingClientRect: () => DOMRect;
  readonly contextElement: Element | undefined;
}

export interface SuggestionListProps {
  open: boolean;
  /** Список закрыт снаружи (Escape из стека слоёв, щелчок мимо): сессию надо завершить. */
  onClose: () => void;
  anchorRef: RefObject<SuggestionAnchor>;
  editorRef: RefObject<Editor | null>;
  /** `id` корня списка: на него указывает `aria-controls` поля. */
  listboxId: string;
  /** Доступное имя списка. */
  label: string;
  groups: readonly SuggestionGroup[];
  /** Номер текущей строки сквозь все разделы. */
  active: number;
  onActivate: (position: number) => void;
  /** Строка выбрана щелчком; клавиатуру слушает поле. */
  onApply: (rowId: string) => void;
  /** Строка «ничего не найдено» — когда строк нет. */
  emptyText: string;
  /** Показывать ли её сейчас: ответ может ещё идти. */
  showEmpty: boolean;
}

/** Id строки в DOM — на него указывает `aria-activedescendant` поля. */
export const suggestionOptionId = (listboxId: string, rowId: string) => `${listboxId}-${rowId}`;

/**
 * Список подсказок у курсора — общий для Меню вставки «/» (`SlashMenu`) и
 * своих символов-триггеров (`TriggerMenu`, ADR-0064).
 *
 * ФОКУС ОСТАЁТСЯ В ПОЛЕ. Список — «всплывающая часть» поля по паттерну
 * комбобокса APG: поле указывает на список `aria-controls`, текущую строку —
 * `aria-activedescendant`, а стрелки и Enter слушает движок (`slashCommand.ts`)
 * и передаёт владельцу списка. Подробности и ПОЧЕМУ `Popover` КИТА — на
 * `useSlashMenu`.
 */
export function SuggestionList({
  open,
  onClose,
  anchorRef,
  editorRef,
  listboxId,
  label,
  groups,
  active,
  onActivate,
  onApply,
  emptyText,
  showEmpty,
}: SuggestionListProps) {
  const flat = groups.flatMap((group) => group.rows);
  const activeRowId = open ? flat[active]?.id : undefined;

  // Длинный список прокручивается за курсором стрелок. В jsdom прокрутки нет.
  useEffect(() => {
    if (!activeRowId) return;
    // Список — в портале документа Редактора, не обязательно глобального.
    const doc = editorRef.current?.view.dom.ownerDocument ?? document;
    const node = doc.getElementById(suggestionOptionId(listboxId, activeRowId));
    if (typeof node?.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
  });

  let index = 0;
  const renderRows = (rows: readonly SuggestionRow[]) =>
    rows.map((row) => {
      const position = index++;
      const selected = position === active;
      const Icon = row.icon;
      return (
        <div
          key={row.id}
          id={suggestionOptionId(listboxId, row.id)}
          role="option"
          aria-selected={selected}
          data-highlighted={selected || undefined}
          onMouseMove={() => {
            if (!selected) onActivate(position);
          }}
          onClick={() => onApply(row.id)}
          className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE.neutral)}
        >
          {Icon && (
            <span className={MENU_ITEM_ICON_CLASS}>
              <Icon size={14} aria-hidden />
            </span>
          )}
          <span className="truncate">{row.label}</span>
          {row.hint && (
            // Подсказка для глаз: имя строки — её подпись, без «##».
            <kbd aria-hidden="true" className={MENU_ITEM_SHORTCUT_CLASS}>
              {keyGlyphs(row.hint)}
            </kbd>
          )}
        </div>
      );
    });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        side="bottom"
        align="start"
        // Курсор движется при наборе и прокрутке, а виртуальный якорь о
        // своих сдвигах не сообщает: позиция пересчитывается каждый кадр,
        // пока список открыт.
        updatePositionStrategy="always"
        // Фокус остаётся в поле — в нём продолжается набор запроса.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // Поле — часть комбобокса, а не «снаружи» списка. Фокус, пришедший в
        // него при открытом списке (каретка, поставленная программно, возврат
        // в окно браузера), не повод закрывать список: Radix иначе считает это
        // уходом фокуса и снимает слой, а с ним — сессию.
        onFocusOutside={(event) => {
          const field = editorRef.current?.view.dom;
          if (field && event.target instanceof Node && field.contains(event.target)) {
            event.preventDefault();
          }
        }}
        className={cn(MENU_PANEL_CLASS, GLASS_MENU_CLASS, "max-h-80 w-64 overflow-y-auto")}
      >
        <div
          role="listbox"
          id={listboxId}
          aria-label={label}
          // Щелчок по строке не уводит фокус из поля: иначе набор оборвался бы.
          onMouseDown={(event) => event.preventDefault()}
        >
          {groups.map((group) => {
            if (group.rows.length === 0) return null;
            if (group.label === undefined) return renderRows(group.rows);
            const headerId = `${listboxId}-${group.id}`;
            return (
              <div key={group.id} role="group" aria-labelledby={headerId}>
                <div id={headerId} role="presentation" className={MENU_SECTION_LABEL_CLASS}>
                  {group.label}
                </div>
                {renderRows(group.rows)}
              </div>
            );
          })}
          {flat.length === 0 && showEmpty && (
            <div
              role="option"
              aria-selected={false}
              aria-disabled="true"
              className={cn(MENU_ITEM_CLASS, "text-fg-3 cursor-default")}
            >
              {emptyText}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

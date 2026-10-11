"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  useContext,
  useEffect,
  useRef,
  type Key,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  OverlayTriggerStateContext,
  Popover as AriaPopover,
  type OverlayTriggerState,
} from "react-aria-components";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "../../../components/overlays/Menu.js";
import { Tooltip } from "../../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../../i18n/useMessages.js";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDownIcon,
  DeleteIcon,
  HeaderRowIcon,
  InsertColumnLeftIcon,
  InsertColumnRightIcon,
  InsertRowAboveIcon,
  InsertRowBelowIcon,
  MergeCellsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SplitCellIcon,
  TableIcon,
} from "../../../icons.js";
import { cn } from "../../../lib/cn.js";
import { MENU_PANEL_CLASS } from "../../../lib/menu.js";
import { useLockableMenu } from "../../ui/lockableMenu.js";
import { insertTableOfSize } from "../../core/insertItems.js";
import {
  lastTableSize,
  rememberTableSize,
  runTableCommand,
  tableCommands,
  tableMenuState,
  type TableAction,
} from "./tableActions.js";
import { TableSizeGrid } from "./TableSizeGrid.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../../styles/glass.js";

export interface TableMenuButtonProps {
  editor: Editor;
  /** Поле выключено: кнопка видна, но не нажимается. */
  disabled: boolean;
  /** `aria-disabled`: в обходе стрелками, но меню не открывает (HTML-режим). */
  unavailable?: boolean;
  /**
   * Пункт «Вставить таблицу…»: окно с числовыми полями держит `RichTextEditor`,
   * а не Панель — плавающая Панель прячется, когда фокус уходит в окно. Нет —
   * пункта нет.
   */
  onInsertDialog?: () => void;
  /** Подпись сочетания — от Панели: она знает, Apple ли это. */
  shortcut: (keys: readonly string[]) => string;
}

/**
 * `Alt+↓` (`⌥↓`) — строка ниже (`addRowBelow` в `tables.ts`). Модификатор
 * Панель переводит сама (`alt` → `Alt` или `⌥`), клавиша идёт как есть.
 *
 * `aria-keyshortcuts` у пункта НЕТ: `MenuItem` кита (react-aria) пропускает на
 * DOM только известные ему атрибуты и этот отбрасывает. Сочетание видно в
 * подписи пункта (`kbd`) и названо в справочнике Редактора.
 */
const ROW_BELOW_KEYS = ["alt", "↓"] as const;

/** Ключи пунктов первого уровня, которые сами ничего не делают. */
const GRID_KEY = "insertGrid";
const DIALOG_KEY = "insertDialog";

/*
  Меню react-aria по умолчанию выбрасывает недоступный пункт из обхода
  стрелками. APG советует обратное — пункт остаётся, но `aria-disabled`: иначе
  стрелка перепрыгивает его молча, и непонятно, куда он делся. Состояние выбора
  react-stately умеет это (`disabledBehavior: "selection"`), а тип `Menu`
  проп не объявляет — отсюда приведение.
*/
const KEEP_DISABLED_IN_NAVIGATION = { disabledBehavior: "selection" } as object;

/*
  RAC ставит триггеру меню `aria-haspopup="true"`. По ARIA 1.2 это то же, что
  `menu`, но владелец попросил явное значение — оно и читается однозначнее.
*/
const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * Меню «Таблица» на Панели — одна кнопка на вставку и на действия, как у TinyMCE.
 *
 * ПОЧЕМУ ОДНА КНОПКА. Прежде их было две: «Таблица» (вставка 3×3) и «Действия
 * с таблицей», которая появлялась только в таблице. Кнопка, возникающая и
 * исчезающая вместе с кареткой, сдвигала остальные и меняла число остановок в
 * обходе Панели; размер таблицы при этом выбрать было негде. Теперь кнопка
 * есть всегда, а пункты, которым вне таблицы нечего делать, недоступны
 * (`aria-disabled`) и остаются в обходе стрелками.
 *
 * ПОЧЕМУ МЕНЮ НА ПАНЕЛИ, А НЕ ПЛАВАЮЩАЯ ПАНЕЛЬ У ТАБЛИЦЫ. Для клавиатуры у неё
 * есть вход: `Alt+F10` переводит фокус в Панель, это одна из её кнопок —
 * `Enter` или стрелка вниз открывают список, `→` — подменю, `←` и `Escape`
 * закрывают его. Курсор при уходе в Панель остаётся в ячейке, так что «строка
 * выше» относится к той строке, из которой пришли.
 *
 * СЕТКА РАЗМЕРА — ВТОРОЙ РЕБЁНОК `SubmenuTrigger`: голый поповер react-aria
 * вместо `Menu` (`GridSubmenu`). Внутри — не пункты, а `TableSizeGrid`.
 *
 * Меню управляемое (`isOpen`): выбор в сетке — не пункт меню, и закрыть меню
 * после него react-aria сам не знает.
 */
export function TableMenuButton({
  editor,
  disabled,
  unavailable = false,
  onInsertDialog,
  shortcut,
}: TableMenuButtonProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const menu = useLockableMenu(unavailable);
  const submenuPlacement = useSubmenuPlacement();
  const gridItemRef = useRef<HTMLDivElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => tableMenuState(current.state, locale),
  });

  const run = (key: Key) => {
    const action = String(key);
    if (action === DIALOG_KEY) {
      /*
        Фокус — в документ ДО окна: окно запоминает, кто был в фокусе при
        открытии, и при закрытии возвращает его туда — на каретку. Таймером,
        а не сразу: react-aria после `onAction` возвращает фокус нажатому
        пункту, и окно запомнило бы его — а к закрытию окна пункта уже нет.
        `view.focus()`, а не `commands.focus()`: тот ждёт ещё кадр.
      */
      setTimeout(() => {
        if (editor.isDestroyed) return;
        editor.view.focus();
        onInsertDialog?.();
      }, 0);
      return;
    }
    const commands = tableCommands(locale);
    if (action in commands) runTableCommand(editor, commands[action as TableAction]);
  };

  /*
    Фокус после выбора в сетке — в документ, но только когда подменю уже снято.
    Поповер сетки — диалог react-aria и держит фокус в себе: документ, взявший
    фокус раньше, тут же его отдаёт обратно сетке, а снятый поповер возвращает
    фокус кнопке «Таблица». Поэтому выбор только поднимает флаг, а фокус ставит
    `GridHost`, размонтируясь (`onClosed`): сетки в DOM уже нет, фокус ушёл в
    body, и react-aria, увидев его в документе, ничего не возвращает.
  */
  const picked = useRef(false);
  const pick = (cols: number, rows: number) => {
    rememberTableSize(editor, { cols, rows });
    insertTableOfSize(editor, cols, rows);
    picked.current = true;
    menu.close();
  };
  const gridClosed = () => {
    if (!picked.current) return;
    picked.current = false;
    if (!editor.isDestroyed) editor.view.focus();
  };

  const item = (action: TableAction, label: string, icon: ReactNode, keys?: readonly string[]) => (
    <MenuItem
      id={action}
      textValue={label}
      disabled={!state?.can[action]}
      icon={icon}
      shortcut={keys ? shortcut(keys) : undefined}
    >
      {label}
    </MenuItem>
  );

  /** Подменю — только в таблице; вне неё пункт недоступен и ничего не раскрывает. */
  const submenu = (id: string, label: string, children: ReactNode) =>
    state ? (
      <SubmenuTrigger>
        <MenuItem id={id} textValue={label}>
          {label}
        </MenuItem>
        <Menu
          aria-label={label}
          className={GLASS_MENU_CLASS}
          placement={submenuPlacement}
          offset={2}
          onAction={run}
          {...KEEP_DISABLED_IN_NAVIGATION}
        >
          {children}
        </Menu>
      </SubmenuTrigger>
    ) : (
      <MenuItem id={id} textValue={label} disabled>
        {label}
      </MenuItem>
    );

  return (
    <MenuTrigger {...menu.trigger}>
      {/* Подсказка — на обёртке: `Button` react-aria не отдаёт Radix обработчики наведения. */}
      <Tooltip content={messages.table}>
        <span className="inline-flex">
          <MenuButton
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={messages.table}
            icon={<TableIcon size={16} aria-hidden />}
            className="gap-0.5 px-1.5"
            {...HAS_POPUP_MENU}
            {...menu.button}
          >
            <ChevronDownIcon size={12} aria-hidden />
          </MenuButton>
        </span>
      </Tooltip>
      <Menu
        aria-label={messages.table}
        className={GLASS_MENU_CLASS}
        onAction={run}
        {...KEEP_DISABLED_IN_NAVIGATION}
      >
        <SubmenuTrigger>
          <MenuItem id={GRID_KEY} ref={gridItemRef} textValue={messages.table}>
            {messages.table}
          </MenuItem>
          <GridSubmenu
            side={submenuPlacement}
            initial={lastTableSize(editor)}
            onPick={pick}
            onClosed={gridClosed}
            triggerRef={gridItemRef}
            label={messages.tableGrid}
          />
        </SubmenuTrigger>
        {onInsertDialog && (
          <MenuItem id={DIALOG_KEY} textValue={messages.tableInsertDialog}>
            {messages.tableInsertDialog}
          </MenuItem>
        )}
        <MenuSeparator />
        {submenu(
          "cell",
          messages.tableCell,
          <>
            {item("mergeCells", messages.tableMergeCells, <MergeCellsIcon size={14} aria-hidden />)}
            {item("splitCell", messages.tableSplitCell, <SplitCellIcon size={14} aria-hidden />)}
          </>
        )}
        {submenu(
          "row",
          messages.tableRow,
          <>
            <MenuSection id="rows">
              {item(
                "addRowBefore",
                messages.tableAddRowBefore,
                <InsertRowAboveIcon size={14} aria-hidden />
              )}
              {item(
                "addRowAfter",
                messages.tableAddRowAfter,
                <InsertRowBelowIcon size={14} aria-hidden />,
                // То же действие с клавиатуры, из ячейки (`tables.ts`, `addRowBelow`).
                ROW_BELOW_KEYS
              )}
              {item("deleteRow", messages.tableDeleteRow, <DeleteIcon size={14} aria-hidden />)}
            </MenuSection>
            <MenuSeparator />
            {/* Пункт-переключатель по умолчанию меню не закрывает; здесь закрывает, как остальные. */}
            <MenuSection
              id="header"
              selectionMode="multiple"
              selectedKeys={state?.headerRow ? ["headerRow"] : []}
            >
              <MenuItem
                id="headerRow"
                textValue={messages.tableHeaderRow}
                disabled={!state?.can.headerRow}
                shouldCloseOnSelect
                icon={<HeaderRowIcon size={14} aria-hidden />}
              >
                {messages.tableHeaderRow}
              </MenuItem>
            </MenuSection>
          </>
        )}
        {submenu(
          "column",
          messages.tableColumn,
          <>
            <MenuSection id="columns">
              {item(
                "addColumnBefore",
                messages.tableAddColumnBefore,
                <InsertColumnLeftIcon size={14} aria-hidden />
              )}
              {item(
                "addColumnAfter",
                messages.tableAddColumnAfter,
                <InsertColumnRightIcon size={14} aria-hidden />
              )}
              {item(
                "deleteColumn",
                messages.tableDeleteColumn,
                <DeleteIcon size={14} aria-hidden />
              )}
            </MenuSection>
            <MenuSeparator />
            {/* Радиогруппа: отмечено выравнивание всего столбца; смешанный — ни одно. */}
            <MenuSection
              id="alignment"
              selectionMode="single"
              selectedKeys={state?.alignment ? [ALIGN_KEY[state.alignment]] : []}
            >
              {item("alignLeft", messages.tableAlignLeft, <AlignLeftIcon size={14} aria-hidden />)}
              {item(
                "alignCenter",
                messages.tableAlignCenter,
                <AlignCenterIcon size={14} aria-hidden />
              )}
              {item(
                "alignRight",
                messages.tableAlignRight,
                <AlignRightIcon size={14} aria-hidden />
              )}
            </MenuSection>
          </>
        )}
        <MenuSeparator />
        {submenu(
          "sort",
          messages.tableSort,
          /*
            Слитые ячейки — сортировка недоступна, и подменю говорит почему:
            подпись раздела читается скринридером при входе в группу, а не
            только видна глазу. Без неё два серых пункта выглядели бы сбоем.
          */
          <MenuSection id="sorting" label={state?.merged ? messages.tableSortMerged : undefined}>
            {item(
              "sortAscending",
              messages.tableSortAscending,
              <SortAscendingIcon size={14} aria-hidden />
            )}
            {item(
              "sortDescending",
              messages.tableSortDescending,
              <SortDescendingIcon size={14} aria-hidden />
            )}
          </MenuSection>
        )}
        <MenuSeparator />
        <MenuItem
          id="deleteTable"
          textValue={messages.tableDelete}
          disabled={!state?.can.deleteTable}
          tone="danger"
        >
          {messages.tableDelete}
        </MenuItem>
      </Menu>
    </MenuTrigger>
  );
}

const ALIGN_KEY = { left: "alignLeft", center: "alignCenter", right: "alignRight" } as const;

/**
 * Подменю «Таблица ›»: поповер react-aria с сеткой размера.
 *
 * ПОПОВЕР react-aria, А НЕ `Popover` КИТА. `SubmenuTrigger` ждёт вторым
 * ребёнком именно его: через контекст он получает место у пункта, слой и
 * состояние подменю. Вид — тот же `MENU_PANEL_CLASS`, что у панели `Menu`.
 *
 * ФОКУС — ПОСЛЕ ТОГО, КАК ПОДМЕНЮ ВСТАЛО, и по сигналу самого поповера, а не
 * по часам. Открытое с клавиатуры (`→`, `Enter`) подменю ждёт фокуса внутри, но
 * сетка, взявшая его при монтировании — ещё в том же `keydown`, до того как
 * поповер получил место, — ломает меню: в окне (`Dialog`) оно после выбора
 * оставалось в DOM, и следующее открытие отдавало фокус `body`. Раньше фокус
 * откладывался таймером на 50 мс — это гонка: число ничего не гарантирует
 * медленному устройству и зря ждёт на быстром. Теперь поповер сам сообщает, что встал:
 * рендер-пропсы `placement` (место посчитано, у панели есть `data-placement`)
 * и `isEntering` (анимация входа доиграна — react-aria ждёт её `finished`),
 * и фокус ставится эффектом, когда оба готовы. Только при открытии с
 * клавиатуры — мышью сетку двигают наведением, и фокус остаётся у пункта.
 *
 * КЛАВИШИ. Стрелки и `Home`/`End` принадлежат сетке и дальше не идут: меню
 * под ней ответило бы на них своим обходом. `Escape` закрывает только подменю
 * и возвращает фокус на пункт «Таблица» — слой за слоем (ADR-0041); `←` в
 * сетке двигает выбор, а не закрывает подменю: у сетки это её ось.
 */
function GridSubmenu({
  side,
  initial,
  onPick,
  onClosed,
  triggerRef,
  label,
}: {
  /** Место у пункта — `useSubmenuPlacement`: на телефоне под ним. */
  side: "bottom start" | "right top";
  initial: { cols: number; rows: number };
  onPick: (cols: number, rows: number) => void;
  onClosed: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
  label: string;
}) {
  return (
    <AriaPopover
      aria-label={label}
      placement={side}
      offset={2}
      className={cn(MENU_PANEL_CLASS, GLASS_MENU_CLASS, "p-2")}
    >
      {({ placement, isEntering }) => (
        <GridHost
          initial={initial}
          onPick={onPick}
          onClosed={onClosed}
          triggerRef={triggerRef}
          settled={placement != null && !isEntering}
        />
      )}
    </AriaPopover>
  );
}

function GridHost({
  initial,
  onPick,
  onClosed,
  triggerRef,
  settled,
}: {
  initial: { cols: number; rows: number };
  onPick: (cols: number, rows: number) => void;
  onClosed: () => void;
  triggerRef: RefObject<HTMLDivElement | null>;
  /** Поповер подменю встал: место посчитано, анимация входа доиграна. */
  settled: boolean;
}) {
  const submenu = useContext(OverlayTriggerStateContext) as
    (OverlayTriggerState & { focusStrategy?: unknown }) | null;
  const gridRef = useRef<HTMLDivElement>(null);
  const fromKeyboard = submenu?.focusStrategy != null;

  // Сетка снята — поповер уже вне DOM (см. `pick` в `TableMenuButton`).
  const onClosedRef = useRef(onClosed);
  onClosedRef.current = onClosed;
  useEffect(() => () => onClosedRef.current(), []);

  useEffect(() => {
    if (fromKeyboard && settled) gridRef.current?.focus();
  }, [fromKeyboard, settled]);

  const close = () => {
    submenu?.close();
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (/^(Arrow|Home$|End$|Enter$)/.test(event.key)) event.stopPropagation();
  };

  return (
    // Обёртка ловит всплытие от сетки: клавиши сетки дальше меню не идут.
    <div onKeyDown={onKeyDown}>
      <TableSizeGrid ref={gridRef} initial={initial} autoFocus={false} onPick={onPick} />
    </div>
  );
}

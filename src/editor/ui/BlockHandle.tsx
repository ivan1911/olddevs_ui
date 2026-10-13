"use client";

import type { EditorView } from "@tiptap/pm/view";
import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Menu, MenuButton, MenuTrigger } from "../../components/overlays/Menu.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ColumnLayoutIcon,
  DeleteIcon,
  DuplicateIcon,
  MoreVerticalIcon,
  PaletteIcon,
  ParagraphIcon,
} from "../../icons.js";
import { cn } from "../../lib/cn.js";
import {
  deleteBlock,
  duplicateBlock,
  handleBlock,
  handleShortcutsMatch,
  moveBlock,
} from "../core/blockCommands.js";
import { blockTypeOf, formatItemsFor } from "../core/blockTypes.js";
import { EDITOR_LAYOUTS, type EditorLayout } from "../features/layout/columnLayouts.js";
import {
  formatMenuSections,
  HAS_POPUP_MENU,
  type FormatMenuItem,
  type FormatMenuSection,
} from "./FormatMenus.js";
import { FOCUS_TARGET } from "./focusWithin.js";
import { applyInsertItem, insertItemsFor, turnBlockInto } from "../core/insertItems.js";
import { COLUMN_NODE, LAYOUT_NODE, layoutOfNode } from "../features/layout/layout.js";
import { EDITOR_WRAPPER_TONE_CLASS } from "../styles/prose.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import { blockActionsOf, blockActionVisible, type ToolList } from "../core/toolDescriptor.js";
import { WRAPPER_NODE } from "../features/wrapper/wrapper.js";
import { EDITOR_WRAPPER_TONES, wrapperToneFrom } from "../features/wrapper/wrapperTones.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

/** Размер ручки и зазор до текста, px: ручка `h-6 w-5` стоит в левом поле Документа. */
const HANDLE_WIDTH = 20;
const HANDLE_HEIGHT = 24;
const HANDLE_GAP = 4;

/*
  Ручка — вне обхода Tab: в Документе Tab сдвигает пункт списка, а к ручке
  ведёт `Mod+/`. Кит не пробрасывает `excludeFromTabOrder` и `onFocusChange` в
  типах `MenuButton`, а `Button` react-aria их понимает.
*/
const buttonExtras = (onFocusChange: (focused: boolean) => void) =>
  ({ excludeFromTabOrder: true, onFocusChange }) as object;

/**
 * Где стоит ручка относительно `anchor.offsetParent` (корня Редактора или
 * области прокрутки Документа): слева от левого края контейнера Блоков — у
 * Документа это его левое поле, у колонки
 * раскладки будет край колонки, — по высоте на середине первой
 * строки Блока. У картинки строки нет — ручка у её верхнего края; у линии —
 * на ней самой. `null` — мерить нечего.
 */
function handlePlace(view: EditorView, anchor: HTMLElement): { top: number; left: number } | null {
  const block = handleBlock(view.state);
  const origin = anchor.offsetParent;
  if (!block || !(origin instanceof HTMLElement)) return null;
  const container = block.depth === 0 ? view.dom : view.nodeDOM(block.$from.before(block.depth));
  if (!(container instanceof HTMLElement)) return null;

  const node = block.parent.child(block.startIndex);
  const win = container.ownerDocument.defaultView;
  /*
    Первая строка — первый текстовый Блок внутри (у списка — первый пункт, у
    таблицы — первая ячейка): верх его рамки и высота строки из стилей. У
    картинки текст есть — подпись, — но она под картинкой, поэтому узел-атом
    меряется своей рамкой.

    ТОЛЬКО DOM, БЕЗ `view.coordsAtPos`. Тот сначала сбрасывает наблюдатель DOM
    ProseMirror, а замер идёт на каждой транзакции — и на той, что приходит с
    фокусом посреди двойного щелчка: сброс в этот миг читал ещё схлопнутое
    выделение, и выделенное двойным щелчком слово терялось.
  */
  let first = -1;
  if (node.isTextblock) first = block.start;
  else if (!node.isAtom) {
    node.descendants((child, offset) => {
      if (first >= 0) return false;
      if (child.isTextblock) first = block.start + 1 + offset;
      return first < 0;
    });
  }
  const dom = view.nodeDOM(first >= 0 ? first : block.start);
  if (!(dom instanceof HTMLElement)) return null;
  const rect = dom.getBoundingClientRect();
  let line: { top: number; bottom: number };
  if (first >= 0) {
    const style = win?.getComputedStyle(dom);
    const top = rect.top + dom.clientTop + (parseFloat(style?.paddingTop ?? "") || 0);
    const height =
      parseFloat(style?.lineHeight ?? "") || (parseFloat(style?.fontSize ?? "") || 16) * 1.2;
    line = { top, bottom: top + height };
  } else {
    line = { top: rect.top, bottom: Math.min(rect.bottom, rect.top + HANDLE_HEIGHT) };
  }

  /*
    Началом координат бывает и прокручиваемая область Документа (`maxHeight`,
    ADR-0059): тогда позиция — в координатах её содержимого, со сдвигом
    прокрутки, и ручка едет вместе с текстом без пересчёта на каждый кадр. У
    корня Редактора сдвиг нулевой.
  */
  const box = origin.getBoundingClientRect();
  const frame = container.getBoundingClientRect();
  const padding = parseFloat(win?.getComputedStyle(container).paddingLeft ?? "") || 0;
  const contentLeft = frame.left + container.clientLeft + padding;
  return {
    top: Math.round(
      (line.top + line.bottom) / 2 -
        HANDLE_HEIGHT / 2 -
        box.top -
        origin.clientTop +
        origin.scrollTop
    ),
    left: Math.round(
      contentLeft - HANDLE_GAP - HANDLE_WIDTH - box.left - origin.clientLeft + origin.scrollLeft
    ),
  };
}

export interface BlockHandleProps {
  editor: Editor;
  tools: ToolList;
  /**
   * Сюда ручка кладёт «открыть меню» для `Mod+/` из Документа: сочетание
   * слушает расширение (`blockCommands.ts`), а меню живёт здесь. `false` —
   * ручки нет, и клавиша идёт дальше.
   */
  openRef: RefObject<() => boolean>;
}

/**
 * Ручка Блока «⋮»: кнопка слева от первой строки Блока с кареткой
 * и меню действий над ним — Добавить ›, Формат ›, Вверх, Вниз, Дублировать,
 * Удалить.
 *
 * ТОЛЬКО ПО КАРЕТКЕ (решение владельца). Наведение мыши ручку не показывает:
 * она не мелькает у каждого абзаца под курсором и не спорит с выделением
 * текста. Видна, пока фокус в Документе, на самой ручке или в её меню; в
 * `readOnly` её не монтирует Редактор, у выключенного поля Блока ручки нет.
 *
 * БЛОК — ЦЕЛИКОМ. Действия идут над Блоком ручки (`handleBlock`): весь список,
 * вся цитата, вся таблица, а не пункт под кареткой. Поэтому подпись сочетания
 * у пункта — только когда сочетание делает то же самое (`handleShortcutsMatch`):
 * в пункте списка `⌥⇧↑` двигает пункт, и там подписи нет. Каждое действие —
 * одна правка на отмену, фокус после него — в Документе. Перетаскивания за
 * ручку нет (решение владельца).
 *
 * СЛОЙ — В ПОТОКЕ ПОЛЯ, А НЕ ОВЕРЛЕЙ. Ручка — часть поля, как полоса прокрутки:
 * она лежит в DOM Редактора абсолютно от его корня и едет с текстом в любом
 * контейнере прокрутки, в `Dialog` и `Drawer` без пересчёта на прокрутке.
 * Ступени `OVERLAY_LAYER` у неё нет намеренно: липкая Панель (`z-[1]`) и любые
 * поповеры должны её перекрывать, а не наоборот. Меню — `Menu` кита, у него
 * свой слой и стек Escape (ADR-0041): Escape закрывает подменю и меню по
 * одному уровню, а окно вокруг Редактора остаётся открытым.
 */
export function BlockHandle({ editor, tools, openRef }: BlockHandleProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const apple = isApple();
  const submenuPlacement = useSubmenuPlacement();
  const [open, setOpen] = useState(false);
  const [buttonFocused, setButtonFocused] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** Выбран ли пункт: тогда фокус в Документ возвращает само действие. */
  const actedRef = useRef(false);

  // «Добавить ›» — пункты Меню вставки без повторов: «Блок кода» там есть и в
  // «Добавить» (`codeBlock`), и в «Превратить в» (`codeBlockFromText`), а новый
  // Блок ниже один и тот же. Двойник отсекается по id, а не по подписи: подпись
  // зависит от каталога потребителя, и совпадение слов не значит одно действие.
  const addItems = useMemo(
    () => insertItemsFor(tools).filter((item) => item.id !== "codeBlockFromText"),
    [tools]
  );
  const formatItems = useMemo(() => formatItemsFor(tools), [tools]);
  // Действия Инструментов — проекция списка описаний; «Тон ›» и «Раскладка ›»
  // — меню-виджеты без своего Инструмента, они собираются ниже по-старому.
  const toolActions = useMemo(() => blockActionsOf(tools), [tools]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const block = current.isEditable ? handleBlock(current.state) : null;
      if (!block) return null;
      const node = block.parent.child(block.startIndex);
      // Раскладка: её вариант — у ручки самой Раскладки (выделена
      // целиком) и у ручки Блока в её колонке.
      const layout =
        node.type.name === LAYOUT_NODE
          ? node
          : block.parent.type.name === COLUMN_NODE
            ? block.$from.node(block.depth - 1)
            : null;
      const wrapper =
        node.type.name === WRAPPER_NODE
          ? node
          : block.parent.type.name === WRAPPER_NODE
            ? block.parent
            : null;
      return {
        focused: current.view.hasFocus(),
        type: blockTypeOf(node),
        // Признак «можно превратить в» своего Блока (ADR-0058, п. 1.4).
        turnInto: node.type.spec.turnInto === true,
        layout: layout ? layoutOfNode(layout) : null,
        isLayout: node.type.name === LAYOUT_NODE,
        // Обёртка: ручка самой Обёртки (выделена целиком) или Блока
        // прямо в ней — у обеих есть «Тон ›».
        inWrapper: wrapper !== null,
        tone: wrapper ? wrapperToneFrom(wrapper.attrs.tone) : null,
        // Действия над Блоком: у Блока Ручки и у контейнера, где он стоит (`BlockAction.blocks`).
        actions: toolActions
          .filter((action) =>
            blockActionVisible(action, current, block.start, {
              name: node.type.name,
              container: block.parent.type.name,
            })
          )
          .map((action) => action.id),
        first: block.startIndex === 0,
        last: block.endIndex === block.parent.childCount,
        keys: handleShortcutsMatch(current.state),
      };
    },
  });
  const shown = state !== null && (state.focused || open || buttonFocused);

  openRef.current = () => {
    if (!editor.isEditable || !handleBlock(editor.state)) return false;
    actedRef.current = false;
    setOpen(true);
    return true;
  };

  /*
    Позиция — заново на каждой транзакции (Блок сменился, текст выше вырос) и
    на смене размера Документа (окно, догрузка картинки, перенос строк). До
    отрисовки, чтобы ручка не мелькала в прежнем месте.
  */
  useLayoutEffect(() => {
    if (!shown) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor || editor.isDestroyed) return;
      const next = handlePlace(editor.view, anchor);
      if (next)
        setPlace((prev) =>
          prev && prev.top === next.top && prev.left === next.left ? prev : next
        );
    };
    update();
    editor.on("transaction", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(editor.view.dom);
    const win = editor.view.dom.ownerDocument.defaultView;
    win?.addEventListener("resize", update);
    return () => {
      editor.off("transaction", update);
      observer?.disconnect();
      win?.removeEventListener("resize", update);
    };
  }, [editor, shown]);

  // `aria-keyshortcuts` — на узел: `Button` react-aria атрибут в DOM не пропускает.
  const openKeys = findShortcutKeys("blockActions");
  useEffect(() => {
    if (openKeys)
      buttonRef.current?.setAttribute("aria-keyshortcuts", ariaShortcut(openKeys, apple));
  }, [openKeys, apple, shown]);

  if (!shown) return null;

  const shortcut = (keys: readonly string[]) => shortcutLabel(keys, apple);
  const { keys } = state;
  const active = formatItems.find((item) => item.id === state.type);

  /*
    Варианты Раскладки — одним списком для «Добавить › Раскладка ›»
    и для выбора варианта: «Одна колонка», «Две колонки», …, «60/40», «40/60».
  */
  const layoutVariants = (prefix: string) =>
    EDITOR_LAYOUTS.map((variant) => ({
      id: `${prefix}:${variant}`,
      label: messages.layoutVariant[variant],
    }));
  const layoutSubmenu = (current: EditorLayout | null): FormatMenuSection[] => [
    {
      id: "layoutVariants",
      selectionMode: "single",
      selected: current ? [`layout:${current}`] : [],
      items: layoutVariants("layout"),
    },
  ];

  const blockItems: FormatMenuItem[] = [];
  if (addItems.length > 0) {
    blockItems.push({
      id: "add",
      label: messages.blockAdd,
      icon: AddIcon,
      // Сочетания Меню вставки меняют текущий Блок, а «Добавить» ставит новый
      // ниже — подписей здесь нет. «Раскладка» — подменю вариантов: в Меню
      // вставки она одним пунктом (две колонки), здесь — любой из шести.
      submenu: [
        {
          id: "addItems",
          items: addItems.map((item) =>
            item.id === "layout"
              ? {
                  id: "addLayout",
                  label: item.label(messages, locale),
                  icon: item.icon,
                  submenu: [{ id: "addLayoutVariants", items: layoutVariants("addLayout") }],
                }
              : { id: `add:${item.id}`, label: item.label(messages, locale), icon: item.icon }
          ),
        },
      ],
    });
  }
  if (state.isLayout) {
    // «Формат ›» Раскладки целиком — её варианты с отметкой текущего: типа Блока
    // у неё нет, а вариант и есть её формат.
    blockItems.push({
      id: "format",
      label: messages.blockFormat,
      icon: ColumnLayoutIcon,
      submenu: layoutSubmenu(state.layout),
    });
  } else if (formatItems.length > 0) {
    blockItems.push({
      id: "format",
      label: messages.blockFormat,
      icon: ParagraphIcon,
      // Таблицу, картинку и линию в текст не превратить: пункт виден, но
      // недоступен. Свой Блок — только с Признаком «можно превратить в».
      disabled: state.type === null && !state.turnInto,
      submenu: [
        {
          id: "formatItems",
          selectionMode: "single",
          selected: active ? [`format:${active.id}`] : [],
          items: formatItems.map((item) => ({
            id: `format:${item.id}`,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: keys.type ? item.keys : undefined,
          })),
        },
      ],
    });
  }
  /*
    Блок в колонке: «Формат ›» — его тип, как везде, а вариант своей Раскладки —
    отдельным пунктом «Раскладка ›». Ручка самой Раскладки есть, только когда она
    выделена целиком (Backspace на Блоке под ней), а каретка почти всегда в
    колонке: без этого пункта вариант было бы не сменить.
  */
  if (!state.isLayout && state.layout) {
    blockItems.push({
      id: "layoutFormat",
      label: messages.layout,
      icon: ColumnLayoutIcon,
      submenu: layoutSubmenu(state.layout),
    });
  }
  /*
    «Тон ›» — и у ручки самой Обёртки, и у Блока прямо в ней. Как с
    «Раскладка ›»: ручка по каретке, а каретка почти всегда внутри, и ручку
    Обёртки целиком видно редко (Backspace на Блоке под ней). «Снять обёртку» —
    Действие над Блоком Инструмента `wrapper` (`features/builtins.ts`), оно в
    секции действий ниже.
  */
  if (state.inWrapper) {
    /*
      Пункты — радио: «Без тона» и пять тонов словами, текущий отмечен, а имя
      пункта несёт текущий тон, как имя кнопки «¶» — текущий тип.
    */
    const toneName = state.tone ? messages.wrapperToneName[state.tone] : messages.wrapperToneNone;
    blockItems.push({
      id: "wrapperTone",
      label: messages.wrapperTone({ current: toneName }),
      icon: PaletteIcon,
      submenu: [
        {
          id: "wrapperTones",
          selectionMode: "single",
          selected: [`tone:${state.tone ?? "none"}`],
          items: [
            { id: "tone:none", label: messages.wrapperToneNone },
            ...EDITOR_WRAPPER_TONES.map((tone) => ({
              id: `tone:${tone}`,
              label: messages.wrapperToneName[tone],
              swatch: EDITOR_WRAPPER_TONE_CLASS[tone],
            })),
          ],
        },
      ],
    });
  }
  const sections = (
    [
      { id: "block", items: blockItems },
      {
        id: "move",
        items: [
          {
            id: "moveUp",
            label: messages.blockMoveUp,
            icon: ArrowUpIcon,
            keys: keys.move ? findShortcutKeys("moveBlockUp") : undefined,
            disabled: state.first,
          },
          {
            id: "moveDown",
            label: messages.blockMoveDown,
            icon: ArrowDownIcon,
            keys: keys.move ? findShortcutKeys("moveBlockDown") : undefined,
            disabled: state.last,
          },
          {
            id: "duplicate",
            label: messages.blockDuplicate,
            icon: DuplicateIcon,
            keys: keys.duplicate ? findShortcutKeys("duplicateBlock") : undefined,
          },
        ],
      },
      // Действия Инструментов — своя секция перед «Удалить» (ADR-0058, п. 10.3).
      {
        id: "toolActions",
        items: toolActions
          .filter((action) => state.actions.includes(action.id))
          .map((action) => ({
            id: `action:${action.id}`,
            label: action.label(messages, locale),
            icon: action.icon,
            keys: action.shortcut,
          })),
      },
      {
        id: "remove",
        items: [{ id: "delete", label: messages.blockDelete, icon: DeleteIcon, tone: "danger" }],
      },
    ] satisfies FormatMenuSection[]
  ).filter((section) => section.items.length > 0);

  const commands = {
    moveUp: moveBlock(-1, "handle"),
    moveDown: moveBlock(1, "handle"),
    duplicate: duplicateBlock("handle"),
    delete: deleteBlock,
  } as const;

  const run = (key: unknown) => {
    actedRef.current = true;
    const id = String(key);
    const [kind, itemId] = id.split(":");
    if (kind === "add") {
      const item = addItems.find((candidate) => candidate.id === itemId);
      if (item) applyInsertItem(editor, item, null, "below");
      return;
    }
    if (kind === "addLayout") {
      const item = addItems.find((candidate) => candidate.id === "layout");
      const variant = itemId as EditorLayout;
      if (item) {
        applyInsertItem(
          editor,
          { ...item, run: (chain) => chain.insertLayout(variant) },
          null,
          "below"
        );
      }
      return;
    }
    if (kind === "layout") {
      // Выбор текущего варианта ничего не меняет — как в «¶».
      const variant = itemId as EditorLayout;
      if (variant !== state.layout) editor.chain().focus().setLayout(variant).run();
      else editor.commands.focus();
      return;
    }
    if (kind === "tone") {
      // Выбор текущего тона ничего не меняет — как в «¶»: пустой правки в истории нет.
      const tone = wrapperToneFrom(itemId);
      if (tone !== state.tone) editor.chain().focus().setWrapperTone(tone).run();
      else editor.commands.focus();
      return;
    }
    if (kind === "action") {
      const action = toolActions.find((candidate) => candidate.id === itemId);
      const block = handleBlock(editor.state);
      if (action && block) action.run(editor, block.start);
      else editor.commands.focus();
      return;
    }
    if (kind === "format") {
      const item = formatItems.find((candidate) => candidate.id === itemId);
      // Выбор текущего типа ничего не меняет — как в «¶».
      if (item && item.id !== state.type) turnBlockInto(editor, item);
      else editor.commands.focus();
      return;
    }
    const command = commands[id as keyof typeof commands];
    if (!command) return;
    command(editor.state, editor.view.dispatch);
    editor.commands.focus();
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      actedRef.current = false;
      return;
    }
    if (actedRef.current) return;
    /*
      Закрыто без выбора — Escape или щелчок мимо. Фокус — в Документ, а не на
      ручку: она вне обхода Tab, и человек с клавиатуры застрял бы на ней.
      Кадром позже, когда меню снято, и только если фокус не поставлен
      осознанно на другое поле или кнопку (`FOCUS_TARGET`): его оставляют.
      Тело страницы и контейнер `Dialog` (туда фокус кладёт ловушка окна,
      когда меню исчезло) — не цель, и оттуда фокус возвращается в Документ.
    */
    const anchor = anchorRef.current;
    const doc = editor.view.dom.ownerDocument;
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      const current = doc.activeElement;
      if (
        !current ||
        !current.matches(FOCUS_TARGET) ||
        anchor?.contains(current) ||
        current.closest('[role="menu"]')
      ) {
        editor.view.focus();
      }
    });
  };

  const tooltip = (
    <span className="flex items-center gap-2">
      {messages.blockActions}
      {openKeys && <Kbd aria-hidden="true">{shortcut(openKeys)}</Kbd>}
    </span>
  );

  return (
    <div
      ref={anchorRef}
      data-block-handle=""
      // До первого замера — невидимо: место ещё не известно.
      className={cn("absolute", !place && "invisible")}
      style={place ?? undefined}
    >
      <TooltipProvider>
        <MenuTrigger isOpen={open} onOpenChange={onOpenChange}>
          <Tooltip content={tooltip}>
            <span className="inline-flex">
              <MenuButton
                ref={buttonRef}
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={messages.blockActions}
                icon={<MoreVerticalIcon size={16} aria-hidden />}
                className="text-fg-2 h-6 w-5"
                {...HAS_POPUP_MENU}
                // Фокус на самой ручке держит её видимой: касание пальцем
                // открывает меню на отпускании, а Документ теряет фокус раньше.
                {...buttonExtras(setButtonFocused)}
              />
            </span>
          </Tooltip>
          <Menu className={GLASS_MENU_CLASS} onAction={run}>
            {formatMenuSections(sections, shortcut, run, submenuPlacement)}
          </Menu>
        </MenuTrigger>
      </TooltipProvider>
    </div>
  );
}

"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { Fragment, type ComponentType, type ReactNode } from "react";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "../../components/overlays/Menu.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { cn } from "../../lib/cn.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  ChevronDownIcon,
  ClearFormattingIcon,
  CodeBlockIcon,
  InlineCodeIcon,
  ListIcon,
  MoreIcon,
  ParagraphIcon,
  StrikethroughIcon,
  SubscriptIcon,
  SuperscriptIcon,
  UnderlineIcon,
  type IconProps,
} from "../../icons.js";
import {
  blockTypeItemsFor,
  currentBlockType,
  quoteItemFor,
  currentListType,
  listTypeItemsFor,
} from "../core/blockTypes.js";
import { applyInsertItem } from "../core/insertItems.js";
import { useLockableMenu } from "./lockableMenu.js";
import { DEFAULT_ALIGNMENT, EDITOR_ALIGNMENTS, type EditorAlignment } from "../styles/palette.js";
import { findShortcutKeys } from "../core/shortcuts.js";
import type { ToolList } from "../core/toolDescriptor.js";
import type { Tool } from "../core/tools.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { GLASS_MENU_CLASS } from "../styles/glass.js";

type EditorMessages = UiMessages["editor"];

/**
 * Что меню форматирования берёт от места, где стоит.
 *
 * Меню «¶», «…», «Выравнивание» и «Списки» живут и на Панели, и в плашке
 * меню выделения. Поэтому всё, что зависит от места, приходит
 * пропами — движок, набор инструментов, выключенность и подпись сочетаний, —
 * а само меню не знает ни про `Toolbar`, ни про `BubbleMenu`. Подпись сочетания
 * отдаёт хозяин: он знает, Apple ли это (`shortcutLabel` в `EditorToolbar`).
 */
export interface FormatMenuHostProps {
  editor: Editor;
  tools: ToolList;
  /** Кнопка видна, но не нажимается: поле выключено или движок не правится. */
  disabled: boolean;
  /**
   * Кнопка недоступна, но в обходе стрелками (`aria-disabled`): HTML-режим —
   * Документа на экране нет, и меню применять не к чему.
   */
  unavailable?: boolean;
  shortcut: (keys: readonly string[]) => string;
}

/** Пункт меню форматирования: слова и иконка уже на языке интерфейса. */
export interface FormatMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<IconProps>;
  /** Сочетание в нотации движка (`mod` — `⌘` или `Ctrl`); только подпись. */
  keys?: readonly string[];
  disabled?: boolean;
  /** Классы подписи: образец вокруг имени (подменю «Тон ›» ручки Блока). */
  swatch?: string;
  /** Разрушительное действие — тон `danger` пункта `Menu` кита («Удалить» ручки Блока). */
  tone?: "danger";
  /**
   * Пункт раскрывает подменю с этими разделами (`SubmenuTrigger`, как у меню
   * «Таблица»): `→` открывает, `←` и Escape закрывают по одному уровню.
   */
  submenu?: readonly FormatMenuSection[];
}

/**
 * Раздел меню. Состояние — выбором на разделе, как велит `Menu` кита:
 * `single` даёт пункты `menuitemradio`, `multiple` — `menuitemcheckbox`, и
 * `aria-checked` react-aria ставит сам. Без `selectionMode` пункты — простые
 * действия (`menuitem`).
 */
export interface FormatMenuSection {
  id: string;
  label?: string;
  selectionMode?: "single" | "multiple";
  /** Отмеченные пункты. Пусто — не отмечен ни один (смешанное, чужой Блок). */
  selected?: readonly string[];
  items: readonly FormatMenuItem[];
}

export interface FormatMenuProps {
  /**
   * Имя кнопки — с текущим значением: «Тип блока: Заголовок 2». Меню
   * называется им же: react-aria связывает меню с кнопкой (`aria-labelledby`),
   * как в паттерне APG «кнопка меню».
   */
  label: string;
  /** Иконка кнопки — текущее значение глазу. */
  icon: ComponentType<IconProps>;
  /**
   * Кнопка — одна иконка, без стрелки ▾. «…» и так читается как «ещё»; стрелка
   * у меню со значением («¶») говорит, что значение выбирается из списка.
   */
  iconOnly?: boolean;
  disabled: boolean;
  /** `aria-disabled`: кнопка в обходе стрелками, но меню не открывает. */
  unavailable?: boolean;
  sections: readonly FormatMenuSection[];
  shortcut: (keys: readonly string[]) => string;
  onAction: (id: string) => void;
}

/*
  RAC ставит триггеру меню `aria-haspopup="true"`. По ARIA 1.2 это то же, что
  `menu`, но явное значение читается однозначнее — как у меню «Таблица».
*/
export const HAS_POPUP_MENU = { "aria-haspopup": "menu" } as object;

/**
 * Кнопка с меню форматирования — общий каркас «¶», «…», «Выравнивания» и
 * «Списков».
 *
 * МЕНЮ, А НЕ РЯД КНОПОК. Прежде Панель держала каждое действие кнопкой в ряд:
 * скрытое в меню действие не показывало `aria-pressed`, и скринридер не узнал
 * бы, включён ли курсив, не открыв меню. Довод снят: пункт с отметкой
 * (`menuitemradio`, `menuitemcheckbox`) объявляет состояние так же, как
 * `aria-pressed`, а кнопка меню несёт текущее значение в имени и в иконке —
 * его слышно и видно без открытия. Решение — ADR-0054.
 *
 * Клавиатура и слой — `Menu` кита (react-aria): Enter, пробел и `↓` открывают,
 * стрелки ходят, Escape закрывает только меню и возвращает фокус на кнопку —
 * через стек слоёв ADR-0041, поэтому внутри `Dialog` окно остаётся открытым.
 */
export function FormatMenu({
  label,
  icon: Icon,
  iconOnly = false,
  disabled,
  unavailable = false,
  sections,
  shortcut,
  onAction,
}: FormatMenuProps) {
  const run = (key: unknown) => onAction(String(key));
  const menu = useLockableMenu(unavailable);
  const submenuPlacement = useSubmenuPlacement();

  return (
    <MenuTrigger {...menu.trigger}>
      {/* Подсказка — на обёртке: `Button` react-aria не отдаёт Radix обработчики наведения. */}
      <Tooltip content={label}>
        <span className="inline-flex">
          <MenuButton
            variant="ghost"
            size="sm"
            iconOnly={iconOnly}
            disabled={disabled}
            aria-label={label}
            icon={<Icon size={16} aria-hidden />}
            className={iconOnly ? undefined : "gap-0.5 px-1.5"}
            {...HAS_POPUP_MENU}
            {...menu.button}
          >
            {!iconOnly && <ChevronDownIcon size={12} aria-hidden />}
          </MenuButton>
        </span>
      </Tooltip>
      <Menu className={GLASS_MENU_CLASS} onAction={run}>
        {formatMenuSections(sections, shortcut, run, submenuPlacement)}
      </Menu>
    </MenuTrigger>
  );
}

/**
 * Разделы меню форматирования — содержимое `Menu`. Общее у кнопок меню выше и
 * у ручки Блока (`BlockHandle.tsx`): у ручки своя кнопка и своё открытие с
 * клавиатуры, а пункты, подменю и отметки — те же.
 *
 * Разделы — через разделитель. Выбор закрывает меню в любом разделе, и в
 * `multiple` тоже: метка ставится одним щелчком, и дальше человек пишет, а не
 * ставит вторую. Подменю — тот же каркас уровнем ниже.
 */
export function formatMenuSections(
  list: readonly FormatMenuSection[],
  shortcut: (keys: readonly string[]) => string,
  run: (key: unknown) => void,
  /** Место подменю — `useSubmenuPlacement` вызывающего: на телефоне под пунктом. */
  submenuPlacement: "bottom start" | "right top" = "right top"
): ReactNode {
  return list.map((section, index) => (
    <Fragment key={section.id}>
      {index > 0 && <MenuSeparator />}
      <MenuSection
        id={section.id}
        label={section.label}
        selectionMode={section.selectionMode}
        selectedKeys={section.selectionMode ? (section.selected ?? []) : undefined}
        shouldCloseOnSelect
      >
        {section.items.map((item) => {
          const ItemIcon = item.icon;
          const entry = (
            <MenuItem
              key={item.id}
              id={item.id}
              textValue={item.label}
              disabled={item.disabled}
              tone={item.tone}
              icon={ItemIcon ? <ItemIcon size={14} aria-hidden /> : undefined}
              shortcut={item.keys ? shortcut(item.keys) : undefined}
            >
              {item.swatch ? (
                /*
                  Образец не должен брать вид выбранной строки: её голубой текст
                  и подложка перекрашивали цвета тона. Текст задан образцу
                  самому, а непрозрачная основа под ним не даёт полупрозрачной
                  подложке тона смешаться с подложкой строки. Основа — только в
                  отмеченной строке: у остальных образец лежит на панели меню,
                  как обёртка в документе, и выглядит так же.
                */
                <span className="in-[[aria-checked=true]]:bg-surface-elevated rounded-xs">
                  <span className={cn(item.swatch, "text-fg-0")}>{item.label}</span>
                </span>
              ) : (
                item.label
              )}
            </MenuItem>
          );
          if (!item.submenu || item.disabled) return entry;
          return (
            <SubmenuTrigger key={item.id}>
              {entry}
              <Menu
                aria-label={item.label}
                className={GLASS_MENU_CLASS}
                placement={submenuPlacement}
                offset={2}
                onAction={run}
              >
                {formatMenuSections(item.submenu, shortcut, run, submenuPlacement)}
              </Menu>
            </SubmenuTrigger>
          );
        })}
      </MenuSection>
    </Fragment>
  ));
}

/** Есть ли у набора инструментов меню «¶»: Панель решает по нему о разделителе. */
export function hasBlockTypeMenu(tools: ToolList): boolean {
  return blockTypeItemsFor(tools).length > 0;
}

/**
 * Меню «¶» — тип строки: Текст, Заголовок 1–4 и пункты
 * своих Инструментов, только из включённых. Списков и цитаты здесь нет: у
 * списков — «Списки ▾», у цитаты — флажок в «…»; в «Формат ›» ручки и в «/»
 * они остаются. Отмечен тип строки под кареткой (абзац в списке или цитате —
 * «Текст»), а текущее имя — в доступном имени кнопки.
 *
 * ИКОНКА — ПО СТРОКЕ ПОД КАРЕТКОЙ (решение владельца; прежде она
 * была всегда «¶», ADR-0054, п. 8): уровень заголовка или иконка пункта своего
 * Инструмента, у текста — пилкроу. Пунктов теперь мало и они узнаваемы, а
 * кнопка показывает, что под кареткой, не открываясь.
 *
 * Выбор меняет тип строки на месте — заголовок в цитате остаётся в цитате; где
 * Схема его не даёт (заголовок первым в пункте списка), действует пункт
 * «Превратить в» Меню вставки (`applyInsertItem`) и снимает обёртки. Текст
 * остаётся, правка одна на отмену, фокус возвращается в Документ. Выбор
 * текущего типа ничего не меняет и пустой правки в историю не кладёт.
 *
 * Блок кода в меню не входит (он пункт «…»), но под кареткой он
 * называется на кнопке, а отметки нет ни у одного пункта.
 */
export function BlockTypeMenu({
  editor,
  tools,
  disabled,
  unavailable,
  shortcut,
}: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const items = blockTypeItemsFor(tools);
  const current = useEditorState({
    editor,
    selector: ({ editor: instance }) => currentBlockType(instance.state),
  });
  if (items.length === 0) return null;

  const active = items.find((item) => item.id === current);
  const currentName = active
    ? active.label(messages, locale)
    : current === "codeBlock"
      ? messages.codeBlock
      : null;

  return (
    <FormatMenu
      label={currentName ? messages.blockType({ current: currentName }) : messages.blockTypeMenu}
      // Иконка — по строке под кареткой: уровень заголовка, иконка
      // пункта своего Инструмента; у текста и вне пунктов «¶» — пилкроу.
      icon={active && active.id !== "text" ? active.icon : ParagraphIcon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "blockType",
          selectionMode: "single",
          selected: active ? [active.id] : [],
          items: items.map((item) => ({
            id: item.id,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: item.keys,
          })),
        },
      ]}
      onAction={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) return;
        if (item.id === current) return void editor.commands.focus();
        /*
          Текст и заголовки кита меняют тип строки на месте:
          заголовок в цитате остаётся в цитате. Где Схема строке этот тип не
          даёт (заголовок первым в пункте списка), и у пунктов своих
          Инструментов (их команда может оборачивать и делать своё) — путь
          «Превратить в»: обёртки снимаются, тип ставится, правка одна на отмену.
        */
        const lineType = item.tool === null || item.tool === "heading";
        if (lineType && item.run(editor.can().chain(), editor).run())
          item.run(editor.chain().focus(), editor).run();
        else applyInsertItem(editor, item, null);
      }}
    />
  );
}

/** Пункт меню «Выравнивание»: иконка, подпись и строка таблицы сочетаний. */
const ALIGN_ITEMS: Record<
  EditorAlignment,
  { icon: ComponentType<IconProps>; label: (m: EditorMessages) => string; shortcut: string }
> = {
  left: { icon: AlignLeftIcon, label: (m) => m.alignLeft, shortcut: "alignLeft" },
  center: { icon: AlignCenterIcon, label: (m) => m.alignCenter, shortcut: "alignCenter" },
  right: { icon: AlignRightIcon, label: (m) => m.alignRight, shortcut: "alignRight" },
};

/**
 * Выравнивание Блоков под выделением. Смешанное (один Блок по центру, другой
 * влево) читается умолчанием: отметка «По левому краю» тогда честнее, чем ни
 * одной, — выбор любого пункта выровняет все Блоки одинаково.
 */
function alignmentOf(editor: Editor): EditorAlignment {
  return (
    EDITOR_ALIGNMENTS.find(
      (alignment) => alignment !== DEFAULT_ALIGNMENT && editor.isActive({ textAlign: alignment })
    ) ?? DEFAULT_ALIGNMENT
  );
}

/**
 * Меню «Выравнивание»: По левому краю, По центру, По правому краю
 * с сочетаниями из общей таблицы. По ширине нет — решение со страницы
 * компонента (WCAG 1.4.8: рваные пробелы мешают читать) остаётся.
 *
 * В отличие от «¶», иконка кнопки — иконка ТЕКУЩЕГО выравнивания (образец
 * эпика): вариантов три, и картинка «по центру» на кнопке говорит больше, чем
 * общая иконка. Имя называет его словами: «Выравнивание: по центру».
 *
 * Прежде выравнивание было тремя кнопками-переключателями, и повторный щелчок
 * по включённому возвращал к умолчанию. В меню-радио так не бывает: выбор
 * отмеченного пункта ничего не меняет и не кладёт в историю пустую правку, а к
 * умолчанию ведёт пункт «По левому краю».
 */
export function AlignMenu({ editor, tools, disabled, unavailable, shortcut }: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      alignment: tools.has("align") ? alignmentOf(current) : DEFAULT_ALIGNMENT,
      unavailable: tools.has("align")
        ? EDITOR_ALIGNMENTS.filter((alignment) => !current.can().setTextAlign(alignment))
        : [],
    }),
  });
  if (!tools.has("align")) return null;

  return (
    <FormatMenu
      label={messages.alignMenu({ current: state.alignment })}
      icon={ALIGN_ITEMS[state.alignment].icon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "align",
          selectionMode: "single",
          selected: [state.alignment],
          items: EDITOR_ALIGNMENTS.map((alignment) => ({
            id: alignment,
            label: ALIGN_ITEMS[alignment].label(messages),
            icon: ALIGN_ITEMS[alignment].icon,
            keys: findShortcutKeys(ALIGN_ITEMS[alignment].shortcut),
            disabled: state.unavailable.includes(alignment),
          })),
        },
      ]}
      onAction={(id) => {
        const alignment = EDITOR_ALIGNMENTS.find((candidate) => candidate === id);
        if (!alignment) return;
        const chain = editor.chain().focus();
        (alignment === alignmentOf(editor) ? chain : chain.setTextAlign(alignment)).run();
      }}
    />
  );
}

/** Есть ли у набора инструментов меню «Списки»: хоть один вид списка. */
export function hasListMenu(tools: ToolList): boolean {
  return listTypeItemsFor(tools).length > 0;
}

/**
 * Меню «Списки»: Маркированный, Нумерованный, Чек-лист — те же
 * виды, что в «Формат ›» Ручки Блока, только из включённых Инструментов.
 * Отмечен вид ближайшего списка вокруг каретки, он же — иконка и имя кнопки
 * («Список: нумерованный»); вне списка иконка — общая иконка списка.
 *
 * Выбор другого вида — тем же путём, что «Превратить в» Меню вставки
 * (`applyInsertItem`): Блок выходит из списка и цитаты и оборачивается заново,
 * одной правкой на отмену. Выбор ОТМЕЧЕННОГО вида снимает список, как прежняя
 * кнопка-переключатель: в «Формат ›» для этого есть «Текст», а здесь другого
 * пути снять список нет.
 */
export function ListMenu({ editor, tools, disabled, unavailable, shortcut }: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const items = listTypeItemsFor(tools);
  const current = useEditorState({
    editor,
    selector: ({ editor: instance }) => currentListType(instance.state),
  });
  if (items.length === 0) return null;

  const active = items.find((item) => item.id === current);

  return (
    <FormatMenu
      label={messages.listMenu({ current })}
      icon={active?.icon ?? ListIcon}
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={[
        {
          id: "lists",
          selectionMode: "single",
          selected: active ? [active.id] : [],
          items: items.map((item) => ({
            id: item.id,
            label: item.label(messages, locale),
            icon: item.icon,
            keys: item.keys,
          })),
        },
      ]}
      onAction={(id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) return;
        // Тот же `toggle…List`, что у пункта: на своём виде он снимает список.
        if (item.id === current) item.run(editor.chain().focus(), editor).run();
        else applyInsertItem(editor, item, null);
      }}
    />
  );
}

/**
 * Редкая метка меню «…»: id совпадает с именем Метки в движке и с id строки
 * таблицы сочетаний (`shortcuts.ts`), откуда берётся подпись.
 */
/** Id редкой метки «…» — имя Метки в движке и строки таблицы сочетаний. */
export type MoreMarkId = "code" | "underline" | "strike" | "superscript" | "subscript";

interface MoreMark {
  id: MoreMarkId;
  label: (messages: EditorMessages) => string;
  icon: ComponentType<IconProps>;
  run: (editor: Editor) => void;
  can: (editor: Editor) => boolean;
}

const MORE_MARKS: readonly MoreMark[] = [
  {
    id: "code",
    label: (m) => m.code,
    icon: InlineCodeIcon,
    run: (editor) => editor.chain().focus().toggleCode().run(),
    can: (editor) => editor.can().toggleCode(),
  },
  {
    id: "underline",
    label: (m) => m.underline,
    icon: UnderlineIcon,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    can: (editor) => editor.can().toggleUnderline(),
  },
  {
    id: "strike",
    label: (m) => m.strike,
    icon: StrikethroughIcon,
    run: (editor) => editor.chain().focus().toggleStrike().run(),
    can: (editor) => editor.can().toggleStrike(),
  },
  {
    id: "superscript",
    label: (m) => m.superscript,
    icon: SuperscriptIcon,
    run: (editor) => editor.chain().focus().toggleSuperscript().run(),
    can: (editor) => editor.can().toggleSuperscript(),
  },
  {
    id: "subscript",
    label: (m) => m.subscript,
    icon: SubscriptIcon,
    run: (editor) => editor.chain().focus().toggleSubscript().run(),
    can: (editor) => editor.can().toggleSubscript(),
  },
];

/** Метка ли «…» — для хозяина, который выводит свой ряд и не повторяет его в «…». */
export function isMoreMarkId(id: string): id is MoreMarkId {
  return MORE_MARKS.some((mark) => mark.id === id);
}

/**
 * Инструменты меню «…» без Меток, что у хозяина стоят в ряду (`omit`): кнопка
 * есть, если включён хоть один.
 */
export function moreFormatTools(omit: readonly MoreMarkId[] = []): readonly Tool[] {
  return [
    ...MORE_MARKS.map((mark) => mark.id).filter((id) => !omit.includes(id)),
    "codeBlock",
    "blockquote",
    "clearFormatting",
  ];
}

export interface MoreFormatMenuProps extends FormatMenuHostProps {
  /**
   * Метки, которые у хозяина уже стоят кнопками в ряду: в «…» их нет. Панель
   * держит в ряду только жирный и курсив, плашка — ещё и подчёркнутый
   * (`rowMarks.ts`).
   */
  omit?: readonly MoreMarkId[];
}

/**
 * Меню «…» — More formatting: Строчный код, Подчёркивание (не
 * у плашки), Зачёркнутый, Верхний и Нижний индекс | Блок кода | Очистить
 * стили — только из включённых инструментов; без
 * единого пункта кнопки нет.
 *
 * Метки — `menuitemcheckbox`: отметка у включённых на выделении или у каретки,
 * выбор ставит или снимает Метку одной правкой и возвращает фокус в Документ.
 * Подписи сочетаний — из общей таблицы (`shortcuts.ts`), как у кнопок Панели.
 *
 * БЛОК КОДА — ПУНКТ «…», А НЕ КНОПКА ПАНЕЛИ: пользуются им нечасто
 * (решение владельца). Это Блок, а не Метка, поэтому раздел свой, но стоит он
 * сразу за Метками: такой же пункт-флажок с сочетанием (`Ctrl/⌘+Alt+C`), и
 * все переключатели «…» идут подряд, а очистка — после них.
 * Отметка — каретка в Блоке кода; выбор переключает его, как прежняя кнопка
 * (`toggleCodeBlock`). «Очистить стили» Блок кода не трогает — она снимает
 * Метки, — и остаётся последней.
 *
 * ЦВЕТОВ ЗДЕСЬ НЕТ. Прежде маркер и цвет текста были подменю
 * «…»; теперь это кнопки «Маркер» и «Цвет» с поповерами-сетками рядом с «…»
 * (`ColorMenus.tsx`): цвет выбирают глазами, по кружкам.
 *
 * Хозяин — Панель или плашка меню выделения: всё место-зависимое приходит
 * пропами (`FormatMenuHostProps`).
 */
export function MoreFormatMenu({
  editor,
  tools,
  disabled,
  unavailable,
  shortcut,
  omit = [],
}: MoreFormatMenuProps) {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  const marks = MORE_MARKS.filter((mark) => tools.has(mark.id) && !omit.includes(mark.id));
  const codeBlock = tools.has("codeBlock");
  // Цитата — флажок рядом с Блоком кода: из «¶» она ушла.
  const quote = quoteItemFor(tools);
  const clear = tools.has("clearFormatting");

  // Сравнение результата глубокое (умолчание `useEditorState`): рендер — только при смене.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      active: marks.filter((mark) => current.isActive(mark.id)).map((mark) => mark.id),
      unavailable: marks.filter((mark) => !mark.can(current)).map((mark) => mark.id),
      inCodeBlock: codeBlock && current.isActive("codeBlock"),
      canCodeBlock: codeBlock && current.can().toggleCodeBlock(),
      inQuote: quote !== undefined && current.isActive("blockquote"),
      canQuote: quote !== undefined && current.can().toggleBlockquote(),
      canClear: clear && current.can().unsetAllMarks(),
    }),
  });
  if (marks.length === 0 && !codeBlock && !quote && !clear) return null;

  const sections = (
    [
      {
        id: "marks",
        selectionMode: "multiple",
        selected: state.active,
        items: marks.map((mark) => ({
          id: mark.id,
          label: mark.label(messages),
          icon: mark.icon,
          keys: findShortcutKeys(mark.id),
          disabled: state.unavailable.includes(mark.id),
        })),
      },
      {
        // Не `codeBlock`: ключи разделов и пунктов в коллекции react-aria общие.
        id: "block",
        selectionMode: "multiple",
        selected: [
          ...(state.inCodeBlock ? ["codeBlock"] : []),
          ...(state.inQuote ? ["blockquote"] : []),
        ],
        items: [
          ...(codeBlock
            ? [
                {
                  id: "codeBlock",
                  label: messages.codeBlock,
                  icon: CodeBlockIcon,
                  keys: findShortcutKeys("codeBlock"),
                  disabled: !state.canCodeBlock,
                },
              ]
            : []),
          ...(quote
            ? [
                {
                  id: "blockquote",
                  label: quote.label(messages, locale),
                  icon: quote.icon,
                  keys: quote.keys,
                  disabled: !state.canQuote,
                },
              ]
            : []),
        ],
      },
      {
        id: "clear",
        items: clear
          ? [
              {
                id: "clearFormatting",
                label: messages.clearFormatting,
                icon: ClearFormattingIcon,
                keys: findShortcutKeys("clearFormatting"),
                disabled: !state.canClear,
              },
            ]
          : [],
      },
    ] satisfies FormatMenuSection[]
  ).filter((section) => section.items.length > 0);

  const apply = (key: string) => {
    const mark = marks.find((candidate) => candidate.id === key);
    if (mark) return mark.run(editor);
    if (key === "codeBlock") return void editor.chain().focus().toggleCodeBlock().run();
    if (key === "blockquote") return void editor.chain().focus().toggleBlockquote().run();
    if (key === "clearFormatting") return void editor.chain().focus().unsetAllMarks().run();
  };

  return (
    <FormatMenu
      label={messages.moreFormatting}
      icon={MoreIcon}
      iconOnly
      disabled={disabled}
      unavailable={unavailable}
      shortcut={shortcut}
      sections={sections}
      onAction={apply}
    />
  );
}

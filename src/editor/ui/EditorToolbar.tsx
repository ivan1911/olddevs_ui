"use client";

// Происхождение: minimal-tiptap, `components/toolbar-button.tsx`,
// `toolbar-section.tsx`, `shortcut-key.tsx`, `section/one.tsx`, `two.tsx`,
// `four.tsx`, `five.tsx` и `utils.ts` (`getShortcutKey`) (MIT, © 2024 Aslam,
// https://github.com/Aslam97/minimal-tiptap). Перенесены таблица действий
// (команда, признак активности, доступность, сочетание) и разметка секций.
// Компоненты shadcn заменены примитивами кита — см. комментарий у
// `EditorToolbar`. Лицензия — NOTICE в корне пакета.

import { useEditorState, type Editor } from "@tiptap/react";
import { useEffect, useRef, type ComponentType } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Separator } from "../../components/content/Separator.js";
import { Toolbar } from "../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { useMessages } from "../../i18n/useMessages.js";
import { SearchIcon, SourceIcon, type IconProps } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { TOUCH_HIDDEN_CLASS } from "../../lib/touch.js";
import {
  AlignMenu,
  BlockTypeMenu,
  hasBlockTypeMenu,
  hasListMenu,
  ListMenu,
  moreFormatTools,
  MoreFormatMenu,
} from "./FormatMenus.js";
import { insertItemsFor } from "../core/insertItems.js";
import { InsertMenuButton } from "./InsertMenuButton.js";
import { TOOLBAR_ROW_MARKS } from "./rowMarks.js";
import { HighlightMenuButton } from "./ColorMenus.js";
import { ShortcutsButton } from "./ShortcutsButton.js";
import { SEARCH_KEYS } from "../features/search/searchTool.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import { tableChunk } from "../features/table/tableTool.js";
import { type KitToolButton, type ToolList } from "../core/toolDescriptor.js";
import { ToolButtonView, useToolLabel } from "./ToolButtonView.js";
import type { Tool } from "../core/tools.js";

// Подписи сочетаний переехали в общую таблицу; экспорт остаётся для Меню вставки.
export { isApple, shortcutLabel };

type EditorMessages = UiMessages["editor"];

/**
 * Одна кнопка Панели — строка таблицы, как `FormatAction` в оригинале.
 *
 * Сочетания здесь нет: оно берётся из общей таблицы по `id` (`shortcuts.ts`),
 * а не живёт у каждой кнопки своё.
 */
interface Action {
  kind: "button";
  tool: Tool;
  /** Стабильный ключ: у одного Инструмента может быть несколько кнопок. */
  id: string;
  label: (messages: EditorMessages) => string;
  icon: ComponentType<IconProps>;
  run: (editor: Editor) => void;
  can: (editor: Editor) => boolean;
  /** Есть — кнопка-переключатель с `aria-pressed`; нет — разовое действие. */
  isActive?: (editor: Editor) => boolean;
}

/**
 * Место Панели под меню или поповер со своим компонентом. Есть ли оно,
 * решает `present` по набору инструментов: у меню свои правила (меню «¶» из
 * одного «Текста» не рисуется, «Списки» с одним пунктом — рисуются), и Панель
 * их не повторяет, а спрашивает у модуля меню.
 */
interface Widget {
  kind: "insert" | "source" | "blockType" | "align" | "highlight" | "more" | "lists" | "table";
  id: string;
  /** `withView` — у хозяина есть пункт «Невидимые символы» (фиксированная Панель). */
  present: (tools: ToolList, withView: boolean) => boolean;
}

/**
 * Место кнопок Инструмента на описании (`toolDescriptor.ts`) — привилегия кита:
 * Панель отводит его по имени, а кнопки, подписи и действия берёт из описания.
 * Выключенный Инструмент уносит кнопки вместе с описанием, и место пустеет.
 */
interface Slot {
  kind: "slot";
  id: string;
  tool: Tool;
}

/** Кнопка описания на своём месте Панели. */
interface ToolEntry {
  kind: "tool";
  id: string;
  button: KitToolButton;
}

type Entry = Action | Widget | Slot;

const widget = (kind: Widget["kind"], present: Widget["present"]): Widget => ({
  kind,
  id: kind,
  present,
});

const slot = (tool: Tool): Slot => ({ kind: "slot", id: tool, tool });

/**
 * Группы Панели по порядку, через разделитель:
 *
 *   «+» · HTML · «¶» · выравнивание ▾ | жирный · курсив · маркер · «…» |
 *   списки ▾ | ссылка · картинка · таблица ▾ · эмодзи | отмена · повтор
 *
 * и справочник сочетаний у правого края. Группы — по смыслу: Блок целиком
 * (вставить, сменить тип, выровнять), Метки, вид списка, вставка внутрь текста,
 * история. Пустая группа выпадает вместе со своим разделителем.
 *
 * ПОРЯДОК ЗАДАЁТ КИТ, а не `tools`: Панель с переставленными кнопками у двух
 * экранов одного продукта пришлось бы учить заново.
 *
 * МЕНЮ ВМЕСТО РЯДА КНОПОК. Прежде здесь стояло правило «все действия — кнопками
 * в ряд, без выпадающих «Ещё» и «Списки»»: скрытое в меню действие не
 * показывало `aria-pressed`, и скринридер не узнал бы, включён ли курсив, не
 * открыв меню. Довод снят ADR-0054: пункт с отметкой
 * (`menuitemradio`, `menuitemcheckbox`) объявляет состояние, а кнопка меню
 * несёт текущее значение в имени и иконке (`FormatMenus.tsx`). Тип Блока и
 * цитата — в «¶»; редкие метки, цвета и очистка — в «…»; выравнивание и
 * списки — в своих меню, а горизонтальная линия
 * осталась только в Меню вставки; Блок кода — пунктом-флажком
 * «…»: пользуются им нечасто (решение владельца). Кнопками
 * остались частые метки (жирный и курсив — решение владельца),
 * ссылка, картинка и история. Маркер — кнопка с рядом маркеров
 * (`ColorMenus.tsx`); «Цвет» с сетками текста и маркера — в меню выделения, а не
 * здесь (решение владельца: без дублей).
 *
 * «HTML» — сразу за «+», как у Redactor: переключатель режима
 * Документа целиком, а не действие над Блоком под кареткой. Он есть только у
 * фиксированной Панели (`source`): плавающая Панель и меню выделения живут над
 * выделением в Документе, а в режиме Документа нет — вход был бы без выхода.
 *
 * Уже своей ширины ряд переносится `flex-wrap` примитива, а не уезжает за
 * край, — группами целиком: с кнопками «Маркер» и «Цвет» Панель
 * `full` в колонке 640 px занимает две строки, и группа не делится на сирот.
 *
 * КНОПКИ ОПИСАНИЙ (ADR-0058, п. 5.3). Ссылка, картинка и эмодзи стоят на местах, которые
 * кит отвёл их Инструментам (`slot`). Кнопки описаний без места кита — своя
 * группа перед «Отменить» и «Повторить», в порядке списка Инструментов.
 */
/** Инструменты «…» Панели: в её ряду из меток «…» нет ни одной. */
const MORE_FORMAT_TOOLS = moreFormatTools();

const GROUPS: readonly (readonly Entry[])[] = [
  [
    widget("insert", (tools) => insertItemsFor(tools).length > 0),
    widget("source", (tools) => tools.has("source")),
    widget("blockType", hasBlockTypeMenu),
    widget("align", (tools) => tools.has("align")),
  ],
  [
    // Частые Метки ряда — общие с плашкой меню выделения (`rowMarks.ts`).
    ...TOOLBAR_ROW_MARKS.map((mark): Action => ({ kind: "button", ...mark })),
    // Только «Маркер»: «Цвет» с обеими сетками — в меню выделения.
    widget("highlight", (tools) => tools.has("highlight")),
    // «Невидимые символы» живёт в «…» только у фиксированной Панели: если он
    // единственный, кнопка «…» нужна ради него одного.
    widget(
      "more",
      (tools, withView) =>
        MORE_FORMAT_TOOLS.some((tool) => tools.has(tool)) ||
        (withView && tools.has("invisibleCharacters"))
    ),
  ],
  [widget("lists", hasListMenu)],
  [slot("link"), slot("image"), widget("table", (tools) => tools.has("table")), slot("emoji")],
  [slot("history")],
];

/** Инструменты, чьим кнопкам кит отвёл место на Панели. */
const SLOTTED: readonly Tool[] = GROUPS.flat().flatMap((entry) =>
  entry.kind === "slot" ? [entry.tool] : []
);

type GroupEntry = Action | Widget | ToolEntry;

/**
 * Группы Панели для набора инструментов — общие у Панели и её Скелета
 * (`ToolbarSkeleton`): кнопки описаний стоят на местах кита (`slot`) и своей
 * группой перед историей. Предикат видимости кнопок описаний здесь не
 * читается — для него нужен движок.
 */
function toolbarGroups(tools: ToolList, withSource: boolean, withView: boolean): GroupEntry[][] {
  const described = tools.descriptors;
  const toolEntries = (buttons: readonly KitToolButton[] = []) =>
    buttons.map((button): ToolEntry => ({ kind: "tool", id: button.id, button }));
  const kitGroups = GROUPS.map((group) =>
    group.flatMap((entry): GroupEntry[] => {
      if (entry.kind === "slot") {
        return toolEntries(described.find((descriptor) => descriptor.name === entry.tool)?.buttons);
      }
      if (entry.kind === "button") return tools.has(entry.tool) ? [entry] : [];
      return entry.present(tools, withView) && (entry.kind !== "source" || withSource)
        ? [entry]
        : [];
    })
  );
  const ownGroup = toolEntries(
    described
      .filter((descriptor) => !(SLOTTED as readonly string[]).includes(descriptor.name))
      .flatMap((descriptor) => descriptor.buttons ?? [])
  );
  return [...kitGroups.slice(0, -1), ownGroup, kitGroups[kitGroups.length - 1]!];
}

/** Места Панели, у которых кнопка — меню со стрелкой: она шире квадратной иконки. */
const MENU_WIDGETS: ReadonlySet<Widget["kind"]> = new Set(["blockType", "align", "lists", "table"]);

/** Кнопка Панели: иконка без подписи, имя — `aria-label`, подсказка с сочетанием. */
const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const BUTTON_PRESSED_CLASS = buttonClasses({
  variant: "ghost",
  size: "sm",
  iconOnly: true,
  selected: true,
});

const TOOL_BUTTON_CLASSES = { idle: BUTTON_CLASS, pressed: BUTTON_PRESSED_CLASS };

/** Место меню со стрелкой в Скелете: те же классы, что у кнопки `FormatMenu`. */
const MENU_PLACE_CLASS = cn(buttonClasses({ variant: "ghost", size: "sm" }), "gap-0.5 px-1.5");

export interface EditorToolbarProps {
  editor: Editor;
  tools: ToolList;
  /** Поле выключено: кнопки видны, но не нажимаются и не берут фокус. */
  disabled: boolean;
  /** Пункт «Вставить таблицу…» меню «Таблица»: окно держит `RichTextEditor`. */
  onInsertTable?: () => void;
  /**
   * Справочник сочетаний — последней кнопкой, у правого края. Есть
   * только у фиксированной Панели: над выделением (`floating`) места для него
   * нет, а меню выделения его не несёт.
   */
  shortcutsReference?: boolean;
  /**
   * HTML-режим: кнопка «HTML» и её состояние. Режим держит
   * `RichTextEditor`; без пропа кнопки нет — так у плавающей Панели.
   */
  source?: { active: boolean; onToggle: () => void };
  /**
   * Кнопка «Поиск» у правого края, перед справочником сочетаний.
   * Панель поиска держит `RichTextEditor`; без пропа кнопки нет — так у
   * плавающей Панели и без Инструмента `search`.
   */
  search?: { open: boolean; onToggle: () => void };
  /**
   * Пункт «Невидимые символы» в меню «…». Показ держит движок (плагин
   * расширения), поэтому проп — только «пункт есть»: отметку меню читает из
   * движка само. Без пропа пункта нет — так у плавающей Панели (она рисует то же
   * «…», что и фиксированная) и без Инструмента `invisibleCharacters`.
   */
  invisibleCharacters?: boolean;
}

/**
 * Фиксированная Панель Редактора.
 *
 * ПРИМИТИВЫ КИТА ВМЕСТО shadcn. ADR-0050 разрешает оставить компоненты shadcn
 * внутри Редактора, но для Панели нужные уже есть в ките, и каждый закрывает
 * обязательный контракт сам:
 *
 * - `Toolbar` — `role="toolbar"`, одна остановка Tab, стрелки, Home и End; он
 *   же не отнимает Home и End у `[contenteditable]`.
 * - `Menu` (react-aria) — меню «+», «¶», «…», выравнивания, списков и
 *   таблицы: Escape и z-index идут через стек слоёв ADR-0041, и Escape внутри
 *   меню в `Dialog` закрывает меню, а не окно. `DropdownMenu` shadcn тянул бы
 *   новый Radix-пакет в peer-зависимости ради того же поведения.
 * - `Tooltip` и `Kbd` — подсказка с сочетанием на ступени `OVERLAY_LAYER.popover`.
 *
 * Состояние кнопок читается через `useEditorState`: Панель перерисовывается,
 * только когда меняется то, что она показывает, а не на каждой транзакции.
 */
export function EditorToolbar({
  editor,
  tools,
  disabled,
  onInsertTable,
  shortcutsReference = false,
  source,
  search,
  invisibleCharacters = false,
}: EditorToolbarProps) {
  const messages = useMessages().editor;
  const label = useToolLabel();
  const apple = isApple();
  /*
    Кнопки описаний — проекция списка Инструментов: на месте кита (`slot`) и
    своей группой перед историей. Есть ли кнопка сейчас, решает ещё и её
    предикат видимости — после чтения состояния ниже.
  */
  const present = toolbarGroups(tools, source != null, invisibleCharacters);
  const entries = present.flat();
  const actions = entries.filter((entry): entry is Action => entry.kind === "button");
  const toolButtons = entries.flatMap((entry) => (entry.kind === "tool" ? [entry.button] : []));
  const insertItems = insertItemsFor(tools);
  /*
    HTML-режим: Документа на экране нет, и применять действия Панели не к
    чему. Кнопки и меню — `aria-disabled` и остаются в обходе стрелками;
    доступны только сама «HTML» и справочник сочетаний.
  */
  const locked = source?.active ?? false;

  /*
    `aria-keyshortcuts` — сочетание, которым в Панель попадают из документа
    (`Alt+F10`, `extensions.ts`): скринридер называет его на самой Панели, и
    путь в неё узнают, не открывая документацию. Атрибут ставится на узел, а
    не пропом: `Toolbar` react-aria пропускает в DOM только известные ему
    атрибуты, и этот до разметки не доходит.
  */
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    toolbarRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
  }, []);

  /*
    Сравнение результата — глубокое (умолчание `useEditorState`), поэтому
    объект с флагами пересобирается на каждой транзакции, а рендер случается
    только при смене флага.
  */
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const flags: Record<string, { active: boolean; can: boolean; visible?: boolean }> = {};
      for (const action of [...actions, ...toolButtons]) {
        flags[action.id] = {
          active: action.isActive?.(current) ?? false,
          can: current.isEditable && action.can(current),
        };
      }
      for (const button of toolButtons) {
        flags[button.id]!.visible = button.isVisible?.(current) ?? true;
      }
      return { flags, editable: current.isEditable };
    },
  });

  const groups = present
    .map((group) =>
      group.filter((entry) => entry.kind !== "tool" || state.flags[entry.id]?.visible !== false)
    )
    .filter((group) => group.length > 0);

  /*
    Что меню берёт от места (`FormatMenuHostProps`): движок, инструменты,
    выключенность и подпись сочетаний. Движок, который не правится, выключает
    меню так же, как выключенное поле.
  */
  const host = {
    editor,
    tools,
    disabled: disabled || !state.editable,
    unavailable: locked,
    shortcut: (keys: readonly string[]) => shortcutLabel(keys, apple),
  };

  const renderButton = (action: Action) => {
    const flags = state.flags[action.id];
    const pressed = flags?.active ?? false;
    const label = action.label(messages);
    const Icon = action.icon;
    const keys = findShortcutKeys(action.id);
    /*
      Недоступное действие — `aria-disabled`, а не `disabled`: APG советует
      оставлять действия панели фокусируемыми, иначе стрелки перепрыгивают
      кнопку молча, и непонятно, куда она делась. Выключенное ПОЛЕ — другое
      дело: в нём фокусу делать нечего.
    */
    const unavailable = locked || !(flags?.can ?? false);
    return (
      <Tooltip
        key={action.id}
        content={
          <span className="flex items-center gap-2">
            {label}
            {keys && <Kbd aria-hidden="true">{shortcutLabel(keys, apple)}</Kbd>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={label}
          aria-pressed={action.isActive ? pressed : undefined}
          aria-disabled={unavailable || undefined}
          aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
          disabled={disabled}
          onClick={() => {
            if (!unavailable) action.run(editor);
          }}
          className={cn(pressed ? BUTTON_PRESSED_CLASS : BUTTON_CLASS)}
        >
          <Icon size={16} aria-hidden />
        </button>
      </Tooltip>
    );
  };

  /*
    Кнопка «HTML» — переключатель режима с `aria-pressed`. Сочетания у неё нет
    (спека среза), подсказка — её имя. Выключенное поле выключает и её: режим
    при этом остаётся открытым, а поле HTML — выключенным вместе с ней.
  */
  const renderSourceButton = ({ active, onToggle }: NonNullable<EditorToolbarProps["source"]>) => (
    <Tooltip key="source" content={messages.source}>
      <button
        type="button"
        aria-label={messages.source}
        aria-pressed={active}
        disabled={disabled}
        onClick={onToggle}
        className={cn(active ? BUTTON_PRESSED_CLASS : BUTTON_CLASS)}
      >
        <SourceIcon size={16} aria-hidden />
      </button>
    </Tooltip>
  );

  return (
    /*
      Своя группа подсказок. Корневой `TooltipProvider` кит оставляет
      потребителю, но Редактор без него падал бы (Radix требует провайдер), а
      требовать его ради одного поля — значит ломать вставку Редактора в
      приложение, где подсказок ещё не было. Группа на Панель заодно даёт то,
      ради чего провайдер и существует: пока курсор идёт по соседним кнопкам,
      подсказки сменяют друг друга без задержки.
    */
    <TooltipProvider>
      <Toolbar ref={toolbarRef} aria-label={messages.toolbar} className="gap-0.5">
        {groups.map((group, index) => (
          /*
            Группа — неразрывный блок: узкая Панель переносит её
            целиком, и «Отменить · Повторить» не расходятся по строкам.
            Разделитель — в конце группы, а не в начале: перенесённая строка
            начинается с кнопки, а не с черты.
          */
          <div key={group.map((entry) => entry.id).join()} className="flex items-center gap-0.5">
            {group.map((entry) => {
              switch (entry.kind) {
                case "insert":
                  return (
                    <InsertMenuButton
                      key={entry.id}
                      editor={editor}
                      items={insertItems}
                      disabled={host.disabled}
                      unavailable={locked}
                      shortcut={host.shortcut}
                    />
                  );
                case "blockType":
                  return <BlockTypeMenu key={entry.id} {...host} />;
                case "align":
                  return <AlignMenu key={entry.id} {...host} />;
                case "highlight":
                  return <HighlightMenuButton key={entry.id} {...host} />;
                case "more":
                  return (
                    <MoreFormatMenu
                      key={entry.id}
                      {...host}
                      invisibleCharacters={invisibleCharacters}
                    />
                  );
                case "lists":
                  return <ListMenu key={entry.id} {...host} />;
                case "table": {
                  // Меню «Таблица» — из ленивого чанка таблицы (`tableTool.ts`):
                  // Панель рисуется при живом движке, а он с таблицей — после чанка.
                  const TableMenuButton = tableChunk()?.TableMenuButton;
                  return (
                    TableMenuButton && (
                      <TableMenuButton
                        key={entry.id}
                        editor={editor}
                        disabled={host.disabled}
                        unavailable={locked}
                        onInsertDialog={onInsertTable}
                        shortcut={host.shortcut}
                      />
                    )
                  );
                }
                case "source":
                  return source && renderSourceButton(source);
                case "tool":
                  return (
                    <ToolButtonView
                      key={entry.id}
                      editor={editor}
                      button={entry.button}
                      label={label(entry.button.label)}
                      pressed={state.flags[entry.id]?.active ?? false}
                      unavailable={locked || !(state.flags[entry.id]?.can ?? false)}
                      disabled={host.disabled}
                      classes={TOOL_BUTTON_CLASSES}
                    />
                  );
                case "button":
                  return renderButton(entry);
              }
            })}
            {/* `h-auto`: группа без своей высоты, и `h-full` черты дал бы ноль —
                черту растягивает `self-stretch`. */}
            {index < groups.length - 1 && <Separator className="h-auto" />}
          </div>
        ))}
        {(search || shortcutsReference) && (
          /*
            Поиск и справочник — одна группа у правого края. Узкая Панель
            переносит её на новую строку целиком и тоже вправо: по одной кнопка
            справочника осталась бы сиротой в начале строки.
          */
          <div className="ml-auto flex items-center gap-0.5">
            {search && (
              /*
                Переключатель панели: `aria-pressed` — панель открыта. В
                HTML-режиме Документа на экране нет, и искать негде — кнопка
                `aria-disabled`, как остальные действия.
              */
              <Tooltip
                content={
                  <span className="flex items-center gap-2">
                    {messages.search}
                    <Kbd aria-hidden="true">{shortcutLabel(SEARCH_KEYS, apple)}</Kbd>
                  </span>
                }
              >
                <button
                  type="button"
                  aria-label={messages.search}
                  aria-pressed={search.open}
                  aria-disabled={locked || undefined}
                  aria-keyshortcuts={ariaShortcut(SEARCH_KEYS, apple)}
                  disabled={disabled}
                  onClick={() => {
                    if (!locked) search.onToggle();
                  }}
                  className={search.open ? BUTTON_PRESSED_CLASS : BUTTON_CLASS}
                >
                  <SearchIcon size={16} aria-hidden />
                </button>
              </Tooltip>
            )}
            {shortcutsReference && <ShortcutsButton tools={tools} disabled={disabled} />}
          </div>
        )}
      </Toolbar>
    </TooltipProvider>
  );
}

export interface ToolbarSkeletonProps {
  tools: ToolList;
  /** Есть ли кнопка «HTML» (`source` у Панели). */
  source: boolean;
  /** Есть ли кнопка «Поиск» и справочник сочетаний у правого края. */
  search: boolean;
  /** Есть ли в «…» пункт «Невидимые символы»: от него зависит, нужна ли Панели кнопка «…». */
  invisibleCharacters: boolean;
  shortcutsReference: boolean;
}

/**
 * Скелет Панели (ADR-0058, п. 11.4): невидимая копия её раскладки — те же
 * группы, те же размеры кнопок и разделителей, тот же перенос группами. Строк
 * у Скелета столько же, сколько будет у Панели на этой ширине, и движок встаёт
 * на его место без прыжка высоты (с кнопками «Маркер» и «Цвет»
 * Панель `full` в колонке 640 px — две строки, а Скелет держал одну).
 */
export function ToolbarSkeleton({
  tools,
  source,
  search,
  invisibleCharacters,
  shortcutsReference,
}: ToolbarSkeletonProps) {
  const groups = toolbarGroups(tools, source, invisibleCharacters).filter(
    (group) => group.length > 0
  );
  const place = (key: string, menu: boolean, className?: string) => (
    <span key={key} className={cn(menu ? MENU_PLACE_CLASS : BUTTON_CLASS, className)}>
      <span className="size-4" />
      {menu && <span className="size-3" />}
    </span>
  );
  return (
    <div aria-hidden="true" className="invisible flex flex-row flex-wrap items-center gap-0.5">
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-0.5">
          {group.map((entry) =>
            place(
              entry.id,
              entry.kind !== "tool" && entry.kind !== "button" && MENU_WIDGETS.has(entry.kind)
            )
          )}
          {index < groups.length - 1 && <Separator orientation="vertical" className="h-auto" />}
        </div>
      ))}
      {(search || shortcutsReference) && (
        <div className="ml-auto flex items-center gap-0.5">
          {search && place("search", false)}
          {shortcutsReference && place("shortcuts", false, TOUCH_HIDDEN_CLASS)}
        </div>
      )}
    </div>
  );
}

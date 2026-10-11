"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import type { UiMessages } from "../../i18n/messages.js";
import { useMessages } from "../../i18n/useMessages.js";
import { BlockedIcon, ChevronDownIcon, HighlightIcon, TextColorIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { buttonClasses } from "../../lib/button.js";
import { normalizeCustomColor, type CustomColorKind } from "../features/color/customColor.js";
import {
  EDITOR_MARKER_NAMES,
  EDITOR_TEXT_COLOR_NAMES,
  type EditorMarkerName,
  type EditorTextColorName,
} from "../styles/palette.js";
import { EDITOR_MARKER_CLASS, EDITOR_TEXT_COLOR_CLASS } from "../styles/prose.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import type { FormatMenuHostProps } from "./FormatMenus.js";

type EditorMessages = UiMessages["editor"];

/**
 * ПОПОВЕРЫ ЦВЕТА. Образец — Notion-like шаблон Tiptap: цвет
 * выбирают глазами, по кружкам, одним щелчком. Прежде цвет текста и маркер
 * были подменю «…» — пункты словом, цвет виден только у образца строки.
 *
 * Кнопки две, как в образце (решение владельца):
 *
 * - «Цвет» — буква «A» текущего цвета текста со стрелкой; поповер из двух
 *   сеток: «Цвет текста» (шесть тонов) и «Цвет маркера» (девять цветов), в
 *   конце каждой — «Убрать цвет» и «Убрать маркер» иконкой. У
 *   заголовка каждой сетки — «Свой цвет…».
 * - «Маркер» — щелчок открывает ряд из девяти маркеров и «Убрать маркер».
 *   Прежний один щелчок жёлтым ушёл: цвет маркера теперь выбирают
 *   всегда, и жёлтый — один щелчок по кружку.
 *
 * РОЛИ — МЕНЮ, А НЕ РАДИОГРУППА. В радиогруппе (`SwatchGroup` кита) стрелка
 * сразу выбирает: здесь первая же стрелка покрасила бы текст и закрыла
 * поповер. Поэтому паттерн меню APG: `menu` › `group` с заголовком ›
 * `menuitemradio` с `aria-checked` (и «Свой цвет…» — вариант того же выбора,
 * как прежде в подменю), «Убрать маркер» — `menuitem`. Стрелки ходят по сетке,
 * Enter, пробел и щелчок применяют.
 *
 * ПОПОВЕР ДЕРЖИТ КНОПКА, и в плашке меню выделения тоже: пока открыт, у кнопки
 * `aria-expanded="true"`, и плашка не прячется (`showOverSelection`).
 */

/** Цвет метки: имя палитры либо `#rrggbb` автора; `null` — цвета нет. */
type CurrentColor = string | null;

function colorOf(attributes: Record<string, unknown>, names: readonly string[]): CurrentColor {
  const found = names.find((name) => name === attributes.color);
  return found ?? normalizeCustomColor(attributes.color);
}

const TEXT_COLOR_LABEL: Record<EditorTextColorName, (m: EditorMessages) => string> = {
  accent: (m) => m.colorAccent,
  success: (m) => m.colorSuccess,
  warning: (m) => m.colorWarning,
  danger: (m) => m.colorDanger,
  lime: (m) => m.colorLime,
  muted: (m) => m.colorMuted,
};

const MARKER_LABEL: Record<EditorMarkerName, (m: EditorMessages) => string> = {
  gray: (m) => m.markerGray,
  brown: (m) => m.markerBrown,
  orange: (m) => m.markerOrange,
  yellow: (m) => m.markerYellow,
  green: (m) => m.markerGreen,
  blue: (m) => m.markerBlue,
  purple: (m) => m.markerPurple,
  pink: (m) => m.markerPink,
  red: (m) => m.markerRed,
};

/** Текущий цвет словом — для имени кнопки «Маркер: Розовый». */
function colorName(
  current: CurrentColor,
  labels: Record<string, (m: EditorMessages) => string>,
  none: string,
  messages: EditorMessages
): string {
  if (current === null) return none;
  if (current.startsWith("#")) return messages.colorCustomCurrent({ hex: current });
  return labels[current]?.(messages) ?? none;
}

/* ─── Сетка ─────────────────────────────────────────────────────────────── */

interface GridItem {
  id: string;
  label: string;
  /**
   * `radio` — вариант выбора, отмечается: цвет и «Свой цвет…» (отмечен, когда на
   * выделении цвет автора; выбор открывает `ColorPicker`). `action` — «Убрать
   * маркер»: действие, а не вариант.
   */
  kind: "radio" | "action";
  checked?: boolean;
  /** Образец; у действия без образца — подпись словом. */
  swatch?: ReactNode;
  /** Подсказка с именем — у иконки без подписи («Убрать маркер»). */
  tooltip?: boolean;
}

interface GridSection {
  id: string;
  /** Заголовок сетки; без него группа называется `aria-label` меню. */
  label?: string;
  /** Пункт у заголовка справа — «Свой цвет…». */
  header?: GridItem;
  items: GridItem[];
}

/** Кружков в ряду: столько у образца, и обе сетки ровно в два ряда. */
const COLUMNS = 5;

/**
 * Ячейка: кружок 24 px и отступ под кольцо выбранности, как у `SwatchGroup`
 * кита — кольцо лежит на подложке поповера, а не на цвете кружка, и держит
 * контраст в любой теме. Фокус — акцентный контур ещё дальше.
 */
const CELL_CLASS =
  "block cursor-pointer rounded-full p-1 transition-shadow outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong";

const SWATCH_CLASS = "flex size-6 items-center justify-center rounded-full";

const HEADER_ACTION_CLASS =
  "text-fg-1 hover:text-fg-0 rounded-xs text-xs underline-offset-2 hover:underline " +
  "outline-none focus-visible:outline-2 focus-visible:outline-accent-strong";

/**
 * Меню-сетка. Обход — свой: `Menu` react-aria ходит только вверх и вниз, а
 * здесь ряды. Фокус кочует (roving tabindex): Tab-остановка у меню одна, на
 * отмеченном цвете или на первом пункте, — её и берёт Radix при открытии.
 *
 * Стрелки: ← → — соседний пункт по порядку, ↑ ↓ — тот же столбец в ряду выше
 * или ниже, через заголовки сеток; Home и End — первый и последний пункт. Края
 * не зацикливаются: прыжок с последнего цвета на первый читается как промах.
 */
function ColorGrid({
  label,
  sections,
  onPick,
}: {
  label: string;
  sections: GridSection[];
  onPick: (id: string) => void;
}) {
  const baseId = useId();
  const rows: GridItem[][] = [];
  for (const section of sections) {
    if (section.header) rows.push([section.header]);
    for (let index = 0; index < section.items.length; index += COLUMNS) {
      rows.push(section.items.slice(index, index + COLUMNS));
    }
  }
  const flat = rows.flat();
  // Фокус при открытии — на отмеченном цвете, без цвета — на первом кружке, а не
  // на «Свой цвет…» у заголовка.
  const checked = flat.findIndex((item) => item.checked);
  const initial = Math.max(0, checked >= 0 ? checked : flat.findIndex((item) => item.swatch));
  const [active, setActive] = useState(initial);
  const refs = useRef(new Map<string, HTMLElement>());

  const focus = (index: number) => {
    const item = flat[index];
    if (!item) return;
    setActive(index);
    refs.current.get(item.id)?.focus();
  };

  const position = (index: number) => {
    let seen = 0;
    for (let row = 0; row < rows.length; row++) {
      const length = rows[row]!.length;
      if (index < seen + length) return { row, column: index - seen };
      seen += length;
    }
    return { row: 0, column: 0 };
  };
  const startOf = (row: number) => rows.slice(0, row).reduce((sum, r) => sum + r.length, 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { row, column } = position(active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = Math.min(active + 1, flat.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(active - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = flat.length - 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const target = row + (event.key === "ArrowDown" ? 1 : -1);
      if (target >= 0 && target < rows.length) {
        next = startOf(target) + Math.min(column, rows[target]!.length - 1);
      } else next = active;
    }
    if (next === null) return;
    event.preventDefault();
    focus(next);
  };

  const cell = (item: GridItem, index: number, header = false) => {
    const button = (
      <button
        key={item.id}
        ref={(node) => {
          if (node) refs.current.set(item.id, node);
          else refs.current.delete(item.id);
        }}
        type="button"
        role={item.kind === "radio" ? "menuitemradio" : "menuitem"}
        aria-checked={item.kind === "radio" ? (item.checked ?? false) : undefined}
        aria-label={item.swatch ? item.label : undefined}
        tabIndex={index === active ? 0 : -1}
        onFocus={() => setActive(index)}
        onClick={() => onPick(item.id)}
        className={
          header
            ? HEADER_ACTION_CLASS
            : cn(CELL_CLASS, item.checked ? "ring-fg-0 ring-2" : "hover:ring-line hover:ring-2")
        }
      >
        {item.swatch ?? item.label}
      </button>
    );
    return item.tooltip ? (
      // Подсказка на обёртке: на самой кнопке Radix добавил бы `aria-describedby`,
      // и скринридер прочитал бы имя дважды (как у `SwatchGroup`).
      <Tooltip key={item.id} content={item.label}>
        <span className="block">{button}</span>
      </Tooltip>
    ) : (
      button
    );
  };

  let index = 0;
  return (
    <div role="menu" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-3">
      {sections.map((section) => {
        const headingId = `${baseId}-${section.id}`;
        const header = section.header ? cell(section.header, index++, true) : null;
        const items = section.items.map((item) => cell(item, index++));
        return (
          <div
            key={section.id}
            role="group"
            aria-labelledby={section.label ? headingId : undefined}
            aria-label={section.label ? undefined : label}
            className="flex flex-col gap-1.5"
          >
            {(section.label || header) && (
              <div className="flex items-baseline justify-between gap-4 px-1">
                {section.label && (
                  <span id={headingId} className="text-fg-0 text-xs font-semibold">
                    {section.label}
                  </span>
                )}
                {header}
              </div>
            )}
            <div
              className="grid w-fit gap-1"
              style={{ gridTemplateColumns: `repeat(${COLUMNS}, min-content)` }}
            >
              {items}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Образцы ───────────────────────────────────────────────────────────── */

/** Кружок цвета текста: буква «A» этим цветом на кольце, как у образца. */
function TextSwatch({ name }: { name: EditorTextColorName }) {
  return (
    <span
      aria-hidden
      className={cn(
        SWATCH_CLASS,
        "border-line border text-[13px] leading-none font-semibold",
        EDITOR_TEXT_COLOR_CLASS[name]
      )}
    >
      A
    </span>
  );
}

/** Кружок маркера: заливка токеном `--marker-<имя>`. */
function MarkerSwatch({ name }: { name: EditorMarkerName }) {
  return (
    <span
      aria-hidden
      className={cn(SWATCH_CLASS, "border-line-soft border", EDITOR_MARKER_CLASS[name])}
    />
  );
}

/**
 * Снятие цвета — последняя ячейка сетки, перечёркнутый круг с подсказкой.
 * Не белый кружок первым, как было: тот выглядел ещё одним цветом
 * и стоял отмеченным, когда цвета нет, — будто выбран белый. Это действие, а
 * не вариант выбора, поэтому `menuitem` без отметки.
 */
function removeItem(id: string, label: string): GridItem {
  return {
    id,
    label,
    kind: "action",
    tooltip: true,
    swatch: (
      <span aria-hidden className={cn(SWATCH_CLASS, "text-fg-1")}>
        <BlockedIcon size={18} />
      </span>
    ),
  };
}

/* ─── Кнопки ────────────────────────────────────────────────────────────── */

const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
const BUTTON_SELECTED_CLASS = buttonClasses({
  variant: "ghost",
  size: "sm",
  iconOnly: true,
  selected: true,
});
const MENU_BUTTON_CLASS = cn(buttonClasses({ variant: "ghost", size: "sm" }), "gap-0.5 px-1.5");
const MENU_BUTTON_OPEN_CLASS = cn(
  buttonClasses({ variant: "ghost", size: "sm", selected: true }),
  "gap-0.5 px-1.5"
);

const POPOVER_CLASS = cn(GLASS_PANEL_CLASS, "w-auto p-3");

/** Как закрыт поповер: выбором (фокус в Документ), передачей (`ColorPicker`) или иначе. */
type Closing = "document" | "handoff" | null;

/**
 * Поповер у кнопки: Radix ведёт стек слоёв (Escape в поповере внутри `Dialog`
 * закрывает поповер, ADR-0041) и берёт фокус на Tab-остановку сетки.
 *
 * ФОКУС ПРИ ЗАКРЫТИИ. После выбора — в Документ, на прежнее выделение: человек
 * красил текст и продолжает писать. После «Свой цвет…» — никуда: фокус уже
 * забрал поповер `ColorPicker`, и фокус в Документ закрыл бы его как щелчок
 * мимо. После Escape — на кнопку, как у меню APG. Щелчок мимо фокус не трогает:
 * человек сам выбрал, куда его поставить.
 */
function ColorPopover({
  editor,
  open,
  onOpenChange,
  label,
  trigger,
  tooltip,
  children,
  pickedRef,
}: {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  trigger: ReactNode;
  tooltip: string;
  children: ReactNode;
  /** Чем закрыт поповер: выбором в Документ или передачей другому поповеру. */
  pickedRef: { current: Closing };
}) {
  const interactedOutside = useRef(false);
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip content={tooltip}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </Tooltip>
      <PopoverContent
        aria-label={label}
        className={POPOVER_CLASS}
        onOpenAutoFocus={() => {
          interactedOutside.current = false;
          pickedRef.current = null;
        }}
        onInteractOutside={() => {
          interactedOutside.current = true;
        }}
        onCloseAutoFocus={(event) => {
          if (pickedRef.current !== null || interactedOutside.current) event.preventDefault();
          if (pickedRef.current === "document" && !editor.isDestroyed) editor.view.focus();
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

export interface ColorMenuButtonProps extends FormatMenuHostProps {
  /** «Свой цвет…»: поповер `ColorPicker` держит `RichTextEditor`. Нет — пункта нет. */
  onCustomColor?: (kind: CustomColorKind) => void;
}

/**
 * Кнопка «Цвет»: иконка «A» текущим цветом текста и стрелка. Сетка маркера —
 * только при инструменте `highlight`: без него Метки маркера нет в Схеме.
 */
export function ColorMenuButton({
  editor,
  tools,
  disabled,
  unavailable = false,
  onCustomColor,
}: ColorMenuButtonProps) {
  const messages = useMessages().editor;
  const withHighlight = tools.has("highlight");
  const [open, setOpen] = useState(false);
  const picked = useRef<Closing>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      text: colorOf(current.getAttributes("textStyle"), EDITOR_TEXT_COLOR_NAMES),
      highlight: withHighlight
        ? colorOf(current.getAttributes("highlight"), EDITOR_MARKER_NAMES)
        : null,
      // Метки цвета исключены, например, в блоке кода: кнопка недоступна, как
      // прежний переключатель маркера, а не открывает выбор впустую.
      can: current.can().setColor("accent"),
    }),
  });
  const textName = state.text && !state.text.startsWith("#") ? state.text : null;
  const textCustom = state.text?.startsWith("#") ? state.text : undefined;
  const locked = unavailable || !state.can;

  const pick = (id: string) => {
    const [kind, name] = id.split(":") as [CustomColorKind, string];
    picked.current = name === "custom" ? "handoff" : "document";
    setOpen(false);
    if (name === "custom") return onCustomColor?.(kind);
    const chain = editor.chain().focus();
    if (kind === "text") (name === "none" ? chain.unsetColor() : chain.setColor(name)).run();
    else (name === "none" ? chain.unsetHighlight() : chain.setHighlight({ color: name })).run();
  };

  const custom = (kind: CustomColorKind, current: CurrentColor): GridItem | undefined =>
    onCustomColor
      ? {
          id: `${kind}:custom`,
          label: messages.colorCustom,
          kind: "radio",
          checked: current?.startsWith("#") ?? false,
        }
      : undefined;

  const sections: GridSection[] = [
    {
      id: "text",
      label: messages.textColorSection,
      header: custom("text", state.text),
      items: [
        ...EDITOR_TEXT_COLOR_NAMES.map((name): GridItem => ({
          id: `text:${name}`,
          label: TEXT_COLOR_LABEL[name](messages),
          kind: "radio",
          checked: state.text === name,
          swatch: <TextSwatch name={name} />,
        })),
        removeItem("text:none", messages.colorRemove),
      ],
    },
  ];
  if (withHighlight) {
    sections.push({
      id: "highlight",
      label: messages.highlightSection,
      header: custom("highlight", state.highlight),
      items: [
        ...EDITOR_MARKER_NAMES.map((name): GridItem => ({
          id: `highlight:${name}`,
          label: MARKER_LABEL[name](messages),
          kind: "radio",
          checked: state.highlight === name,
          swatch: <MarkerSwatch name={name} />,
        })),
        removeItem("highlight:none", messages.highlightRemove),
      ],
    });
  }

  const trigger = (
    <button
      type="button"
      // Имя несёт текущий цвет текста, как у остальных кнопок меню (ADR-0054,
      // п. 3): его слышно, не открывая поповер.
      aria-label={messages.colorMenu({
        current: colorName(state.text, TEXT_COLOR_LABEL, messages.colorDefault, messages),
      })}
      aria-haspopup="menu"
      aria-disabled={locked || undefined}
      disabled={disabled}
      onClick={(event) => {
        // Radix не откроет поповер, если обработчик отменил событие.
        if (locked) event.preventDefault();
      }}
      className={open ? MENU_BUTTON_OPEN_CLASS : MENU_BUTTON_CLASS}
    >
      <TextColorIcon
        size={16}
        aria-hidden
        className={textName ? EDITOR_TEXT_COLOR_CLASS[textName as EditorTextColorName] : undefined}
        // Цвет автора — значением: класса под произвольный `#rrggbb` нет.
        style={textCustom ? { color: textCustom } : undefined}
      />
      <ChevronDownIcon size={12} aria-hidden />
    </button>
  );

  return (
    <ColorPopover
      editor={editor}
      open={open}
      onOpenChange={setOpen}
      label={messages.color}
      tooltip={messages.color}
      trigger={trigger}
      pickedRef={picked}
    >
      <ColorGrid label={messages.color} sections={sections} onPick={pick} />
    </ColorPopover>
  );
}

/**
 * Кнопка «Маркер»: щелчок открывает ряд из девяти маркеров и «Убрать маркер».
 * Нажата на вид, пока на выделении маркер; имя называет текущий —
 * «Маркер: Розовый», и его слышно, не открывая поповер.
 */
export function HighlightMenuButton({
  editor,
  disabled,
  unavailable = false,
}: FormatMenuHostProps) {
  const messages = useMessages().editor;
  const [open, setOpen] = useState(false);
  const picked = useRef<Closing>(null);
  const { current, can } = useEditorState({
    editor,
    selector: ({ editor: state }) => ({
      current: colorOf(state.getAttributes("highlight"), EDITOR_MARKER_NAMES),
      can: state.can().setHighlight({ color: "yellow" }),
    }),
  });
  const locked = unavailable || !can;
  const name = colorName(current, MARKER_LABEL, messages.highlightNone, messages);

  const pick = (id: string) => {
    picked.current = "document";
    setOpen(false);
    const chain = editor.chain().focus();
    (id === "remove" ? chain.unsetHighlight() : chain.setHighlight({ color: id })).run();
  };

  const items: GridItem[] = [
    ...EDITOR_MARKER_NAMES.map((marker): GridItem => ({
      id: marker,
      label: MARKER_LABEL[marker](messages),
      kind: "radio",
      checked: current === marker,
      swatch: <MarkerSwatch name={marker} />,
    })),
    removeItem("remove", messages.highlightRemove),
  ];

  const trigger = (
    <button
      type="button"
      aria-label={messages.highlight({ current: name })}
      aria-haspopup="menu"
      aria-disabled={locked || undefined}
      disabled={disabled}
      onClick={(event) => {
        if (locked) event.preventDefault();
      }}
      className={open || current !== null ? BUTTON_SELECTED_CLASS : BUTTON_CLASS}
    >
      <HighlightIcon size={16} aria-hidden />
    </button>
  );

  return (
    <ColorPopover
      editor={editor}
      open={open}
      onOpenChange={setOpen}
      label={messages.highlightToggle}
      tooltip={messages.highlightToggle}
      trigger={trigger}
      pickedRef={picked}
    >
      <ColorGrid
        label={messages.highlightToggle}
        sections={[{ id: "highlight", items }]}
        onPick={pick}
      />
    </ColorPopover>
  );
}

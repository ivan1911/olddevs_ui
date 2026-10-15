"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, type ComponentType } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Separator } from "../../components/content/Separator.js";
import { Toolbar } from "../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import { useMessages } from "../../i18n/useMessages.js";
import type { IconProps } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import type { CustomColorKind } from "../features/color/customColor.js";
import {
  BlockTypeMenu,
  hasBlockTypeMenu,
  hasListMenu,
  ListMenu,
  isMoreMarkId,
  moreFormatTools,
  MoreFormatMenu,
} from "./FormatMenus.js";
import { BUBBLE_ROW_MARKS } from "./rowMarks.js";
import { showOverSelection, useOutOfTabOrder, useSelectionMenuOptions } from "./selectionMenu.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import { projectRecords, type KitToolButton, type ToolList } from "../core/toolDescriptor.js";
import { ToolButtonView, useToolLabel } from "./ToolButtonView.js";
import { ColorMenuButton, HighlightMenuButton } from "./ColorMenus.js";
import type { Tool } from "../core/tools.js";
import { GLASS_INVERSE_CLASS } from "../styles/glass.js";

/** Ключ плагина меню выделения: по нему его показывают командой (`Alt+F10`). */
export const SELECTION_BUBBLE_KEY = "richTextSelectionBubble";

/** «…» плашки без Меток её ряда (подчёркнутого): они здесь кнопками. */
const BUBBLE_MORE_OMIT = BUBBLE_ROW_MARKS.map((mark) => mark.id).filter(isMoreMarkId);
const BUBBLE_MORE_TOOLS = moreFormatTools(BUBBLE_MORE_OMIT);

/**
 * Места кнопок описаний в хвосте плашки — привилегия кита: ссылка, затем
 * эмодзи. Кнопки описаний с флагом Меню выделения без места кита идут
 * следом, в порядке списка Инструментов.
 */
const BUBBLE_TAIL_ORDER: readonly Tool[] = ["link", "emoji"];

/**
 * Инверсная поверхность плашки — переназначением моста `@theme` внутри неё.
 *
 * ПОЧЕМУ ТАК, А НЕ СВОИ КЛАССЫ НА КАЖДОЙ КНОПКЕ. В плашке стоят общие кнопки
 * Редактора — меню «¶» и «…» (`FormatMenus.tsx`) и кнопка эмодзи, — и они
 * красятся словарём кита: `text-fg-1`, `hover:bg-bg-2`, контур фокуса
 * `outline-accent-strong`. Утилита читает переменную моста (`--color-fg-1`),
 * а мост объявлен на корне и наследуется — значит, переобъявленный на плашке
 * мост перекрашивает всех её потомков, а сами кнопки о плашке не знают.
 * Свои классы пришлось бы протаскивать пропом в каждый общий компонент и
 * бороться со специфичностью `hover:` плагина react-aria.
 *
 * ПОЧЕМУ МЕНЮ ОСТАЮТСЯ ОБЫЧНЫМИ. Списки меню, подсказки и поповеры (ссылка,
 * эмодзи) рисуются в портале у `body`, вне плашки, и переназначения не видят:
 * они на обычной поверхности поповера, как требует спека.
 *
 * Роли: текст и иконки — `--text-on-inverse`; наведение (`bg-2`) —
 * `--surface-inverse-hover`; нажатие (`bg-3`, наведение на нажатую) и
 * разделители — `--surface-inverse-pressed`; контур фокуса —
 * `--accent-on-inverse`. Значения и пары контраста — ADR-0055,
 * `scripts/contrast.mjs`.
 */
const INVERSE_SCOPE_CLASS =
  "[--color-fg-0:var(--text-on-inverse)] [--color-fg-1:var(--text-on-inverse)] " +
  "[--color-bg-2:var(--surface-inverse-hover)] [--color-bg-3:var(--surface-inverse-pressed)] " +
  "[--color-line:var(--surface-inverse-pressed)] [--color-line-soft:var(--surface-inverse-pressed)] " +
  "[--color-accent-strong:var(--accent-on-inverse)]";

const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
/** Нажатая метка — своя подложка инверсной поверхности, а не `soft` словаря. */
const BUTTON_PRESSED_CLASS = cn(
  BUTTON_CLASS,
  "bg-surface-inverse-pressed hover:bg-surface-inverse-pressed"
);
const TOOL_BUTTON_CLASSES = { idle: BUTTON_CLASS, pressed: BUTTON_PRESSED_CLASS };

export interface SelectionBubbleProps {
  editor: Editor;
  tools: ToolList;
  /** Поле выключено: кнопки видны, но не нажимаются. */
  disabled: boolean;
  /**
   * Пункт «Свой цвет…» поповера «Цвет»: поповер `ColorPicker` держит
   * Редактор, как у Панели, — плашка прячется, когда фокус уходит в него.
   */
  onCustomColor?: (kind: CustomColorKind) => void;
  /**
   * Ведёт ли сюда `Alt+F10`. В режиме `toolbar="bubble"` — да; поверх
   * фиксированной Панели сочетание ведёт в Панель, и плашка его не объявляет:
   * два `aria-keyshortcuts` на одно сочетание — ложь для скринридера.
   */
  keyboardTarget?: boolean;
  /** Область Документа, которая прокручивается сама (ADR-0059); без неё — окно. */
  scrollTarget?: HTMLElement;
}

/**
 * Меню выделения — `toolbar="bubble"`: компактная плашка на
 * инверсной поверхности над непустым выделением.
 *
 * СОСТАВ ЗАДАН КИТОМ: «¶» · Списки ▾ | жирный · курсив · подчёркнутый · Цвет ▾ ·
 * «…» | ссылка · эмодзи. «Цвет» — обе сетки, текста и маркера;
 * отдельного «Маркера» здесь нет — он на Панели (без инструмента `color` — есть).
 * Кнопка выключенного инструмента не рисуется, порядок от `tools` не зависит. Ссылка и эмодзи — кнопки описаний с флагом Меню выделения
 * (`toolDescriptor.ts`): те же, что на Панели. Справочника сочетаний, отмены и
 * повтора нет: плашка — про выделенный текст, а не про Документ.
 *
 * ПОКАЗ И ПОЗИЦИЯ — те же, что у плавающей Панели (`selectionMenu.ts`):
 * `BubbleMenu` Tiptap показывает плашку после того, как выделение устоялось,
 * прячет на пустом выделении, на картинке и без фокуса в Редакторе и вынимает
 * узел из DOM, когда прячет. Слой — `OVERLAY_LAYER.popover`; в стеке Escape
 * плашка не участвует, Escape в открытом из неё меню закрывает только меню.
 *
 * КЛАВИАТУРА — `Toolbar` кита: `Alt+F10` из Документа, стрелки, Home и End,
 * действие возвращает фокус в Документ на то же выделение.
 */
export function SelectionBubble({
  editor,
  tools,
  disabled,
  onCustomColor,
  keyboardTarget = true,
  scrollTarget,
}: SelectionBubbleProps) {
  const options = useSelectionMenuOptions(scrollTarget);
  const messages = useMessages().editor;
  const label = useToolLabel();
  const apple = isApple();
  const ref = useRef<HTMLDivElement>(null);
  useOutOfTabOrder(ref, editor);

  const marks = BUBBLE_ROW_MARKS.filter((mark) => tools.has(mark.tool));
  const hasMore = BUBBLE_MORE_TOOLS.some((tool) => tools.has(tool));
  /*
    Цвет — одна кнопка «Цвет» с обеими сетками (решение владельца):
    на Панели — «Маркер», здесь — «Цвет», без дублей. Без инструмента `color`
    кнопки «Цвет» нет, и маркер ставит «Маркер» — иначе в плашке его не поставить.
  */
  const hasColor = tools.has("color");
  const hasHighlight = !hasColor && tools.has("highlight");
  const hasBlockType = hasBlockTypeMenu(tools);
  // «Списки ▾» — сразу за «¶», как на Панели: из «¶» списки ушли.
  const hasLists = hasListMenu(tools);
  // Хвост — кнопки описаний с флагом Меню выделения: проекция списка.
  const tail = projectRecords<KitToolButton>(tools, BUBBLE_TAIL_ORDER, (descriptor) =>
    descriptor.buttons?.filter((button) => button.selectionMenu)
  );

  // `aria-keyshortcuts` — путь в плашку из Документа; `Toolbar` react-aria
  // атрибут в DOM не пропускает, поэтому — на узел, как у Панели.
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (keyboardTarget) toolbarRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
    else toolbarRef.current?.removeAttribute("aria-keyshortcuts");
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const flags: Record<string, { active: boolean; can: boolean; visible?: boolean }> = {};
      for (const mark of marks) {
        flags[mark.id] = {
          active: mark.isActive(current),
          can: current.isEditable && mark.can(current),
        };
      }
      for (const button of tail) {
        flags[button.id] = {
          active: button.isActive?.(current) ?? false,
          can: current.isEditable && button.can(current),
          visible: button.isVisible?.(current) ?? true,
        };
      }
      return { flags, editable: current.isEditable };
    },
  });
  const off = disabled || !state.editable;
  const shortcut = (keys: readonly string[]) => shortcutLabel(keys, apple);

  const toggle = (
    id: string,
    label: string,
    Icon: ComponentType<IconProps>,
    pressed: boolean,
    available: boolean,
    run: () => void
  ) => {
    const keys = findShortcutKeys(id);
    return (
      <Tooltip
        key={id}
        content={
          <span className="flex items-center gap-2">
            {label}
            {keys && <Kbd aria-hidden="true">{shortcut(keys)}</Kbd>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          // Недоступное действие — `aria-disabled`, как на Панели: кнопка
          // остаётся в обходе стрелками и не пропадает молча.
          aria-disabled={!available || undefined}
          aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
          disabled={disabled}
          onClick={() => {
            if (available) run();
          }}
          className={pressed ? BUTTON_PRESSED_CLASS : BUTTON_CLASS}
        >
          <Icon size={16} aria-hidden />
        </button>
      </Tooltip>
    );
  };

  const shownTail = tail.filter((button) => state.flags[button.id]?.visible !== false);
  const hasMarks = marks.length > 0 || hasHighlight || hasColor || hasMore;
  const hasTail = shownTail.length > 0;
  // Ни одной кнопки — нет и плашки: пустая тёмная полоса над выделением
  // (`tools={["history", "table"]}` при Панели сверху) ничего не даёт.
  if (!hasBlockType && !hasLists && !hasMarks && !hasTail) return null;

  return (
    <BubbleMenu
      ref={ref}
      editor={editor}
      pluginKey={SELECTION_BUBBLE_KEY}
      shouldShow={showOverSelection}
      options={options}
      className={cn(
        OVERLAY_LAYER.popover,
        INVERSE_SCOPE_CLASS,
        GLASS_INVERSE_CLASS,
        "text-text-on-inverse shadow-2 rounded-md p-1",
        // Узкий экран: плашка переносится на вторую строку, а не уезжает за край.
        "max-w-[calc(100vw-1rem)]"
      )}
    >
      <TooltipProvider>
        <Toolbar ref={toolbarRef} aria-label={messages.selectionToolbar} className="gap-0.5">
          {(hasBlockType || hasLists) && (
            <>
              {hasBlockType && (
                <BlockTypeMenu editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
              )}
              {hasLists && (
                <ListMenu editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
              )}
              {(hasMarks || hasTail) && <Separator />}
            </>
          )}
          {marks.map((mark) =>
            toggle(
              mark.id,
              mark.label(messages),
              mark.icon,
              state.flags[mark.id]?.active ?? false,
              state.flags[mark.id]?.can ?? false,
              () => mark.run(editor)
            )
          )}
          {hasHighlight && (
            <HighlightMenuButton editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
          )}
          {hasColor && (
            <ColorMenuButton
              editor={editor}
              tools={tools}
              disabled={off}
              shortcut={shortcut}
              onCustomColor={onCustomColor}
            />
          )}
          {hasMore && (
            // То же меню «…», что на Панели, без подчёркнутого: он здесь в ряду.
            // Пункт «Блок кода» — и здесь: кнопки Блока кода у плашки
            // не было, а выделенные строки в Блок кода превращают как раз отсюда,
            // как тип Блока — из «¶» той же плашки.
            <MoreFormatMenu
              editor={editor}
              tools={tools}
              disabled={off}
              shortcut={shortcut}
              omit={BUBBLE_MORE_OMIT}
            />
          )}
          {hasMarks && hasTail && <Separator />}
          {shownTail.map((button) => (
            <ToolButtonView
              key={button.id}
              editor={editor}
              button={button}
              label={label(button.label)}
              pressed={state.flags[button.id]?.active ?? false}
              unavailable={!(state.flags[button.id]?.can ?? false)}
              disabled={off}
              classes={TOOL_BUTTON_CLASSES}
            />
          ))}
        </Toolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}

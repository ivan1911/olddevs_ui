"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useMemo, useRef } from "react";
import { Separator } from "../../../components/content/Separator.js";
import { Toolbar } from "../../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../../components/overlays/Tooltip.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { DeleteIcon, EditIcon } from "../../../icons.js";
import { buttonClasses } from "../../../lib/button.js";
import { cn } from "../../../lib/cn.js";
import { OVERLAY_LAYER } from "../../../lib/overlay-layer.js";
import { IMAGE_WIDTHS, isImageSelection, type ImageWidth } from "./image.js";
import { focusWithin } from "../../ui/focusWithin.js";
import { GLASS_PANEL_CLASS } from "../../styles/glass.js";

/** Ключ плагина панели картинки — отдельный от плавающей Панели форматирования. */
export const IMAGE_TOOLBAR_KEY = "richTextImageToolbar";

const IMAGE_TOOLBAR_OPTIONS = {
  placement: "top",
  offset: 8,
  flip: true,
  shift: { padding: 8 },
} as const;

const ICON_BUTTON = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });

/**
 * Панель выделенной картинки: пресеты ширины, «Изменить» (поповер с адресом и
 * описанием) и «Убрать». Появляется над картинкой, выделенной щелчком или
 * стрелками, — как плавающая Панель над текстом, тем же `BubbleMenu`.
 *
 * Это путь мыши и быстрых правок. С клавиатуры в неё ведёт тот же `Alt+F10`,
 * что и в Панель форматирования: на выделенной картинке он выбирает её
 * панель. Ширина с клавиатуры есть и в поповере картинки.
 *
 * `role="toolbar"` кита — одна остановка Tab, стрелки, Home и End. Пресеты —
 * кнопки-переключатели с `aria-pressed`; нажатый повторным нажатием снимается,
 * и картинка возвращается к своему размеру. Действие оставляет картинку
 * выделенной: следующий пресет жмётся сразу.
 */
export function ImageToolbar({
  editor,
  disabled,
  onEdit,
  scrollTarget,
}: {
  editor: Editor;
  disabled: boolean;
  onEdit: () => void;
  /** Область Документа, которая прокручивается сама (ADR-0059); без неё — окно. */
  scrollTarget?: HTMLElement;
}) {
  const messages = useMessages().editor;
  const ref = useRef<HTMLDivElement>(null);
  const options = useMemo(
    () => ({ ...IMAGE_TOOLBAR_OPTIONS, ...(scrollTarget && { scrollTarget }) }),
    [scrollTarget]
  );

  // Лишняя остановка Tab у узла плагина — та же причина, что у `FloatingToolbar`.
  useEffect(() => {
    ref.current?.setAttribute("tabindex", "-1");
  }, [editor]);

  const width = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      isImageSelection(current.state.selection)
        ? ((current.state.selection as NodeSelection).node.attrs.width as ImageWidth | null)
        : null,
  });

  const setWidth = (preset: ImageWidth) =>
    editor
      .chain()
      .focus()
      .updateImage({ width: width === preset ? null : preset })
      .run();

  return (
    <BubbleMenu
      ref={ref}
      editor={editor}
      pluginKey={IMAGE_TOOLBAR_KEY}
      data-image-toolbar=""
      shouldShow={({ editor: current, state, view, element }) =>
        current.isEditable && isImageSelection(state.selection) && focusWithin(view, element)
      }
      options={options}
      className={cn(
        OVERLAY_LAYER.popover,
        GLASS_PANEL_CLASS,
        "border-line-soft shadow-2 rounded-md border px-1.5 py-1"
      )}
    >
      <TooltipProvider>
        <Toolbar aria-label={messages.image} className="gap-0.5">
          <div role="group" aria-label={messages.imageWidth} className="flex gap-0.5">
            {IMAGE_WIDTHS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={width === preset}
                disabled={disabled}
                onClick={() => setWidth(preset)}
                className={buttonClasses({
                  variant: "ghost",
                  size: "sm",
                  selected: width === preset,
                })}
              >
                {messages.imageWidthPreset({ percent: Number(preset) })}
              </button>
            ))}
          </div>
          <Separator />
          <Tooltip content={messages.imageEdit}>
            <button
              type="button"
              aria-label={messages.imageEdit}
              disabled={disabled}
              onClick={onEdit}
              className={ICON_BUTTON}
            >
              <EditIcon size={16} aria-hidden />
            </button>
          </Tooltip>
          <Tooltip content={messages.imageRemove}>
            <button
              type="button"
              aria-label={messages.imageRemove}
              disabled={disabled}
              onClick={() => editor.chain().focus().removeImage().run()}
              className={ICON_BUTTON}
            >
              <DeleteIcon size={16} aria-hidden />
            </button>
          </Tooltip>
        </Toolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}

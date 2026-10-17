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

/** Key of the image Toolbar plugin, separate from the floating formatting Toolbar. */
export const IMAGE_TOOLBAR_KEY = "richTextImageToolbar";

const IMAGE_TOOLBAR_OPTIONS = {
  placement: "top",
  offset: 8,
  flip: true,
  shift: { padding: 8 },
} as const;

const ICON_BUTTON = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });

/**
 * Toolbar for the selected image: width presets, "Edit" (a popover with the address and the
 * description) and "Remove". It appears above an image selected with a click or with the arrows,
 * like the floating Toolbar above text, with the same `BubbleMenu`.
 *
 * This is the path for the mouse and for quick edits. From the keyboard, the same `Alt+F10` that
 * opens the formatting Toolbar leads here: on a selected image it targets this Toolbar. The width
 * from the keyboard is also available in the image popover.
 *
 * The kit's `role="toolbar"` is one Tab stop, with the arrows, Home and End. The presets are toggle
 * buttons with `aria-pressed`; pressing a pressed one again clears it, and the image goes back to
 * its own size. The action keeps the image selected, so the next preset can be pressed right away.
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
  /** The area of the Document that scrolls on its own (ADR-0059); without it, the window. */
  scrollTarget?: HTMLElement;
}) {
  const messages = useMessages().editor;
  const ref = useRef<HTMLDivElement>(null);
  const options = useMemo(
    () => ({ ...IMAGE_TOOLBAR_OPTIONS, ...(scrollTarget && { scrollTarget }) }),
    [scrollTarget]
  );

  // The extra Tab stop on the plugin's node has the same cause as in `FloatingToolbar`.
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

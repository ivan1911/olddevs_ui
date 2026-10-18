"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useMemo, useRef } from "react";
import { Separator } from "../../../components/content/Separator.js";
import { Toolbar } from "../../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../../components/overlays/Tooltip.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { DeleteIcon, EditIcon } from "../../../icons.js";
import { buttonClasses } from "../../../lib/button.js";
import { cn } from "../../../lib/cn.js";
import { OVERLAY_LAYER } from "../../../lib/overlay-layer.js";
import { selectedImage, inTableCell, isImageSelection, type ImageAttributes } from "./image.js";
import { ImageAlignGroup } from "./ImageAlignGroup.js";
import { IMAGE_WIDTHS, type ImageAlign } from "./imageLayout.js";
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
 * Toolbar for the selected image: the three alignment toggles, the width presets, "Edit" (a popover
 * with the address and the description) and "Remove". It appears above an image selected with a click or with the arrows,
 * like the floating Toolbar above text, with the same `BubbleMenu`.
 *
 * This is the path for the mouse and for quick edits. From the keyboard, the same `Alt+F10` that
 * opens the formatting Toolbar leads here: on a selected image it targets this Toolbar. The width
 * from the keyboard is also available in the image popover.
 *
 * The kit's `role="toolbar"` is one Tab stop, with the arrows, Home and End. The presets are toggle
 * buttons with `aria-pressed`; pressing a pressed one again clears it, and the image goes back to
 * its own size. The action keeps the image selected, so the next preset can be pressed right away.
 *
 * The alignment comes first: it is the choice that changes how the image sits among the text, and
 * the width only sizes it. Left and right also set the width and 100% also clears the side
 * (`layoutOf`), so the presets pressed next to the toggles always show what the Document holds.
 * In a table cell the toggles are disabled: there is no room for text to wrap there (ADR-0081).
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

  // One primitive per field: `useEditorState` re-renders on a changed value, not on a new object.
  const width = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      (selectedImage(current.state)?.node.attrs as ImageAttributes | undefined)?.width ?? null,
  });
  const align = useEditorState({
    editor,
    selector: ({ editor: current }): ImageAlign | null => {
      const found = isImageSelection(current.state.selection) ? selectedImage(current.state) : null;
      if (!found || inTableCell(current.state, found.pos)) return null;
      return (found.node.attrs as ImageAttributes).align;
    },
  });
  const inCell = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const found = selectedImage(current.state);
      return found ? inTableCell(current.state, found.pos) : false;
    },
  });

  const setWidth = (preset: (typeof IMAGE_WIDTHS)[number]) =>
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
          <ImageAlignGroup
            value={align}
            disabled={disabled || inCell}
            variant="ghost"
            onChange={(next) => editor.chain().focus().updateImage({ align: next }).run()}
          />
          <Separator />
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

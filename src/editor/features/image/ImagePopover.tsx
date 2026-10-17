"use client";

import { posToDOMRect, type Editor } from "@tiptap/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/overlays/Popover.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { UploadIcon } from "../../../icons.js";
import { buttonClasses } from "../../../lib/button.js";
import { cn } from "../../../lib/cn.js";
import {
  IMAGE_WIDTHS,
  normalizeImageInput,
  selectedImage,
  type ImageAttributes,
  type ImageWidth,
} from "./image.js";
import { GLASS_PANEL_CLASS } from "../../styles/glass.js";

export interface ImagePopoverProps {
  editor: Editor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** There is an uploader (`onUploadImage`): the popover then shows a file picker. */
  canUpload: boolean;
}

/**
 * Image popover: the address, the alt text and, for an existing image, the width. It is opened by
 * the "Image" button of the Toolbar, by the Slash menu item and by "Edit image" on the toolbar of a
 * selected image.
 *
 * TWO MODES BY THE SELECTION AT THE MOMENT IT OPENS. If an image is selected (or the caret is in its
 * caption), the popover edits it: the address, the description, the width presets and "Remove".
 * Otherwise it inserts a new one at the caret. So a single Toolbar button does not insert a second
 * image on top of the selected one.
 *
 * It is built like the link popover (`LinkPopover`): the kit's `Popover` sits in the Radix layer
 * stack (Escape inside a `Dialog` closes only the popover, ADR-0041), the anchor is the selection,
 * and closing from the keyboard returns focus to the document.
 *
 * WIDTH FROM THE KEYBOARD IS HERE. The image's resize handles are for the mouse only; three toggle
 * buttons give the same 50/75/100 % presets with `aria-pressed`. Pressing a pressed preset again
 * clears it, and the image goes back to its own size.
 */
export function ImagePopover({ editor, open, onOpenChange, canUpload }: ImagePopoverProps) {
  const messages = useMessages().editor;
  /*
    The anchor is the whole selected image, or the text selection when there is none.
    It is measured at every position update: the popover moves along with the document.
  */
  const anchorRef = useRef({
    getBoundingClientRect: () => {
      const found = selectedImage(editor.state);
      const dom = found ? editor.view.nodeDOM(found.pos) : null;
      if (dom instanceof HTMLElement) return dom.getBoundingClientRect();
      const { from, to } = editor.state.selection;
      return posToDOMRect(editor.view, from, to);
    },
  });
  const interactedOutside = useRef(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        aria-label={messages.image}
        className={cn(GLASS_PANEL_CLASS, "w-80 p-3")}
        onOpenAutoFocus={() => {
          interactedOutside.current = false;
        }}
        onInteractOutside={() => {
          interactedOutside.current = true;
        }}
        onCloseAutoFocus={(event) => {
          // As in the link popover: it has no trigger of its own, so focus goes to the document.
          event.preventDefault();
          if (!interactedOutside.current && !editor.isDestroyed) editor.commands.focus();
        }}
      >
        {/* Mounted on every open: the mode and the fields follow the selection at that moment. */}
        <ImageForm editor={editor} canUpload={canUpload} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

function ImageForm({
  editor,
  canUpload,
  onDone,
}: {
  editor: Editor;
  canUpload: boolean;
  onDone: () => void;
}) {
  const messages = useMessages().editor;
  const addressId = useId();
  const altId = useId();
  const widthLabelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [existing] = useState(() => {
    const found = selectedImage(editor.state);
    return found ? (found.node.attrs as ImageAttributes) : null;
  });
  const [address, setAddress] = useState(existing?.src ?? "");
  const [alt, setAlt] = useState(existing?.alt ?? "");
  const [width, setWidth] = useState<ImageWidth | null>(existing?.width ?? null);
  const [invalid, setInvalid] = useState(false);

  const apply = () => {
    const src = normalizeImageInput(address);
    if (!src) {
      setInvalid(true);
      return;
    }
    if (existing) editor.chain().updateImage({ src, alt: alt.trim(), width }).run();
    else editor.chain().insertImage({ src, alt: alt.trim() }).run();
    onDone();
  };

  const remove = () => {
    editor.chain().removeImage().run();
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter, which IME uses to confirm a word, is not "apply".
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* `layout="stack"`, as in the link popover: it is drawn outside the form's layout. */}
      <FormField
        label={messages.imageAddress}
        htmlFor={addressId}
        error={invalid ? messages.imageInvalid : undefined}
        layout="stack"
      >
        <TextControl
          id={addressId}
          size="sm"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={address}
          onChange={(event) => {
            setAddress(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <FormField
        label={messages.imageAlt}
        htmlFor={altId}
        hint={messages.imageAltHint}
        layout="stack"
      >
        <TextControl
          id={altId}
          size="sm"
          type="text"
          autoComplete="off"
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </FormField>
      {existing && (
        <div className="flex flex-col gap-1.5">
          <span id={widthLabelId} className="text-fg-2 text-xs font-medium">
            {messages.imageWidth}
          </span>
          <div role="group" aria-labelledby={widthLabelId} className="flex gap-1">
            {IMAGE_WIDTHS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={width === preset}
                onClick={() => setWidth((current) => (current === preset ? null : preset))}
                className={buttonClasses({
                  variant: "outline",
                  size: "sm",
                  selected: width === preset,
                })}
              >
                {messages.imageWidthPreset({ percent: Number(preset) })}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className={cn(
          "flex items-center gap-2",
          canUpload && !existing ? "justify-between" : "justify-end"
        )}
      >
        {canUpload && !existing && (
          <>
            {/*
              The file input is hidden but alive: the button next to it opens the system
              file picker on its own click. A custom button instead of the input itself,
              because the browser draws the look of a file input on its own and does not
              translate it.
            */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length === 0) return;
                onDone();
                editor.commands.uploadImages(files);
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<UploadIcon size={14} aria-hidden />}
              onClick={() => fileRef.current?.click()}
            >
              {messages.imageChooseFile}
            </Button>
          </>
        )}
        <div className="flex gap-2">
          {existing && (
            <Button type="button" size="sm" variant="ghost" tone="danger" onClick={remove}>
              {messages.imageRemove}
            </Button>
          )}
          <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
            {existing ? messages.imageApply : messages.imageInsert}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
  /** Есть загрузчик (`onUploadImage`) — в поповере появляется выбор файла. */
  canUpload: boolean;
}

/**
 * Поповер картинки: адрес, альтернативный текст и — у существующей картинки —
 * ширина. Открывают кнопка «Картинка» Панели, пункт Меню вставки и
 * «Изменить картинку» на панели выделенной картинки.
 *
 * ДВА РЕЖИМА ПО ВЫДЕЛЕНИЮ В МОМЕНТ ОТКРЫТИЯ. Выделена картинка (или каретка в
 * её подписи) — поповер правит её: адрес, описание, пресет ширины и «Убрать».
 * Иначе — вставляет новую на место каретки. Так одна кнопка Панели не
 * вставляет вторую картинку поверх выделенной.
 *
 * Устроен как поповер ссылки (`LinkPopover`): `Popover` кита в стеке слоёв
 * Radix (Escape внутри `Dialog` закрывает только поповер, ADR-0041), якорь —
 * выделение, закрытие с клавиатуры возвращает фокус в документ.
 *
 * ШИРИНА С КЛАВИАТУРЫ — ЗДЕСЬ. Ручки у картинки только для мыши; три
 * кнопки-переключателя дают те же пресеты 50/75/100 % с `aria-pressed`.
 * Нажатый пресет повторным нажатием снимается — картинка возвращается к
 * своему размеру.
 */
export function ImagePopover({ editor, open, onOpenChange, canUpload }: ImagePopoverProps) {
  const messages = useMessages().editor;
  /*
    Якорь — выделенная картинка целиком, а без неё — выделение текста.
    Меряется при каждом пересчёте позиции: поповер едет вместе с документом.
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
          // Как у поповера ссылки: своего триггера нет, фокус — в документ.
          event.preventDefault();
          if (!interactedOutside.current && !editor.isDestroyed) editor.commands.focus();
        }}
      >
        {/* Монтируется на каждое открытие: режим и поля — по выделению в этот момент. */}
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
    // Enter, которым IME подтверждает слово, — не «применить».
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* `layout="stack"` — как у поповера ссылки: он рисуется вне раскладки формы. */}
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
              Поле файла спрятано, но живо: кнопка рядом открывает системный
              выбор файла его же щелчком. Своя кнопка вместо поля — потому что
              вид поля файла браузер рисует сам и не переводит.
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

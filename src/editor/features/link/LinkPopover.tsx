"use client";

// Происхождение: minimal-tiptap, `components/link/link-edit-block.tsx` и
// `link-edit-popover.tsx` (MIT, © 2024 Aslam, https://github.com/Aslam97/minimal-tiptap).
// Перенесены поведение «применить к выделению или вставить адрес текстом» и
// правка ссылки под кареткой; разметка shadcn заменена примитивами кита.
// Лицензия — NOTICE в корне пакета.

import type { Editor } from "@tiptap/react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { normalizeLinkInput } from "./link.js";

/**
 * Содержимое поповера адреса ссылки: `Mod+K` и кнопка «Ссылка» Панели и Меню
 * выделения (описание — `linkTool.tsx`).
 *
 * Рамку держит кит (`ToolButtonView.tsx`): `Popover` в стеке слоёв, имя рамки
 * — подпись кнопки, возврат фокуса в Документ на прежнее выделение.
 *
 * ЯКОРЬ — ВЫДЕЛЕНИЕ, а не кнопка. Поповер открывают и с клавиатуры, когда
 * Панели нет вовсе (`toolbar="none"`) или плавающая спрятана, поэтому он
 * стоит у текста, который станет ссылкой, — одинаково при любом способе
 * открыть.
 *
 * Форма монтируется заново на каждое открытие: поле берёт адрес ссылки под
 * кареткой в момент открытия, а не прошлый черновик.
 */
export function LinkForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const [existing] = useState(() =>
    editor.isActive("link") ? String(editor.getAttributes("link").href ?? "") : null
  );
  const [draft, setDraft] = useState(existing ?? "");
  const [invalid, setInvalid] = useState(false);

  const remove = () => {
    editor.chain().extendMarkRange("link").unsetLink().run();
    onDone();
  };

  const apply = () => {
    const text = draft.trim();
    // Пустое поле — «ссылки здесь нет»: у существующей это снятие, у новой —
    // просто закрыть.
    if (!text) {
      if (existing != null) remove();
      else onDone();
      return;
    }
    const href = normalizeLinkInput(text);
    if (!href) {
      setInvalid(true);
      return;
    }
    const chain = editor.chain();
    if (!editor.state.selection.empty) chain.setLink({ href });
    else if (existing != null) chain.extendMarkRange("link").setLink({ href });
    // Выделения нет — адрес вставляется текстом ссылки, как в minimal-tiptap.
    else chain.insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href } }] });
    chain.run();
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
      {/* `layout="stack"` явно: поповер рисуется вне раскладки формы, где
          стоит Редактор, и боковая подпись `FormLayout` ему не подходит. */}
      <FormField
        label={messages.linkAddress}
        htmlFor={fieldId}
        error={invalid ? messages.linkInvalid : undefined}
        layout="stack"
      >
        <TextControl
          id={fieldId}
          size="sm"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
      </FormField>
      <div className="flex justify-end gap-2">
        {existing != null && (
          <Button type="button" size="sm" variant="ghost" tone="danger" onClick={remove}>
            {messages.linkRemove}
          </Button>
        )}
        <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
          {messages.linkApply}
        </Button>
      </div>
    </div>
  );
}

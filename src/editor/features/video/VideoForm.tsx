"use client";

import type { Editor } from "@tiptap/react";
import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "../../../components/actions/Button.js";
import { FormField } from "../../../components/inputs/FormField.js";
import { TextControl } from "../../../components/inputs/TextControl.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { videoProviders } from "./video.js";
import { parseVideoLink, VIDEO_PROVIDER_NAME } from "./videoLink.js";

/**
 * Содержимое поповера пункта «Видео» Меню вставки (ADR-0071, п. 6): поле ссылки.
 *
 * СЕРВИС ОПРЕДЕЛЯЕТ АДРЕС, а не автор: один пункт на `youtube` и `twitch`, и
 * ссылка разбирается среди сервисов, включённых в этом Редакторе. Ссылка чужого
 * сервиса и ссылка выключенного сервиса — одна ошибка в поле, которая называет,
 * что Редактор принимает. Блок ставится в место каретки (`insertVideo`).
 *
 * Рамку держит кит (`SelectionPopover`): стек слоёв, имя рамки — подпись пункта,
 * возврат фокуса в Документ. Форма монтируется заново на каждое открытие.
 */
export function VideoForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const messages = useMessages().editor;
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const providers = videoProviders(editor);

  const apply = () => {
    const text = draft.trim();
    if (!text) return void onDone();
    const link = parseVideoLink(text);
    if (!link || !providers.includes(link.provider)) return void setInvalid(true);
    editor.chain().focus().insertVideo(link).run();
    onDone();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Enter, которым IME подтверждает слово, — не «вставить».
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    apply();
  };

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label={messages.videoLink}
        htmlFor={fieldId}
        error={
          invalid
            ? messages.videoNotFound({
                services: providers.map((provider) => VIDEO_PROVIDER_NAME[provider]).join(" / "),
              })
            : undefined
        }
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
        <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
          {messages.videoInsert}
        </Button>
      </div>
    </div>
  );
}

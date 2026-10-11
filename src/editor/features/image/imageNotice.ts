"use client";

// Тексты Сообщения поля для событий файлов: каталог сообщений вместо строк
// в коде расширения. Вынесено из `RichTextEditor.tsx`.

import type { UiMessages } from "../../../i18n/messages.js";
import type { FieldNotice } from "../../core/fieldNotice.js";
import type { ImageNotice } from "./image.js";

/** Событие файлов — строкой каталога и тоном: живой регион или ошибка под полем. */
export function describeImageNotice(
  notice: ImageNotice,
  messages: UiMessages["editor"]
): FieldNotice {
  switch (notice.kind) {
    case "uploading":
      return { tone: "status", text: messages.imageUploading({ name: notice.name }) };
    case "uploaded":
      return { tone: "status", text: messages.imageUploaded({ name: notice.name }) };
    case "failed":
      return { tone: "error", text: messages.imageUploadFailed({ name: notice.name }) };
    case "notImage":
      return { tone: "error", text: messages.imageNotImage({ name: notice.name }) };
    case "unsupported":
      return { tone: "error", text: messages.imageFilesUnsupported };
  }
}

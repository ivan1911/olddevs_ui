"use client";

import { ImageIcon } from "../../../icons.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import { RichImage } from "./image.js";

/**
 * Картинка на описании Инструмента (ADR-0058, п. 10).
 *
 * Картинка — `figure` с подписью (`image.ts`). Без Инструмента `<img>` из
 * вставки и `value` отбрасывается, а файлы из буфера не перехватываются:
 * расширения нет в списке, пока нет моста `image` (его даёт `RichTextEditor`
 * только с Инструментом).
 *
 * Картинке нужен адрес, и ни кнопка, ни пункт его не знают: оба готовят пустой
 * абзац и открывают поповер картинки (`ImagePopover`), команда `openImageEditor`
 * — из `image.ts`. Картинка из поповера встаёт на место этого абзаца. Закрытый
 * без адреса поповер оставляет пустой абзац — как Блок, который передумали
 * писать. Сам поповер и панель выделенной картинки (`ImageToolbar`) — виджеты
 * кита, у описания их нет. Форма Блока для Скелета не нужна: его Схеме мост
 * картинки подставлен заглушкой (`skeleton.ts`), и расширение то же.
 */
export const IMAGE_TOOL: ToolDescriptor = {
  name: "image",
  engine: (context) => (context.image ? [RichImage.configure(context.image)] : []),
  buttons: [
    {
      id: "image",
      label: ({ messages }) => messages.image,
      icon: ImageIcon,
      // Как у ссылки: кнопка открывает поповер, а не вставляет сама.
      run: (editor) => editor.commands.openImageEditor(),
      can: (editor) => editor.can().openImageEditor(),
      // `aria-pressed` — выделена картинка или каретка в её подписи: поповер
      // тогда правит её, а не вставляет новую.
      isActive: (editor) => editor.isActive("image"),
    },
  ],
  insertItems: [
    {
      id: "image",
      section: "insert",
      label: (m) => m.image,
      icon: ImageIcon,
      aliases: ["img", "picture", "photo", "![]()"],
      run: (chain) => chain.openImageEditor(),
    },
  ],
};

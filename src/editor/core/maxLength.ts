"use client";

// Происхождение: Tiptap, `@tiptap/extensions/character-count` (MIT, © Tiptap GmbH,
// https://github.com/ueberdosis/tiptap). Взята логика `filterTransaction` и
// подсчёт символов; лимит читается функцией, а замена документа снаружи
// пропускается меткой. Лицензия — NOTICE в корне пакета.

import { Extension, type Editor } from "@tiptap/core";
import { Slice, type Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { textBetween } from "./atomText.js";
import { trimPaste } from "./pasteTrim.js";

/**
 * Метка транзакции «документ заменён снаружи» — новым `value` или `clear()`.
 *
 * Такая замена лимиту не подчиняется: это данные владельца, а не набор автора.
 * Предел, молча отвергший длинный `value`, оставил бы на экране прежний текст
 * при новом значении в состоянии потребителя.
 */
export const EXTERNAL_CHANGE = "olddevsExternalChange";

/**
 * Документ целиком — новым содержимым, Заменой снаружи: одна транзакция с
 * меткой `EXTERNAL_CHANGE`, предел её не режет. Так заменяют Документ
 * `setMarkdown()` и `setJSON()`.
 */
export function replaceDocument(editor: Editor, content: Fragment): void {
  const { tr, doc } = editor.state;
  const slice = new Slice(content, 0, 0);
  editor.view.dispatch(tr.replace(0, doc.content.size, slice).setMeta(EXTERNAL_CHANGE, true));
}

/**
 * Символов в документе: `getText` без разделителей Блоков. Атом весит длину
 * своего Текста атома (`atomText.ts`): разделитель — 0, мягкий перенос — 1,
 * картинка — длину подписи, Merge Tag — длину `{{key}}`.
 */
export function countCharacters(doc: ProseMirrorNode): number {
  return textBetween(doc, 0, doc.content.size, "").length;
}

export interface MaxLengthOptions {
  limit: () => number | undefined;
}

/**
 * Предел символов: правка, уводящая документ за `limit`, не проходит.
 *
 * ПОЧЕМУ НЕ `CharacterCount` КАК ЕСТЬ. У него лимит задаётся один раз при
 * создании движка, а `maxLength` — проп и вправе меняться; пересоздавать движок
 * ради нового числа значило бы терять историю правок и курсор. И он же
 * отвергает ЛЮБУЮ транзакцию за пределом, включая замену документа новым
 * `value`, а при `autoTrim` по умолчанию ещё и срезает начало слишком длинного
 * начального значения, то есть молча портит данные потребителя.
 *
 * Документ, уже лежащий за пределом (пришёл таким в `value`), можно сокращать,
 * но не удлинять. Вставка обрезается до предела, а не отвергается целиком: это
 * поведение оригинала, и человек, вставивший абзац в почти полное поле,
 * получает всё, что поместилось. Режет `pasteTrim.ts`: хвост — по символам,
 * атом — целиком.
 */
export const MaxLength = Extension.create<MaxLengthOptions>({
  name: "maxLength",

  addOptions() {
    return { limit: () => undefined };
  },

  addProseMirrorPlugins() {
    const { limit } = this.options;

    return [
      new Plugin({
        key: new PluginKey("maxLength"),
        filterTransaction: (transaction, state) => {
          const max = limit();
          if (
            !transaction.docChanged ||
            max === undefined ||
            transaction.getMeta(EXTERNAL_CHANGE)
          ) {
            return true;
          }

          const before = countCharacters(state.doc);
          const after = countCharacters(transaction.doc);
          if (after <= max || after <= before) return true;
          if (before >= max || !transaction.getMeta("paste")) return false;

          // Вставка: срезается хвост вставленного. Правка транзакции внутри
          // фильтра — приём оригинала; если срезать нечем или после среза
          // предел всё ещё превышен, правка отвергается целиком.
          return trimPaste(transaction, after - max) && countCharacters(transaction.doc) <= max;
        },
      }),
    ];
  },
});

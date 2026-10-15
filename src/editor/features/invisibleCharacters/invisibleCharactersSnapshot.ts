import type { Editor } from "@tiptap/core";
import type { InvisibleCharactersToolState } from "../../core/toolState.js";
import { invisibleCharactersVisible } from "./invisibleCharactersVisible.js";

/**
 * Снимок Состояния `invisibleCharacters` для `useRichTextToolState`. Лежит
 * отдельно, как `searchSnapshot.ts`: нужен только хуку и не должен попадать в
 * статический граф Редактора.
 */
export function invisibleCharactersSnapshot(editor: Editor): InvisibleCharactersToolState {
  return { visible: invisibleCharactersVisible(editor) };
}

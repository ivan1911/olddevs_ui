import type { Editor } from "@tiptap/core";

/**
 * Показаны ли невидимые символы: плагин расширения держит флаг в своём
 * состоянии, а наружу отдаёт его через `storage` (`visibility()`). Читается при
 * каждом вызове: после создания движка расширение подменяет `visibility` на
 * чтение состояния плагина. `false` — расширения в движке нет.
 *
 * Лежит отдельно от `invisibleCharactersTool.ts` и от снимка Состояния: чтение
 * нужно и Панели (она в стартовом графе), и хуку (в стартовый граф не входит), а
 * пакет Tiptap им не нужен — Панель его не импортирует.
 */
export function invisibleCharactersVisible(editor: Editor): boolean {
  const storage = editor.storage as {
    invisibleCharacters?: { visibility?: () => boolean | undefined };
  };
  return storage.invisibleCharacters?.visibility?.() === true;
}

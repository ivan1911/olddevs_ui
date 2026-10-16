"use client";

import type { Editor } from "@tiptap/core";

/**
 * Показаны ли невидимые символы: плагин расширения держит флаг в своём
 * состоянии, а наружу отдаёт его через `storage` (`visibility()`). Читается при
 * каждом вызове: после создания движка расширение подменяет `visibility` на
 * чтение состояния плагина. `false` — расширения в движке нет.
 *
 * Лежит отдельно от `invisibleCharactersTool.ts` и от снимка Состояния: чтение
 * нужно и меню «…» Панели (она в стартовом графе), и хуку (в стартовый граф не входит), а
 * пакет Tiptap им не нужен — Панель его не импортирует.
 */
export function invisibleCharactersVisible(editor: Editor): boolean {
  const storage = editor.storage as {
    invisibleCharacters?: { visibility?: () => boolean | undefined };
  };
  return storage.invisibleCharacters?.visibility?.() === true;
}

/**
 * Переключить показ: единственный путь и у пункта «Невидимые символы» меню «…»,
 * и у команды `tool("invisibleCharacters").toggle()`. Лежит рядом с чтением, а не
 * в описании Инструмента: пункт живёт в Панели из стартового графа, а пакет
 * Tiptap ему не нужен. `false` — расширения в движке нет.
 */
export function toggleInvisibleCharacters(editor: Editor): boolean {
  return editor.commands.toggleInvisibleCharacters();
}

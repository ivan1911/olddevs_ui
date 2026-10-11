/**
 * Лёгкий вход `@olddevs/ui/editor/schema`: Схема Редактора данными, очистка по
 * ней (`sanitizeRichText` с DOMPurify потребителя) и закрытый конфиг для
 * DOMPurify — и больше ничего.
 *
 * ПОЧЕМУ ОТДЕЛЬНО ОТ `@olddevs/ui/editor`. Очистка HTML — дело сервера
 * потребителя (ADR-0050), и Node-процессу, которому нужен один конфиг, не нужны
 * ни React, ни Tiptap. Вход `./editor` реэкспортирует редактор вместе с
 * движком, а без сборщика (чистый Node, воркер, скрипт миграции) лишнее никто
 * не отбросит. Здесь в графе модулей только `schema.ts` — данные и функция над
 * ними. Сторожит `tests/editor-schema-entry.test.ts`.
 *
 * Свои Инструменты (ADR-0058, п. 2.3) сюда приходят массивом `tools` в
 * `sanitizeRichText` и `richTextSchema`: читаются только правила Схемы из
 * описания (`customTool.ts`, тоже без движка), Часть для движка не трогается.
 * Описание своего Инструмента с Карточкой у текста собирается и на сервере,
 * поэтому её помощник `markRange` (функция над состоянием, Tiptap — только
 * типом) отдаётся и здесь.
 *
 * Те же имена по-прежнему отдаёт и `@olddevs/ui/editor`: это не перенос, а
 * второй, короткий путь к тем же значениям. Список имён здесь явный, чтобы
 * новый экспорт `schema.ts` попадал в публичный вход решением, а не случайно.
 *
 * Директивы `"use client"` нет, как у остальных входов-реэкспортов.
 */
export {
  RICH_TEXT_SCHEMA,
  richTextSanitizeConfig,
  richTextSchema,
  sanitizeRichText,
} from "./core/schema.js";
export { markRange } from "./core/customTool.js";
export type {
  RichTextAttributeHookEvent,
  RichTextCustomBlockRules,
  RichTextCustomMarkRules,
  RichTextPurifier,
  RichTextSanitizeConfig,
  RichTextSchema,
} from "./core/schema.js";

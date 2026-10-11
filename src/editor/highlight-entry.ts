/**
 * Лёгкий вход `@olddevs/ui/editor/highlight`: подсветка кода без Редактора —
 * и больше ничего.
 *
 * - `highlightCodeBlocks` — серверная подсветка блоков кода в сохранённом
 *   Документе для `RichTextView` (ADR-0051).
 * - `highlightCodeNodes` — токены узлами React для `children` у `CodeView`
 *   (ADR-0052).
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ВХОД, А НЕ ПРОП `highlight` У `RichTextView` ИЛИ `language`
 * У `CodeView`. Подсветка — lowlight, ядро highlight.js и восемь грамматик,
 * 22,6 кБ gzip. Импорт не бывает условным: проп-флаг держал бы их в графе
 * компонента всегда, и показ Документа вырос бы с 2 кБ до 23 даже там, где
 * подсветка выключена. Здесь подсветчик приезжает только к тому, кто его
 * импортировал, — обычно к серверу, — а компоненты остаются крошечными: они
 * получают уже подсвеченные HTML или узлы.
 * Граф входа сторожит `tests/editor-highlight-entry.test.ts`.
 *
 * Директивы `"use client"` нет: модуль только реэкспортирует серверно-безопасные
 * функции.
 */
export { highlightCodeBlocks } from "./features/code/highlight.js";
export { highlightCodeNodes } from "./features/code/highlightNodes.js";

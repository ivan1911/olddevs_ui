/**
 * Отдельный вход для редактора форматированного текста: `@olddevs/ui/editor`.
 *
 * ПОЧЕМУ МИМО BARREL. Движок — Tiptap v3 на ProseMirror — в манифест кита не
 * входит: его ставит только тот, кто импортирует этот вход, командой со
 * страницы Редактора (раздел «Установка»). Остальные ничего не ставят, и
 * бюджет основного входа не меняется. Реэкспорт из `src/index.ts`
 * сделал бы Tiptap обязательным для каждого потребителя — сборка без него
 * падала бы на неразрешимом импорте. Сторожит `tests/editor-entry.test.ts`.
 *
 * Директивы `"use client"` здесь нет намеренно, как у `color.ts`: модуль только
 * реэкспортирует, а клиентский компонент несёт директиву сам. Вход заодно
 * отдаёт серверно-безопасные `RichTextView` и `richTextSanitizeConfig`, и
 * директива на входе увела бы их в клиентский граф.
 *
 * Решение — ADR-0050.
 */
export { RichTextEditor } from "./RichTextEditor.js";
export type { RichTextEditorHandle, RichTextEditorProps } from "./RichTextEditor.js";
export type { RichTextDocument } from "./core/jsonDocument.js";
export { useRichTextEditorState } from "./hooks/useRichTextEditorState.js";
export { useRichTextToolState } from "./hooks/useRichTextToolState.js";
export type { RichTextToolState } from "./hooks/useRichTextToolState.js";
export { RichTextView } from "./RichTextView.js";
export type { RichTextViewProps } from "./RichTextView.js";
export { RichTextToc } from "./features/toc/RichTextToc.js";
export type { RichTextTocProps } from "./features/toc/RichTextToc.js";
export type { FieldNotice, FieldNoticeTone } from "./core/fieldNotice.js";
export type { RichTextSurface } from "./styles/surface.js";
export { richTextSanitizeConfig, richTextSchema, sanitizeRichText } from "./core/schema.js";
export type {
  RichTextAttributeHookEvent,
  RichTextCustomBlockRules,
  RichTextCustomMarkRules,
  RichTextPurifier,
  RichTextSanitizeConfig,
  RichTextSchema,
} from "./core/schema.js";
export { RICH_TEXT_PRESETS } from "./core/tools.js";
export type { RichTextEditorPreset } from "./core/tools.js";
export { tool } from "./core/toolOptions.js";
export type { ConfiguredTool, RichTextTools } from "./core/toolOptions.js";
export type { SearchToolState, TocToolHeading, TocToolState } from "./core/toolState.js";
export { markRange } from "./core/customTool.js";
export type {
  TextCardRange,
  TextCardRangeAt,
  CustomAttribute,
  CustomBlock,
  CustomBlockAction,
  CustomTextCard,
  CustomTextCardRender,
  CustomIslandProps,
  CustomInsertItem,
  CustomMark,
  CustomTool,
  CustomToolButton,
  CustomToolLabel,
  CustomToolPopover,
  CustomTrigger,
  PrefixedName,
  TriggerContext,
  TriggerItem,
  ToolEntry as Tool,
  ToolName,
} from "./core/customTool.js";

/**
 * The separate entry point for the rich text editor: `@olddevs/ui/editor`.
 *
 * WHY OUTSIDE THE BARREL. The engine (Tiptap v3 on ProseMirror) is not part of the kit's
 * manifest: only the consumer who imports this entry installs it, with the command from the
 * Editor page ("Installation" section). Everyone else installs nothing, and the size budget
 * of the main entry does not change. A re-export from `src/index.ts` would make Tiptap
 * mandatory for every consumer, and a build without it would fail on an unresolvable import.
 * Guarded by `tests/editor-entry.test.ts`.
 *
 * There is intentionally no `"use client"` directive here, as in `color.ts`: the module only
 * re-exports, and the client component carries the directive itself. The entry also exposes
 * the server-safe `RichTextView` and `richTextSanitizeConfig`, and a directive on the entry
 * would pull them into the client graph.
 *
 * The decision is recorded in ADR-0050.
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
export { defineTool } from "./core/toolDefinition.js";
export type {
  CustomToolBody,
  ToolDefinition,
  ToolDefinitionContext,
  ToolDefinitionInput,
} from "./core/toolDefinition.js";
export type {
  ConfiguredTool,
  DateToolOptions,
  DetailsToolOptions,
  InvisibleCharactersToolOptions,
  LanguageToolOptions,
  MathematicsToolOptions,
  RichTextTools,
  SearchToolOptions,
  TocLevel,
  TocToolOptions,
  TypographyToolOptions,
  VideoToolOptions,
} from "./core/toolOptions.js";
export type {
  DateToolCommands,
  BlockSelectionToolCommands,
  InvisibleCharactersToolCommands,
  LanguageToolCommands,
  SearchToolCommands,
  TocToolCommands,
} from "./core/toolCommands.js";
export type {
  BlockSelectionToolState,
  InvisibleCharactersToolState,
  LanguageToolState,
  SearchToolState,
  TocToolHeading,
  TocToolState,
} from "./core/toolState.js";
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

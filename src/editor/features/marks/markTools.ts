"use client";

import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { SHORTCUT_KEYS, type ShortcutCommand } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";

/**
 * Инлайн-Метки на описаниях Инструментов: жирный, курсив, подчёркнутый,
 * зачёркнутый, код, верхний и нижний индекс.
 *
 * Клавишу и markdown-шорткат вешает само расширение Tiptap, а строка справочника
 * — подпись к ней (`SHORTCUT_KEYS`). Виджеты остаются у кита, показ по
 * `has(name)`: ряд Меток B·I·U (`rowMarks.ts`), «…» (`MORE_MARKS` в
 * `FormatMenus.tsx`) и места Меток в Меню выделения.
 *
 * ПОРЯДОК МЕТОК в сохранённом HTML решает StarterKit: ранг и вложенность Меток
 * зависят от порядка его расширений, а не от порядка доль. Поэтому пять Меток
 * из StarterKit — его доли (`starterKit`), которые сливаются в один
 * `StarterKit.configure` (`extensions.ts`); индексы подключаются отдельными
 * расширениями на местах `ENGINE_ORDER`.
 */

/** Строка справочника Метки: подпись из каталога под тем же id. */
function shortcutOf(
  id: "bold" | "italic" | "strike" | "underline" | "code" | "superscript" | "subscript"
): ShortcutCommand {
  return { id, group: "marks", tool: id, keys: SHORTCUT_KEYS[id], label: (m) => m[id] };
}

/** Жирный: доля StarterKit, `{}` включает его умолчание. */
export const BOLD_TOOL: ToolDescriptor = {
  name: "bold",
  starterKit: () => ({ bold: {} }),
  shortcuts: [shortcutOf("bold")],
};

/** Курсив: доля StarterKit. */
export const ITALIC_TOOL: ToolDescriptor = {
  name: "italic",
  starterKit: () => ({ italic: {} }),
  shortcuts: [shortcutOf("italic")],
};

/** Подчёркнутый: доля StarterKit. */
export const UNDERLINE_TOOL: ToolDescriptor = {
  name: "underline",
  starterKit: () => ({ underline: {} }),
  shortcuts: [shortcutOf("underline")],
};

/** Зачёркнутый: доля StarterKit. */
export const STRIKE_TOOL: ToolDescriptor = {
  name: "strike",
  starterKit: () => ({ strike: {} }),
  shortcuts: [shortcutOf("strike")],
};

/** Код в строке: доля StarterKit. */
export const CODE_TOOL: ToolDescriptor = {
  name: "code",
  starterKit: () => ({ code: {} }),
  shortcuts: [shortcutOf("code")],
};

/** Верхний индекс: отдельное расширение Tiptap, место в `ENGINE_ORDER` — первое. */
export const SUPERSCRIPT_TOOL: ToolDescriptor = {
  name: "superscript",
  engine: () => [Superscript],
  shortcuts: [shortcutOf("superscript")],
};

/** Нижний индекс: отдельное расширение Tiptap. */
export const SUBSCRIPT_TOOL: ToolDescriptor = {
  name: "subscript",
  engine: () => [Subscript],
  shortcuts: [shortcutOf("subscript")],
};

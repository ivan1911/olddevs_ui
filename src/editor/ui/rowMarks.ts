"use client";

import type { Editor } from "@tiptap/react";
import type { ComponentType } from "react";
import type { UiMessages } from "../../i18n/messages.js";
import { BoldIcon, ItalicIcon, UnderlineIcon, type IconProps } from "../../icons.js";
import type { Tool } from "../core/tools.js";

/** Метка-переключатель ряда: кнопка с `aria-pressed` на Панели и в плашке. */
export interface RowMark {
  tool: Tool;
  /** Id строки общей таблицы сочетаний (`shortcuts.ts`) — оттуда подсказка. */
  id: string;
  label: (messages: UiMessages["editor"]) => string;
  icon: ComponentType<IconProps>;
  run: (editor: Editor) => void;
  can: (editor: Editor) => boolean;
  isActive: (editor: Editor) => boolean;
}

/**
 * Частые Метки в ряду (решения владельца): у Панели — жирный и
 * курсив (`TOOLBAR_ROW_MARKS`), у плашки меню выделения — ещё и подчёркнутый
 * (`BUBBLE_ROW_MARKS`). Остальные Метки — в меню «…» (`FormatMenus.tsx`), и
 * то, что стоит в ряду, в «…» того же хозяина не повторяется.
 *
 * Маркер стоял здесь же — один щелчок жёлтым. Теперь это кнопка с
 * поповером (`ColorMenus.tsx`): щелчок открывает ряд маркеров.
 */
const ROW_MARKS: readonly RowMark[] = [
  {
    tool: "bold",
    id: "bold",
    label: (m) => m.bold,
    icon: BoldIcon,
    run: (editor) => editor.chain().focus().toggleBold().run(),
    can: (editor) => editor.can().toggleBold(),
    isActive: (editor) => editor.isActive("bold"),
  },
  {
    tool: "italic",
    id: "italic",
    label: (m) => m.italic,
    icon: ItalicIcon,
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    can: (editor) => editor.can().toggleItalic(),
    isActive: (editor) => editor.isActive("italic"),
  },
  {
    tool: "underline",
    id: "underline",
    label: (m) => m.underline,
    icon: UnderlineIcon,
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    can: (editor) => editor.can().toggleUnderline(),
    isActive: (editor) => editor.isActive("underline"),
  },
];

const pick = (ids: readonly string[]) => ids.map((id) => ROW_MARKS.find((mark) => mark.id === id)!);

/** Ряд Метак Панели: B · I. */
export const TOOLBAR_ROW_MARKS: readonly RowMark[] = pick(["bold", "italic"]);

/** Ряд Метак плашки меню выделения: B · I · U. */
export const BUBBLE_ROW_MARKS: readonly RowMark[] = pick(["bold", "italic", "underline"]);

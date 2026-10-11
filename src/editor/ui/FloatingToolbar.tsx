"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useRef } from "react";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { showOverSelection, useOutOfTabOrder, useSelectionMenuOptions } from "./selectionMenu.js";
import type { ToolList } from "../core/toolDescriptor.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";

/** Ключ плагина плавающей Панели: по нему её показывают командой (`Alt+F10`). */
export const FLOATING_TOOLBAR_KEY = "richTextFloatingToolbar";

export interface FloatingToolbarProps {
  editor: Editor;
  tools: ToolList;
  disabled: boolean;
  /** Пункт «Вставить таблицу…» меню «Таблица» — окно держит Редактор. */
  onInsertTable?: () => void;
  /** Область Документа, которая прокручивается сама (ADR-0059); без неё — окно. */
  scrollTarget?: HTMLElement;
}

/**
 * Плавающая Панель — та же `EditorToolbar`, но над непустым выделением.
 *
 * ПОЗИЦИЯ И ПОКАЗ — `BubbleMenu` Tiptap (`@tiptap/react/menus`, floating-ui
 * внутри). Он прячет Панель на пустом выделении, в нередактируемом поле и без
 * фокуса в документе или в самой Панели, а показывает с задержкой после
 * того, как выделение перестало меняться: пока мышь тянет выделение, Панель не
 * мигает. Узел Панели он вставляет рядом с документом и вынимает из DOM,
 * когда прячет, — скрытой Панели нет ни для скринридера, ни для Tab.
 *
 * Условие показа и позиция — общие с меню выделения (`selectionMenu.ts`):
 * над картинкой Панели нет, у края окна она переворачивается и сдвигается.
 *
 * СЛОЙ — `OVERLAY_LAYER.popover`: Панель всплывает над текстом, как поповер.
 * В стеке Escape она не участвует: фокуса не держит и закрывать в ней нечего,
 * поэтому Escape остаётся окну или ящику вокруг Редактора.
 */
export function FloatingToolbar({
  editor,
  tools,
  disabled,
  onInsertTable,
  scrollTarget,
}: FloatingToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const options = useSelectionMenuOptions(scrollTarget);
  useOutOfTabOrder(ref, editor);

  return (
    <BubbleMenu
      ref={ref}
      editor={editor}
      pluginKey={FLOATING_TOOLBAR_KEY}
      shouldShow={showOverSelection}
      options={options}
      className={cn(
        OVERLAY_LAYER.popover,
        GLASS_PANEL_CLASS,
        "border-line-soft shadow-2 rounded-md border px-1.5 py-1",
        // Узкий экран: Панель переносится на вторую строку, а не уезжает за край.
        "max-w-[min(40rem,calc(100vw-1rem))]"
      )}
    >
      <EditorToolbar
        editor={editor}
        tools={tools}
        disabled={disabled}
        onInsertTable={onInsertTable}
      />
    </BubbleMenu>
  );
}

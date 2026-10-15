"use client";

import { SHORTCUT_KEYS } from "../../core/shortcuts.js";
import type { ToolDescriptor } from "../../core/toolDescriptor.js";
import {
  HighlightExtension,
  TEXT_COLOR_EXTENSIONS,
  TextAlignExtension,
} from "./styleExtensions.js";

/*
  Цвет, маркер и выравнивание пишут `data-color` и `data-align`, а не `style`
  (`styleExtensions.ts`; единственное исключение — цвет автора, `customColor.ts`):
  выключенный Инструмент не отдаёт ни атрибута, ни правила разбора, и такой
  атрибут из вставки отбрасывается.

  Виджеты — «Маркер» на Панели, «Цвет» и «Маркер» в Меню выделения
  (`ColorMenus.tsx`, `SelectionBubble.tsx`) и ленивый поповер своего цвета —
  остаются у кита, показ по `has(name)`. Сочетаний и пунктов вставки у цвета
  и маркера нет, поэтому их описания — только Часть для движка.
*/

/** Цвет текста: Метка `textStyle` с `data-color` и цвет автора. */
export const COLOR_TOOL: ToolDescriptor = {
  name: "color",
  engine: () => TEXT_COLOR_EXTENSIONS,
};

/** Маркер: Метка `highlight` с `data-color` (несколько цветов). */
export const HIGHLIGHT_TOOL: ToolDescriptor = {
  name: "highlight",
  engine: () => [HighlightExtension],
};

/**
 * Выравнивание: `data-align` на абзаце и заголовке.
 *
 * Клавиши `Mod-Shift-L/E/R` вешает само расширение, а три строки справочника —
 * подпись к ним. Меню «Выравнивание ▾» (`AlignMenu`, `FormatMenus.tsx`) — виджет
 * кита, он читает те же сочетания из `SHORTCUT_KEYS`.
 */
export const ALIGN_TOOL: ToolDescriptor = {
  name: "align",
  engine: () => [TextAlignExtension],
  shortcuts: [
    {
      id: "alignLeft",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignLeft,
      label: (m) => m.alignLeft,
    },
    {
      id: "alignCenter",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignCenter,
      label: (m) => m.alignCenter,
    },
    {
      id: "alignRight",
      group: "align",
      tool: "align",
      keys: SHORTCUT_KEYS.alignRight,
      label: (m) => m.alignRight,
    },
  ],
};

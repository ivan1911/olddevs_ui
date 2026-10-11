"use client";

import { posToDOMRect, type Editor } from "@tiptap/react";
import { useMemo, useRef, useState } from "react";
import { Button } from "../../../components/actions/Button.js";
import { ColorPicker } from "../../../components/inputs/ColorPicker.js";
import { Popover, PopoverAnchor, PopoverContent } from "../../../components/overlays/Popover.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { CONTRAST_TEXT, contrastRatio, formatRatio } from "./contrast.js";
import { normalizeCustomColor, type CustomColorKind } from "./customColor.js";
import { cn } from "../../../lib/cn.js";
import { GLASS_PANEL_CLASS } from "../../styles/glass.js";

export interface CustomColorPopoverProps {
  editor: Editor;
  /** Какой цвет выбирается: текст или маркер. */
  kind: CustomColorKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Что показать, пока у выделения нет цвета автора: цвет, с которого начинать.
 * Красный и жёлтый — потому что «Свой цвет…» чаще всего нужен там, где палитра
 * не дотягивает до яркого; сам выбор человек всё равно делает заново.
 */
const START: Record<CustomColorKind, string> = { text: "#d92d20", highlight: "#ffe066" };

/** Метка, в атрибуте которой живёт цвет, по виду цвета. */
const MARK: Record<CustomColorKind, "textStyle" | "highlight"> = {
  text: "textStyle",
  highlight: "highlight",
};

/**
 * Поповер произвольного цвета: `ColorPicker` кита, предупреждение о контрасте и
 * «Применить» / «Отмена».
 *
 * ОТДЕЛЬНЫМ МОДУЛЕМ, И `RichTextEditor` ГРУЗИТ ЕГО ЛЕНИВО. `ColorPicker` тянет
 * цветовую подсистему `react-aria-components` — 61 кБ gzip (ADR-0038), столько
 * же, сколько весь остальной кит. Большинство редакторов эту возможность не
 * откроют ни разу, и платить за неё каждому — значит поднять вход
 * `@olddevs/ui/editor` вдвое ради пункта меню. Поэтому статический импорт
 * только здесь, а редактор берёт модуль через `React.lazy` при первом «Свой
 * цвет…».
 *
 * ПОПОВЕР ТОЛЬКО У РЕДАКТОРА, НЕ У МЕНЮ. Меню закрывается по выбору пункта, а
 * плавающая Панель прячется, когда фокус уходит в поповер, — вместе с меню и
 * поповером, который в нём жил бы. Якорь — выделение, как у ссылки
 * (`LinkPopover`): так он стоит у текста при любом способе открыть.
 *
 * ESCAPE. И `Popover`, и `Dialog` кита — Radix, поэтому стек слоёв ADR-0041
 * работает без единой строки здесь: выбор цвета внутри (тоже `Popover`) закрывает
 * первый Escape, этот поповер — второй, окно вокруг — третий.
 *
 * КОНТРАСТ — ПРЕДУПРЕЖДЕНИЕ, А НЕ ЗАПРЕТ. Автор вправе взять бледный цвет
 * намеренно; он должен видеть цену выбора. Меряется по ТЕКУЩЕЙ теме: фон и
 * основной текст Редактора — `--rte-background` и `--rte-foreground` на
 * документе (`tokens.ts`). Текст — против фона; маркер — тёмный текст на
 * подложке маркера (`--marker-text`): текст на маркере тёмный в любой
 * теме, поэтому меряется он, а не основной текст темы. Не удалось
 * прочитать тему (нет стилей) — молчание: «не измерено» не то же, что «плохо».
 */
export function CustomColorPopover({ editor, kind, open, onOpenChange }: CustomColorPopoverProps) {
  const messages = useMessages().editor;
  /*
    Прямоугольник выделения меряется при каждом пересчёте позиции — поповер
    едет вместе с текстом; выделение движка при этом не меняется.
  */
  const anchorRef = useRef({
    getBoundingClientRect: () => {
      const { from, to } = editor.state.selection;
      return posToDOMRect(editor.view, from, to);
    },
  });
  const interactedOutside = useRef(false);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        aria-label={kind === "text" ? messages.customColorText : messages.customColorHighlight}
        className={cn(GLASS_PANEL_CLASS, "w-80 p-3")}
        onOpenAutoFocus={() => {
          interactedOutside.current = false;
        }}
        onInteractOutside={() => {
          interactedOutside.current = true;
        }}
        onCloseAutoFocus={(event) => {
          // Своей кнопки-триггера у поповера нет: Radix вернул бы фокус тому,
          // кто был в фокусе до открытия, — пункту меню, которого уже нет.
          event.preventDefault();
          if (!interactedOutside.current && !editor.isDestroyed) editor.commands.focus();
        }}
      >
        {/* Содержимое монтируется заново на каждое открытие: старт — цвет
            автора на выделении сейчас, а не прошлый черновик. */}
        <CustomColorForm editor={editor} kind={kind} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Значение пользовательского свойства на документе; `null` — не задано или не цвет. */
function themeColor(editor: Editor, property: string): string | null {
  if (typeof getComputedStyle === "undefined") return null;
  const value = getComputedStyle(editor.view.dom).getPropertyValue(property).trim();
  return value || null;
}

function CustomColorForm({
  editor,
  kind,
  onDone,
}: {
  editor: Editor;
  kind: CustomColorKind;
  onDone: () => void;
}) {
  const messages = useMessages().editor;
  const [draft, setDraft] = useState(
    () => normalizeCustomColor(editor.getAttributes(MARK[kind]).color) ?? START[kind]
  );
  const color = normalizeCustomColor(draft);

  const warning = useMemo(() => {
    if (!color) return "";
    const background = themeColor(editor, "--rte-background");
    const markerText = themeColor(editor, "--marker-text");
    // Текст — сам цвет против фона; маркер — тёмный текст на этом маркере.
    const ratio =
      kind === "text"
        ? contrastRatio(color, background ?? "")
        : contrastRatio(markerText ?? "", color);
    if (Number.isNaN(ratio) || ratio >= CONTRAST_TEXT) return "";
    return kind === "text"
      ? messages.customColorLowContrastText({ ratio: formatRatio(ratio) })
      : messages.customColorLowContrastHighlight({ ratio: formatRatio(ratio) });
  }, [color, editor, kind, messages]);

  const apply = () => {
    if (!color) return;
    const chain = editor.chain().focus();
    (kind === "text" ? chain.setColor(color) : chain.setHighlight({ color })).run();
    onDone();
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Живая область есть всегда, текст в ней — только при низком контрасте:
          скринридер объявляет изменение содержимого, а не появление узла. */}
      <div role="status" className="text-warning-strong text-caption min-h-4">
        {warning}
      </div>
      <p className="text-fg-2 text-caption">{messages.customColorThemeNote}</p>
      {/*
        Выбор цвета — В НИЖНЕЙ СТРОКЕ, рядом с кнопками. `ColorPicker` кита —
        кнопка и своя панель, и панель раскрывается под кнопкой: стоя выше
        предупреждения и «Применить», она закрывала бы их ровно тогда, когда
        цвет выбирают. Внизу она раскрывается мимо них.
      */}
      <div className="flex items-center gap-2">
        <ColorPicker
          value={draft}
          onChange={setDraft}
          label={messages.customColorValue({ hex: draft.toLowerCase() })}
          outputFormat="hex"
          className="min-w-0 flex-1"
        />
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {messages.customColorCancel}
        </Button>
        <Button type="button" size="sm" variant="solid" tone="accent" onClick={apply}>
          {messages.customColorApply}
        </Button>
      </div>
    </div>
  );
}

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
  /** Which color is being selected: text or highlight. */
  kind: CustomColorKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The color to start from while the selection has no custom color yet. Red and yellow, because
 * "Custom color…" is most often needed where the palette falls short of bright colors. The person
 * selects the color again in any case.
 */
const START: Record<CustomColorKind, string> = { text: "#d92d20", highlight: "#ffe066" };

/** The Mark whose attribute holds the color, by kind of color. */
const MARK: Record<CustomColorKind, "textStyle" | "highlight"> = {
  text: "textStyle",
  highlight: "highlight",
};

/**
 * Popover for a custom color: the kit's `ColorPicker`, a contrast warning, and "Apply" / "Cancel".
 *
 * SEPARATE MODULE, AND `RichTextEditor` LOADS IT LAZILY. `ColorPicker` pulls in the color subsystem
 * of `react-aria-components`, 61 kB gzip (ADR-0038), as much as the whole rest of the kit. Most
 * editors will never open this feature, and paying for it in every editor would double the
 * `@olddevs/ui/editor` entry point for one menu item. So the static import lives only here, and the
 * editor takes the module through `React.lazy` on the first "Custom color…".
 *
 * POPOVER ONLY IN THE EDITOR, NOT IN A MENU. A menu closes when an item is chosen, and the floating
 * Toolbar hides when focus moves into the popover, together with the menu and with a popover that
 * would have lived inside it. The anchor is the selection, as for a link (`LinkPopover`), so the
 * popover stays at the text however it was opened.
 *
 * ESCAPE. Both `Popover` and `Dialog` of the kit are Radix, so the overlay layers of ADR-0041 work
 * without a line here: the color choice inside (also a `Popover`) closes on the first Escape, this
 * popover on the second, and the dialog around it on the third.
 *
 * CONTRAST IS A WARNING, NOT A BAN. The author may select a pale color on purpose, but they must see
 * the cost of the choice. It is measured against the CURRENT theme. The Editor's background and main
 * text are `--rte-background` and `--rte-foreground` on the document (`tokens.ts`). Text is measured
 * against the background. For a highlight it is dark text on the highlight's background
 * (`--marker-text`): text on a highlight is dark in any theme, so that is what gets measured, not
 * the theme's main text. If the theme cannot be read (no styles), the popover stays silent: "not
 * measured" is not the same as "poor".
 */
export function CustomColorPopover({ editor, kind, open, onOpenChange }: CustomColorPopoverProps) {
  const messages = useMessages().editor;
  /*
    The selection rectangle is measured on every position update, so the popover moves together
    with the text. The engine's selection does not change in the process.
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
          // The popover has no trigger button of its own: Radix would return focus to whoever
          // had it before opening, a menu item that is already gone.
          event.preventDefault();
          if (!interactedOutside.current && !editor.isDestroyed) editor.commands.focus();
        }}
      >
        {/* The content mounts anew on every opening: the start is the custom color on the
            selection now, not the previous draft. */}
        <CustomColorForm editor={editor} kind={kind} onDone={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Value of a CSS custom property on the document; `null` if it is not set or not a color. */
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
    // Text: the color itself against the background. Highlight: dark text on that highlight.
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
      {/* The live region is always there; text goes into it only on low contrast. A screen
          reader announces a change of the content, not the appearance of a node. */}
      <div role="status" className="text-warning-strong text-caption min-h-4">
        {warning}
      </div>
      <p className="text-fg-2 text-caption">{messages.customColorThemeNote}</p>
      {/*
        The color picker is IN THE BOTTOM ROW, next to the buttons. The kit's `ColorPicker` is a
        button with its own panel, and the panel opens below the button. Placed above the warning
        and "Apply", it would cover them exactly when the color is being chosen. At the bottom it
        opens past them.
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

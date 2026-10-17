"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useEffect, useRef, type ComponentType } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import { Separator } from "../../components/content/Separator.js";
import { Toolbar } from "../../components/actions/Toolbar.js";
import { Tooltip, TooltipProvider } from "../../components/overlays/Tooltip.js";
import { useMessages } from "../../i18n/useMessages.js";
import type { IconProps } from "../../icons.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import type { CustomColorKind } from "../features/color/customColor.js";
import {
  BlockTypeMenu,
  hasBlockTypeMenu,
  hasListMenu,
  ListMenu,
  isMoreMarkId,
  moreFormatTools,
  MoreFormatMenu,
} from "./FormatMenus.js";
import { BUBBLE_ROW_MARKS } from "./rowMarks.js";
import { showOverSelection, useOutOfTabOrder, useSelectionMenuOptions } from "./selectionMenu.js";
import { ariaShortcut, findShortcutKeys, isApple, shortcutLabel } from "../core/shortcuts.js";
import { projectRecords, type KitToolButton, type ToolList } from "../core/toolDescriptor.js";
import { ToolButtonView, useToolLabel } from "./ToolButtonView.js";
import { ColorMenuButton, HighlightMenuButton } from "./ColorMenus.js";
import type { Tool } from "../core/tools.js";
import { GLASS_INVERSE_CLASS } from "../styles/glass.js";

/** Plugin key of the Bubble menu, used to show it by command (`Alt+F10`). */
export const SELECTION_BUBBLE_KEY = "richTextSelectionBubble";

/** The bubble's "…" menu leaves out the Marks of its row (underline): here they are buttons. */
const BUBBLE_MORE_OMIT = BUBBLE_ROW_MARKS.map((mark) => mark.id).filter(isMoreMarkId);
const BUBBLE_MORE_TOOLS = moreFormatTools(BUBBLE_MORE_OMIT);

/**
 * The tail of the bubble has places reserved for the kit's own buttons: link, then emoji.
 * Button descriptors flagged for the selection menu that have no reserved place come after
 * them, in the order of the Tool list.
 */
const BUBBLE_TAIL_ORDER: readonly Tool[] = ["link", "emoji"];

/**
 * The bubble's inverse surface, made by re-pointing the `@theme` bridge inside it.
 *
 * WHY THIS WAY, NOT WITH OWN CLASSES ON EACH BUTTON. The bubble holds the shared Editor buttons,
 * the "¶" and "…" menus (`FormatMenus.tsx`) and the emoji button, and they are colored by the
 * kit's vocabulary: `text-fg-1`, `hover:bg-bg-2`, the focus outline `outline-accent-strong`.
 * A utility reads the bridge variable (`--color-fg-1`), and the bridge is declared on the root and
 * inherited. So a bridge re-declared on the bubble recolors all its descendants, while the buttons
 * themselves know nothing about the bubble. Own classes would have to be passed as props into every
 * shared component, and would fight the `hover:` specificity of the react-aria plugin.
 *
 * WHY THE MENUS STAY NORMAL. Menu lists, tooltips and popovers (link, emoji) are rendered in a portal
 * at `body`, outside the bubble, and do not see the re-declaration: they sit on the normal popover
 * surface, as the spec requires.
 *
 * Roles: text and icons, `--text-on-inverse`; hover (`bg-2`), `--surface-inverse-hover`; pressed
 * (`bg-3`, hover on a pressed button) and dividers, `--surface-inverse-pressed`; focus outline,
 * `--accent-on-inverse`. The values and contrast pairs are in ADR-0055 and `scripts/contrast.mjs`.
 */
const INVERSE_SCOPE_CLASS =
  "[--color-fg-0:var(--text-on-inverse)] [--color-fg-1:var(--text-on-inverse)] " +
  "[--color-bg-2:var(--surface-inverse-hover)] [--color-bg-3:var(--surface-inverse-pressed)] " +
  "[--color-line:var(--surface-inverse-pressed)] [--color-line-soft:var(--surface-inverse-pressed)] " +
  "[--color-accent-strong:var(--accent-on-inverse)]";

const BUTTON_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true });
/** A pressed Mark button gets its own inverse-surface background, not the kit's `soft` variant. */
const BUTTON_PRESSED_CLASS = cn(
  BUTTON_CLASS,
  "bg-surface-inverse-pressed hover:bg-surface-inverse-pressed"
);
const TOOL_BUTTON_CLASSES = { idle: BUTTON_CLASS, pressed: BUTTON_PRESSED_CLASS };

export interface SelectionBubbleProps {
  editor: Editor;
  tools: ToolList;
  /** The field is disabled: the buttons are visible but cannot be pressed. */
  disabled: boolean;
  /**
   * The "Custom color…" item of the "Color" popover. The Editor holds the `ColorPicker` popover,
   * as the Toolbar does: the bubble hides when focus moves into it.
   */
  onCustomColor?: (kind: CustomColorKind) => void;
  /**
   * Whether `Alt+F10` leads here. In `toolbar="bubble"` mode, yes. Over the fixed Toolbar the
   * shortcut leads to the Toolbar, and the bubble does not declare it: two `aria-keyshortcuts`
   * for one shortcut would be false for a screen reader.
   */
  keyboardTarget?: boolean;
  /** The Document area that scrolls on its own (ADR-0059); without it, the window scrolls. */
  scrollTarget?: HTMLElement;
}

/**
 * The Bubble menu, `toolbar="bubble"`: a compact pill on an inverse surface above a non-empty
 * selection.
 *
 * ITS CONTENTS ARE SET BY THE KIT: "¶" · Lists ▾ | bold · italic · underline · Color ▾ ·
 * "…" | link · emoji. "Color" holds both grids, for text and for the highlight. There is no
 * separate "Highlight" here: it is on the Toolbar (without the `color` Tool, it is here).
 * The button of a disabled Tool is not drawn; the order does not depend on `tools`. Link and emoji
 * are button descriptors flagged for the selection menu (`toolDescriptor.ts`): the same as on the
 * Toolbar. There is no Keyboard shortcuts popover, no undo and no redo: the bubble is about the
 * selected text, not about the Document.
 *
 * VISIBILITY AND POSITION are the same as for the floating Toolbar (`selectionMenu.ts`): Tiptap's
 * `BubbleMenu` shows the bubble once the selection has settled, hides it on an empty selection, over
 * an image, and without focus in the Editor, and removes its node from the DOM when it hides. The
 * layer is `OVERLAY_LAYER.popover`. The bubble does not take part in the Escape stack, and Escape
 * inside a menu opened from it closes only that menu.
 *
 * KEYBOARD: the kit's `Toolbar`. `Alt+F10` from the Document, arrow keys, Home and End; an action
 * returns focus to the Document, on the same selection.
 */
export function SelectionBubble({
  editor,
  tools,
  disabled,
  onCustomColor,
  keyboardTarget = true,
  scrollTarget,
}: SelectionBubbleProps) {
  const options = useSelectionMenuOptions(scrollTarget);
  const messages = useMessages().editor;
  const label = useToolLabel();
  const apple = isApple();
  const ref = useRef<HTMLDivElement>(null);
  useOutOfTabOrder(ref, editor);

  const marks = BUBBLE_ROW_MARKS.filter((mark) => tools.has(mark.tool));
  const hasMore = BUBBLE_MORE_TOOLS.some((tool) => tools.has(tool));
  /*
    The "Color" button is one button with both grids (the owner's decision):
    on the Toolbar it is "Highlight", here it is "Color", with no duplicates. Without the `color`
    Tool there is no "Color" button, and the highlight is set by "Highlight". Otherwise the mark
    could not be set from the bubble.
  */
  const hasColor = tools.has("color");
  const hasHighlight = !hasColor && tools.has("highlight");
  const hasBlockType = hasBlockTypeMenu(tools);
  // "Lists ▾" comes right after "¶", as on the Toolbar: the lists have moved out of the "¶" menu.
  const hasLists = hasListMenu(tools);
  // The tail: button descriptors flagged for the selection menu, projected from the Tool list.
  const tail = projectRecords<KitToolButton>(tools, BUBBLE_TAIL_ORDER, (descriptor) =>
    descriptor.buttons?.filter((button) => button.selectionMenu)
  );

  // `aria-keyshortcuts` is the route into the bubble from the Document. react-aria's `Toolbar`
  // does not pass the attribute to the DOM, so it is set on the node, as on the Toolbar.
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (keyboardTarget) toolbarRef.current?.setAttribute("aria-keyshortcuts", "Alt+F10");
    else toolbarRef.current?.removeAttribute("aria-keyshortcuts");
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      const flags: Record<string, { active: boolean; can: boolean; visible?: boolean }> = {};
      for (const mark of marks) {
        flags[mark.id] = {
          active: mark.isActive(current),
          can: current.isEditable && mark.can(current),
        };
      }
      for (const button of tail) {
        flags[button.id] = {
          active: button.isActive?.(current) ?? false,
          can: current.isEditable && button.can(current),
          visible: button.isVisible?.(current) ?? true,
        };
      }
      return { flags, editable: current.isEditable };
    },
  });
  const off = disabled || !state.editable;
  const shortcut = (keys: readonly string[]) => shortcutLabel(keys, apple);

  const toggle = (
    id: string,
    label: string,
    Icon: ComponentType<IconProps>,
    pressed: boolean,
    available: boolean,
    run: () => void
  ) => {
    const keys = findShortcutKeys(id);
    return (
      <Tooltip
        key={id}
        content={
          <span className="flex items-center gap-2">
            {label}
            {keys && <Kbd aria-hidden="true">{shortcut(keys)}</Kbd>}
          </span>
        }
      >
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          // An unavailable action gets `aria-disabled`, as on the Toolbar: the button
          // stays in the arrow-key navigation and does not silently disappear.
          aria-disabled={!available || undefined}
          aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
          disabled={disabled}
          onClick={() => {
            if (available) run();
          }}
          className={pressed ? BUTTON_PRESSED_CLASS : BUTTON_CLASS}
        >
          <Icon size={16} aria-hidden />
        </button>
      </Tooltip>
    );
  };

  const shownTail = tail.filter((button) => state.flags[button.id]?.visible !== false);
  const hasMarks = marks.length > 0 || hasHighlight || hasColor || hasMore;
  const hasTail = shownTail.length > 0;
  // No buttons means no bubble at all: an empty dark strip above the selection
  // (`tools={["history", "table"]}` with the Toolbar above it) would show nothing useful.
  if (!hasBlockType && !hasLists && !hasMarks && !hasTail) return null;

  return (
    <BubbleMenu
      ref={ref}
      editor={editor}
      pluginKey={SELECTION_BUBBLE_KEY}
      shouldShow={showOverSelection}
      options={options}
      className={cn(
        OVERLAY_LAYER.popover,
        INVERSE_SCOPE_CLASS,
        GLASS_INVERSE_CLASS,
        "text-text-on-inverse shadow-2 rounded-md p-1",
        // Narrow screen: the bubble wraps onto a second row instead of running past the edge.
        "max-w-[calc(100vw-1rem)]"
      )}
    >
      <TooltipProvider>
        <Toolbar ref={toolbarRef} aria-label={messages.selectionToolbar} className="gap-0.5">
          {(hasBlockType || hasLists) && (
            <>
              {hasBlockType && (
                <BlockTypeMenu editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
              )}
              {hasLists && (
                <ListMenu editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
              )}
              {(hasMarks || hasTail) && <Separator />}
            </>
          )}
          {marks.map((mark) =>
            toggle(
              mark.id,
              mark.label(messages),
              mark.icon,
              state.flags[mark.id]?.active ?? false,
              state.flags[mark.id]?.can ?? false,
              () => mark.run(editor)
            )
          )}
          {hasHighlight && (
            <HighlightMenuButton editor={editor} tools={tools} disabled={off} shortcut={shortcut} />
          )}
          {hasColor && (
            <ColorMenuButton
              editor={editor}
              tools={tools}
              disabled={off}
              shortcut={shortcut}
              onCustomColor={onCustomColor}
            />
          )}
          {hasMore && (
            // The same "…" menu as on the Toolbar, without underline: it is in the row here.
            // The "Code block" item is here too: the bubble had no code Block button,
            // and selected lines are turned into a code Block from here,
            // just as the Block type is set from the "¶" menu of the same bubble.
            <MoreFormatMenu
              editor={editor}
              tools={tools}
              disabled={off}
              shortcut={shortcut}
              omit={BUBBLE_MORE_OMIT}
            />
          )}
          {hasMarks && hasTail && <Separator />}
          {shownTail.map((button) => (
            <ToolButtonView
              key={button.id}
              editor={editor}
              button={button}
              label={label(button.label)}
              pressed={state.flags[button.id]?.active ?? false}
              unavailable={!(state.flags[button.id]?.can ?? false)}
              disabled={off}
              classes={TOOL_BUTTON_CLASSES}
            />
          ))}
        </Toolbar>
      </TooltipProvider>
    </BubbleMenu>
  );
}

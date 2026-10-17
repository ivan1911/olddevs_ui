"use client";

import { posToDOMRect, type Editor, type EditorEvents } from "@tiptap/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Kbd } from "../../components/content/Kbd.js";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "../../components/overlays/Popover.js";
import { Tooltip } from "../../components/overlays/Tooltip.js";
import { useMessages, useUiLocale } from "../../i18n/useMessages.js";
import { buttonClasses } from "../../lib/button.js";
import { cn } from "../../lib/cn.js";
import { GLASS_PANEL_CLASS } from "../styles/glass.js";
import { ariaShortcut, isApple, shortcutLabel } from "../core/shortcuts.js";
import type { ToolPopoverRequest } from "../core/toolButtons.js";
import { toolLabel, type KitToolButton, type ToolLabel } from "../core/toolDescriptor.js";

/**
 * A button built from a Tool description (`toolDescriptor.ts`) on the Toolbar, on the
 * floating Toolbar and in the bubble menu, and the frame of its popover.
 *
 * THE KIT DRAWS, THE DESCRIPTION DESCRIBES (ADR-0058, item 5). The host of the place (the
 * Toolbar or the bubble menu) computes the button's state (`pressed`, `unavailable`)
 * together with its own state, and manages roving focus. What all description buttons
 * share is here: the hint with `Kbd`, `aria-pressed` only when `isActive`,
 * `aria-keyshortcuts`, `aria-disabled` and the popover.
 */

/**
 * The label of an entry in the `UiProvider` locale. A locale change re-renders the entry
 * (ADR-0058, item 6.1). The kit's Editor strings are placed in the context for built-ins.
 */
export function useToolLabel(): (label: ToolLabel) => string {
  const messages = useMessages().editor;
  const locale = useUiLocale();
  return (label) => toolLabel(label, { locale, messages });
}

/**
 * The default popover frame: sized to its content, with a small padding. The background is
 * the Editor's popover glass for every frame, including a custom Tool's popover. It floats
 * above the Document just like the built-in ones.
 */
const POPOVER_FRAME_CLASS = "w-auto p-2";

const OPEN_CLASS = buttonClasses({ variant: "ghost", size: "sm", iconOnly: true, selected: true });

/**
 * The popover frame of an entry, shared by the anchor on a button, on a selection and on
 * a Block.
 *
 * The kit's `Popover`. Radix keeps the stack of layers, and the kit's `Dialog` is Radix
 * too: Escape inside a popover within a dialog closes the popover, not the dialog
 * (ADR-0041). Mouse selection in `Dialog` and `Drawer` works for the same reason: the
 * popover's layer is above the dialog's layer and enables `pointer-events` itself.
 *
 * FOCUS. Closing with the keyboard or by a selection returns focus to the Document, to the
 * previous selection, not to the button: the user came to edit the text and continues from
 * the same place. A click outside does not touch focus, because the user chose where to put
 * it. Radix itself moves focus inside, to the first focusable element. That cannot be done
 * by hand: inside a `Dialog` the window's focus trap is not yet suspended, and it would
 * return focus to the button.
 */
function ToolPopoverFrame({
  editor,
  label,
  className,
  children,
}: {
  editor: Editor;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const interactedOutside = useRef(false);
  return (
    <PopoverContent
      aria-label={label}
      className={cn(GLASS_PANEL_CLASS, className ?? POPOVER_FRAME_CLASS)}
      onOpenAutoFocus={() => {
        interactedOutside.current = false;
      }}
      onInteractOutside={() => {
        interactedOutside.current = true;
      }}
      onCloseAutoFocus={(event) => {
        // Radix would return focus to the trigger button, but a popover on a selection has
        // no such button at all. Radix's timer could also fire after the engine has been
        // unmounted. Focus is set at once, not a frame later as `commands.focus()` does: a
        // delayed focus into the Document would close a popover opened by a second click.
        event.preventDefault();
        if (!interactedOutside.current && !editor.isDestroyed) editor.view.focus();
      }}
    >
      {/* The content is mounted anew on each open: it takes the Document's state at the
          moment of opening, not a stale draft. */}
      {children}
    </PopoverContent>
  );
}

export interface ToolButtonViewProps {
  editor: Editor;
  button: KitToolButton;
  /** The label in the current locale (`toolLabel`). */
  label: string;
  /** The `isActive` state; not read for a button that has no `isActive`. */
  pressed: boolean;
  /** `aria-disabled`: the `can` check fails, or the field is in HTML mode. */
  unavailable: boolean;
  /** The field is disabled: the button stays visible but cannot be pressed or take focus. */
  disabled: boolean;
  /** The host's classes: the normal and the pressed button (the bubble menu has its own). */
  classes: { idle: string; pressed: string };
}

export function ToolButtonView({
  editor,
  button,
  label,
  pressed,
  unavailable,
  disabled,
  classes,
}: ToolButtonViewProps) {
  const apple = isApple();
  const [open, setOpen] = useState(false);
  // The tooltip text: the button's own shortcut, or the key from the Extensions (`keys` of a
  // built-in).
  const keys = button.shortcut ?? button.keys;
  const tooltip = keys ? (
    <span className="flex items-center gap-2">
      {label}
      <Kbd aria-hidden="true">{shortcutLabel(keys, apple)}</Kbd>
    </span>
  ) : (
    label
  );
  const Icon = button.icon;
  // A button's popover is held by the button itself; a selection's popover is held by the
  // Editor (`SelectionPopover`).
  const atButton = button.popover != null && button.popoverFrame?.anchor !== "selection";
  /*
    An unavailable action uses `aria-disabled`, not `disabled`: APG advises keeping Toolbar
    actions focusable, otherwise arrow keys skip the button silently. A disabled FIELD is a
    different matter: there is nothing for focus to do in it.
  */
  const trigger = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={button.isActive ? pressed : undefined}
      aria-haspopup={atButton ? "dialog" : undefined}
      aria-disabled={unavailable || undefined}
      aria-keyshortcuts={keys ? ariaShortcut(keys, apple) : undefined}
      disabled={disabled}
      onClick={(event) => {
        // Radix will not open the popover if the handler cancelled the event.
        if (unavailable) event.preventDefault();
        else if (atButton) return;
        // The engine command that opens the popover on a selection is the same as the one
        // behind the shortcut (`toolButtons.ts`).
        else if (button.popover) editor.commands.openToolPopover(button.id);
        else button.run(editor);
      }}
      className={open ? OPEN_CLASS : pressed ? classes.pressed : classes.idle}
    >
      <Icon size={16} aria-hidden />
    </button>
  );

  if (!atButton) return <Tooltip content={tooltip}>{trigger}</Tooltip>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={tooltip}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      </Tooltip>
      <ToolPopoverFrame editor={editor} label={label} className={button.popoverFrame?.className}>
        {button.popover?.({ editor, close: () => setOpen(false) })}
      </ToolPopoverFrame>
    </Popover>
  );
}

export interface SelectionPopoverProps {
  editor: Editor;
  /** The entry whose popover is open, or was opened last. */
  request: ToolPopoverRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The entry's popover on a selection or on a Block (ADR-0058, item 5.6). It appears this
 * way when a shortcut or a menu opened it: an Insert item opens at the caret, and a Block
 * action opens at the Block. It always appears at a button with the frame
 * `anchor: "selection"` (the link). `RichTextEditor` holds it, not a button or a menu. A
 * shortcut works without the Toolbar (`toolbar="none"`) and with the floating Toolbar
 * hidden, and by the time the popover opens, the menu is already gone.
 *
 * The anchor is measured on every position recalculation, not once on opening. Radix calls
 * it on scroll and on resize, and the popover moves with the text. The engine's selection
 * does not change in the process: focus in the popover does not reset it. The Block's
 * position follows the Document's edits while the popover is open.
 */
export function SelectionPopover({ editor, request, open, onOpenChange }: SelectionPopoverProps) {
  const label = useToolLabel();
  // The Block position of the request: a new request takes its own position at once, with
  // no frame showing the old one.
  const [moved, setMoved] = useState({ request, block: request.block });
  const block = moved.request === request ? moved.block : request.block;
  const blockRef = useRef(block);
  blockRef.current = block;
  useEffect(() => {
    let current = request.block;
    if (current === undefined) return;
    const follow = ({ transaction }: EditorEvents["transaction"]) => {
      current = transaction.mapping.map(current!);
      setMoved({ request, block: current });
    };
    editor.on("transaction", follow);
    return () => void editor.off("transaction", follow);
  }, [editor, request]);
  const anchorRef = useRef({
    getBoundingClientRect: () => {
      const node = blockRef.current === undefined ? null : editor.view.nodeDOM(blockRef.current);
      if (node instanceof HTMLElement) return node.getBoundingClientRect();
      const { from, to } = editor.state.selection;
      return posToDOMRect(editor.view, from, to);
    },
  });
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <ToolPopoverFrame editor={editor} label={label(request.label)} className={request.className}>
        {request.popover({
          editor,
          close: () => onOpenChange(false),
          pos: block ?? editor.state.selection.from,
        })}
      </ToolPopoverFrame>
    </Popover>
  );
}

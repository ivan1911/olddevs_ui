"use client";

import * as Primitive from "@radix-ui/react-context-menu";
import { forwardRef, type ReactNode } from "react";
import { CheckIcon, ChevronRightIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_SELECTED_CLASS,
  MENU_ITEM_SHORTCUT_CLASS,
  MENU_ITEM_SUBMENU_CLASS,
  MENU_ITEM_TONE,
  MENU_PANEL_CLASS,
  MENU_SECTION_LABEL_CLASS,
  MENU_SEPARATOR_CLASS,
} from "../../lib/menu.js";
import type { Tone } from "../../lib/variants.js";
import { keyGlyphs } from "../content/Kbd.js";

/**
 * Context menu: opened by the right mouse button and by the context menu key.
 *
 * BUILT ON RADIX, NOT ON react-aria, and this was forced: react-aria does not provide a context
 * menu at all. The Radix family is already in the package (dialog, popover, tooltip), so the new
 * dependency does not bring a new vendor.
 *
 * The look comes from the same table, `lib/menu.ts`, as the react-aria `Menu`. This is the only
 * thing that keeps the two menus from drifting apart: the libraries differ, while the user must
 * see the same menu whether they opened it with a button or with the right mouse button. The
 * "two menus side by side" snapshot guards it.
 */
export const ContextMenu = Primitive.Root;
export const ContextMenuTrigger = Primitive.Trigger;
export const ContextMenuSub = Primitive.Sub;

export interface ContextMenuContentProps {
  /** Menu items, sections and separators. */
  children?: ReactNode;
  /** Classes for the menu panel, for example the width. */
  className?: string;
}

/** Context menu panel. Portal inside, as in `Menu`. */
export const ContextMenuContent = forwardRef<HTMLDivElement, ContextMenuContentProps>(
  function ContextMenuContent({ children, className }, ref) {
    return (
      <Primitive.Portal>
        <Primitive.Content ref={ref} className={cn(MENU_PANEL_CLASS, className)}>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    );
  }
);

export interface ContextMenuItemProps {
  /** Item label. A long label is truncated with an ellipsis. */
  children?: ReactNode;
  /** Icon to the left of the label. */
  icon?: ReactNode;
  /** Keyboard shortcut on the right — a hint, not an action. */
  shortcut?: ReactNode;
  /** Color of the label and icon. `danger` is for destructive actions. */
  tone?: Tone;
  /** The item is inactive: it cannot be selected and is skipped during navigation. */
  disabled?: boolean;
  /** The item is selected with the mouse or the keyboard; the menu closes after that. */
  onSelect?: () => void;
  /** Classes for the item. */
  className?: string;
}

export const ContextMenuItem = forwardRef<HTMLDivElement, ContextMenuItemProps>(
  function ContextMenuItem(
    { children, icon, shortcut, tone = "neutral", disabled, onSelect, className },
    ref
  ) {
    return (
      <Primitive.Item
        ref={ref}
        disabled={disabled}
        onSelect={onSelect}
        // The Radix item gets real DOM focus, and the global `:focus-visible` rule draws an outline
        // around it, which a react-aria item does not have, because there the highlight comes from
        // the item background. Without this attribute the two menus look different, and the "two
        // menus side by side" snapshot catches it on the first run.
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], className)}
      >
        {icon != null && <span className={MENU_ITEM_ICON_CLASS}>{icon}</span>}
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.Item>
    );
  }
);

export interface ContextMenuCheckboxItemProps extends Omit<ContextMenuItemProps, "icon"> {
  /** Whether the item is checked. Controlled from outside: it changes only together with this prop. */
  checked?: boolean;
  /** The user toggled the item; the new value is passed. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Checkbox item.
 *
 * Here `checked`/`onCheckedChange` are on the item itself, unlike `Menu`, where toggles are set by
 * a selection on the section. The difference is not a whim: the libraries are built this way, and
 * making one match the other would mean adding a state layer of our own on top of it. Each of them
 * sets the `menuitemcheckbox` role and `aria-checked` itself, and that is exactly why they were
 * taken.
 */
export const ContextMenuCheckboxItem = forwardRef<HTMLDivElement, ContextMenuCheckboxItemProps>(
  function ContextMenuCheckboxItem(
    { children, shortcut, tone = "neutral", disabled, checked, onCheckedChange, className },
    ref
  ) {
    return (
      <Primitive.CheckboxItem
        ref={ref}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], MENU_ITEM_SELECTED_CLASS, className)}
      >
        <span className={MENU_ITEM_ICON_CLASS}>
          <Primitive.ItemIndicator>
            <CheckIcon size={14} strokeWidth={3} />
          </Primitive.ItemIndicator>
        </span>
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.CheckboxItem>
    );
  }
);

export interface ContextMenuRadioGroupProps {
  /** The `ContextMenuRadioItem` items of this group. */
  children?: ReactNode;
  /** The selected value. `undefined` means nothing is selected. */
  value?: string;
  /** Another item was selected; its `value` is passed. */
  onValueChange?: (value: string) => void;
}

/**
 * Single-choice section.
 *
 * The selection is set ON THE SECTION, not on the item — unlike the neighbouring checkbox item,
 * where `checked` lives on the item itself. The difference is not cosmetic: "exactly one is
 * selected" is a property of the group, and only by knowing the group can Radix set
 * `aria-checked="false"` on the others. An item that knows only about itself would announce the
 * unselected ones as plain commands.
 *
 * Use this, not `ContextMenuCheckboxItem`, wherever the value is one: a checkbox item promises that
 * several can be checked, and that promise would be false here.
 */
export function ContextMenuRadioGroup({
  children,
  value,
  onValueChange,
}: ContextMenuRadioGroupProps) {
  return (
    <Primitive.RadioGroup value={value} onValueChange={onValueChange}>
      {children}
    </Primitive.RadioGroup>
  );
}

export interface ContextMenuRadioItemProps extends Omit<ContextMenuItemProps, "icon" | "onSelect"> {
  /** The item's value. When it matches the section's value, the item is selected. */
  value: string;
}

/**
 * Single-choice item. Lives only inside `ContextMenuRadioGroup`.
 *
 * Radix sets the `menuitemradio` role and `aria-checked` — that is why it was taken. The mark is
 * drawn by the indicator in the same slot as the icon of a regular item, so a radio item has no icon
 * of its own: two icons on the left would read as two different states.
 */
export const ContextMenuRadioItem = forwardRef<HTMLDivElement, ContextMenuRadioItemProps>(
  function ContextMenuRadioItem(
    { children, shortcut, tone = "neutral", disabled, value, className },
    ref
  ) {
    return (
      <Primitive.RadioItem
        ref={ref}
        value={value}
        disabled={disabled}
        data-disable-focus-ring="true"
        className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE[tone], MENU_ITEM_SELECTED_CLASS, className)}
      >
        <span className={MENU_ITEM_ICON_CLASS}>
          <Primitive.ItemIndicator>
            <CheckIcon size={14} strokeWidth={3} />
          </Primitive.ItemIndicator>
        </span>
        <span className="truncate">{children}</span>
        {shortcut != null && <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>}
      </Primitive.RadioItem>
    );
  }
);

/** Section label. */
export function ContextMenuLabel({
  children,
  className,
}: {
  /** Text of the section label. */
  children?: ReactNode;
  /** Classes for the label. */
  className?: string;
}) {
  return (
    <Primitive.Label className={cn(MENU_SECTION_LABEL_CLASS, className)}>
      {children}
    </Primitive.Label>
  );
}

/** Separator. */
export function ContextMenuSeparator({
  className,
}: {
  /** Classes for the separator line. */
  className?: string;
}) {
  return <Primitive.Separator className={cn(MENU_SEPARATOR_CLASS, className)} />;
}

/** Item that opens a submenu. */
export function ContextMenuSubTrigger({
  children,
  icon,
  className,
}: {
  /** Item label. A long label is truncated with an ellipsis. */
  children?: ReactNode;
  /** Icon to the left of the label. */
  icon?: ReactNode;
  /** Classes for the item. */
  className?: string;
}) {
  return (
    <Primitive.SubTrigger
      data-disable-focus-ring="true"
      className={cn(MENU_ITEM_CLASS, MENU_ITEM_TONE.neutral, className)}
    >
      {icon != null && <span className={MENU_ITEM_ICON_CLASS}>{icon}</span>}
      <span className="truncate">{children}</span>
      <span className={MENU_ITEM_SUBMENU_CLASS}>
        <ChevronRightIcon size={14} />
      </span>
    </Primitive.SubTrigger>
  );
}

/** Submenu panel. */
export function ContextMenuSubContent({
  children,
  className,
}: {
  /** Submenu items. */
  children?: ReactNode;
  /** Classes for the submenu panel. */
  className?: string;
}) {
  return (
    <Primitive.Portal>
      <Primitive.SubContent className={cn(MENU_PANEL_CLASS, className)}>
        {children}
      </Primitive.SubContent>
    </Primitive.Portal>
  );
}

"use client";

import { forwardRef, useContext, type ReactNode } from "react";
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuSection as AriaMenuSection,
  Header,
  Popover,
  PopoverContext,
  Separator,
  type MenuItemProps as AriaMenuItemProps,
  type MenuProps as AriaMenuProps,
  type MenuSectionProps as AriaMenuSectionProps,
} from "react-aria-components";
import { CheckIcon, ChevronRightIcon } from "../../icons.js";
import { buttonClasses, type ButtonLookOptions } from "../../lib/button.js";
import { useSubmenuPlacement } from "../../hooks/useSubmenuPlacement.js";
import { cn } from "../../lib/cn.js";
import {
  MENU_ITEM_CLASS,
  MENU_ITEM_ICON_CLASS,
  MENU_ITEM_PRESSED_CLASS,
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

export { MenuTrigger, SubmenuTrigger } from "react-aria-components";

export interface MenuButtonProps extends ButtonLookOptions {
  /** Button label. Not shown with `iconOnly`. */
  children?: ReactNode;
  /** Icon on the left. With `iconOnly` it is the only content. */
  icon?: ReactNode;
  /** The button is disabled: the menu does not open. */
  disabled?: boolean;
  /** Accessible name. Required when there is no label. */
  "aria-label"?: string;
  /** Classes for the button. */
  className?: string;
}

/**
 * A button that opens a menu.
 *
 * A SEPARATE COMPONENT, NOT A PLAIN `Button`, and the reason is technical.
 * `MenuTrigger` passes its props to the trigger through react-aria's `ButtonContext` —
 * `onPress`, `aria-expanded`, `aria-haspopup`, the ref. A plain `<button>` does not read
 * this context, and the menu simply does not open on it: no error, no warning, the button
 * silently does nothing.
 *
 * Rewriting `Button` on react-aria would look "more correct" at first glance, but decision G
 * of the spec explicitly forbids it: existing primitives are not moved — they work and are
 * covered by snapshots. So this one is a RAC button, and both share the same look from
 * `lib/button.ts`. They have no way to drift apart.
 *
 * When `Button` gets `asChild` in W7, these two components can be merged into one — but not earlier.
 */
export const MenuButton = forwardRef<HTMLButtonElement, MenuButtonProps>(function MenuButton(
  { children, icon, disabled, variant, tone, size, iconOnly, selected, className, ...rest },
  ref
) {
  return (
    <AriaButton
      ref={ref}
      isDisabled={disabled}
      className={cn(buttonClasses({ variant, tone, size, iconOnly, selected }), className)}
      {...rest}
    >
      {icon}
      {children != null && !iconOnly ? <span>{children}</span> : null}
    </AriaButton>
  );
});

export interface MenuProps<T extends object = object> extends AriaMenuProps<T> {
  /** Offset of the panel from the button, in pixels. */
  offset?: number;
  /**
   * The side the panel opens from. By default a root menu opens below the button on the left
   * (`bottom start`); a nested one, inside `SubmenuTrigger`, opens beside its own item, and below
   * it on a narrow screen. An explicit value wins over both defaults. `end top` and `start top`
   * are beside the end or start of the line: in right-to-left writing they swap places, while
   * `right top` and `left top` do not.
   */
  placement?:
    | "bottom start"
    | "bottom end"
    | "top start"
    | "top end"
    | "end top"
    | "start top"
    | "right top"
    | "left top";
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, "children" | "className"> {
  /** Item label. A long one is cut off with an ellipsis. */
  children?: ReactNode;
  /** Icon on the left. On a selected item it is replaced by a checkmark. */
  icon?: ReactNode;
  /** Keyboard shortcut on the right — a reminder, not an action. */
  shortcut?: ReactNode;
  /** Color of the label and icon. `danger` is for destructive actions. */
  tone?: Tone;
  /** The item is inactive: it cannot be selected and is skipped in navigation. */
  disabled?: boolean;
  /** Classes for the item. */
  className?: string;
}

/**
 * Menu panel.
 *
 * A COMPOSITE API, not an `items` array — and this is not a departure from the package convention:
 * `Popover` and `Tooltip` are already composite here. A menu with submenus, sections and
 * checkbox or radio items, described as an object, turns into a separate markup language
 * next to the JSX that already exists; `Select` is items-based because it renders uniform list
 * rows, and here there is no uniformity.
 *
 * The component includes `Popover`, so the consumer does not need to wrap the menu by hand.
 * This is also what makes `SubmenuTrigger` work: it expects the popover as its second child.
 *
 * A SUBMENU opens beside its own item, and this default has to be set explicitly.
 * `SubmenuTrigger` hands the nested popover the `end top` placement through context, but an
 * explicit popover prop wins over context, and the kit's root default `bottom start` is exactly
 * such a prop: without a special case, a nested menu would open below its item. So `Menu` detects
 * a submenu from context (`trigger: "SubmenuTrigger"`, the public field of `PopoverContext`) and
 * asks the shared hook `useSubmenuPlacement` — the same one the Editor uses: on a phone a submenu
 * opens below its item; on a wide screen the kit passes no placement of its own, and react-aria's
 * `end top` applies — beside the item, respecting the writing direction. Flipping at the screen
 * edge (`shouldFlip`) and menu aim — moving the pointer diagonally toward the submenu does not
 * close it — stay with react-aria; the kit does not touch them.
 *
 * CHECKABLE ITEMS are driven by selection on the section, not by `checked` on the item:
 *
 *     <MenuSection label="View" selectionMode="multiple"
 *                  selectedKeys={keys} onSelectionChange={setKeys}>
 *       <MenuItem id="dense">Compact</MenuItem>
 *     </MenuSection>
 *
 * That is how react-aria works, and it is the right way: it sets the `menuitemcheckbox`/
 * `menuitemradio` roles and the `aria-checked` attribute itself. A `checked` prop on the item would
 * have to be propped up with those attributes by hand — repeating someone else's work and drifting
 * away from it at the first update.
 */
export const Menu = forwardRef<HTMLDivElement, MenuProps>(function Menu(
  { offset = 6, placement, className, ...rest },
  ref
) {
  const popoverContext = useContext(PopoverContext);
  // The context can be empty, carry slots, or carry the popover's own props; only the last
  // one says "submenu".
  const isSubmenu =
    popoverContext != null &&
    "trigger" in popoverContext &&
    popoverContext.trigger === "SubmenuTrigger";
  const submenuPlacement = useSubmenuPlacement();
  // On a wide screen no placement is passed at all: then `end top` from the `SubmenuTrigger` context
  // applies. It is logical, so in right-to-left writing the submenu opens on the left, whereas the
  // hook's `right top` would push it to the right.
  const resolvedPlacement =
    placement ??
    (isSubmenu
      ? submenuPlacement === "bottom start"
        ? submenuPlacement
        : undefined
      : "bottom start");

  return (
    <Popover
      offset={offset}
      placement={resolvedPlacement}
      className={cn(MENU_PANEL_CLASS, className)}
    >
      {/*
        `data-disable-focus-ring` is the package's own mechanism, the same as in `TextControl`.
        The global `:focus-visible` rule in styles.css draws an outline around any focusable element,
        and react-aria puts focus on the menu panel itself when it opens: without this attribute the
        user would see a blue frame around the whole menu instead of the item highlight. The
        `outline-none` class does not help here — the global rule has no `!important`, but the
        specificity of the pseudo-class is higher than the utility's.
      */}
      <AriaMenu ref={ref} data-disable-focus-ring="true" className="outline-none" {...rest} />
    </Popover>
  );
});

/**
 * Menu item.
 *
 * The look comes from the shared table `lib/menu.ts` — the same one `ContextMenu` on Radix is built from.
 * The states are set as variants (`hover:`, `selected:`, `pressed:`), not as a render prop: the item is the
 * element itself with `data-*`, not its child, and it is more correct to paint it with a class than with a condition in JS.
 */
export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(function MenuItem(
  { children, icon, shortcut, tone = "neutral", disabled, className, ...rest },
  ref
) {
  return (
    <AriaMenuItem
      ref={ref}
      isDisabled={disabled}
      // The item gets real DOM focus, and the global `:focus-visible` rule draws an outline around it.
      // In a menu the highlight is set by the background fill, and an outline on top of it is a second
      // cursor in the same place. The same attribute is on `ContextMenu` items: without it the two
      // implementations look different, and the "two menus side by side" snapshot shows it.
      data-disable-focus-ring="true"
      className={cn(
        MENU_ITEM_CLASS,
        MENU_ITEM_TONE[tone],
        MENU_ITEM_SELECTED_CLASS,
        MENU_ITEM_PRESSED_CLASS,
        className
      )}
      {...rest}
    >
      {({ isSelected, hasSubmenu }) => (
        <>
          {(icon != null || isSelected) && (
            <span className={MENU_ITEM_ICON_CLASS}>
              {isSelected ? <CheckIcon size={14} strokeWidth={3} /> : icon}
            </span>
          )}
          <span className="truncate">{children}</span>
          {shortcut != null && (
            <kbd className={MENU_ITEM_SHORTCUT_CLASS}>{keyGlyphs(shortcut)}</kbd>
          )}
          {hasSubmenu && (
            <span className={MENU_ITEM_SUBMENU_CLASS}>
              <ChevronRightIcon size={14} />
            </span>
          )}
        </>
      )}
    </AriaMenuItem>
  );
});

export interface MenuSectionProps<T extends object = object> extends Omit<
  AriaMenuSectionProps<T>,
  "className" | "children"
> {
  /** Section label. Without it the section stays a plain grouping. */
  label?: ReactNode;
  /**
   * Section items. Pass static markup only.
   *
   * In react-aria `children` can also be a function: that is how dynamic collections are described,
   * where items arrive as an array. The kit does not pass this form through — it is built entirely on
   * the composite API, and a second way to express the same thing would mean two markup languages in one component.
   */
  children?: ReactNode;
  /** Classes for the section. */
  className?: string;
}

/** Menu section. It is also the carrier of selection for checkable items. */
export const MenuSection = forwardRef<HTMLElement, MenuSectionProps>(function MenuSection(
  { label, children, className, ...rest },
  ref
) {
  return (
    <AriaMenuSection ref={ref} className={className} {...rest}>
      {label != null && <Header className={MENU_SECTION_LABEL_CLASS}>{label}</Header>}
      {children}
    </AriaMenuSection>
  );
});

/** Separator between groups of items. */
export function MenuSeparator({
  className,
}: {
  /** Classes for the separator line. */
  className?: string;
}) {
  return <Separator className={cn(MENU_SEPARATOR_CLASS, className)} />;
}

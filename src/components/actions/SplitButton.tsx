"use client";

import { useEffect, useState, type MouseEventHandler, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { ChevronDownIcon } from "../../icons.js";
import type { Size, Tone, Variant } from "../../lib/variants.js";
import { Button } from "./Button.js";
import { ButtonGroup } from "./ButtonGroup.js";
import { Menu, MenuButton, MenuTrigger } from "../overlays/Menu.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface SplitButtonProps {
  /**
   * The label of the main action — a string, not a node.
   *
   * This is the only restriction compared with `Button`, and it follows from how the component
   * is built: the menu button's accessible name is built from the label ("More actions: Export").
   * A node would give a name that does not exist — or would require a second prop with the same
   * label as a string, that is, two places where the same thing is written, which would drift
   * apart at the first edit.
   */
  label: string;
  /** Icon on the left of the main action. */
  icon?: ReactNode;
  /** The main action. The menu button does not call it. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /**
   * Disables both buttons at once.
   *
   * There is no separate disabled state for the two on purpose: a live menu button next to a
   * dead action offers variants of what cannot be done.
   */
  disabled?: boolean;
  /**
   * The main action is submitting: a ring instead of the icon, `aria-busy`.
   *
   * The menu button is disabled for this time too, for the same reason as with `disabled`. An
   * open menu in the middle of a submission offers a second way to do what is already being done.
   */
  loading?: boolean;
  /**
   * Variant of both buttons: the same axis as in `Button`. Without a value, the default of `Button`
   * applies.
   */
  variant?: Variant;
  /** Tone of both buttons: the axis is the same as in `Button`. Without a value, `Button`'s default applies. */
  tone?: Tone;
  /** Size of both buttons: the axis is the same as in `Button`. Without a value, `Button`'s default applies. */
  size?: Size;
  /** Menu items: `MenuItem`, `MenuSection`, `MenuSeparator`. */
  children?: ReactNode;
  /**
   * The side the menu panel opens toward.
   *
   * Four values out of the six that `Menu` supports: the side ones (`right top`, `left top`) are
   * deliberately narrowed — a panel that slides sideways from the menu button would land on top
   * of the main action, covering the very thing the user came for.
   */
  placement?: "bottom start" | "bottom end" | "top start" | "top end";
  /**
   * Classes for the group, not the button.
   *
   * This differs from the same-named prop of `Button`, and it is forced: there are two elements
   * here, and "a class on the button" has no unambiguous target.
   */
  className?: string;
}

/**
 * The main action button and the menu button for its variants, side by side.
 *
 * TWO SEPARATE BUTTONS, NOT ONE BUTTON WITH A ZONE. One button whose right part opens a menu is
 * an element with two different outcomes and one accessible name: from the keyboard the second
 * outcome cannot be reached at all, and a screen reader announces one action instead of two. The
 * split here is not styling but different controls.
 *
 * THE MENU BUTTON'S NAME IS BUILT FROM THE ACTION'S LABEL, and this is the component's only own
 * decision. Without it, a screen reader says "Export" and then an unnamed button with an arrow —
 * and there are usually several such arrows on a page, with nothing to tell them apart. Hence the
 * requirement for `label` to be a string.
 *
 * The look and layout are entirely borrowed: `ButtonGroup` trims the inner corners and collapses
 * adjacent borders; `Button` and `MenuButton` take their look from `lib/button.ts`. The component
 * does not introduce its own palette — the `variant`, `tone` and `size` axes are the same as for a
 * button, and they mean the same thing.
 *
 * Why `MenuButton` rather than a second `Button`: `MenuTrigger` passes its props to the trigger
 * through react-aria's `ButtonContext`, and a plain `<button>` does not read that context — the
 * menu would silently not open. See the docstring of `Menu` for the details.
 *
 * THE TRIGGER IS CONTROLLED, AND THIS IS NOT A WHIM. An uncontrolled `MenuTrigger` keeps the panel
 * open regardless of what happened to the button: disabling would only dim the menu button, while
 * an already open menu would stay in the DOM and its items would keep firing. The component would
 * look disabled, while the second way to perform the action would still work — exactly what the
 * `disabled` promise denies.
 *
 * The other props are NOT forwarded, and this is also a consequence of the two elements: `id`,
 * `type` or `data-*` have no unambiguous target here. A button that must submit a form needs a
 * `Button` with a `MenuTrigger` next to it, assembled by hand — each of them has its own target.
 */
export function SplitButton({
  label,
  icon,
  onClick,
  disabled = false,
  loading = false,
  variant,
  tone,
  size,
  children,
  placement = "bottom end",
  className,
}: SplitButtonProps) {
  const messages = useMessages();
  const moreLabel = messages.splitButton.more({ action: label });
  const off = disabled || loading;
  const [open, setOpen] = useState(false);

  /*
    Disabling not only hides the panel but also FORGETS that it was open.

    `isOpen={open && !off}` suppresses the display, but a controlled change of `isOpen` does not
    call `onOpenChange`, so `open` itself stays `true`. Without this cleanup, the menu would open
    on its own once the disabled state is lifted: the menu was opened → submission started → the
    panel closed → submission ended → the panel came back, although the user pressed nothing.
  */
  useEffect(() => {
    if (off) setOpen(false);
  }, [off]);

  return (
    <ButtonGroup className={className}>
      <Button
        variant={variant}
        tone={tone}
        size={size}
        icon={icon}
        disabled={disabled}
        loading={loading}
        onClick={onClick}
      >
        {label}
      </Button>
      <MenuTrigger isOpen={open && !off} onOpenChange={setOpen}>
        <MenuButton
          variant={variant}
          tone={tone}
          size={size}
          iconOnly
          disabled={off}
          aria-label={moreLabel}
          icon={<ChevronDownIcon size={BUTTON_ICON_SIZE[size ?? "md"]} aria-hidden />}
        />
        {/*
          The panel gets no `aria-label` of its own: `MenuTrigger` links it to the trigger, and the
          name comes from there. A second source of the name would drift from the first when one of
          them is edited. A test guards that the name is there.
        */}
        <Menu placement={placement}>{children}</Menu>
      </MenuTrigger>
    </ButtonGroup>
  );
}

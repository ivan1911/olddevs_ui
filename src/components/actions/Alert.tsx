"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import { TONE_TOKENS, type Tone, type Variant } from "../../lib/variants.js";

export interface AlertProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /**
   * Tone of the message: sets the color, the default icon and the role for screen readers.
   * Defaults to `accent`.
   *
   * `danger` gets `role="alert"`, the other tones get `role="status"`.
   */
  tone?: Tone;
  /**
   * Variant: `soft` — with a background tint, `outline` — border only. Defaults to `soft`.
   *
   * Only `soft` and `outline`, and that is a restriction of the type, not an oversight.
   *
   * `solid` at full width is a block that overrides the page content; `ghost` without a border
   * and without a background stops reading as a message at all. Both variants exist on the
   * button, where the size is different, and they do not suit a message either.
   */
  variant?: Extract<Variant, "soft" | "outline">;
  /** Message title: a bold line above the text. Optional: without it only the text is shown. */
  title?: ReactNode;
  /** Message text below the title. */
  children?: ReactNode;
  /** Icon on the left. Chosen by tone by default. */
  icon?: ReactNode;
  /** Close button. Not rendered at all without a handler. */
  onDismiss?: () => void;
  /** Action on the right — usually `Button size="sm"`. */
  action?: ReactNode;
  /** Accessible name of the close button. Taken from the kit's message catalog by default. */
  closeLabel?: string;
}

/** Default icon, by tone. A lookup table, not a guess based on where the component is called. */
const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: <InfoIcon size={16} />,
  accent: <InfoIcon size={16} />,
  success: <SuccessIcon size={16} />,
  warning: <WarningIcon size={16} />,
  danger: <ErrorIcon size={16} />,
};

/**
 * An inline message — as opposed to a toast, which pops up and goes away.
 *
 * When to use which: a toast reports an EVENT ("Saved"), while `Alert` describes a STATE
 * ("The channel is not connected, posts will not go out"). A state must not disappear on a timer,
 * and an event must not take up space on the screen forever.
 *
 * THE ROLE IS CHOSEN BY TONE, and this is not cosmetic. `danger` gets `role="alert"` — a screen
 * reader interrupts its current speech with it; the other tones get `role="status"`, which waits
 * for a pause. Mixing them up means either losing an error message or shouting about a
 * successful save.
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  {
    tone = "accent",
    variant = "soft",
    title,
    children,
    icon,
    onDismiss,
    action,
    closeLabel,
    className,
    ...rest
  },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[13px]",
        // The look is built from the tone's ATOMS, not through `variantClasses()`, and this is
        // not an optimization. That one also returns hover classes — a message is not a button,
        // there is nothing to hover over. Cancelling them on top is not possible:
        // `hover:bg-inherit` does not remove the background, it replaces it with the parent's,
        // and the message would flicker with the page background under the cursor.
        t.border,
        variant === "soft" ? cn(t.bg, t.softFg) : cn("bg-transparent", t.fg),
        className
      )}
      {...rest}
    >
      <span className="flex shrink-0 items-center pt-px">{icon ?? TONE_ICONS[tone]}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title != null && <div className="font-semibold">{title}</div>}
        {/*
          The message text is NOT dimmed with opacity. The tones are calibrated to exactly the 4.5
          threshold on their own background (`npm run contrast`), and any `opacity` on top silently
          drops the pair below it: `opacity-90` gave 3.89–4.08 in the light theme. The hierarchy
          between the title and the text rests on font weight, not on dimming.
        */}
        {children != null && <div>{children}</div>}
      </div>
      {action != null && <div className="shrink-0 pl-1">{action}</div>}
      {onDismiss != null && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel ?? messages.alert.close}
          className="hover:bg-bg-3 -mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-xs opacity-70 transition-colors hover:opacity-100"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
});

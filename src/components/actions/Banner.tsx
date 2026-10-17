"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CloseIcon, ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

export interface BannerProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  /**
   * Tone of the banner: sets the color, the default icon and the role for screen readers.
   * Defaults to `accent`.
   *
   * `danger` gets `role="alert"`, the other tones get `role="status"`.
   */
  tone?: Tone;
  /**
   * Banner title: a bold fragment at the start of the line. Optional: without it, only the text
   * remains on the line.
   */
  title?: ReactNode;
  /** Banner text after the title, on the same line. */
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

/** Default icon, by tone. The same lookup table as in `Alert`. */
const TONE_ICONS: Record<Tone, ReactNode> = {
  neutral: <InfoIcon size={16} />,
  accent: <InfoIcon size={16} />,
  success: <SuccessIcon size={16} />,
  warning: <WarningIcon size={16} />,
  danger: <ErrorIcon size={16} />,
};

/**
 * An APPLICATION-level message: service degradation, work on the server, an expired
 * subscription.
 *
 * A THREE-LINE BOUNDARY, worth keeping in mind:
 *
 *   `toast`  — an EVENT: "Saved". It pops up and goes away on a timer.
 *   `Alert`  — the STATE OF A PLACE: "this campaign has no channel". It lives inside the content,
 *              next to what it is about.
 *   `Banner` — the STATE OF THE APPLICATION: "posts are not going out, maintenance is running".
 *              It sits above the content, survives navigation, and belongs to no block of the page.
 *
 * Hence a separate component rather than an axis of `Alert` (ADR-0027): the difference is not in
 * the look but in the place and the lifetime. A message that could do both would carry parts
 * that do not work into the markup.
 *
 * THE ROLE IS CHOSEN BY TONE — by the same rule as in `Alert`: `danger` gets `role="alert"` and
 * interrupts screen reader speech, the other tones get `role="status"` and wait for a pause.
 * One rule for the kit, not two similar ones.
 *
 * FULL WIDTH AND NO ROUNDED CORNERS: a banner is a strip across the application, not a card
 * inside the page. Rounded corners would read as a block of content — that is, as `Alert`.
 *
 * NOT STICKY. The `--topbar-h` contract (ADR-0016) and its publication by the header (ADR-0019)
 * are not touched: the header stays at `top: 0`. The message's persistence rests on the banner
 * not disappearing from the markup, not on it always being in view.
 *
 * A STACK is a plain list of adjacent banners: each one is closed by its own button, and the
 * order is set by the consumer. The component has no queue of its own — it would be state, and
 * the kit keeps no state.
 */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone = "accent", title, children, icon, onDismiss, action, closeLabel, className, ...rest },
  ref
) {
  const messages = useMessages();
  const t = TONE_TOKENS[tone];

  return (
    <div
      ref={ref}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex w-full items-center gap-2.5 border-b px-4 py-2.5 text-[13px]",
        // The look is built from the tone's ATOMS, as in `Alert`, not through
        // `variantClasses()`: that one also returns hover classes, and there is nothing
        // to hover over on a message.
        t.border,
        t.bg,
        t.softFg,
        className
      )}
      {...rest}
    >
      <span className="flex shrink-0 items-center">{icon ?? TONE_ICONS[tone]}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {title != null && <span className="font-semibold">{title}</span>}
        {/*
          The text is NOT dimmed with opacity: the tones are calibrated to exactly the 4.5
          threshold on their own background (`npm run contrast`), and any `opacity` on top silently
          drops the pair below it. The hierarchy rests on font weight — the same lesson as in
          `Alert`.
        */}
        {children != null && <span className="min-w-0">{children}</span>}
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
      {onDismiss != null && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={closeLabel ?? messages.banner.close}
          className="hover:bg-bg-3 -mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-xs opacity-70 transition-colors hover:opacity-100"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
});

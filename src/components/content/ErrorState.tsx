"use client";

import type { ReactNode } from "react";
import { ErrorIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";
import {
  STATE_DESCRIPTION,
  STATE_ICON,
  STATE_LAYOUT,
  STATE_ROOT,
  STATE_TITLE,
} from "../../lib/state.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface ErrorStateProps {
  /**
   * Heading of the error state: a general phrase above the explanation.
   *
   * The default comes from the message catalog (`errorState.title`). In the Russian catalog
   * it reads "Loading error" (a gloss of the Russian phrase; all four front-end
   * places used exactly these words). Without a provider, it is the English string.
   */
  title?: string;
  /** What exactly failed. A general phrase on top, the specifics here. */
  description?: string;
  /**
   * A ready-made node (usually a `Button` labeled "Try again"), not a callback with a label,
   * as with `EmptyState`: the consumer knows what the action does.
   */
  action?: ReactNode;
  /**
   * A custom icon in place of the standard one. `null` removes it altogether, for example
   * when the block sits inside a container that is already marked as dangerous.
   */
  icon?: ReactNode | null;
  /** `sm` for use inside pickers and panels; `md` in place of page content. */
  size?: "sm" | "md";
  /** Classes for the root element. */
  className?: string;
}

const ICON_SIZE = { sm: 22, md: 28 } as const;

/**
 * A failure: the request did not succeed, so there is nothing to show.
 *
 * It differs from `EmptyState` in three things, and all three are not cosmetic:
 *
 * 1. **The `alert` role.** An empty list is a result; a failure is an event, and a screen
 *    reader must be told about it. Without a live region, a user who is not looking at the
 *    screen is left with silence instead of an answer: the request went out, nothing
 *    happened, and why is unknown. This was missing from each of the four hand-written
 *    copies in the front end.
 * 2. **The danger tone** on the icon and the title: `danger.fg`, that is `danger-strong`.
 *    The bare `--danger` does not fit here: the tone's base token is chosen so that it passes
 *    the contrast threshold on all four backgrounds, while the filled `--danger` is valid
 *    only under contrasting text.
 * 3. **An action is implied.** A failure is almost always retryable, so the `action` slot
 *    sits in a prominent place rather than as a rare addition.
 *
 * It is a separate component, not a `tone` axis on `EmptyState`: that one is designed around
 * the rule "an empty screen is not an event, it should not draw attention", which is exactly
 * the opposite requirement. One component with two mutually exclusive modes would cost more
 * than two honest ones. The geometry is shared and lives in `lib/state.ts`.
 */
export function ErrorState({
  title,
  description,
  action,
  icon,
  size = "md",
  className,
}: ErrorStateProps) {
  const messages = useMessages();
  const layout = STATE_LAYOUT[size];
  const tone = TONE_TOKENS.danger;
  // `undefined`: no icon was passed, so the standard one is used. `null`: the caller explicitly
  // opted out of it. The difference is visible only this way: `??` would merge both cases.
  const iconNode =
    icon === undefined ? <ErrorIcon size={ICON_SIZE[size]} strokeWidth={1.5} /> : icon;

  return (
    <div role="alert" className={cn(STATE_ROOT, layout.root, className)}>
      {iconNode ? (
        <span aria-hidden className={cn(tone.fg, STATE_ICON, layout.icon)}>
          {iconNode}
        </span>
      ) : null}
      <div className={cn(tone.fg, STATE_TITLE, layout.title)}>
        {title ?? messages.errorState.title}
      </div>
      {description ? (
        <div className={cn("text-fg-3", STATE_DESCRIPTION, layout.description)}>{description}</div>
      ) : null}
      {action ? <div className={layout.action}>{action}</div> : null}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/cn.js";
import {
  STATE_DESCRIPTION,
  STATE_ICON,
  STATE_LAYOUT,
  STATE_ROOT,
  STATE_TITLE,
} from "../../lib/state.js";

export interface EmptyStateProps {
  /** Icon above the title. */
  icon?: ReactNode;
  /** Title: what exactly is empty. */
  title: string;
  /** Explanation under the title: why it is empty or what can be done about it. */
  description?: string;
  /**
   * A ready-made node (usually a `Button`), not a callback with a label: what the action
   * does and how it looks is known to the consumer; the component only reserves the space.
   */
  action?: ReactNode;
  /** `sm` for use inside pickers and dropdowns; `md` for an empty page or section. */
  size?: "sm" | "md";
  /** Classes for the root element. */
  className?: string;
}

/**
 * An empty state: "No matches found", "Nothing here yet", "No results".
 *
 * Before this package, every place in the front end drew its own version: eight variants of
 * the same thing with different spacing and tones. The component is deliberately plain:
 * vertical centering, muted tones, no illustrations or animations. An empty screen is not an
 * event and is not supposed to attract attention.
 *
 * The geometry is shared with `ErrorState` and lives in `lib/state.ts`; what remains here is
 * the tone and the role, which are what tell these two states apart.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "md",
  className,
}: EmptyStateProps) {
  const layout = STATE_LAYOUT[size];
  return (
    <div className={cn(STATE_ROOT, layout.root, className)}>
      {icon ? (
        <span aria-hidden className={cn("text-fg-3", STATE_ICON, layout.icon)}>
          {icon}
        </span>
      ) : null}
      <div className={cn("text-fg-1", STATE_TITLE, layout.title)}>{title}</div>
      {description ? (
        <div className={cn("text-fg-3", STATE_DESCRIPTION, layout.description)}>{description}</div>
      ) : null}
      {action ? <div className={layout.action}>{action}</div> : null}
    </div>
  );
}

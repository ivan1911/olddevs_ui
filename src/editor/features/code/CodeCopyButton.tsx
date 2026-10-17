"use client";

import { useEffect, useRef, useState } from "react";
import { CopyButton, type CopyButtonProps } from "../../../components/actions/CopyButton.js";
import { Tooltip, TooltipProvider } from "../../../components/overlays/Tooltip.js";
import { useMessages } from "../../../i18n/useMessages.js";
import { cn } from "../../../lib/cn.js";

/** How long "Copied" stays: as long as the kit's default `CopyButton` keeps it. */
const RESET_MS = 2000;

export interface CodeCopyButtonProps extends Omit<
  CopyButtonProps,
  "value" | "children" | "onCopy" | "size" | "variant" | "resetDelay"
> {
  /** The block's text as a string: what goes into the clipboard (ADR-0039: the text is copied, not the DOM). */
  code: string;
}

/**
 * The "Copy" button in the header of a code Block: the kit's `CopyButton` with the tooltip
 * "Copy code" → "Copied".
 *
 * THE TOOLTIP DOES NOT REPLACE THE NAME. The button's name and the announcement of the result
 * belong to `CopyButton` ("Copy" → "Copied", a live region); the tooltip is only for sighted users and
 * says WHAT is copied. Its state comes from `onCopy`, not from the button's internals.
 *
 * ITS OWN `TooltipProvider`, as the Toolbar and the image panel have: the root kit component
 * leaves the provider to the consumer, while the Editor and the View without it would crash in
 * Radix. The tooltip wraps the button in a span, because `CopyButton` does not accept a ref.
 */
export function CodeCopyButton({ code, ...rest }: CodeCopyButtonProps) {
  const messages = useMessages();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  const content =
    state === "copied"
      ? messages.copyButton.copied
      : state === "failed"
        ? messages.copyButton.failed
        : messages.editor.codeCopy;

  return (
    <TooltipProvider>
      <Tooltip content={content}>
        <span className="inline-flex">
          <CopyButton
            {...rest}
            value={code}
            // The icon is 12 px, like the chevron of the language button next to it: the header is
            // a `text-xs` line of text, and the button's default icon looked larger than the label.
            // The 24 px hit area is kept by `xs`.
            className={cn("[&_svg]:size-3", rest.className)}
            size="xs"
            variant="ghost"
            resetDelay={RESET_MS}
            onCopy={(ok) => {
              setState(ok ? "copied" : "failed");
              if (timer.current != null) clearTimeout(timer.current);
              timer.current = setTimeout(() => setState("idle"), RESET_MS);
            }}
          />
        </span>
      </Tooltip>
    </TooltipProvider>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "../../icons.js";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { hasContent } from "../../lib/empty.js";
import { Button, type ButtonProps } from "./Button.js";
import { BUTTON_ICON_SIZE } from "../../lib/button.js";

export interface CopyButtonProps extends Omit<
  ButtonProps,
  // `onCopy` is overridden on purpose: `<button>` has its own, clipboard-related one, and our
  // same-named prop would conflict with it by type.
  "children" | "icon" | "onClick" | "value" | "onCopy"
> {
  /** What to copy. */
  value: string;
  /** Label next to the icon. Without it the button is icon-only. */
  children?: ReactNode;
  /** How long to keep the "copied" state, in ms. */
  resetDelay?: number;
  /** Report the outcome to the outside. Logs and metrics are the consumer's concern. */
  onCopy?: (ok: boolean) => void;
}

/**
 * "Copy" button: puts the value into the clipboard and gives the user a clear answer.
 *
 * THE RESULT IS ANNOUNCED, not only shown by swapping the icon. A checkmark instead of the icon
 * is a signal for the eyes; a screen reader user who presses the button would otherwise not know
 * whether it worked. So next to it sits a live region, mounted ALWAYS: when it is inserted
 * together with its text, it is announced unreliably — some screen readers manage to skip it.
 * The same trick as in `FileDropzone`.
 *
 * A CLIPBOARD FAILURE IS A LEGITIMATE OUTCOME, not an exception. `navigator.clipboard` is missing
 * in an insecure context (a page served over `http`), and writing may be blocked by permissions.
 * The button does not crash and does not pretend to have succeeded: it says the copy did not
 * work, and the value stays available for selecting by hand.
 *
 * The timer is reset on unmount: otherwise `setState` would fire on an unmounted component after
 * the popover in which the button stood was closed.
 */
export function CopyButton({
  value,
  children,
  resetDelay = 2000,
  onCopy,
  className,
  ...rest
}: CopyButtonProps) {
  const messages = useMessages();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(async () => {
    let ok = false;
    try {
      // `navigator.clipboard` may be missing entirely — in an insecure context it does not
      // exist, and calling `writeText` would fail on `undefined`.
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = false;
    }

    setState(ok ? "copied" : "failed");
    onCopy?.(ok);

    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), resetDelay);
  }, [value, onCopy, resetDelay]);

  const label =
    state === "copied"
      ? messages.copyButton.copied
      : state === "failed"
        ? messages.copyButton.failed
        : messages.copyButton.copy;

  const iconSize = BUTTON_ICON_SIZE[rest.size ?? "md"];

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Button
        {...rest}
        // The button's name CHANGES together with the state: "Copied" on a button that copied
        // nothing is a lie, and vice versa.
        aria-label={hasContent(children) ? undefined : label}
        icon={state === "copied" ? <CheckIcon size={iconSize} /> : <CopyIcon size={iconSize} />}
        iconOnly={!hasContent(children)}
        tone={state === "failed" ? "danger" : rest.tone}
        onClick={() => void copy()}
      >
        {children}
      </Button>

      {/* The region is mounted always; only its text is swapped. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === "idle" ? "" : label}
      </span>
    </span>
  );
}

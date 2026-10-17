"use client";

import { type ReactNode } from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from "../../icons.js";
import { TONE_TOKENS } from "../../lib/variants.js";

export interface ToasterProps {
  /** Corner or edge of the screen where toasts stack. Defaults to `bottom-right`. */
  position?: "top-right" | "top-center" | "bottom-right" | "bottom-center";
  /** How long a toast stays on screen, in ms. Defaults to 4000. */
  duration?: number;
  /** Theme. Needed by the showcase; in an application the colors come from tokens anyway. */
  theme?: "light" | "dark" | "system";
  /**
   * Name of the CSS variable with the height of the application's bottom bar. Toasts at the bottom
   * edge sit this much higher than the usual offset instead of going under the bar. Defaults to
   * `--bottombar-h`, which the `bottomBar` slot of `AppShell` publishes. If the variable is not
   * defined (there is no bar, or it is hidden on a wide screen), the offset is unchanged. Has no
   * effect on the top positions.
   */
  offsetVar?: string;
}

/** The default is shared with `AppShell` (`bottomBarHeightVar`). */
const DEFAULT_OFFSET_VAR = "--bottombar-h";

/**
 * The area in which toasts pop up. Placed once, next to the root.
 *
 * BUILT ON `sonner`, not written from scratch, and not on react-aria: it provides no toasts at
 * all. The stack, the queue, the swipe, pausing on hover, collapsing a group — sonner already has
 * all of this, and it is tested; our own implementation would be not a primitive but a second
 * library. It is the same logic by which portals are borrowed from Radix and the behavior of
 * fields from react-aria.
 *
 * The look is set by the package's tokens through `--normal-*`, which sonner substitutes into its
 * own internal classes. The sonner defaults are not disabled halfway: `unstyled` would take the
 * layout and animations with it, and along with them the point of taking the library.
 */
export function Toaster({
  position = "bottom-right",
  duration = 4000,
  theme,
  offsetVar = DEFAULT_OFFSET_VAR,
}: ToasterProps) {
  return (
    <SonnerToaster
      position={position}
      // sonner's default offset (24px, 16px on a narrow screen) is kept, and the height of the
      // bottom bar is added to it: a toast above `MobileTabBar` would cover the tabs. `calc` with
      // a fallback of `0px` does not change the look where there is no bar. The width at which
      // sonner switches to `mobileOffset` is its own (600px), while the bar hides at `md` — so the
      // range 600–768px needs both entries.
      offset={{ bottom: `calc(var(${offsetVar}, 0px) + 24px)` }}
      mobileOffset={{ bottom: `calc(var(${offsetVar}, 0px) + 16px)` }}
      duration={duration}
      theme={theme}
      // `--normal-*` are sonner's public variables: it paints the toast's background, text and
      // border with them. We hand over the package's tokens, and the toast follows the
      // application's theme by itself, with no switch inside the library.
      style={
        {
          // The background is semi-transparent and blurred. This is how the toast looked on the
          // frontend before the move, and this look moves into the package rather than being lost:
          // blur is already part of the system's vocabulary (the dialog background), while the
          // "glassiness" of the popup layer is a decision of the design system, not of a separate
          // screen.
          "--normal-bg": "color-mix(in srgb, var(--surface-elevated) 82%, transparent)",
          "--normal-text": "var(--fg-0)",
          "--normal-border": "var(--line-soft)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "rounded-lg border text-[13px] shadow-[var(--shadow-2)] backdrop-blur-[14px]",
          title: "font-semibold",
          description: "text-fg-2 text-[12px]",
          actionButton: TONE_TOKENS.accent.solid,
          cancelButton: TONE_TOKENS.neutral.solid,
        },
      }}
      icons={{
        success: <SuccessIcon size={16} className="text-success-strong" />,
        error: <ErrorIcon size={16} className="text-danger-strong" />,
        warning: <WarningIcon size={16} className="text-warning-strong" />,
        info: <InfoIcon size={16} className="text-accent-strong" />,
      }}
    />
  );
}

export interface ToastOptions {
  /** Second line — details. For an error, the server's text goes here. */
  description?: ReactNode;
  /** How long this toast stays on screen, in ms. Overrides the `duration` of the `Toaster` area. */
  duration?: number;
  /** Action button in the toast: label and press handler. */
  action?: { label: string; onClick: () => void };
}

/**
 * Toasts by the tones of the vocabulary.
 *
 * FOUR METHODS, NOT ARBITRARY JSX. sonner has both `toast.custom` and arbitrary content — they are
 * deliberately absent here: a toast that can do everything stops being part of the system, and in
 * half a year the application has five different toasts. The tone is the package's vocabulary, not
 * the styling of the call site.
 *
 * `neutral` is expressed as `info`: an event never has a tone of its own called "none".
 *
 * WHAT IS NOT INCLUDED HERE: parsing API errors. `extractErrorMessage` stays with the consumer —
 * the format of server responses is its knowledge, not the design system's. The call looks like
 * this:
 *
 *     toast.error("Could not save", { description: extractErrorMessage(err) })
 */
export const toast = {
  success: (message: ReactNode, options?: ToastOptions) => sonnerToast.success(message, options),
  error: (message: ReactNode, options?: ToastOptions) => sonnerToast.error(message, options),
  warning: (message: ReactNode, options?: ToastOptions) => sonnerToast.warning(message, options),
  info: (message: ReactNode, options?: ToastOptions) => sonnerToast.info(message, options),
  /**
   * A toast that follows a promise: waiting → success or error.
   *
   * The signature is OWN, not sonner's passed through, and this is forced: its type refers to an
   * internal, unexported type (`PromiseIExtendedResult`), and the compiler refuses to generate the
   * package's `.d.ts` — "cannot be named". The package must declare its contract anyway, so it is
   * written out here and at the same time narrowed to what is actually needed.
   *
   * The labels are set by the caller: only it knows what is being saved.
   */
  // The comma in `<T,>` is required: in a `.tsx` file a generic arrow is otherwise
  // indistinguishable from a JSX tag, and the parser stumbles.
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: ReactNode;
      success: ReactNode | ((data: T) => ReactNode);
      error: ReactNode | ((error: unknown) => ReactNode);
    }
  ): void => {
    sonnerToast.promise(promise, messages);
  },
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

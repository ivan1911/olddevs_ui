"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "../../lib/cn.js";
import { useOpenerFocus } from "../../hooks/useOpenerFocus.js";
import { hasOpenAriaOverlay, OVERLAY_LAYER } from "../../lib/overlay-layer.js";
import { useOverlayLayer } from "../../hooks/useOverlayLayer.js";
import { withoutToolbarAxis } from "../../lib/toolbar-axis.js";
import { ModalHeader } from "./ModalHeader.js";

/** The dialog's portal: the `Toolbar` axis the dialog was opened from does not pass into it. */
const Portal = withoutToolbarAxis(DialogPrimitive.Portal);

export interface DialogProps {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Close request: the close button, Escape and a click outside all call this. */
  onClose: () => void;
  /** Dialog title. It also becomes the dialog's accessible name. */
  title: ReactNode;
  /** A line under the title in the header: a slug, a date, a counter. */
  subtitle?: ReactNode;
  /**
   * The `id` of the node that serves as the dialog's description — the text the screen reader
   * reads right after the name.
   *
   * An identifier, not the text itself, and this comes from a defect. The first version accepted
   * a `ReactNode` and rendered it as a hidden copy: `ConfirmDialog` passed its `message` there and
   * rendered the same `message` as a visible paragraph — the text ended up in the document TWICE.
   * `message` is typed as `ReactNode`, so a link inside it created an invisible extra tab stop, and
   * a component with its own `id` created a duplicate identifier in the document.
   *
   * The description must point at the SAME node the eye sees. If you need text for speech only, put
   * it in `children` under `sr-only` and reference it here.
   *
   * For `role="alertdialog"` the description is required by APG: a confirmation that announces only
   * the name and the button forces the user to confirm blindly.
   */
  describedBy?: string;
  /** Icon to the left of the title. The consumer sets its color, because the consumer knows the dialog's tone. */
  icon?: ReactNode;
  /**
   * Submission is in progress: the dialog cannot be closed by the close button, by Escape or by a
   * click outside.
   *
   * One prop instead of three bans is deliberate: "the form is being submitted" is one state, not
   * three independent decisions, and splitting them would allow the dialog to end up in a state
   * where "Escape closes it, but there is no close button".
   */
  loading?: boolean;
  /** Vertical alignment: centered or from the top edge. */
  align?: "center" | "start";
  /** Classes for the dialog itself: width, corner radius, border. */
  className?: string;
  /** Classes for the scrim — for dialogs with special geometry or animation. */
  overlayClassName?: string;
  /** Scrim styles — for example, color and blur for a special dialog. */
  overlayStyle?: CSSProperties;
  /** Dynamic styles for the dialog itself. */
  contentStyle?: CSSProperties;
  /** Whether to render the standard header. Special dialogs keep their own. */
  header?: boolean;
  /** The dialog's layer. Some of the application's overlays sit above the regular ones. */
  zIndex?: string;
  /**
   * Use `alertdialog` for a dialog that interrupts the work and requires an answer: a delete
   * confirmation, a warning about unsaved changes. Regular dialogs with a form stay `dialog`.
   *
   * No separate primitive is added for this: `@radix-ui/react-alert-dialog` differs from a regular
   * dialog only in its role and in that it cannot be closed by a click outside — and we already
   * solve the second with the `loading` prop.
   */
  role?: "dialog" | "alertdialog";
  /**
   * Where to place focus when the dialog opens. By default, the first element that Tab reaches,
   * which is the close button in the header.
   *
   * The prop is needed because "where the user looks when the dialog opens" is the dialog's own
   * decision, not an implementation detail. It cannot be done with an effect on the caller's side:
   * Radix sets focus later than effects run, and silently overrides someone else's `focus()` call.
   * Verified in the showcase: focus kept moving to the close button.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** An extra Escape handler for dialogs with their own internal state. */
  onEscapeKeyDown?: DialogPrimitive.DialogContentProps["onEscapeKeyDown"];
  /** Accessible name of the close button. Defaults to "Close" from the message catalog. */
  closeLabel?: string;
  /** Dialog content below the header. */
  children?: ReactNode;
}

/**
 * A complete modal dialog: scrim, focus trap, header and background lock.
 *
 * WHY THIS IS A SEPARATE PRIMITIVE AND NOT A PROP OF `ModalOverlay`. The scrim honestly does one
 * thing — dims the background and catches a click outside — and it cannot take `role="dialog"`: a
 * dialog needs an accessible name, and only the caller knows the name. Because of this, every
 * dialog in the frontend assembled modality by hand, and it did so differently: of ten dialogs, one
 * had the role and `aria-modal`, and none had a focus trap — Tab led into the background under the
 * scrim, to buttons that were not visible.
 *
 * Here the name is known (it is `title`), so the dialog takes care of everything at once.
 *
 * BEHAVIOUR — `@radix-ui/react-dialog` from the package's `dependencies` (ADR-0072), on the same
 * logic as the tooltip and the popover (ADR-0004): the focus trap, focus return to the trigger,
 * `aria-modal`, the portal, Escape by layers and `inert` for the background are not things to write
 * again. A custom focus trap is not a primitive but a second library.
 *
 * THE BACKGROUND SCROLL IS LOCKED BY RADIX, not by `useScrollLock`. Inside it has
 * `react-remove-scroll`, and two locks on one `body` are two independent counters that cannot see
 * each other. That is why `Dialog` does not call the hook; `useScrollLock` remains for overlays
 * assembled by hand.
 *
 * NESTING WORKS ON ITS OWN. A confirmation dialog on top of an editing dialog is an ordinary case,
 * and Escape closes the top layer, not both: Radix manages the layer stack. It does not know about a
 * FOREIGN stack, though — the package's menus are built on react-aria, and the dialog tells their
 * layer apart separately (see `escapeBelongsToAriaLayer`). The earlier version had to catch Escape
 * in the capture phase and stop the event with `stopImmediatePropagation`.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  describedBy,
  icon,
  loading = false,
  align = "center",
  className,
  overlayClassName,
  overlayStyle,
  contentStyle,
  header = true,
  zIndex = OVERLAY_LAYER.modal,
  role = "dialog",
  initialFocusRef,
  onEscapeKeyDown,
  closeLabel,
  children,
}: DialogProps) {
  // While submitting there is nothing to close with — but the handlers are not removed, they are
  // suppressed: removing `onOpenChange` would leave Radix in a state where it thinks the dialog is
  // closed while we still render it.
  const block = loading ? (e: Event) => e.preventDefault() : undefined;

  /** The dialog itself — to tell "Escape inside" from "Escape in a foreign layer". */
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * An Escape addressed to a react-aria layer must not reach the dialog.
   *
   * Radix manages the stack of ITS OWN layers, and nested dialogs close one at a time. But the
   * package's menus and lists are built on react-aria, which keeps its own stack, and neither library
   * knows about the other's: one Escape with a menu open inside the dialog closed both the menu and
   * the dialog — that is, it took the form away with the unsaved changes. The "Menu inside Dialog"
   * case is where this was found.
   *
   * The sign was the position of the event target: "`data-rac` and outside the dialog". For menus it
   * worked, but for a `Combobox` INSIDE the dialog it did not: focus sits in the `Input`, which lies
   * inside the content, the list is in the portal, and the second condition was false. Escape closed
   * the dialog instead of the suggestion list.
   *
   * From wave 26 a foreign layer is detected by the presence of an open RAC overlay in the document,
   * not by the position of the target; this lives in `lib/overlay-layer.ts` together with the layer
   * stack — ADR-0041.
   */
  const escapeBelongsToAriaLayer = () => hasOpenAriaOverlay();

  /**
   * Who opened the dialog — to return focus to them on close.
   *
   * Radix returns focus to its own `Dialog.Trigger`, and there is none here: dialogs are opened from
   * application state, not from a wrapped button. Without this, focus after closing drifts to
   * `<body>` — verified both in the showcase and in the application — and keyboard users start
   * tabbing through the page from the beginning.
   *
   * It is remembered in `onOpenAutoFocus`: that fires BEFORE Radix moves focus inside the dialog, so
   * `activeElement` is still the one who opened it.
   */
  const { remember, restore } = useOpenerFocus(open, contentRef);
  // The layer joins the shared stack — ADR-0041 promises this for ALL modal layers of the kit,
  // not only for the scrim.
  useOverlayLayer(open, contentRef);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !loading) onClose();
      }}
    >
      <Portal>
        {/*
          The dialog sits INSIDE the scrim, not next to it. That way tall content scrolls together
          with the dimming instead of spilling off the screen: the scrim here is both the scroll
          container and the centering flex container.
        */}
        <DialogPrimitive.Overlay
          className={cn(
            "animate-fadein data-[state=closed]:animate-fadeout fixed inset-0 flex justify-center overflow-auto p-6",
            zIndex,
            align === "start" ? "items-start" : "items-center",
            overlayClassName
          )}
          style={{
            background: "var(--overlay-scrim)",
            backdropFilter: "blur(4px)",
            ...overlayStyle,
          }}
        >
          <DialogPrimitive.Content
            // The role is set after Radix's own spread, so it overrides its `dialog` —
            // a separate primitive for a single attribute is not needed.
            role={role}
            /*
              The description is a prop, not "there is none".

              A hard-coded `undefined` used to be here to suppress a Radix warning, and the consequence
              was broader than intended: no dialog of the kit could have a description at all. For
              `ConfirmDialog` this meant that the question itself — "Delete 12 items permanently?" —
              was not read to the screen reader: it announced the dialog's name and the button the
              focus had moved to. For the `alertdialog` role, APG requires a description outright.

              `undefined` remains the default: a dialog without a description must not point at
              nothing, and Radix's warning is then still suppressed.
            */
            aria-describedby={describedBy}
            onOpenAutoFocus={(e) => {
              remember();
              if (initialFocusRef) {
                e.preventDefault();
                initialFocusRef.current?.focus();
              }
            }}
            onCloseAutoFocus={restore}
            ref={contentRef}
            onEscapeKeyDown={(event) => {
              if (loading) {
                event.preventDefault();
                return;
              }
              if (escapeBelongsToAriaLayer()) {
                event.preventDefault();
                return;
              }
              onEscapeKeyDown?.(event);
            }}
            onPointerDownOutside={block}
            onInteractOutside={block}
            className={cn(
              "animate-sheetin data-[state=closed]:animate-sheetout border-line bg-bg-1 rounded-lg border outline-none",
              className
            )}
            style={{ boxShadow: "var(--modal-shadow)", ...contentStyle }}
          >
            {header ? (
              <ModalHeader
                // Radix renders the title: it also registers it as the dialog's name, so
                // `aria-labelledby` is set without our involvement.
                titleComponent={DialogPrimitive.Title}
                title={title}
                subtitle={subtitle}
                icon={icon}
                onClose={loading ? undefined : onClose}
                closeLabel={closeLabel}
              />
            ) : (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            )}
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </Portal>
    </DialogPrimitive.Root>
  );
}

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { TONE_TOKENS } from "../../lib/variants.js";
import { Button } from "../actions/Button.js";

export interface ContextualSaveBarProps {
  /** Whether there are unsaved changes. When `false`, the bar is not rendered. */
  visible: boolean;
  /**
   * How many fields have changed. Without it the bar says "You have unsaved changes"; with it,
   * the bar shows the number, which is much more useful in a long form where the changed field
   * has scrolled out of view.
   */
  count?: number;
  /** Custom wording in place of the default, for example the name of the entity being edited. */
  message?: ReactNode;
  /** Called when the save button is pressed. */
  onSave: () => void;
  /**
   * Called when the cancel button is pressed. Without a handler, the button is not rendered at all.
   */
  onCancel?: () => void;
  /** Saving is in progress: the save button shows progress and both buttons are disabled. */
  saving?: boolean;
  /** Save failure text. Shown in the bar and announced. */
  error?: ReactNode;
  /** Save button label. Defaults to the message catalog's string. */
  saveLabel?: ReactNode;
  /** Cancel button label. Defaults to the message catalog's string. */
  cancelLabel?: ReactNode;
  /**
   * Stick to the bottom edge of the browser window. Turn it off where the bar sits inside a dialog
   * (`Dialog`).
   */
  sticky?: boolean;
  /**
   * Name of the CSS variable with the height of the app's bottom bar. The bar sticks at this
   * height above the window edge. Defaults to `--bottombar-h`, which the `bottomBar` slot of
   * `AppShell` publishes. If the variable is absent (there is no bottom bar, or it is hidden on
   * wide screens), the offset is `0px` and the bar sticks to the very bottom.
   *
   * Works only together with `sticky`.
   */
  offsetVar?: string;
  /** Accessible name of the bar. */
  "aria-label"?: string;
  /** Extra classes on the bar. */
  className?: string;
}

/** Shared with `AppShell` (`bottomBarHeightVar`): this is the name of the `bottomBar` slot height. */
const DEFAULT_OFFSET_VAR = "--bottombar-h";

const PANEL =
  "border-line z-20 mt-4 flex flex-col gap-2 rounded-[14px] border p-[10px_14px] " +
  "backdrop-blur-md shadow-[var(--shadow-1)] sm:flex-row sm:items-center sm:gap-[14px]";

/**
 * Unsaved changes bar: "there is something to save", plus two buttons.
 *
 * THE BOUNDARY IN THREE LINES, the same as for `Banner`; keep it in mind:
 *
 *   `SelectionBar`      — about the SELECTION: "12 selected" and what to do with those items.
 *   `Banner`            — about the APP: "Work in progress", survives navigation.
 *   `ContextualSaveBar` — about the CURRENT FORM: edits are made but not submitted.
 *
 * Hence its lifetime: the bar appears with the first edit and disappears together with it,
 * on save or on cancel. It does not survive leaving the page, and it does not warn about
 * leaving: intercepting navigation belongs to the app, which knows its own router, not to the kit.
 *
 * THE COMPONENT DOES NOT KNOW THE FORM'S DATA. It takes a flag for whether there are changes,
 * the number of changes and two handlers. What counts as a change is the consumer's decision:
 * a comparison with the original value, a counter of field touches, or the form's response.
 *
 * ABOVE THE BOTTOM BAR, NOT BELOW IT. On a phone, the bottom edge of the window is taken by
 * `MobileTabBar` in the `bottomBar` slot. `AppShell` publishes its height (`--bottombar-h`), and
 * the bar sticks at that height above the edge, the same way `SelectionBar` measures its
 * stickiness from `--topbar-h`. There is no longer any need to nudge the bar with
 * `max-md:bottom-14` by eye: a hard-coded number drifts from the real height of the panel
 * (a screen notch, labels that wrap onto a second line).
 *
 * IT STICKS TO THE BOTTOM, NOT THE TOP, AND THAT IS A DECISION, NOT A TASTE. The top already
 * holds the app bar and `SelectionBar`, both measuring stickiness from `--topbar-h`
 * (ADR-0016, ADR-0019). A third sticky layer at the top would need a second height variable and
 * a revision of the contract: a cost out of all proportion to the task. The bottom is free, and
 * that is where admin panels have taught people to expect the bar.
 *
 * THE APPEARANCE IS ANNOUNCED, NOT ONLY SHOWN. The live region is mounted at all times and only
 * its content changes, the same technique as in `UploadQueue`. A live region inserted into the
 * tree together with its text is announced unreliably: some screen readers manage to see only
 * an empty node.
 *
 * `role="status"`, not `alert`, even when a save fails. The failure is accompanied by visible
 * text in the bar itself, and there is no reason to interrupt speech with it. `alert` here would
 * produce the same double reading that ADR-0026 warns about.
 *
 * THE COST OF THIS DECISION IS STATED OUT LOUD: the bar's text enters the tree twice, as a
 * visible line and as a hidden live region. In browse mode a screen reader reads it two times in
 * a row. The trade-off is deliberate: an unreliable announcement of the appearance is worse than
 * an extra repeat, and there is no other way to get both properties at once. The same question
 * is open for `MaskedInput` (ADR-0026) and will be settled by one pass with NVDA and VoiceOver,
 * for both components at once rather than separately.
 */
export function ContextualSaveBar({
  visible,
  count,
  message,
  onSave,
  onCancel,
  saving = false,
  error,
  saveLabel,
  cancelLabel,
  sticky = true,
  offsetVar = DEFAULT_OFFSET_VAR,
  "aria-label": ariaLabel,
  className,
}: ContextualSaveBarProps) {
  const messages = useMessages();
  const bar = messages.contextualSaveBar;

  const summary = message ?? (typeof count === "number" ? bar.changes({ count }) : bar.unsaved);
  const announcement = !visible ? "" : saving ? bar.saving : (error ?? summary);

  return (
    <>
      {visible ? (
        <div
          role="group"
          aria-label={ariaLabel ?? bar.label}
          // The offset is a CLASS that reads the variable, not an inline `bottom`: an inline
          // style beats any class, so a consumer's `bottom-*` (its own bottom panel outside
          // `AppShell`) would silently lose to it. The `cn` helper merges this class with the
          // consumer's, and the consumer's class wins.
          className={cn(PANEL, sticky && "sticky bottom-[var(--od-savebar-bottom)]", className)}
          style={
            {
              background: "var(--topbar-bg)",
              "--od-savebar-bottom": `var(${offsetVar}, 0px)`,
            } as CSSProperties
          }
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] font-semibold">{summary}</span>
            {error ? (
              <span className={cn("text-[12px]", TONE_TOKENS.danger.fg)}>{error}</span>
            ) : null}
          </div>

          <div className="hidden flex-1 sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            {onCancel ? (
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
                {cancelLabel ?? bar.cancel}
              </Button>
            ) : null}
            <Button size="sm" tone="accent" onClick={onSave} loading={saving}>
              {saveLabel ?? bar.save}
            </Button>
          </div>
        </div>
      ) : null}

      {/*
        Always mounted: see the file header. Empty while there is nothing to save, because
        "No changes" is not a message, it is noise.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}

"use client";

// What sits under the Document, inside the field frame: the Field notice and the Status
// bar (ADR-0058, section 7). Moved out of `RichTextEditor.tsx`.

import type { ReactNode } from "react";
import type { FieldNotice } from "../core/fieldNotice.js";

/**
 * Field notice. The live region is always mounted, even while it is empty: a screen
 * reader announces a change inside a region, not the region's appearance. That is why
 * it is here also for an Editor without images: a notice can come from any Tool.
 *
 * `status` goes into a region with no visual output: the loading progress is shown to
 * sighted users by a placeholder in the Document, and a live region inside
 * `contenteditable` is not read everywhere. `error` is a visible `role="alert"` line:
 * it asks for action, and the Document has not changed. Without the line it would look
 * as if nothing had happened.
 */
export function FieldNoticeView({
  notice,
  action,
}: {
  notice: FieldNotice | null;
  /** Action for the error, such as "Retry" for a failed Loader; rendered outside `role="alert"`. */
  action?: ReactNode;
}) {
  return (
    <>
      <div role="status" className="sr-only">
        {notice?.tone === "status" ? notice.text : ""}
      </div>
      {notice?.tone === "error" && (
        <div className="flex items-center gap-2 pb-1.5">
          <p role="alert" className="text-danger-strong text-xs">
            {notice.text}
          </p>
          {action}
        </div>
      )}
    </>
  );
}

/** Whether the screen has anything to show: empty React values render nothing. */
function hasContent(status: ReactNode): boolean {
  return status != null && status !== false && status !== true && status !== "";
}

/**
 * Status bar: the screen's own content at the start, the kit's counter at the end.
 *
 * The container has no `role` and no `aria-live`: a word count that updates on every
 * Edit must not be read aloud. A screen that wants a "Saved" note announced wraps
 * it in `role="status"` itself. The bar sits inside the field frame, so it stays visible
 * with `readOnly` and `disabled`. `counterId` stays on the counter, since the field's
 * `aria-describedby` points to it; the screen's own content is not part of that description.
 */
export function StatusLine({
  status,
  counter,
  counterId,
}: {
  status: ReactNode;
  counter: string | null;
  counterId: string;
}) {
  const own = hasContent(status);
  if (!own && counter == null) return null;
  return (
    // `text-fg-2`, not `text-fg-3`: the bar sits inside the field, on `bg-2`, and the third
    // step does not keep 4.5:1 contrast there, the same reason as for the counter in
    // `TextControl`. A screen colors its own content itself if it needs another tone.
    <div
      data-status-line
      className="text-fg-2 flex items-center gap-2 pb-1.5 text-[11px] tabular-nums"
    >
      {own && <div className="min-w-0 flex-1">{status}</div>}
      {counter != null && (
        <span id={counterId} className="ms-auto">
          {counter}
        </span>
      )}
    </div>
  );
}

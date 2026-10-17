"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { useMessages } from "../../i18n/useMessages.js";
import { cn } from "../../lib/cn.js";
import { PROGRESS_STATUS_TONE, type ProgressStatus } from "../../lib/progress-status.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";
import { Progress } from "../actions/Progress.js";
import { StatusBadge } from "../actions/StatusBadge.js";

/*
  Tone by state, with protection against unknown values.

  `??` only handles a missing key, and `state` comes from the backend: a string like `"constructor"`
  or `"toString"` would find an inherited function on a plain object, and the lookup would yield
  `undefined.fg`. So the key is checked for an own property — the same as for an explicit `tone`.
*/
function stateTone(state: ProgressStatus): Tone {
  return Object.hasOwn(PROGRESS_STATUS_TONE, state) ? PROGRESS_STATUS_TONE[state] : "neutral";
}

export interface UploadItem {
  /** Row key, unique within `items`. */
  id: string;
  /** File name or address. */
  name: ReactNode;
  /**
   * The size is already formatted.
   *
   * The kit does not format sizes: "2.4 MB" and "2,4 MB" differ not only in the decimal separator
   * but also in units, and choosing units (MB or MiB) is the application's decision, not the design
   * system's.
   */
  size?: ReactNode;
  /** Preview, usually an `Image`. Without it, no space is reserved. */
  preview?: ReactNode;
  /** Item state. The vocabulary is shared across the whole kit — `ProgressStatus`. */
  state: ProgressStatus;
  /**
   * `0`–`100`; `null` — progress is UNKNOWN; `undefined` — no bar at all.
   *
   * The difference between `null` and `0` is the same as in `Progress`: zero means "started, nothing
   * done yet", `null` means "the total amount of work is unknown".
   */
  progress?: number | null;
  /**
   * State label shown as a badge, for example "Duplicate" or "Processing". Without it, there is no
   * badge.
   */
  statusLabel?: ReactNode;
  /**
   * Tone of the row's badge and progress bar.
   *
   * The row tone is a DOMAIN status layered over the mechanical `state`: "Duplicate" on a
   * technically successful upload is `"warning"`, not green success.
   *
   * It colors the badge and the progress bar. If absent, the tone is derived from `state` by the shared
   * `ProgressStatus` table, as before. The text color of `meta` on a failed item does not react to
   * `tone`: it follows `state`.
   */
  tone?: Tone;
  /** Second line: error text, task ID. */
  meta?: ReactNode;
  /** Actions on the right, usually `Button size="sm"`: retry, cancel, remove. */
  actions?: ReactNode;
}

export interface UploadQueueProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Queue rows in display order. */
  items: UploadItem[];
  /** Accessible name of the list. */
  "aria-label"?: string;
  /** What to show when the queue is empty. If absent, nothing is rendered. */
  empty?: ReactNode;
}

/**
 * Upload manager: what has already been sent, what is in progress, and what has failed.
 *
 * THE BOUNDARY WITH `FileDropzone`: the zone is the CHOICE of a file, the queue is its FATE. They
 * are often confused because they sit side by side on screen; but the choice ends the moment the
 * files are received, and the queue begins only from that point.
 *
 * THERE IS NO TRANSPORT HERE. Sending, retrying, cancelling and polling tasks on the server is the
 * consumer's knowledge: response formats, addresses and retry rules belong to the application
 * (ADR-0027). The kit provides the item shape, progress, states and the summary announcement; it
 * does not store the queue — items and handlers come in through props. Precedent: ownership of
 * table state (ADR-0023).
 *
 * THE SUMMARY IS ANNOUNCED IN A LIVE REGION, and this is not decoration. A partial success — "nine
 * of twelve, one failed" — is otherwise visible only to someone scanning the list by eye; a screen
 * reader user who has sent a dozen files does not learn that the single file has failed at all. The
 * region is mounted ALWAYS, and only its text is swapped: when it is inserted together with the
 * message, it is announced unreliably — some screen readers manage to skip it. The same approach as
 * in `FileDropzone`.
 *
 * STATE IS MECHANICS, LABEL AND TONE ARE DOMAIN. The four states describe the fate of the work;
 * "Duplicate" and "Under review" arrive as a label (`statusLabel`), and their color, if it must
 * differ from the state's color, is `tone`. `StatusBadge` follows the same rule: it was moved into the kit
 * from the app, leaving the dictionary of eleven domain statuses behind.
 */
export const UploadQueue = forwardRef<HTMLDivElement, UploadQueueProps>(function UploadQueue(
  { items, empty, className, "aria-label": ariaLabel, ...rest },
  ref
) {
  const messages = useMessages();

  const done = items.filter((i) => i.state === "success").length;
  const failed = items.filter((i) => i.state === "failed").length;

  /*
    The SETTLED total is announced, not every intermediate transition.

    The region text is `summary({done, total, failed})`, and it changed on every file transition to
    `success`/`failed`. Sending twelve files produced twelve messages in a row — "1 of 12 uploaded",
    "2 of 12 uploaded", … A `polite` queue does not collapse them, so a screen reader user heard a
    minute of continuous speech instead of one result message. The doc comment above justified
    announcing the TOTAL, but what got announced was each step.
  */
  const pending = items.some((i) => i.state === "pending" || i.state === "running");
  const settled =
    items.length > 0 && !pending
      ? messages.uploadQueue.summary({ done, total: items.length, failed })
      : "";

  return (
    <div ref={ref} className={cn("flex flex-col gap-2", className)} {...rest}>
      {items.length === 0 ? (
        empty
      ) : (
        /*
          A real list, not a set of `div`s. A screen reader must announce that this is a queue and
          how many items it has; a set of cards announces neither.
        */
        <ul aria-label={ariaLabel ?? messages.uploadQueue.label} className="flex flex-col gap-2">
          {items.map((item) => {
            /*
              Row tone: an explicit `tone`, otherwise from `state`, otherwise neutral.

              An explicit tone is checked against the dictionary: a consumer in JS builds it from its
              own status table, and an unknown value would give `undefined.fg` inside the badge, that
              is, crash the whole screen. Such a tone is treated as unset — like an unknown `state`.
            */
            const tone: Tone =
              item.tone !== undefined && Object.hasOwn(TONE_TOKENS, item.tone)
                ? item.tone
                : stateTone(item.state);
            return (
              <li
                key={item.id}
                className="bg-bg-2 border-line-soft flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                {item.preview != null && (
                  <div className="bg-bg-3 border-line-soft size-12 shrink-0 overflow-hidden rounded-md border">
                    {item.preview}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{item.name}</span>
                    {item.size != null && (
                      <span className="text-fg-2 shrink-0 text-[11px] tabular-nums">
                        {item.size}
                      </span>
                    )}
                  </div>

                  {item.progress !== undefined && (
                    <div className="mt-1.5">
                      {/*
                        The bar's name is built from the file name, rather than a generic
                        "Uploading": in a queue of a dozen rows, identical names don't say which
                        file is meant. A string does not always fit here — `name` is a `ReactNode` —
                        so the text is taken only when it is text.
                      */}
                      {/*
                        The bar follows `tone`, not `state`: it sits on the same row as the badge,
                        and a green bar next to a yellow "Duplicate" would say two different things
                        about the same item. The bar shows the mechanics (running, not started,
                        unknown) by itself — through its shape and `aria-valuenow`, not through color.
                      */}
                      <Progress
                        value={item.progress}
                        tone={tone}
                        size="sm"
                        label={
                          typeof item.name === "string"
                            ? messages.uploadQueue.itemProgress({ name: item.name })
                            : messages.uploadQueue.progress
                        }
                      />
                    </div>
                  )}

                  {item.meta != null && (
                    <div
                      className={cn(
                        "mt-0.5 text-[11px]",
                        // The failure color comes from the tone dictionary: a test checks it there.
                        item.state === "failed" ? TONE_TOKENS.danger.fg : "text-fg-2"
                      )}
                    >
                      {item.meta}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.statusLabel != null && (
                    <StatusBadge tone={tone}>{item.statusLabel}</StatusBadge>
                  )}
                  {item.actions}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/*
        The announcement region is always mounted; only its content changes. `role="status"`, not
        `alert`: the queue is the progress of work, not a failure, and there is no reason to
        interrupt current speech with it, even when a file has failed.

        An empty queue produces no summary: "0 of 0" is not a message.
      */}
      <div role="status" aria-live="polite" className="sr-only">
        {settled}
      </div>
    </div>
  );
});

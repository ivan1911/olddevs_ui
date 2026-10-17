import type { Tone } from "./variants.js";

/**
 * Progress state: not started, running, finished successfully, finished with a failure.
 *
 * One vocabulary for the whole kit. This is the result of the breaking change in 3.0.0.
 * Before it there were two: `TimelineStatus` with `success`/`failed` and `UploadState`
 * with `done`/`error`. It was one and the same concept under two names, with two
 * line-by-line identical tone tables. The debt was found by the 2.5.0 review, but it
 * could not be fixed with a patch: both types were part of the public API (ADR-0031).
 *
 * WHY `success` AND `failed` SURVIVED. They describe the OUTCOME and are symmetric to
 * each other. `done` and `error` are asymmetric: the first is about completion, the
 * second is about an event, and the pair reads as if "finished with an error" were a
 * possible state too. For four mutually exclusive values, that is a defect.
 *
 * THE NAME IS NEUTRAL, not the name of one of the consumers: `TimelineStatus` would
 * be misleading for an upload queue, because it has no timeline.
 *
 * THE STATE IS MECHANICS, NOT DOMAIN. "Duplicate", "under review", "limit exceeded"
 * are labels of the consumer (`statusLabel`), not new values. The precedent is
 * `StatusBadge`: it came from the frontend and left behind a vocabulary of eleven
 * domain statuses with Russian labels.
 */
export type ProgressStatus = "pending" | "running" | "success" | "failed";

/**
 * Tone by state.
 *
 * `pending` is deliberately neutral and muted: work that has not started yet is not an event.
 *
 * It is always looked up with the `?? "neutral"` fallback. The consumer of the package is an app in
 * JS, the compiler does not check its data, and the states come from the backend. A fifth kind
 * of status must not crash a screen. Without the fallback, `TONE_TOKENS[…]` gives
 * `undefined.dotBg`, that is, the whole activity screen crashes.
 */
export const PROGRESS_STATUS_TONE: Record<ProgressStatus, Tone> = {
  pending: "neutral",
  running: "accent",
  success: "success",
  failed: "danger",
};

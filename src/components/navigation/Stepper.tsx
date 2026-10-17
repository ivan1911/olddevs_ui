"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "../../icons.js";
import { cn } from "../../lib/cn.js";
import { useMessages } from "../../i18n/useMessages.js";

export interface Step {
  /** Stable step identifier; the list key. */
  id: string;
  /** Step label. */
  label: string;
  /** Short note under the label. */
  hint?: ReactNode;
}

export interface StepperProps {
  /** Wizard steps, in order. */
  steps: Step[];
  /** Index of the current step, counted from zero. */
  current: number;
  /**
   * Called on a click on a completed step, with that step's index.
   *
   * If not set, the steps are not clickable at all, and that is the default. You can go back
   * **only to a completed** step: a future step needs data that does not exist yet, and letting
   * the user into it would show a form that could neither be submitted nor explain what it lacks.
   *
   * A wizard that must not go back at all (payment, an irreversible import) simply does not pass
   * this callback.
   */
  onStepClick?: (index: number) => void;
  /** Direction of the row: `horizontal` puts the steps in a line (default), `vertical` in a column. */
  orientation?: "horizontal" | "vertical";
  /** Extra classes on the `nav`. */
  className?: string;
  /** Accessible name of the navigation. Defaults to the message catalog value. */
  "aria-label"?: string;
}

/**
 * Wizard steps: where the user is now and how many remain.
 *
 * Built by hand: react-aria has no such component. Of the behavior here, only the click-to-navigate
 * belongs to the caller, and it belongs to the caller entirely.
 *
 * The markup is an ordered list inside `nav`: the steps go in order, and the screen reader must
 * announce both the order and the total count. The current step is marked with
 * `aria-current="step"`.
 */
export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = "horizontal",
  className,
  "aria-label": ariaLabel,
}: StepperProps) {
  const messages = useMessages();

  return (
    <nav aria-label={ariaLabel ?? messages.stepper.label} className={cn("min-w-0", className)}>
      <ol
        className={cn(
          "flex gap-2",
          orientation === "horizontal" ? "flex-row items-start" : "flex-col"
        )}
      >
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = onStepClick != null && done;

          const body = (
            <>
              <span
                aria-hidden
                className={cn(
                  "text-caption flex size-6 shrink-0 items-center justify-center rounded-full border font-semibold",
                  done && "border-accent-strong bg-accent-soft text-accent-strong",
                  // `text-text-on-accent`, not `text-on-accent`: the second class does not exist
                  // at all, so the number of the active step was painted with nothing on top of
                  // the accent fill. The class-coverage matrix caught it, which is exactly why it
                  // was set up.
                  active && "border-accent-strong bg-accent text-text-on-accent",
                  !done && !active && "border-line text-fg-3"
                )}
              >
                {done ? <CheckIcon size={12} /> : index + 1}
              </span>
              {/*
                The step state is TEXT, not only the circle.

                The circle with a number or a check mark is marked `aria-hidden`, and nothing else
                expresses "completed / current / upcoming": the `li` has only `aria-current` on the
                active item. A screen reader read a wizard of five identical items, and it
                announced no difference between the ones already filled in, the current one, and
                the ones still ahead.
              */}
              {/*
                The current step does not get a row of its own: `aria-current="step"` on the `li`
                announces it. A second row gave "current step, current step, Payment", so the state
                was read twice.
              */}
              {active ? null : (
                <span className="sr-only">
                  {messages.stepper.state({ state: done ? "done" : "upcoming" })}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    "truncate text-sm",
                    active ? "text-fg-0 font-semibold" : done ? "text-fg-1" : "text-fg-2"
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? <span className="text-fg-2 text-caption">{step.hint}</span> : null}
              </span>
            </>
          );

          return (
            <li
              key={step.id}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-2",
                orientation === "vertical" && "flex-none"
              )}
              // The current step is announced as a step, not as a page: `aria-current` tells these
              // values apart, and "step" is exactly this case.
              aria-current={active ? "step" : undefined}
            >
              {clickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick(index)}
                  className="focus-visible:outline-accent-strong flex min-w-0 cursor-pointer items-start gap-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {body}
                </button>
              ) : (
                <span className="flex min-w-0 items-start gap-2">{body}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "./components/actions/Button.js";

const meta = {
  title: "Foundations/Motion",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/*
 * The scale classes are listed here in full, on purpose.
 *
 * Tailwind generates a utility only when it finds its name in the source. A step
 * that no component uses today (`duration-slow`, the top of the scale) would
 * otherwise never reach the built CSS, and there would be no way to check it in
 * the browser. The showcase is the right place to show the whole scale.
 */
const STEPS = [
  { name: "duration-fast", value: "100ms", role: "hover, press, chevron, checkbox" },
  { name: "duration-base", value: "150ms", role: "tooltip, popover, menu — and the default" },
  { name: "duration-moderate", value: "250ms", role: "dialog, drawer, scrim, disclosure" },
  { name: "duration-slow", value: "400ms", role: "large travel across the screen" },
] as const;

const CURVES = [
  { name: "ease-standard", role: "movement within the screen" },
  { name: "ease-enter", role: "enter: decelerate into place" },
  { name: "ease-exit", role: "exit: accelerate away" },
] as const;

const TRACK = "border-line-soft bg-bg-2 relative h-8 flex-1 overflow-hidden rounded-lg border";
const MARKER = "bg-accent absolute top-1 bottom-1 left-1 w-6 rounded-md transition-[translate]";

/**
 * The duration scale: four steps, named by role rather than by value. Every
 * marker below starts at the same moment, so the steps are compared against
 * each other rather than against a memory of the previous click.
 *
 * The scale is closed. A fifth step is an architectural decision, not a line of
 * CSS — the same rule that governs the reduced-motion exception list.
 */
export const Durations: Story = {
  render: () => {
    const [moved, setMoved] = useState(false);
    return (
      <div className="flex max-w-[640px] flex-col gap-4">
        <Button onClick={() => setMoved((on) => !on)}>Move</Button>
        {STEPS.map((step) => (
          <div key={step.name} className="flex items-center gap-3">
            <div className="w-[152px] shrink-0">
              <div className="text-fg-1 font-mono text-[13px]">{step.name}</div>
              <div className="text-fg-3 text-caption">
                {step.value} · {step.role}
              </div>
            </div>
            <div className={TRACK}>
              <div
                className={`${MARKER} ${step.name}`}
                style={{ translate: moved ? "calc(100% * 14)" : "0" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

/**
 * The easing scale: three curves, named by the job they do. Enter decelerates
 * into place, exit accelerates away, standard moves within the screen.
 *
 * `enter` and `exit` are numerically the same as Tailwind's own `ease-out` and
 * `ease-in`. They are declared anyway: the name has to carry the role, and an
 * overlay entering is not the same statement as a curve easing out.
 */
export const Easings: Story = {
  render: () => {
    const [moved, setMoved] = useState(false);
    return (
      <div className="flex max-w-[640px] flex-col gap-4">
        <Button onClick={() => setMoved((on) => !on)}>Move</Button>
        {CURVES.map((curve) => (
          <div key={curve.name} className="flex items-center gap-3">
            <div className="w-[152px] shrink-0">
              <div className="text-fg-1 font-mono text-[13px]">{curve.name}</div>
              <div className="text-fg-3 text-caption">{curve.role}</div>
            </div>
            <div className={TRACK}>
              <div
                className={`${MARKER} duration-slow ${curve.name}`}
                style={{ translate: moved ? "calc(100% * 14)" : "0" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  },
};

/**
 * A transition with no duration class at all. It takes 150ms from the scale,
 * because the kit points Tailwind's own transition defaults at `duration-base`
 * and `ease-standard`.
 *
 * This is the half of the scale that is easy to miss: without it, every plain
 * `transition-colors` in the kit would keep running Tailwind's hardcoded 150ms
 * — a number that matches the step by coincidence rather than by reference, and
 * one that a consumer retuning the tempo could not move.
 */
export const DefaultTempo: Story = {
  render: () => (
    <div className="flex max-w-[640px] flex-col gap-2">
      <button
        type="button"
        className="border-line-soft bg-bg-2 text-fg-1 hover:bg-bg-3 hover:border-line w-fit cursor-pointer rounded-lg border px-4 py-2 text-[13px] transition-colors"
      >
        Hover me — 150ms, no duration class
      </button>
      <p className="text-fg-3 text-caption">
        The markup says <code className="font-mono">transition-colors</code> and nothing else.
      </p>
    </div>
  ),
};

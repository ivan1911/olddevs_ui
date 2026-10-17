import type { Meta, StoryObj } from "@storybook/react-vite";
import { LABEL_BG_CLASS, LABEL_HUES, LABEL_TEXT_CLASS } from "./lib/variants.js";

const meta = {
  title: "Foundations/Label colours",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/**
 * A closed set of hues for what the person colours themselves: a project, a
 * label, a category. These are NOT tones. A tone carries meaning — `danger`
 * means "this action destroys something" — while a label means whatever the
 * person put into it. A dot coloured `danger` next to a project would read as
 * an error, and the tone would stop meaning what it means.
 *
 * The set does not depend on the accent or the brand overlay: switching the
 * accent must not repaint every project the person has.
 *
 * Names go by hue, not by purpose. The name travels into the consumer's
 * database as the colour key and outlives value changes; `label-1` tells
 * nobody anything six months later.
 */
export const Swatches: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {LABEL_HUES.map((hue) => (
          <div key={hue} className="flex w-[104px] flex-col gap-1.5">
            {/*
              Exactly 10 pixels: the request asked for the hues to be told apart at the
              size of a label, not on a swatch that fills half the screen. A large square
              would make even the shades that blend into a dot look different.
            */}
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${LABEL_BG_CLASS[hue]}`} />
              <span className="text-fg-1 text-[13px]">{hue}</span>
            </div>
            <div className={`h-6 rounded-md ${LABEL_BG_CLASS[hue]}`} />
            <span className={`text-[11px] ${LABEL_TEXT_CLASS[hue]}`}>Aa caption</span>
          </div>
        ))}
      </div>
      <p className="text-fg-3 max-w-[680px] text-[11px]">
        Three rows, three roles of one token: a dot the size of a real label, a fill strip, and a
        caption in the same hue NEXT TO the label. Text inside the fill is not intended — eight hues
        that stay readable under text across all three themes would cost twice the set, and a
        caption beside the label solves the same problem.
      </p>
    </div>
  ),
};

/**
 * The same set on a row, the way a consumer actually uses it: a dot next to a
 * project name. Colour is never the only carrier — the name is always next to
 * it.
 */
export const InAList: Story = {
  render: () => (
    <ul className="flex w-[260px] list-none flex-col gap-0.5 p-0">
      {LABEL_HUES.map((hue, index) => (
        <li key={hue} className="hover:bg-bg-2 flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className={`size-2.5 shrink-0 rounded-full ${LABEL_BG_CLASS[hue]}`} />
          <span className="text-fg-0 text-[13px]">Project {index + 1}</span>
        </li>
      ))}
    </ul>
  ),
};

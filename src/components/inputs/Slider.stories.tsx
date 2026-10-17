import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RangeSlider, Slider, type SliderProps } from "./Slider.js";

const meta = {
  title: "Inputs/Slider",
  component: Slider,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<SliderProps>;

export default meta;
type Story = StoryObj<SliderProps>;

export const Playground: Story = {
  render: function Render() {
    const [value, setValue] = useState(40);
    return (
      <div className="w-[360px]">
        <Slider label="Preview quality" value={value} onChange={setValue} />
      </div>
    );
  },
};

export const WithoutValue: Story = {
  render: () => (
    <div className="w-[360px]">
      <Slider label="Opacity" defaultValue={70} valuePosition="none" />
    </div>
  ),
};

export const WithFormat: Story = {
  render: () => (
    <div className="w-[360px]">
      <Slider
        label="Photo width"
        defaultValue={1080}
        minValue={480}
        maxValue={2160}
        step={120}
        formatValue={(v) => `${v} px`}
      />
    </div>
  ),
};

/** Range: the ends cannot come closer together than `minGap`. */
export const Range: Story = {
  render: function Render() {
    const [range, setRange] = useState([300, 900]);
    return (
      <div className="flex w-[360px] flex-col gap-6">
        <RangeSlider
          label="File size"
          value={range}
          onChange={(v) => setRange(v as number[])}
          minValue={0}
          maxValue={1200}
          step={50}
          minGap={100}
          formatValue={(v) => `${v} KB`}
        />
      </div>
    );
  },
};

/**
 * The mouse wheel and the trackpad move the value by one step. On a range, the end nearest
 * to the cursor moves; at the edge of the track the page scrolls as usual.
 */
export const Wheel: Story = {
  render: () => (
    <div className="flex w-[360px] flex-col gap-6">
      <Slider label="Volume" defaultValue={40} step={5} formatValue={(v) => `${v}%`} />
      <RangeSlider
        label="Price"
        defaultValue={[200, 700]}
        minValue={0}
        maxValue={1000}
        step={50}
        minGap={100}
        formatValue={(v) => `${v} ₽`}
      />
    </div>
  ),
};

/** Disabled state: the slider is dimmed as a whole, and it cannot be dragged or focused. */
export const Disabled: Story = {
  render: () => (
    <div className="flex items-end gap-10">
      <div className="flex w-[280px] flex-col gap-6">
        <Slider label="Opacity" defaultValue={70} formatValue={(v) => `${v}%`} isDisabled />
        <RangeSlider
          label="Price"
          defaultValue={[200, 700]}
          minValue={0}
          maxValue={1000}
          isDisabled
        />
      </div>
      <Slider
        label="Level"
        orientation="vertical"
        defaultValue={65}
        formatValue={(v) => `${v}%`}
        isDisabled
      />
    </div>
  ),
};

/**
 * Vertical slider: the fill grows from the bottom edge, and the up and down arrows are
 * the primary ones. The default height is `h-48`; it is changed through `className`.
 */
export const Vertical: Story = {
  render: function Render() {
    const [level, setLevel] = useState(65);
    return (
      <div className="flex items-end gap-10">
        <Slider
          label="Level"
          orientation="vertical"
          value={level}
          onChange={setLevel}
          formatValue={(v) => `${v}%`}
        />
        <Slider
          label="Brightness"
          orientation="vertical"
          defaultValue={30}
          className="h-64"
          formatValue={(v) => `${v}%`}
        />
      </div>
    );
  },
};

/**
 * All variants side by side: both orientations with a label and without a value
 * (`valuePosition="none"`), and a range. This overview story is also the one the snapshot
 * gallery uses (the capture script picks `Matrix` first).
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex items-end gap-10">
      <div className="flex w-[280px] flex-col gap-6">
        <Slider label="Opacity" defaultValue={70} formatValue={(v) => `${v}%`} />
        <Slider aria-label="Opacity" defaultValue={40} valuePosition="none" />
        <RangeSlider label="Price" defaultValue={[200, 700]} minValue={0} maxValue={1000} />
      </div>
      <Slider label="Level" orientation="vertical" defaultValue={65} formatValue={(v) => `${v}%`} />
      <Slider aria-label="Level" orientation="vertical" defaultValue={30} valuePosition="none" />
    </div>
  ),
};

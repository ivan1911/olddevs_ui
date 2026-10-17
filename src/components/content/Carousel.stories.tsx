import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Carousel, type CarouselProps } from "./Carousel.js";

const meta = {
  title: "Content/Carousel",
  component: Carousel,
  parameters: { layout: "padded" },
} satisfies Meta<CarouselProps>;

export default meta;
type Story = StoryObj<CarouselProps>;

/** Placeholder slide: the number is visible, the slide edge is visible, nothing domain-specific. */
function Tile({ n }: { n: number }) {
  return (
    <div className="p-1.5">
      <div className="border-line-soft bg-bg-2 text-fg-1 flex h-40 items-center justify-center rounded-lg border text-lg">
        Slide {n}
      </div>
    </div>
  );
}

const tiles = (count: number) =>
  Array.from({ length: count }, (_, i) => <Tile key={i} n={i + 1} />);

/**
 * One slide in the frame. The strip is paged with the buttons, the wheel, a trackpad, a swipe,
 * and the keyboard arrows; the slide snaps into place after a gesture. At the edges the buttons
 * are disabled.
 */
export const Playground: Story = {
  args: { "aria-label": "Featured" },
  render: (args: CarouselProps) => (
    <div className="max-w-xl" data-testid="stage">
      <Carousel {...args}>{tiles(5)}</Carousel>
    </div>
  ),
};

/**
 * Several slides in the frame: a number or an object per the kit's breakpoints. Here it is one
 * on a phone, two from `sm`, and four from `lg`. The strip does not move past its end: with
 * three in the frame and five slides, the last index is two.
 */
export const SlidesPerView: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Carousel
        aria-label="Responsive"
        slidesPerView={{ base: 1, sm: 2, lg: 4 }}
        data-testid="responsive"
      >
        {tiles(9)}
      </Carousel>
      <Carousel aria-label="Three at a time" slidesPerView={3} data-testid="three">
        {tiles(5)}
      </Carousel>
    </div>
  ),
};

/**
 * Controlled mode: `index` is the leftmost visible slide. The buttons outside and a finger drag
 * move the same index. Exactly one `onIndexChange` call arrives after the strip stops, not one
 * per frame.
 */
export const Controlled: Story = {
  render: () => {
    const [index, setIndex] = useState(2);
    return (
      <div className="flex max-w-xl flex-col gap-3" data-testid="stage">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setIndex(0)}>
            First
          </Button>
          <Button size="sm" onClick={() => setIndex(4)}>
            Last
          </Button>
          <output className="text-fg-2 text-caption" data-testid="index">
            index: {index}
          </output>
        </div>
        <Carousel aria-label="Controlled" index={index} onIndexChange={setIndex}>
          {tiles(5)}
        </Carousel>
      </div>
    );
  },
};

/** Uncontrolled mode: `defaultIndex` opens the strip on the needed slide without animation. */
export const DefaultIndex: Story = {
  render: () => (
    <div className="max-w-xl">
      <Carousel aria-label="Starts on the third" defaultIndex={2}>
        {tiles(5)}
      </Carousel>
    </div>
  ),
};

/** Everything fits in the frame: there is nowhere to go, and both buttons are disabled. */
export const Fits: Story = {
  render: () => (
    <div className="max-w-xl">
      <Carousel aria-label="Two of two" slidesPerView={2}>
        {tiles(2)}
      </Carousel>
    </div>
  ),
};

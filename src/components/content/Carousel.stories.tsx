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

/** Слайд-заглушка: число видно, граница слайда видна, ничего доменного. */
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
 * Один слайд в кадре. Листают кнопки, колесо, тачпад, свайп и стрелки
 * клавиатуры на ленте; слайд после жеста встаёт ровно. На краях кнопки
 * выключаются.
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
 * Несколько слайдов в кадре: число или объект по брейкпойнтам кита. Здесь —
 * один на телефоне, два с `sm`, четыре с `lg`. Лента не едет дальше своего
 * конца: при трёх в кадре и пяти слайдах последний индекс — второй.
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
 * Управляемый режим: `index` — левый видимый слайд. Кнопки снаружи и
 * прокрутка пальцем двигают один и тот же индекс; ровно один вызов
 * `onIndexChange` приходит после остановки ленты, а не на каждый кадр.
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

/** Неуправляемый режим: `defaultIndex` открывает ленту на нужном слайде без анимации. */
export const DefaultIndex: Story = {
  render: () => (
    <div className="max-w-xl">
      <Carousel aria-label="Starts on the third" defaultIndex={2}>
        {tiles(5)}
      </Carousel>
    </div>
  ),
};

/** Всё помещается в кадр: ехать некуда, обе кнопки выключены. */
export const Fits: Story = {
  render: () => (
    <div className="max-w-xl">
      <Carousel aria-label="Two of two" slidesPerView={2}>
        {tiles(2)}
      </Carousel>
    </div>
  ),
};

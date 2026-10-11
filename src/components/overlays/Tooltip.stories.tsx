import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { ModalOverlay } from "./ModalOverlay.js";
import { Tooltip, TooltipProvider } from "./Tooltip.js";

const meta = {
  title: "Overlays/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: { content: "Notifications" },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: <Button variant="soft">Hover here</Button> },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="soft">Hover here</Button>
    </Tooltip>
  ),
};

/**
 * Матрица сторон. Тултип живёт в портале и появляется по наведению, поэтому
 * на снимке его не видно — матрица показывает якоря и сам факт, что обёртка
 * не ломает вёрстку. Появление и позиционирование проверяются вручную
 * в витрине: детерминированного снимка у наведения курсора не бывает.
 */
export const Matrix: Story = {
  args: { children: <Button variant="outline">Anchor</Button> },
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap gap-4">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side} content={`Tooltip below ${side}`} side={side}>
          <Button variant="outline" tone="neutral">
            side={side}
          </Button>
        </Tooltip>
      ))}
      <Tooltip content="">
        <Button variant="ghost">No tooltip</Button>
      </Tooltip>
    </div>
  ),
};

/**
 * Подсказка внутри модального окна.
 *
 * Здесь проверяется слой: при `z-[60]` подсказка уходила под подложку
 * (`z-90`) — в разметке она есть, на экране её нет. Наводить нужно вручную,
 * снимка у наведения не бывает; смотреть надо на то, что подсказка
 * появляется ПОВЕРХ окна, а не за ним.
 */
export const UnderOverlay: Story = {
  args: { children: <Button variant="soft">Hover here</Button> },
  parameters: { layout: "fullscreen" },
  render: () => (
    // Обёртка с высотой обязательна: подложка позиционируется `fixed`, и без
    // неё корень витрины остаётся коробкой нулевой высоты — то есть «скрытым»
    // для Playwright, и прогон падает по таймауту вместо проверки.
    <div className="h-[320px]">
      <ModalOverlay
        onClose={() => {}}
        className="border-line bg-bg-1 w-full max-w-[380px] rounded-lg border p-5"
      >
        <p className="text-fg-1 m-0 mb-4 text-[13px]">
          Hover the button: the tooltip must sit above the window.
        </p>
        <Tooltip content="Visible above the backdrop">
          <Button variant="solid" tone="accent">
            A button inside the window
          </Button>
        </Tooltip>
      </ModalOverlay>
    </div>
  ),
};

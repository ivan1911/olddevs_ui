import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover.js";

const meta = {
  title: "Overlays/Popover",
  component: PopoverContent,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PopoverContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const Content = () => (
  <div className="w-[240px] p-3">
    <div className="text-fg-0 mb-1 text-[13px] font-bold">Panel</div>
    <div className="text-fg-2 text-[13px]">
      The caller supplies the content: the panel only positions it and closes on Escape.
    </div>
  </div>
);

/**
 * Открыто по умолчанию — снимок должен быть детерминированным, а закрытая
 * панель на нём просто отсутствует.
 */
export const Playground: Story = {
  render: () => (
    <div className="flex h-[280px] items-start">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="soft">Open the panel</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Content />
        </PopoverContent>
      </Popover>
    </div>
  ),
};

/**
 * Матрицы у панели нет по той же причине, что и у `ModalOverlay`: содержимое
 * живёт в портале поверх всей страницы, и две открытые панели в одном кадре
 * перекрывают друг друга. Здесь — одна, привязанная к нижнему краю.
 */
export const BelowTrigger: Story = {
  render: () => (
    <div className="flex h-[280px] items-start">
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant="outline">Anchor</Button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end">
          <Content />
        </PopoverContent>
      </Popover>
    </div>
  ),
};

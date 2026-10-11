import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { Card } from "../content/Card.js";
import { ModalOverlay } from "./ModalOverlay.js";

const meta = {
  title: "Overlays/ModalOverlay",
  component: ModalOverlay,
  parameters: { layout: "fullscreen" },
  args: { onClose: () => {} },
} satisfies Meta<typeof ModalOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Подложка снимается прямо в истории, а не по клику: снимок должен быть
 * детерминированным, а состояние «открыто» — единственное, что тут видно.
 *
 * Фон набран блоками, а не текстом, и это не украшательство. Текст под
 * затемнением axe меряет сквозь подложку и справедливо считает нечитаемым —
 * для контента позади модального окна это норма, но аудит об этом не знает
 * и падал бы на каждой теме. Блоки показывают размытие не хуже.
 */
const Backdrop = () => (
  <div className="flex h-[420px] flex-col gap-3 p-6" aria-hidden>
    <div className="bg-bg-3 rounded-control h-8 w-64" />
    <div className="bg-bg-2 h-4 w-96 rounded" />
    <div className="flex gap-2">
      <div className="bg-accent rounded-control h-9 w-28" />
      <div className="bg-bg-2 border-line rounded-control h-9 w-24 border" />
    </div>
    <div className="mt-2 grid grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-bg-2 h-40 rounded-md" />
      ))}
    </div>
  </div>
);

export const Centered: Story = {
  render: (args) => (
    <div className="relative">
      <Backdrop />
      <ModalOverlay {...args}>
        <Card>
          <div className="flex w-[320px] flex-col gap-3">
            <div className="text-fg-0 font-bold">Delete the photo?</div>
            <div className="text-fg-2 text-[13px]">This cannot be undone.</div>
            <div className="flex justify-end gap-2">
              <Button variant="soft">Cancel</Button>
              <Button variant="solid" tone="danger">
                Delete
              </Button>
            </div>
          </div>
        </Card>
      </ModalOverlay>
    </div>
  ),
};

/**
 * Матрицы у этого примитива нет, и не по недосмотру: оверлей — `position: fixed`
 * на весь экран, два таких в одном кадре просто лягут друг на друга. Проверено:
 * подложка второго затемняет карточку первого, и аудит axe справедливо ловит
 * нечитаемый текст. Поэтому каждое выравнивание — своя история.
 */
export const FromTop: Story = {
  render: (args) => (
    <div className="relative">
      <Backdrop />
      <ModalOverlay {...args} align="start">
        <Card>
          <div className="text-fg-0 w-[320px] font-mono text-xs">align=&quot;start&quot;</div>
        </Card>
      </ModalOverlay>
    </div>
  ),
};

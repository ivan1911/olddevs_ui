import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "./Card.js";
import { Button } from "../actions/Button.js";
import { StatusBadge } from "../actions/StatusBadge.js";

const meta = {
  title: "Content/Card",
  component: Card,
  parameters: { layout: "centered" },
  args: { children: "Card content" },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Одна карточка с живыми контролами — покрутить пропсы. */
export const Playground: Story = {
  args: { size: "md" },
};

/** Содержимое, по которому видно отступы и то, как ложится текст внутри. */
function CardBody() {
  return (
    <div className="flex w-56 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-fg-0 text-md font-semibold">Publishing</span>
        <StatusBadge tone="success">OK</StatusBadge>
      </div>
      <p className="text-fg-2 text-xs">
        Two padding steps: cards in the schedule grid are denser than cards on a page.
      </p>
      <Button size="sm" variant="soft" tone="neutral">
        Open
      </Button>
    </div>
  );
}

/**
 * Матрица размеров. Ось у карточки одна, и одиночный экземпляр по ней ничего не
 * скажет: разницу `sm` и `md` (отступ и радиус движутся парой) видно только
 * рядом, при одинаковом содержимом.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      {(["sm", "md"] as const).map((size) => (
        <div key={size} className="flex flex-col gap-2">
          <span className="text-fg-2 font-mono text-xs">{size}</span>
          <Card size={size}>
            <CardBody />
          </Card>
        </div>
      ))}
    </div>
  ),
};

/** Карточка на карточке: проверка, что рамка и тень не сливаются на вложенности. */
export const Nesting: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <Card size="md" className="max-w-md">
      <div className="flex flex-col gap-3">
        <span className="text-fg-0 text-md font-semibold">Outer card</span>
        <Card size="sm">
          <span className="text-fg-2 text-xs">Nested card, size sm</span>
        </Card>
        <Card size="sm">
          <span className="text-fg-2 text-xs">One more</span>
        </Card>
      </div>
    </Card>
  ),
};

/**
 * `asChild` — карточка, по которой нажимают.
 *
 * До этого пропа такие карточки собирались как `<div onClick>`: с клавиатуры
 * недостижимы, роли нет, скринридер о нажатии не сообщает. Здесь вид уезжает
 * на настоящую кнопку или ссылку, а вместе с ним — курсор, подсветка рамки и
 * кольцо фокуса.
 */
export const Pressable: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Card asChild size="md" className="max-w-[260px]">
        <button type="button">
          <span className="text-fg-0 text-md font-semibold">City views</span>
          <span className="text-fg-3 mt-px block text-[11px]">142 photos</span>
        </button>
      </Card>
      <Card asChild size="md" className="max-w-[260px]">
        <a href="#collection">
          <span className="text-fg-0 text-md font-semibold">Card as a link</span>
          <span className="text-fg-3 mt-px block text-[11px]">opens in a new tab</span>
        </a>
      </Card>
      <Card size="md" className="max-w-[260px]">
        <span className="text-fg-2 text-xs">A plain container card next to it</span>
      </Card>
    </div>
  ),
};

/**
 * `interactive` — карточка с главным действием и вторичными рядом.
 *
 * Кнопку в кнопку вкладывать нельзя, поэтому карточка с меню «Ещё» не может
 * быть кнопкой целиком. Главное действие — ссылка, растянутая по площади
 * карточки (`after:absolute after:inset-0`); меню лежит выше по слою и
 * остаётся отдельной целью для мыши и для клавиатуры.
 */
export const WithMenuInside: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Card interactive size="md" className="w-[260px]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <a href="#collection" className="after:absolute after:inset-0">
              <span className="text-fg-0 text-md font-semibold">City views</span>
            </a>
            <span className="text-fg-3 mt-px block text-[11px]">142 photos</span>
          </div>
          <div className="relative z-10">
            <Button variant="ghost" iconOnly size="sm" aria-label="More" icon={<span>⋯</span>} />
          </div>
        </div>
      </Card>
    </div>
  ),
};

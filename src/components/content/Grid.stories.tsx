import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Grid, type GridGap, type GridProps } from "./Grid.js";

const meta = {
  title: "Content/Grid",
  component: Grid,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<GridProps>;

export default meta;
type Story = StoryObj<GridProps>;

/** Ячейка-заглушка: видно границы колонок и зазор, ничего доменного. */
function Tile({ children, as = "div" }: { children: ReactNode; as?: "div" | "li" }) {
  const Comp = as;
  return (
    <Comp className="border-line-soft bg-bg-2 text-fg-1 rounded-lg border px-4 py-6 text-sm">
      {children}
    </Comp>
  );
}

const tiles = (count: number, as?: "div" | "li") =>
  Array.from({ length: count }, (_, i) => (
    <Tile key={i} as={as}>
      Item {i + 1}
    </Tile>
  ));

/**
 * Число колонок одним числом — отзывчивая лестница: одна на телефоне, две с
 * `sm`, сколько сказано — с `lg`. Сузьте окно, чтобы увидеть переходы.
 */
export const Playground: Story = {
  args: { columns: 4, gap: "md" },
  render: (args: GridProps) => (
    <Grid {...args} data-testid="grid">
      {tiles(8)}
    </Grid>
  ),
};

/**
 * Точное число колонок с каждого брейкпойнта: 1 → 2 с `sm` → 3 с `md` → 6 с
 * `xl`. Неизменное число на любой ширине — объект с одним `base`.
 */
export const Breakpoints: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Grid columns={{ base: 1, sm: 2, md: 3, xl: 6 }} data-testid="responsive">
        {tiles(6)}
      </Grid>
      <Grid columns={{ base: 3 }} gap="sm" data-testid="fixed">
        {tiles(3)}
      </Grid>
    </div>
  ),
};

/**
 * Наименьшая ширина ячейки вместо числа колонок: строка заполняется сама.
 * Пустые дорожки остаются (`auto-fill`), поэтому три ячейки не растягиваются
 * во всю ширину и равны ячейкам полной строки.
 */
export const AutoFill: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <Grid minItemWidth={200} data-testid="autofill">
        {tiles(10)}
      </Grid>
      <Grid minItemWidth={200} data-testid="autofill-short">
        {tiles(3)}
      </Grid>
    </div>
  ),
};

const GAPS: GridGap[] = ["none", "xs", "sm", "md", "lg", "xl"];

/** Зазор — ступень шкалы: none, 8, 12, 16, 24, 32 пикселя. */
export const Gaps: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {GAPS.map((gap) => (
        <div key={gap} className="flex flex-col gap-2">
          <span className="text-fg-2 text-caption">gap=&quot;{gap}&quot;</span>
          <Grid columns={{ base: 4 }} gap={gap}>
            {tiles(4)}
          </Grid>
        </div>
      ))}
    </div>
  ),
};

/** Набор, который и есть список: скринридер объявит его и число элементов. */
export const AsList: Story = {
  render: () => (
    <Grid as="ul" aria-label="Plans" columns={3}>
      {tiles(3, "li")}
    </Grid>
  ),
};

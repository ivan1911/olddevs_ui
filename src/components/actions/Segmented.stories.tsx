import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Segmented } from "./Segmented.js";
import { TooltipProvider } from "../overlays/Tooltip.js";

const meta = {
  title: "Actions/Segmented",
  component: Segmented,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: {
    value: "exact",
    onChange: () => {},
    options: [
      { value: "exact", label: "Exact" },
      { value: "semantic", label: "Semantic" },
    ],
  },
} satisfies Meta<typeof Segmented>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Живой переключатель: состояние настоящее, а не нарисованное. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return <Segmented {...args} value={value} onChange={setValue} />;
  },
};

/**
 * Недоступный сегмент. Режим существует, но сейчас его применить нельзя —
 * например, семантический поиск при выключенных эмбеддингах. Убирать такой
 * сегмент из набора нельзя: пропавший режим выглядит как поломка, а
 * приглушённый честно говорит «есть, но не сейчас».
 */
export const Disabled: Story = {
  args: {
    options: [
      { value: "exact", label: "Exact" },
      { value: "semantic", label: "Semantic", disabled: true },
    ],
  },
};

/**
 * Матрица наполнения: подписи, иконки с подсказками, смешанный набор,
 * и по строке на каждый выбранный сегмент — чтобы было видно, что выделение
 * ездит, а не нарисовано на первом.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <tbody>
        {(
          [
            [
              "labels",
              [
                { value: "exact", label: "Exact" },
                { value: "semantic", label: "Semantic" },
              ],
            ],
            [
              "icons only",
              [
                { value: "phone", icon: <span aria-hidden>▯</span>, tooltip: "Phone" },
                { value: "desktop", icon: <span aria-hidden>▭</span>, tooltip: "Desktop" },
              ],
            ],
            [
              "icon with a label",
              [
                { value: "grid", icon: <span aria-hidden>▦</span>, label: "Grid" },
                { value: "list", icon: <span aria-hidden>▤</span>, label: "List" },
              ],
            ],
          ] as const
        ).flatMap(([label, options]) =>
          options.map((opt, i) => (
            <tr key={`${label}-${i}`}>
              <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">
                {i === 0 ? label : ""}
              </td>
              <td>
                <Segmented value={opt.value} onChange={() => {}} options={[...options]} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  ),
};

/**
 * Пять сегментов в колонке шириной с телефон. Сегменты не сжимаются, поэтому
 * лишние уезжают на вторую строку — без этого единственным исходом была бы
 * горизонтальная прокрутка, то есть нарушение WCAG 1.4.10.
 *
 * Рамка вокруг — это не часть контрола, а замер: она показывает границу
 * доступной ширины, за которую переключатель не должен выходить.
 */
export const Wrapping: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="border-line-soft w-[359px] border border-dashed p-2">
      <Segmented
        value="available"
        onChange={() => {}}
        options={[
          { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
          { value: "deferred", icon: <span aria-hidden>▷</span>, label: "Deferred" },
          { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
          { value: "dropped", icon: <span aria-hidden>▫</span>, label: "Dropped" },
          { value: "available", icon: <span aria-hidden>◎</span>, label: "Available now" },
        ]}
      />
    </div>
  ),
};

/**
 * Режим «только иконка на узком экране» (`mobileIconOnly`).
 *
 * СУЗЬТЕ ОКНО ДО 640 ПИКСЕЛЕЙ — иначе оба переключателя выглядят одинаково, и
 * это не дефект истории, а суть режима: порог берётся от ШИРИНЫ ЭКРАНА, а не
 * от ширины родителя. Рамка в 359 пикселей вокруг — замер доступной ширины,
 * она на брейкпоинт не влияет (медиазапрос про экран ничего не знает о ней).
 *
 * На широком экране справа обязано быть ровно то же, что слева: подписи на
 * месте. На узком слева останутся три ряда, справа — один.
 */
export const MobileIconOnly: Story = {
  parameters: { layout: "padded" },
  render: () => {
    const options = [
      { value: "active", icon: <span aria-hidden>▤</span>, label: "Active" },
      { value: "deferred", icon: <span aria-hidden>▷</span>, label: "Deferred" },
      { value: "done", icon: <span aria-hidden>▪</span>, label: "Done" },
      { value: "dropped", icon: <span aria-hidden>▫</span>, label: "Dropped" },
      { value: "available", icon: <span aria-hidden>◎</span>, label: "Available now" },
    ];
    return (
      // Колонкой, а не в ряд: на телефоне две рамки по 359 рядом не помещаются
      // и сжимаются — сравнивать было бы нечего.
      <div className="flex flex-col items-start gap-6">
        <div className="border-line-soft w-[359px] max-w-full border border-dashed p-2">
          {/* Как было: подписи всегда видны. */}
          <Segmented value="available" onChange={() => {}} options={options} />
        </div>
        <div className="border-line-soft w-[359px] max-w-full border border-dashed p-2">
          <Segmented value="available" onChange={() => {}} options={options} mobileIconOnly />
        </div>
      </div>
    );
  },
};

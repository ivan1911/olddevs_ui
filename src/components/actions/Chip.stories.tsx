import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./Chip.js";
import type { Tone } from "../../lib/variants.js";

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

const meta = {
  title: "Actions/Chip",
  component: Chip,
  parameters: { layout: "centered" },
  args: { children: "Filter" },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Один чип с живыми контролами — покрутить пропсы. */
export const Playground: Story = {
  args: { selected: false, tone: "accent", size: "md" },
};

/**
 * Матрица тон × состояние. Смысл витрины именно в ней: одиночный экземпляр
 * не покажет, что тон `warning` в светлой теме теряет контраст, а матрица покажет.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Variant</span>
          </th>
          <th className="text-fg-2 text-xs font-semibold">unselected</th>
          <th className="text-fg-2 text-xs font-semibold">selected</th>
          <th className="text-fg-2 text-xs font-semibold">with a count</th>
          <th className="text-fg-2 text-xs font-semibold">icon only</th>
        </tr>
      </thead>
      <tbody>
        {TONES.map((tone) => (
          <tr key={tone}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{tone}</td>
            <td>
              <Chip tone={tone}>Filter</Chip>
            </td>
            <td>
              <Chip tone={tone} selected>
                Filter
              </Chip>
            </td>
            <td>
              <Chip tone={tone} selected count={12}>
                Filter
              </Chip>
            </td>
            <td>
              <Chip tone={tone} selected iconOnly icon={<span>★</span>} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Размеры и выключенное состояние. */
export const SizesAndStates: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Chip size="sm">sm</Chip>
      <Chip size="md">md</Chip>
      <Chip size="sm" selected>
        sm selected
      </Chip>
      <Chip size="md" selected>
        md selected
      </Chip>
      <Chip disabled>disabled</Chip>
      <Chip disabled selected>
        disabled and selected
      </Chip>
    </div>
  ),
};

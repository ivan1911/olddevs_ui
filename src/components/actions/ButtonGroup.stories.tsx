import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button.js";
import { ButtonGroup } from "./ButtonGroup.js";
import { GridDenseIcon, GridSparseIcon } from "../../icons.js";

/** Wave 9, a lighter quality bar: it shipped together with the navigation primitives. */
const meta = {
  title: "Actions/ButtonGroup",
  component: ButtonGroup,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <ButtonGroup aria-label="View">
        <Button variant="outline" icon={<GridSparseIcon size={16} />}>
          List
        </Button>
        <Button variant="outline" icon={<GridDenseIcon size={16} />}>
          Tile
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Actions">
        <Button variant="outline" iconOnly icon={<GridSparseIcon size={16} />} aria-label="List" />
        <Button variant="outline" iconOnly icon={<GridDenseIcon size={16} />} aria-label="Tile" />
      </ButtonGroup>
    </div>
  ),
};

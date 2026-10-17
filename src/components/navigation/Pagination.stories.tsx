import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Pagination } from "./Pagination.js";
import { Text } from "../content/Text.js";

/** Wave 9: navigation primitives for the lighter bar. */
const meta = {
  title: "Navigation/Pagination",
  component: Pagination,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj;

export const Pages: Story = {
  render: function Render() {
    const [page, setPage] = useState(7);
    return (
      <div className="flex flex-col gap-4">
        <Pagination page={page} pageCount={24} onChange={setPage} />
        <Pagination page={2} pageCount={4} onChange={() => {}} />
        <Text size="sm" level={3}>
          With a single page nothing is drawn below:
        </Text>
        <Pagination page={1} pageCount={1} onChange={() => {}} />
      </div>
    );
  },
};

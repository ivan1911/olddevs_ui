import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../actions/Button.js";
import { PageHeader } from "./PageHeader.js";

const meta = {
  title: "Navigation/PageHeader",
  component: PageHeader,
  parameters: { layout: "padded" },
  args: { title: "Library" },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { subtitle: "3527 photos in the library" },
};

/**
 * Матрица наполнения. Ось у шапки одна — что в ней есть, кроме заголовка,
 * поэтому матрица перебирает сочетания подписи и действий, а не размеры.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex w-[720px] flex-col gap-8">
      <PageHeader title="Title only" />
      <PageHeader title="With a subtitle" subtitle="3527 photos in the library" />
      <PageHeader
        title="With actions"
        actions={
          <>
            <Button variant="soft" tone="neutral">
              Filters
            </Button>
            <Button tone="accent">Upload</Button>
          </>
        }
      />
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span aria-hidden>★</span> Title as markup
          </span>
        }
        subtitle="Subtitle and actions together"
        actions={<Button tone="accent">Upload</Button>}
      />
    </div>
  ),
};

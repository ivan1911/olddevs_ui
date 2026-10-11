import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DeleteIcon, DownloadIcon, EditIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Image } from "./Image.js";
import { MediaCard, type MediaCardProps } from "./MediaCard.js";
import { StatusBadge } from "../actions/StatusBadge.js";

const meta = {
  title: "Content/MediaCard",
  component: MediaCard,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<MediaCardProps>;

export default meta;
type Story = StoryObj<MediaCardProps>;

/** Заглушка вместо сети: витрина не ходит наружу. */
const PREVIEW = (
  <div className="from-accent-soft to-bg-3 flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl">
    ▦
  </div>
);

export const Playground: Story = {
  args: { preview: PREVIEW, title: "kadr-0042.png", subtitle: "1920×1080 · 2.4 MB" },
  render: (args) => (
    <div className="w-[220px]">
      <MediaCard {...args} />
    </div>
  ),
};

/** Бейджи и действия поверх превью. Действия достижимы с клавиатуры. */
export const WithActions: Story = {
  render: () => (
    <div className="w-[220px]">
      <MediaCard
        preview={PREVIEW}
        title="kadr-0042.png"
        subtitle="1920×1080"
        badges={<StatusBadge tone="warning">Duplicate</StatusBadge>}
        actions={
          <>
            <Button size="sm" variant="soft" iconOnly icon={<EditIcon />} aria-label="Edit" />
            <Button
              size="sm"
              variant="soft"
              iconOnly
              icon={<DownloadIcon />}
              aria-label="Download"
            />
            <Button
              size="sm"
              variant="soft"
              tone="danger"
              iconOnly
              icon={<DeleteIcon />}
              aria-label="Delete"
            />
          </>
        }
      />
    </div>
  ),
};

/** Ось выбора включается парой пропов; без них кнопки нет вовсе. */
export const WithSelection: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Record<string, boolean>>({ "2": true });
    return (
      <div className="grid w-[480px] grid-cols-2 gap-3">
        {["1", "2", "3", "4"].map((id) => (
          <MediaCard
            key={id}
            preview={PREVIEW}
            title={`kadr-000${id}.png`}
            selected={selected[id] ?? false}
            onSelectedChange={(next) => setSelected((prev) => ({ ...prev, [id]: next }))}
          />
        ))}
      </div>
    );
  },
};

/** Пропорция задаётся числом и держится существующим `AspectRatio`. */
export const Ratios: Story = {
  render: () => (
    <div className="flex w-[560px] items-start gap-3">
      <div className="w-[180px]">
        <MediaCard preview={PREVIEW} ratio={1} title="Square" />
      </div>
      <div className="w-[240px]">
        <MediaCard preview={PREVIEW} ratio={16 / 9} title="Wide" />
      </div>
      <div className="w-[140px]">
        <MediaCard preview={PREVIEW} ratio={9 / 16} title="Tall" />
      </div>
    </div>
  ),
};

/** Превью — обычно `Image`: своей загрузки и своего скелетона плитка не пишет. */
export const WithImage: Story = {
  render: () => (
    <div className="w-[220px]">
      <MediaCard
        preview={<Image src="/broken.png" alt="" className="h-full w-full" />}
        title="Broken URL"
        subtitle="Fallback comes from `Image`"
      />
    </div>
  ),
};

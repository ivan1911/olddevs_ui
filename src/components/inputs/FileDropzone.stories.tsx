import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileDropzone, type FileDropzoneProps } from "./FileDropzone.js";
import { Text } from "../content/Text.js";

const meta = {
  title: "Inputs/FileDropzone",
  component: FileDropzone,
  parameters: { layout: "padded" },
  tags: ["periphery"],
  args: { onFiles: () => {} },
} satisfies Meta<FileDropzoneProps>;

export default meta;
type Story = StoryObj<FileDropzoneProps>;

export const Playground: Story = {
  render: function Render(args) {
    const [files, setFiles] = useState<string[]>([]);
    return (
      <div className="flex w-[440px] flex-col gap-3">
        <FileDropzone
          {...args}
          accept="image/*"
          maxSize={5 * 1024 * 1024}
          hint="JPG или PNG, не больше 5 МБ"
          onFiles={(f) => setFiles(f.map((x) => x.name))}
        />
        <Text size="sm" level={3}>
          Принято: {files.length ? files.join(", ") : "—"}
        </Text>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: (args) => (
    <div className="w-[440px]">
      <FileDropzone {...args} disabled hint="Загрузка приостановлена" />
    </div>
  ),
};

/**
 * Отклонённые файлы показываются с причиной. Область, которая молча принимает
 * семь файлов из десяти, читается как сломанная.
 */
export const WithRejected: Story = {
  render: function Render(args) {
    return (
      <div className="w-[440px]">
        <FileDropzone
          {...args}
          accept=".jpg,.png"
          maxSize={1024}
          hint="The limit here is 1 KB — any real file will be rejected"
        />
      </div>
    );
  },
};

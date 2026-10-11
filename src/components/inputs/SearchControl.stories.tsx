import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Dialog } from "../overlays/Dialog.js";
import { SearchControl } from "./SearchControl.js";

const meta = {
  title: "Inputs/SearchControl",
  component: SearchControl,
  parameters: { layout: "padded" },
  args: {
    label: "Search the library",
    placeholder: "Find photos…",
    value: "",
    onChange: () => {},
  },
} satisfies Meta<typeof SearchControl>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Живое поле: крестик появляется с первым символом и возвращает фокус в поле. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState("");
    return (
      <div className="w-[320px]">
        <SearchControl {...args} value={value} onChange={setValue} />
      </div>
    );
  },
};

/** По образцу поиска YouTube: панель открывается кнопкой внутри поля и меняет текущее выделение. */
export const OnScreenKeyboard: Story = {
  render: (args) => {
    const [value, setValue] = useState("sunset");
    const [layout, setLayout] = useState<"en" | "ru">("ru");
    return (
      <div className="h-[460px] w-[640px]">
        <SearchControl
          {...args}
          value={value}
          onChange={setValue}
          keyboard={{ layout, onLayoutChange: setLayout }}
        />
      </div>
    );
  },
};

/** Технический сценарий для проверки Escape в стеке Popover поверх Dialog. */
export const KeyboardInDialog: Story = {
  tags: ["periphery"],
  render: (args) => {
    const [dialogOpen, setDialogOpen] = useState(true);
    const [value, setValue] = useState("sunset");
    const [layout, setLayout] = useState<"en" | "ru">("ru");
    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Search inside a dialog"
        className="w-full max-w-[700px]"
      >
        <div className="p-5">
          <SearchControl
            {...args}
            value={value}
            onChange={setValue}
            keyboard={{ layout, onLayoutChange: setLayout }}
          />
        </div>
      </Dialog>
    );
  },
};

/**
 * Матрица «состояние × форма». Геометрия задаётся через `shellClassName` —
 * своей оси размера у поля нет, как и у `Select` с его `triggerClassName`:
 * какой вид у окружающей формы, пакет не знает.
 *
 * Последняя строка — пилюля из фильтра библиотеки: тот же примитив, другая
 * оболочка, а не второй компонент.
 */
export const Matrix: Story = {
  render: (args) => (
    <div className="flex w-[420px] flex-col gap-5">
      {(
        [
          ["empty", { value: "" }],
          ["with a query", { value: "sunset" }],
          ["no clear", { value: "sunset", clearable: false }],
          ["disabled", { value: "sunset", disabled: true }],
        ] as const
      ).map(([label, props]) => (
        <div key={label} className="flex flex-col gap-1.5">
          <span className="text-fg-2 font-mono text-xs">{label}</span>
          <SearchControl {...args} {...props} />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <span className="text-fg-2 font-mono text-xs">pill, compact</span>
        <SearchControl
          {...args}
          value="mountains"
          shellClassName="rounded-full py-0"
          className="py-[7px] text-xs"
        />
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type ChangeEvent } from "react";
import { Keyboard, type KeyboardLayout, type KeyboardSelection } from "./Keyboard.js";
import { SearchControl } from "../inputs/SearchControl.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Content/Keyboard",
  component: Keyboard,
  parameters: { layout: "padded" },
  args: {
    value: "",
    selection: { start: 0, end: 0 },
    onChange: () => {},
    onSelectionChange: () => {},
    layout: "ru",
    onLayoutChange: () => {},
  },
} satisfies Meta<typeof Keyboard>;

export default meta;
type Story = StoryObj<typeof meta>;

function KeyboardPlayground() {
  const [value, setValue] = useState("sunset");
  const [selection, setSelection] = useState<KeyboardSelection>({ start: 5, end: 5 });
  const [layout, setLayout] = useState<KeyboardLayout>("ru");

  const rememberSelection = (event: ChangeEvent<HTMLInputElement>) => {
    setSelection({ start: event.target.selectionStart ?? 0, end: event.target.selectionEnd ?? 0 });
  };

  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <TextControl
        aria-label="Query"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onSelect={rememberSelection}
      />
      <Keyboard
        value={value}
        selection={selection}
        onChange={setValue}
        onSelectionChange={setSelection}
        layout={layout}
        onLayoutChange={setLayout}
        onRequestClose={() => {}}
      />
    </div>
  );
}

function KeyboardScenario({
  title,
  initialValue,
  initialLayout,
  defaultOpen = false,
}: {
  title: string;
  initialValue: string;
  initialLayout: KeyboardLayout;
  defaultOpen?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [layout, setLayout] = useState<KeyboardLayout>(initialLayout);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className={defaultOpen ? "min-h-[21.5rem]" : undefined}>
      <p className="text-fg-2 mb-1.5 font-mono text-xs font-semibold">{title}</p>
      <SearchControl
        label={title}
        value={value}
        onChange={setValue}
        placeholder="Find photos…"
        keyboard={{
          layout,
          onLayoutChange: setLayout,
          defaultOpen,
          onSubmit: () => setSubmitted(true),
        }}
      />
      {submitted ? <p role="status">Search submitted</p> : null}
    </div>
  );
}

/** Живая панель: выбор в поле сохраняется, а EN/RU и Shift меняют клавиши. */
export const Playground: Story = { render: () => <KeyboardPlayground /> };

/**
 * Матрица «панель × раскладка × содержимое поля» для реального SearchControl.
 * Открытые состояния показаны сразу, а закрытые оставляют видимой иконку
 * клавиатуры: так видно и место входа, и то, какое поле редактирует каждая
 * конкретная панель. На мобильной ширине и иконка, и сама панель скрываются.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="grid w-full max-w-[60rem] grid-cols-1 gap-y-6 lg:grid-cols-2 lg:gap-x-8">
      <KeyboardScenario
        title="open · Russian · query"
        initialValue="sunset"
        initialLayout="ru"
        defaultOpen
      />
      <KeyboardScenario
        title="open · English · query"
        initialValue="sunset"
        initialLayout="en"
        defaultOpen
      />
      <KeyboardScenario title="closed · empty query" initialValue="" initialLayout="ru" />
      <KeyboardScenario
        title="closed · query with a clear"
        initialValue="northern lights"
        initialLayout="en"
      />
    </div>
  ),
};

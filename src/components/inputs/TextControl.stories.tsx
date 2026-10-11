import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { SearchControl } from "./SearchControl.js";
import { Select } from "./Select.js";
import { TextControl } from "./TextControl.js";

const meta = {
  title: "Inputs/TextControl",
  component: TextControl,
  parameters: { layout: "centered" },
  args: { placeholder: "Photo name", "aria-label": "Photo name" },
} satisfies Meta<typeof TextControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { as: "input" } };

/**
 * Матрица «вид × состояние». Состояния показаны реальными атрибутами
 * (`disabled`, `readOnly`), а не классами: если оформление разъедется
 * с настоящим состоянием поля, матрица это покажет.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[420px] flex-col gap-5">
      {(
        [
          ["plain", {}],
          ["with text", { defaultValue: "Sunset over the city" }],
          ["disabled", { disabled: true, defaultValue: "Unavailable" }],
          ["read only", { readOnly: true, defaultValue: "Read only" }],
        ] as const
      ).map(([label, props]) => (
        <label key={label} className="flex flex-col gap-1.5">
          <span className="text-fg-2 font-mono text-xs">{label}</span>
          <TextControl placeholder="Photo name" {...props} />
        </label>
      ))}
      <label className="flex flex-col gap-1.5">
        <span className="text-fg-2 font-mono text-xs">textarea, rows=3</span>
        <TextControl as="textarea" rows={3} placeholder="Description" />
      </label>
    </div>
  ),
};

/**
 * Растущее поле и счётчик символов.
 *
 * Высоту считает браузер, а не JS: невидимый близнец с той же типографикой
 * лежит в той же ячейке грида и задаёт её высоту. Обычный способ — читать
 * `scrollHeight` на каждое нажатие — это принудительный пересчёт раскладки на
 * каждый символ.
 *
 * `rows` при `autosize` работает минимумом, `maxRows` — пределом, после
 * которого включается прокрутка.
 */
export const Growing: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [short, setShort] = useState("One line");
    const [long, setLong] = useState(
      "First line\nsecond line\nthird line\nfourth line\nfifth line"
    );
    return (
      <div className="flex w-[360px] flex-col gap-4">
        <TextControl
          as="textarea"
          autosize
          rows={2}
          value={short}
          onChange={(e) => setShort(e.target.value)}
          aria-label="Grows with content"
          shellClassName="w-full"
        />
        <TextControl
          as="textarea"
          autosize
          rows={2}
          maxRows={4}
          value={long}
          onChange={(e) => setLong(e.target.value)}
          aria-label="Grows to a limit, then scrolls"
          shellClassName="w-full"
        />
      </div>
    );
  },
};

/** Счётчик: с `maxLength` показывает «N/M», без него — просто «N». */
export const WithCounter: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [name, setName] = useState("Daily collection");
    const [text, setText] = useState("A short caption");
    return (
      <div className="flex w-[360px] flex-col gap-4">
        <TextControl
          showCount
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="With a limit"
          shellClassName="w-full"
        />
        <TextControl
          as="textarea"
          autosize
          rows={2}
          showCount
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Without a limit"
          shellClassName="w-full"
        />
      </div>
    );
  },
};

/**
 * Ступень высоты рядом с соседями по строке.
 *
 * `sm` — 36 пикселей, ровно рост `Button size="md"` и пилюли-триггера `Select`:
 * в панели управления поле до этой ступени выпадало из ряда в одиночку. `md` —
 * прежние 42, и в форме это верная высота.
 *
 * История нужна замеру: разницу в шесть пикселей на статичном кадре видно
 * только рядом с тем, с чем поле обязано совпасть.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2" data-testid="compact-row">
        <Button>New task</Button>
        <TextControl aria-label="Compact search" size="sm" placeholder="sm — 36" />
        {/* Ступень пробрасывается и в поиск: он стоит на этом же поле. */}
        <SearchControl label="Search tasks" size="sm" value="" onChange={() => {}} />
        <Select
          items={[{ id: "all", label: "All projects" }]}
          value={null}
          onChange={() => {}}
          placeholder="Project"
          highlightSelected={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <TextControl aria-label="Form field" placeholder="md — 42, the default" />
      </div>
    </div>
  ),
};

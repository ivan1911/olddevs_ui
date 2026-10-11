import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeView } from "./CodeView.js";

const BODY = `{
  "id": 4821,
  "status": "assembling",
  "total": 148200,
  "customer": null
}`;

const LONG = `curl -X POST https://api.example.com/v1/orders --header "Content-Type: application/json" --data '{"id":4821,"status":"assembling"}'`;

const meta = {
  title: "Content/CodeView",
  component: CodeView,
  // Периферия по ADR-0038: представление без поведения, подсветку компонент не
  // делает вовсе.
  tags: ["periphery"],
  parameters: { layout: "padded" },
  args: { code: BODY },
} satisfies Meta<typeof CodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Простой текст: подсветчика кит не везёт, и без него это просто моноширинный код. */
export const Playground: Story = {};

/** Шапка с именем файла и копированием — существующая `CopyButton`. */
export const WithHeader: Story = {
  args: { title: "response.json", copyable: true, lineNumbers: true },
};

/**
 * Подсвеченная разметка. Это то, что вернул подсветчик потребителя; `code`
 * при этом остаётся источником правды для нумерации и копирования.
 *
 * Цвета здесь взяты из токенов кита и в варианте `strong`: обычный `accent` на
 * подложке кода не проходит по контрасту, и аудит axe это ловит. Заметьте, что
 * это довод самой границы ADR-0039 — кит не может отвечать за цвета синтаксиса,
 * которых не выбирал.
 */
export const Highlighted: Story = {
  args: { title: "response.json", copyable: true, lineNumbers: true },
  render: (args) => (
    <CodeView {...args}>
      <span className="text-fg-2">{"{\n"}</span>
      <span className="text-accent-strong">{'  "id"'}</span>
      <span className="text-fg-2">: </span>
      <span className="text-warning-strong">4821</span>
      <span className="text-fg-2">{",\n"}</span>
      <span className="text-accent-strong">{'  "status"'}</span>
      <span className="text-fg-2">: </span>
      <span className="text-success-strong">{'"assembling"'}</span>
      <span className="text-fg-2">{",\n"}</span>
      <span className="text-accent-strong">{'  "total"'}</span>
      <span className="text-fg-2">: </span>
      <span className="text-warning-strong">148200</span>
      <span className="text-fg-2">{",\n"}</span>
      <span className="text-accent-strong">{'  "customer"'}</span>
      <span className="text-fg-2">: </span>
      <span className="text-danger-strong">null</span>
      <span className="text-fg-2">{"\n}"}</span>
    </CodeView>
  ),
};

/**
 * Длинная строка без переноса даёт прокрутку, а не обрезку: обрезанная строка
 * кода молча теряет то, ради чего её открыли.
 */
export const LongLine: Story = {
  args: { code: LONG, title: "request.sh", copyable: true },
};

/** Та же строка с переносом. */
export const Wrapped: Story = {
  args: { code: LONG, title: "request.sh", copyable: true, wrap: true },
};

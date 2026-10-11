import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "./Alert.js";
import { Button } from "./Button.js";
import { TONE_TOKENS, type Tone } from "../../lib/variants.js";

const meta = {
  title: "Actions/Alert",
  component: Alert,
  parameters: { layout: "padded" },
  args: { children: "Channel not connected — nothing will be published." },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { tone: "warning", title: "Channel not connected" },
  render: (args) => (
    <div className="max-w-[520px]">
      <Alert {...args} />
    </div>
  ),
};

/** С действием и крестиком: и то и другое — узлы, а не колбэки с подписью. */
export const WithAction: Story = {
  render: () => (
    <div className="max-w-[520px]">
      <Alert
        tone="warning"
        title="Channel not connected"
        action={
          <Button size="sm" variant="solid" tone="warning">
            Connect
          </Button>
        }
        onDismiss={() => {}}
      >
        Nothing will be published until the channel is connected.
      </Alert>
    </div>
  ),
};

/**
 * Матрица тон × вид.
 *
 * `solid` и `ghost` в матрице отсутствуют не по недосмотру: они исключены
 * типом. Сплошная заливка на всю ширину блока — плашка, перебивающая
 * содержимое; `ghost` без рамки и подложки перестаёт читаться как сообщение.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex max-w-[520px] flex-col gap-3">
      {(Object.keys(TONE_TOKENS) as Tone[]).map((tone) => (
        <div key={tone} className="flex flex-col gap-2">
          <Alert tone={tone} variant="soft" title={`${tone} / soft`}>
            A one-line message.
          </Alert>
          <Alert tone={tone} variant="outline" title={`${tone} / outline`} onDismiss={() => {}}>
            A one-line message.
          </Alert>
        </div>
      ))}
    </div>
  ),
};

/** Без заголовка — короткое сообщение одной строкой. */
export const WithoutTitle: Story = {
  render: () => (
    <div className="max-w-[520px]">
      <Alert tone="success">Settings saved.</Alert>
    </div>
  ),
};

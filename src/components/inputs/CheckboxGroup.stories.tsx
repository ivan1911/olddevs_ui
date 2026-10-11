import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PaymentIcon, SecurityIcon, StorageIcon } from "../../icons.js";
import type { Tone } from "../../lib/variants.js";
import { Checkbox } from "./Checkbox.js";
import { CheckboxGroup } from "./CheckboxGroup.js";

const meta = {
  title: "Inputs/CheckboxGroup",
  component: CheckboxGroup,
  parameters: { layout: "padded" },
  args: { label: "Where to publish", value: [], onChange: () => {} },
} satisfies Meta<typeof CheckboxGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function LiveDemo({
  orientation,
  disabled,
  errorMessage,
  description,
  initial = ["tg"],
}: {
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  errorMessage?: string;
  description?: string;
  initial?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label="Where to publish"
      value={value}
      onChange={setValue}
      orientation={orientation}
      disabled={disabled}
      errorMessage={errorMessage}
      description={description}
    >
      <Checkbox value="tg">Telegram</Checkbox>
      <Checkbox value="vk">VK</Checkbox>
      <Checkbox value="ok" disabled>
        OK — channel not connected
      </Checkbox>
    </CheckboxGroup>
  );
}

export const Playground: Story = {
  render: () => <LiveDemo description="Pick more than one" />,
};

/** Горизонтальная раскладка — для двух-трёх коротких подписей. */
export const Horizontal: Story = {
  render: () => <LiveDemo orientation="horizontal" />,
};

/**
 * Матрица трёх состояний группы.
 *
 * Показывает то, чего не видно на одной группе: индивидуальный `disabled`
 * гасит один пункт, групповой — все, включая пункты без своего `disabled`;
 * а ошибка вытесняет пояснение, а не встаёт под ним.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <LiveDemo description="Pick more than one" />
      <LiveDemo disabled />
      <LiveDemo errorMessage="Pick at least one channel" description="Pick more than one" />
    </div>
  ),
};

function CardsDemo({
  orientation,
  disabled,
  errorMessage,
  tone,
  label = "Modules",
  initial = ["billing"],
}: {
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  errorMessage?: string;
  tone?: Tone;
  label?: string;
  initial?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <CheckboxGroup
      label={label}
      appearance="card"
      value={value}
      onChange={setValue}
      tone={tone}
      orientation={orientation}
      disabled={disabled}
      errorMessage={errorMessage}
      description="Pick as many as you need"
    >
      <Checkbox
        value="billing"
        icon={<PaymentIcon size={20} />}
        description="Invoices and payments"
      >
        Billing
      </Checkbox>
      <Checkbox value="storage" icon={<StorageIcon size={20} />} description="Files and backups">
        Storage
      </Checkbox>
      <Checkbox
        value="audit"
        icon={<SecurityIcon size={20} />}
        description="Not on your plan"
        disabled
      >
        Audit log
      </Checkbox>
    </CheckboxGroup>
  );
}

/** Карточки выбора: пробел переключает, вся карточка — область нажатия. */
export const Cards: Story = {
  render: () => <CardsDemo />,
};

/** Карточки в строку с переносом. */
export const CardsHorizontal: Story = {
  render: () => <CardsDemo orientation="horizontal" />,
};

/** Ошибка и выключенная группа — как у обычной группы флажков. */
export const CardsStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <CardsDemo initial={[]} errorMessage="Pick at least one module" />
      <CardsDemo disabled />
    </div>
  ),
};

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

/**
 * Тон группы красит рамку выбранной карточки и галочку. Заданный `tone` группы
 * один на весь набор и перекрывает `tone` отдельных флажков. Последняя группа без
 * `tone` — флажки красятся каждый своим.
 */
export const CardsTones: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {TONES.map((tone) => (
        <CardsDemo
          key={tone}
          tone={tone}
          label={`Modules — ${tone}`}
          initial={["billing", "storage"]}
        />
      ))}
      <CheckboxGroup
        label="Without a group tone"
        appearance="card"
        value={["a", "b"]}
        onChange={() => {}}
      >
        <Checkbox value="a" tone="success" description="Own tone: success">
          First
        </Checkbox>
        <Checkbox value="b" tone="danger" description="Own tone: danger">
          Second
        </Checkbox>
      </CheckboxGroup>
    </div>
  ),
};

/** Тон группы и у обычных строк: коробка отмеченного флажка берёт его же. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {TONES.map((tone) => (
        <CheckboxGroup
          key={tone}
          label={`Tone — ${tone}`}
          tone={tone}
          value={["a"]}
          onChange={() => {}}
          orientation="horizontal"
        >
          <Checkbox value="a">Checked</Checkbox>
          <Checkbox value="b">Unchecked</Checkbox>
        </CheckboxGroup>
      ))}
    </div>
  ),
};

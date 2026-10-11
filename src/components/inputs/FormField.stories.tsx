import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "../date-time/DatePicker.js";
import { DateRangePicker } from "../date-time/DateRangePicker.js";
import { FormField } from "./FormField.js";
import { SearchControl } from "./SearchControl.js";
import { Select } from "./Select.js";
import { TextControl } from "./TextControl.js";

/**
 * Вид контрола внутри формы: нейтральная рамка, ширина по колонке.
 *
 * Акцентная подсветка выбранного значения здесь выключена намеренно. В панели
 * фильтров она означает «фильтр применён» и её ищут глазами; в форме то же
 * самое означало бы «поле заполнено» — а это норма, а не событие.
 */
const FORM_TRIGGER = "border-line bg-bg-2 w-full rounded-control px-3 py-2.5";

const meta = {
  title: "Inputs/FormField",
  component: FormField,
  parameters: { layout: "padded" },
  args: { label: "Name" },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Канонический вызов: `htmlFor` блока и `id` поля — одна и та же строка.
 * Клик по подписи фокусирует поле, скринридер называет поле её словами,
 * и отдельный `aria-label` на поле становится не нужен.
 */
export const Playground: Story = {
  args: {
    htmlFor: "field-title",
    hint: "Shown to channel subscribers",
    children: <TextControl id="field-title" placeholder="Sunset over the city" />,
  },
};

/**
 * Матрица наполнения: с пояснением и без, с разными контролами внутри.
 *
 * Смысл перебора именно в разнородности содержимого. `FormField` не знает,
 * что у него внутри, — он даёт подпись, отступ и пояснение чему угодно, что
 * занимает ширину колонки. Матрица из одних текстовых полей этого не
 * показывала и оставляла впечатление, что `FormField` и `TextControl` —
 * одно и то же с разных сторон.
 *
 * Чего здесь нет и не будет — `Toggle`. У переключателя подпись стоит слева
 * от контрола, а не над ним; положить его сюда значит узаконить раскладку,
 * которой в интерфейсах не бывает. Плюс у него есть собственный обязательный
 * `label` (`aria-label` на `role="switch"`), и внутри `FormField` имён стало
 * бы два — видимое сверху и объявляемое скринридером.
 */
export const Matrix: Story = {
  render: () => (
    <div className="flex w-[420px] flex-col gap-6">
      <FormField label="Label only">
        <TextControl aria-label="Label only" />
      </FormField>
      <FormField label="With a hint" hint="No longer than 120 characters">
        <TextControl aria-label="With a hint" />
      </FormField>
      <FormField label="Multiline" hint="Telegram markup is supported">
        <TextControl as="textarea" rows={3} aria-label="Multiline" />
      </FormField>
      <FormField label="Search" hint="The cross clears and returns focus to the field">
        <SearchControl label="Find photos" value="sunset" onChange={() => {}} />
      </FormField>
      <FormField label="Category" hint="Affects tag suggestions on upload">
        <Select
          items={[
            { id: "nature", label: "Nature", meta: 214 },
            { id: "space", label: "Space", meta: 87 },
          ]}
          value="nature"
          onChange={() => {}}
          placeholder="Category"
          highlightSelected={false}
          triggerClassName={FORM_TRIGGER}
        />
      </FormField>
      <FormField label="Publish date">
        <DatePicker value="2026-03-12" onChange={() => {}} triggerClassName={FORM_TRIGGER} />
      </FormField>
      <FormField label="Campaign period" hint="The preset stays relative tomorrow too">
        <DateRangePicker
          value={{ start: "2026-03-09", end: "2026-03-22" }}
          period={null}
          onChange={() => {}}
          triggerClassName={FORM_TRIGGER}
        />
      </FormField>
    </div>
  ),
};

/**
 * Ошибка и обязательность.
 *
 * Ошибка ВЫТЕСНЯЕТ пояснение, а не встаёт под ним: две строки под полем, одна
 * из которых противоречит другой, заставляют читать обе, чтобы понять, какая
 * ещё действует.
 */
export const ErrorAndRequired: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[320px] flex-col gap-4">
      <FormField label="Name" htmlFor="ff-a" hint="How subscribers will see it">
        <TextControl id="ff-a" defaultValue="Daily collection" shellClassName="w-full" />
      </FormField>
      <FormField label="Name" htmlFor="ff-b" required hint="How subscribers will see it">
        <TextControl id="ff-b" shellClassName="w-full" />
      </FormField>
      <FormField
        label="Name"
        htmlFor="ff-c"
        required
        hint="How subscribers will see it"
        error="Name is required"
      >
        <TextControl id="ff-c" shellClassName="w-full" />
      </FormField>
    </div>
  ),
};

/**
 * Боковая раскладка: подпись в колонке слева, пояснение и ошибка — под полем.
 *
 * Ось живёт у поля, а не у раскладки: подпись рисует `FormField`, и перенести
 * её снаружи невозможно. Ширина колонки — переменная `--form-label-w`.
 */
export const LabelOnLeft: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex w-[520px] flex-col gap-4">
      <FormField label="Name" htmlFor="ff-s1" layout="side" hint="How subscribers will see it">
        <TextControl id="ff-s1" defaultValue="Daily collection" shellClassName="w-full" />
      </FormField>
      <FormField
        label="Email for notifications"
        htmlFor="ff-s2"
        layout="side"
        required
        error="The address is required"
      >
        <TextControl id="ff-s2" shellClassName="w-full" />
      </FormField>
      <div style={{ "--form-label-w": "8rem" } as React.CSSProperties}>
        <FormField label="Narrow column" htmlFor="ff-s3" layout="side">
          <TextControl id="ff-s3" shellClassName="w-full" />
        </FormField>
      </div>
    </div>
  ),
};

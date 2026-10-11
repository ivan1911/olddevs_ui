import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./Button.js";
import { AddIcon } from "../../icons.js";
import type { ButtonSize, Tone, Variant } from "../../lib/variants.js";

const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];
const VARIANTS: Variant[] = ["solid", "soft", "outline", "ghost"];
const SIZES: ButtonSize[] = ["xs", "sm", "md", "lg"];

const meta = {
  title: "Actions/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Button" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Одна кнопка с живыми контролами — покрутить пропсы. */
export const Playground: Story = {
  args: { variant: "solid", tone: "accent", size: "md", disabled: false },
};

/**
 * Матрица variant × tone. Смысл витрины именно в ней: одиночная кнопка не
 * покажет, что `outline` тона `warning` в светлой теме теряет контраст,
 * а `ghost` тона `neutral` в покое почти неотличим от фона — матрица покажет.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Variant</span>
          </th>
          {VARIANTS.map((variant) => (
            <th key={variant} className="text-fg-2 font-mono text-xs font-semibold">
              {variant}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {TONES.map((tone) => (
          <tr key={tone}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{tone}</td>
            {VARIANTS.map((variant) => (
              <td key={variant}>
                <Button variant={variant} tone={tone}>
                  Button
                </Button>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/** Размеры, иконка и выключенное состояние. */
/**
 * Только иконка. Отдельная история, а не столбец матрицы: у такой кнопки другая
 * геометрия (квадрат) и другое требование к доступности — имя берётся из
 * `aria-label`, потому что подписи внутри нет.
 */
export const IconOnly: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Size</span>
          </th>
          {VARIANTS.map((v) => (
            <th key={v} className="text-fg-2 font-mono text-xs font-semibold">
              {v}
            </th>
          ))}
          <th className="text-fg-2 font-mono text-xs font-semibold">selected</th>
        </tr>
      </thead>
      <tbody>
        {SIZES.map((size) => (
          <tr key={size}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{size}</td>
            {VARIANTS.map((v) => (
              <td key={v}>
                <Button
                  size={size}
                  variant={v}
                  tone="neutral"
                  iconOnly
                  icon={<span aria-hidden>★</span>}
                  aria-label={`Favourite, ${v}, ${size}`}
                />
              </td>
            ))}
            <td>
              <Button
                size={size}
                variant="ghost"
                tone="neutral"
                iconOnly
                selected
                icon={<span aria-hidden>★</span>}
                aria-label={`Favourite on, ${size}`}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const SizesAndStates: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {SIZES.map((size) => (
          <Button key={size} size={size} variant="solid" tone="accent">
            {size}
          </Button>
        ))}
      </div>

      {/* Иконка — произвольный ReactNode, размер она не подстраивает. */}
      <div className="flex flex-wrap items-center gap-3">
        {SIZES.map((size) => (
          <Button key={size} size={size} variant="outline" tone="neutral" icon={<span>★</span>}>
            with icon
          </Button>
        ))}
        <Button variant="solid" tone="accent" icon={<span>★</span>} aria-label="Icon only" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled variant="solid" tone="accent">
          disabled
        </Button>
        <Button disabled variant="soft" tone="neutral">
          disabled
        </Button>
        <Button disabled variant="outline" tone="danger">
          disabled
        </Button>
        <Button disabled variant="ghost" tone="neutral">
          disabled
        </Button>
      </div>
    </div>
  ),
};

/**
 * `asChild` — вид кнопки на элементе, который кнопкой не является.
 *
 * Переход на другой экран — это ссылка: её открывают средней кнопкой мыши в
 * новой вкладке, копируют адрес, видят в строке состояния. Кнопка с
 * `onClick={() => router.push(…)}` не умеет ничего из этого, а скринридер
 * объявляет её кнопкой, то есть врёт про то, что произойдёт.
 *
 * Клавиатура у роли своя, и это не дефект: кнопка срабатывает на пробел и
 * Enter, ссылка — только на Enter.
 */
export const AsLink: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} asChild variant="solid" tone="accent">
        <a href="#create">New campaign</a>
      </Button>
      <Button {...args} asChild variant="outline" icon={<AddIcon size={16} />}>
        <a href="#upload">Upload photos</a>
      </Button>
      <Button {...args} variant="soft">
        a plain button next to it
      </Button>
    </div>
  ),
};

/**
 * `loading` — отправка идёт.
 *
 * Кольцо занимает слот иконки, кнопка не нажимается, состояние объявляется
 * через `aria-busy`. Отдельный `disabled` рядом не нужен: он наступает сам.
 *
 * У кнопки без иконки слот появляется на время отправки, и подпись сдвигается —
 * поэтому кнопке, которая умеет уходить в отправку, иконку стоит дать сразу.
 */
export const Submitting: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} loading variant="solid" tone="accent" icon={<AddIcon size={16} />}>
        Saving
      </Button>
      <Button {...args} loading variant="outline" tone="danger">
        Deleting
      </Button>
      <Button {...args} loading iconOnly aria-label="Refreshing" icon={<AddIcon size={16} />} />
      <Button {...args} variant="solid" tone="accent" icon={<AddIcon size={16} />}>
        Save
      </Button>
    </div>
  ),
};

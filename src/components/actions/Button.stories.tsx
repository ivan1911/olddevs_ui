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

/** A single button with live controls. Tweak the props. */
export const Playground: Story = {
  args: { variant: "solid", tone: "accent", size: "md", disabled: false },
};

/**
 * Variant × tone matrix. This is the point of the showcase: a single button won't
 * show that `outline` in the `warning` tone loses contrast in the light theme, or
 * that `ghost` in the `neutral` tone is nearly indistinguishable from the background
 * at rest. The matrix will.
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

/** Sizes, icon and disabled state. */
/**
 * Icon only. A separate story rather than a column of the matrix: such a button has
 * a different geometry (square) and different accessibility requirements. Its name
 * comes from `aria-label`, because there is no visible label inside it.
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

      {/* The icon is an arbitrary ReactNode; the button does not resize it. */}
      <div className="flex flex-wrap items-center gap-3">
        {SIZES.map((size) => (
          <Button key={size} size={size} variant="outline" tone="neutral" icon={<span>★</span>}>
            with icon
          </Button>
        ))}
        <Button
          variant="solid"
          tone="accent"
          iconOnly
          icon={<span>★</span>}
          aria-label="Icon only"
        />
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
 * `asChild` applies the button's look to an element that is not a button.
 *
 * Navigating to another screen is a link: users open it in a new tab with the
 * middle mouse button, copy its address, and see it in the status bar. A button
 * with `onClick={() => router.push(…)}` supports none of this, and a screen reader
 * announces it as a button, so it misreports what will happen.
 *
 * The keyboard behavior is specific to the role, and that is not a defect: a button
 * activates on Space and Enter, a link only on Enter.
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
 * `loading` means a submission is in progress.
 *
 * The spinner takes the icon slot, the button can't be pressed, and the state is
 * announced through `aria-busy`. A separate `disabled` is not needed: it applies on
 * its own.
 *
 * A button without an icon gets the slot only while submitting, and its label shifts.
 * So a button that can enter the submitting state should get an icon up front.
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

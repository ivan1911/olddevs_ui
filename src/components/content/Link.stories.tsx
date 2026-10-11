import type { Meta, StoryObj } from "@storybook/react-vite";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps, type LinkVariant } from "./Link.js";
import { Text } from "./Text.js";
import type { Tone } from "../../lib/variants.js";

const meta = {
  title: "Content/Link",
  component: Link,
  parameters: { layout: "padded" },
  args: { href: "#", children: "the channel schedule" },
} satisfies Meta<LinkProps>;

export default meta;
type Story = StoryObj<LinkProps>;

const VARIANTS: LinkVariant[] = ["inline", "standalone", "quiet"];
const TONES: Tone[] = ["neutral", "accent", "success", "warning", "danger"];

export const Playground: Story = {};

/**
 * `inline` подчёркнут всегда: внутри абзаца ссылка обязана отличаться от текста
 * не только цветом — иначе для дальтоника она не отличается ничем.
 */
export const InParagraph: Story = {
  render: (args) => (
    <Text className="max-w-[420px]">
      Publishing follows <Link {...args}>the channel schedule</Link>, and exceptions are set in{" "}
      <Link {...args}>the campaign settings</Link>.
    </Text>
  ),
};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex items-center gap-4">
          <code className="text-fg-2 text-caption w-24 shrink-0">{variant}</code>
          <Link {...args} variant={variant} />
        </div>
      ))}
    </div>
  ),
};

/** Внешняя ссылка: иконка рядом с подписью. */
export const External: Story = {
  render: (args) => (
    <div className="flex flex-col items-start gap-3">
      <Link {...args} external href="https://core.telegram.org/bots/api">
        Telegram Bot API
      </Link>
      <Link {...args} external target="_blank" href="https://core.telegram.org/bots/api">
        the same thing, but in a new tab
      </Link>
    </div>
  ),
};

/**
 * Полиморфный `as`: компонент маршрутизации потребителя. Здесь заглушка с той
 * же сигнатурой, что у `next/link`, — пакет про маршрутизацию не знает.
 */
function OurLink({
  href,
  children,
  ...rest
}: { href: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a data-router-link href={href} {...rest}>
      {children}
    </a>
  );
}

export const WithRouter: Story = {
  render: (args) => (
    <Link {...args} as={OurLink} href="/schedule">
      go to the schedule
    </Link>
  ),
};

export const Matrix: Story = {
  render: (args) => (
    <div className="flex flex-col gap-5">
      {VARIANTS.map((variant) => (
        <div key={variant} className="flex flex-col gap-2">
          <code className="text-fg-2 text-caption">{variant}</code>
          <div className="flex flex-wrap items-center gap-4">
            {TONES.map((tone) => (
              <Link key={tone} {...args} variant={variant} tone={tone}>
                {tone}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

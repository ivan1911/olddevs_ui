import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
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
  // Periphery per ADR-0038: a view without behavior. The component does no syntax
  // highlighting at all.
  tags: ["periphery"],
  parameters: { layout: "padded" },
  args: { code: BODY },
} satisfies Meta<typeof CodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Plain text: the kit ships no highlighter, so without one this is simply monospaced code. */
export const Playground: Story = {};

/** A header with the file name and a copy action: the existing `CopyButton`. */
export const WithHeader: Story = {
  args: { title: "response.json", copyable: true, lineNumbers: true },
};

/**
 * Highlighted markup. This is what the consumer's highlighter returned, but `code`
 * remains the source of truth for numbering and copying.
 *
 * The colors here come from the kit's tokens, in the `strong` variant: a plain `accent` on
 * a code background fails the contrast check, and the axe audit catches it. Note that this is
 * an argument for the ADR-0039 boundary itself: the kit cannot answer for syntax colors it
 * did not choose.
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

/** A frame narrower than the line: otherwise the line fits in a wide frame, and neither scrolling nor wrapping is visible. */
const narrowFrame: Decorator = (Story) => (
  <div className="max-w-md">
    <Story />
  </div>
);

/**
 * A long line without wrapping scrolls rather than truncates: a truncated line of code
 * silently loses what it was opened for.
 */
export const LongLine: Story = {
  args: { code: LONG, title: "request.sh", copyable: true },
  decorators: [narrowFrame],
};

/** The same line in the same narrow frame, but with wrapping. */
export const Wrapped: Story = {
  args: { code: LONG, title: "request.sh", copyable: true, wrap: true },
  decorators: [narrowFrame],
};

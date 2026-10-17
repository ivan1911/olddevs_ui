import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar.js";

/**
 * Photos in the stories are data URIs, not network requests: the showcase works offline, and
 * the snapshot does not depend on a third-party host. The frame is deliberately portrait (2:3),
 * with the head and shoulders in view, so on a square circle you can see at once whether the
 * picture is fitted by `cover` or stretched.
 */
const portrait = (hue: number) =>
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="hsl(${hue} 55% 78%)"/><circle cx="100" cy="115" r="48" fill="hsl(${hue} 35% 38%)"/><path d="M10 300c0-80 40-120 90-120s90 40 90 120z" fill="hsl(${hue} 35% 38%)"/></svg>`
  );

const meta = {
  title: "Content/Avatar",
  component: Avatar,
  parameters: { layout: "centered" },
  args: { name: "Ada Lovelace" },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = { args: { size: "md" } };

// The hue is computed from the first character of the name, so the different names here start
// with different letters, and the identical one is repeated.
const MATRIX_NAMES = ["Ada Lovelace", "Grace Hopper", "Grace Hopper", "Zoe Quinn", "Mary Jackson"];

/**
 * Size × name matrix. The second column is the point of the component: the hue must differ
 * for names that start with different letters and match for identical names, because it is
 * computed from the first character.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Size</span>
          </th>
          {MATRIX_NAMES.map((n, i) => (
            <th key={i} className="text-fg-2 font-mono text-xs font-semibold">
              {n}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(["md", "lg"] as const).map((size) => (
          <tr key={size}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{size}</td>
            {MATRIX_NAMES.map((n, i) => (
              <td key={i}>
                <Avatar name={n} size={size} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Photo: Story = {
  args: { size: "lg", src: portrait(210) },
};

/** The address does not open: instead of an empty circle, initials in the same hue. */
export const PhotoLoadFailed: Story = {
  args: { size: "lg", src: "/no-such-file.png" },
};

/** Photo and initials side by side: the size and circle are identical, only the content changes. */
export const PhotoMatrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <table className="border-separate border-spacing-3">
      <thead>
        <tr>
          <th>
            <span className="sr-only">Size</span>
          </th>
          {["photo", "broken URL", "no src"].map((label) => (
            <th key={label} className="text-fg-2 font-mono text-xs font-semibold">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(["md", "lg"] as const).map((size) => (
          <tr key={size}>
            <td className="text-fg-2 pr-2 text-right font-mono text-xs">{size}</td>
            <td>
              <Avatar name="Ada Lovelace" size={size} src={portrait(210)} />
            </td>
            <td>
              <Avatar name="Ada Lovelace" size={size} src="/no-such-file.png" />
            </td>
            <td>
              <Avatar name="Ada Lovelace" size={size} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

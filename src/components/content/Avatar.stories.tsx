import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar.js";

/**
 * Фото в историях — data-URI, а не сеть: витрина работает офлайн, а снимок не
 * зависит от чужого хоста. Кадр намеренно портретный (2:3) с «головой и
 * плечами»: на квадратном кружке по нему сразу видно, вписана картинка по
 * `cover` или растянута.
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

// Оттенок считается по первому символу имени, поэтому разные имена здесь начинаются
// на разные буквы, а одинаковое — повторено.
const MATRIX_NAMES = ["Ada Lovelace", "Grace Hopper", "Grace Hopper", "Zoe Quinn", "Mary Jackson"];

/**
 * Матрица размер × имя. Второй столбец — смысл компонента: оттенок обязан
 * различаться у имён на разные буквы и совпадать у одинаковых имён: считается он
 * по первому символу.
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

/** Адрес не открывается: вместо пустого круга — инициалы на том же оттенке. */
export const PhotoLoadFailed: Story = {
  args: { size: "lg", src: "/no-such-file.png" },
};

/** Фото и инициалы рядом: размер и круг одинаковы, меняется только содержимое. */
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

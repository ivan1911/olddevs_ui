import type { Meta, StoryObj } from "@storybook/react-vite";
import { Image, type ImageProps } from "./Image.js";

/**
 * Images in the stories are data URIs, not network requests. The showcase snapshot must not
 * depend on the availability of a third-party host, or the baseline starts failing for reasons
 * unrelated to the code.
 */
const PHOTO =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8be6"/><stop offset="1" stop-color="#9a7cf6"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`
  );

const meta = {
  title: "Content/Image",
  component: Image,
  parameters: { layout: "padded" },
  args: { src: PHOTO, alt: "" },
} satisfies Meta<ImageProps>;

export default meta;
type Story = StoryObj<ImageProps>;

export const Tile: Story = {
  args: { ratio: 16 / 9, className: "w-[240px] rounded-xl" },
};

export const LoadFailed: Story = {
  args: { src: "/no-such-file.png", ratio: 16 / 9, className: "w-[240px] rounded-xl" },
};

/**
 * The image sets its own size, and the box wraps it.
 *
 * This is how the frame preview is built: it has no height of its own, only a ceiling. That
 * ceiling belongs on the image (`imgClassName`), not on the box. On the box it would crop the
 * frame instead of shrinking it.
 */
export const IntrinsicSize: Story = {
  args: {
    src: PHOTO,
    alt: "",
    sizing: "intrinsic",
    imgClassName: "max-h-[120px] max-w-full rounded-xl",
  },
};

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-fg-2 font-mono text-xs">cover</span>
        <Image src={PHOTO} alt="" ratio={1} className="w-[140px] rounded-xl" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-fg-2 font-mono text-xs">contain</span>
        <Image
          src={PHOTO}
          alt=""
          fit="contain"
          ratio={1}
          className="bg-bg-2 w-[140px] rounded-xl"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-fg-2 font-mono text-xs">failure</span>
        <Image src="" alt="" ratio={1} className="w-[140px] rounded-xl" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-fg-2 font-mono text-xs">custom fallback</span>
        <Image
          src=""
          alt=""
          ratio={1}
          fallback={<span className="text-fg-3 text-xs">No preview</span>}
          className="w-[140px] rounded-xl"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-fg-2 font-mono text-xs">circle</span>
        <Image src={PHOTO} alt="" ratio={1} className="w-[64px] rounded-full" />
      </div>
    </div>
  ),
};

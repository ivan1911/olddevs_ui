import type { Meta, StoryObj } from "@storybook/react-vite";
import { AvatarGroup } from "./AvatarGroup.js";

/** Wave 10: data. A lighter quality bar, no snapshots. */
const meta = {
  title: "Content/AvatarGroup",
  component: AvatarGroup,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<typeof AvatarGroup>;

export default meta;
type Story = StoryObj;

export const Avatars: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <AvatarGroup names={["Ada Lovelace", "Grace Hopper"]} />
      <AvatarGroup
        names={["Ada Lovelace", "Grace Hopper", "Alan Turing", "Barbara Liskov", "Edsger Dijkstra"]}
      />
      <AvatarGroup names={["Ada Lovelace", "Grace Hopper", "Alan Turing"]} size="lg" max={2} />
    </div>
  ),
};

/**
 * Photos for the stacks are data URIs: the showcase works offline, and the snapshot does not
 * depend on a third-party host. The frame is portrait (2:3), so fitting by `cover` is visible.
 */
const photo = (hue: number) =>
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="hsl(${hue} 55% 78%)"/><circle cx="100" cy="115" r="48" fill="hsl(${hue} 35% 38%)"/><path d="M10 300c0-80 40-120 90-120s90 40 90 120z" fill="hsl(${hue} 35% 38%)"/></svg>`
  );

/** A stack with photos: a mixed set, a broken address (initials), and the "+N" overflow. */
export const AvatarsWithPhotos: Story = {
  render: () => {
    return (
      <div className="flex flex-col gap-4">
        <AvatarGroup
          names={[
            { name: "Ada Lovelace", src: photo(210) },
            { name: "Grace Hopper", src: photo(20) },
            "Alan Turing",
          ]}
        />
        <AvatarGroup
          names={[
            { name: "Ada Lovelace", src: photo(210) },
            { name: "Grace Hopper", src: "/no-such-file.png" },
            { name: "Alan Turing", src: photo(140) },
            { name: "Barbara Liskov", src: photo(300) },
            "Edsger Dijkstra",
          ]}
        />
        <AvatarGroup
          size="lg"
          max={2}
          names={[
            { name: "Ada Lovelace", src: photo(210) },
            { name: "Grace Hopper", src: photo(20) },
            { name: "Alan Turing", src: photo(140) },
          ]}
        />
      </div>
    );
  },
};

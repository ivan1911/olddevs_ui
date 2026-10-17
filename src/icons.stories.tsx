import type { Meta, StoryObj } from "@storybook/react-vite";
import * as icons from "./icons.js";

// The entry point also exports `LucideProvider` (ADR-0072); the grid shows only dictionary icons.
const { LucideProvider, ...dictionary } = icons;

/**
 * Showcase of the icon dictionary. Its main job is not to look pretty but to give
 * a place where the lucide geometry can be checked by eye before it drifts across
 * the consumer's fifty-odd screens.
 */
const meta = {
  title: "Foundations/Icons",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const ENTRIES = Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b, "ru"));

function Grid({ size = 22, strokeWidth }: { size?: number; strokeWidth?: number }) {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
      {ENTRIES.map(([name, Icon]) => (
        <li
          key={name}
          className="border-line-soft text-fg-1 rounded-control flex flex-col items-center gap-2 border p-3"
        >
          <Icon size={size} strokeWidth={strokeWidth} aria-hidden />
          <code className="text-fg-2 text-center text-[11px] break-all">{name}</code>
        </li>
      ))}
    </ul>
  );
}

/**
 * The whole dictionary, with names. The name under each icon is the one the consumer
 * imports it by: `import { DeleteIcon } from "@olddevs/ui/icons"`.
 */
export const Catalog: Story = {
  render: () => <Grid />,
};

/**
 * The consumer sets the stroke width through `LucideProvider`, and all icons inherit it
 * at once. Three values side by side here: 1.6 is what the in-house set used and what
 * the front end sets by default; 2 is the lucide default.
 */
export const StrokeWidth: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {[1.25, 1.6, 2].map((w) => (
        <section key={w}>
          <h3 className="text-fg-2 mb-2 font-mono text-xs">strokeWidth={w}</h3>
          <LucideProvider strokeWidth={w}>
            <div className="text-fg-1 flex flex-wrap gap-4">
              <icons.DeleteIcon size={24} aria-hidden />
              <icons.EditIcon size={24} aria-hidden />
              <icons.CloseIcon size={24} aria-hidden />
              <icons.CheckIcon size={24} aria-hidden />
              <icons.SearchIcon size={24} aria-hidden />
              <icons.AiIcon size={24} aria-hidden />
              <icons.CalendarIcon size={24} aria-hidden />
              <icons.SettingsIcon size={24} aria-hidden />
            </div>
          </LucideProvider>
        </section>
      ))}
    </div>
  ),
};

/**
 * The size ladder the front end actually uses: 14 in small badges, 18 in buttons,
 * 20 in triggers, 28 in lists.
 *
 * 20, not 22: the control's line box is set by `leading-5`, and anything placed in a
 * trigger's line has to fit inside it. Otherwise the trigger grows and its height
 * drifts away from the neighboring field.
 */
export const Sizes: Story = {
  render: () => (
    <div className="text-fg-1 flex items-end gap-6">
      {[14, 18, 20, 28].map((s) => (
        <div key={s} className="flex flex-col items-center gap-2">
          <icons.LibraryIcon size={s} aria-hidden />
          <code className="text-fg-2 text-[11px]">{s}px</code>
        </div>
      ))}
    </div>
  ),
};

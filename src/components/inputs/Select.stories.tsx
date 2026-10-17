import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FilterIcon } from "../../icons.js";
import { Select, type SelectItem, type SelectProps } from "./Select.js";

interface Topic extends SelectItem {
  hue: number;
}

const ITEMS: Topic[] = [
  { id: 1, label: "Nature", keywords: "nature forest mountains", meta: 214, hue: 140 },
  { id: 2, label: "Space", keywords: "space stars", meta: 87, hue: 260 },
  { id: 3, label: "Cities", keywords: "city urban", meta: 132, hue: 30 },
  { id: 4, label: "Anime", keywords: "anime", meta: 341, hue: 330 },
  { id: 5, label: "Minimal", keywords: "minimal", meta: 56, hue: 200 },
];

/** Image stub: a colored square instead of a preview, since the showcase makes no network requests. */
const square = (item: Topic, px: number) => (
  <span
    aria-hidden
    className="inline-flex shrink-0 items-center justify-center rounded-xs text-xs"
    style={{
      width: px,
      height: px,
      background: `oklch(0.32 0.05 ${item.hue})`,
      border: `1px solid oklch(0.5 0.09 ${item.hue})`,
    }}
  />
);

/**
 * The showcase's arguments are typed with a single branch of the union: for `SelectProps`
 * the shape depends on `multiple`, and Storybook cannot infer `args` from the union, so
 * `render(args)` would get `any`. Multiple selection is shown by separate stories that
 * add `multiple` to the shared arguments explicitly.
 */
type SingleSelect = Extract<SelectProps<Topic>, { multiple?: false }>;

const meta = {
  title: "Inputs/Select",
  component: Select,
  parameters: { layout: "padded" },
  args: {
    items: ITEMS,
    placeholder: "Category",
    searchPlaceholder: "Find a category…",
    emptyText: "No categories",
    onChange: () => {},
  },
} satisfies Meta<SingleSelect>;

export default meta;
type Story = StoryObj<SingleSelect>;

/** Live example: the state is real, and the clear button empties it. */
export const Playground: Story = {
  render: (args) => {
    const [value, setValue] = useState<string | number | null>(null);
    return (
      <div className="h-[360px]">
        <Select {...args} searchable value={value} onChange={setValue} renderMedia={square} />
      </div>
    );
  },
};

/** Live multiple selection: the panel stays open, and the clear button removes the whole set. */
export const PlaygroundMultiple: Story = {
  render: (args) => {
    const [value, setValue] = useState<(string | number)[]>([]);
    return (
      <div className="h-[360px]">
        <Select
          {...args}
          searchable
          multiple
          value={value}
          onChange={setValue}
          countLabel={(n) => `Categories: ${n}`}
          renderMedia={square}
        />
      </div>
    );
  },
};

/**
 * Matrix of the trigger's states. The open list is not included here: it lives in a portal
 * over the page, and two open lists would overlap each other, just as `Popover` and
 * `ModalOverlay` do. The expanded state is captured by the separate stories below.
 */
export const Matrix: Story = {
  render: (args) => (
    <table className="border-separate border-spacing-3">
      <tbody>
        {(
          [
            ["nothing selected", null, true],
            ["selected", 2, true],
            ["selected, no clear", 4, false],
            ["no images", 1, true],
            ["custom icon", null, true],
          ] as const
        ).map(([label, value, clearable], i) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <Select
                {...args}
                value={value}
                clearable={clearable}
                renderMedia={i === 3 ? undefined : square}
                // By default the icon comes from the design system's dictionary;
                // the last row shows that the consumer can replace it.
                icon={i === 4 ? <FilterIcon size={14} /> : undefined}
              />
            </td>
          </tr>
        ))}
        {(
          [
            ["multiple: empty", [] as (string | number)[]],
            ["multiple: one", [2]],
            ["multiple: three", [1, 2, 4]],
          ] as const
        ).map(([label, value]) => (
          <tr key={label}>
            <td className="text-fg-2 pr-2 text-right align-middle font-mono text-xs">{label}</td>
            <td>
              <Select
                {...args}
                multiple
                value={[...value]}
                onChange={() => {}}
                countLabel={(n) => `Categories: ${n}`}
                renderMedia={square}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

/**
 * The consumer's classes on the trigger. This is a separate story because this is exactly
 * where a regression already happened: `triggerClassName` moved onto the wrapper, the paddings
 * doubled, and the control grew from 36 to 56 pixels. The classes are copied verbatim from
 * the call in the frontend, not made up; otherwise the snapshot guards the wrong thing.
 */
export const WithConsumerClasses: Story = {
  render: (args) => (
    <div className="flex w-[520px] flex-col gap-4">
      <Select
        {...args}
        value={null}
        renderMedia={square}
        triggerClassName="w-full justify-between rounded-control px-3 py-2.5 lg:w-auto lg:min-w-[220px]"
      />
      <Select
        {...args}
        value={2}
        renderMedia={square}
        triggerClassName="w-full justify-between rounded-control px-3 py-2.5 lg:w-auto lg:min-w-[220px]"
      />
    </div>
  ),
};

/**
 * Form appearance: `highlightSelected={false}`.
 *
 * The accent highlight of the selected value means "filter applied": in the filter panel
 * people look for it with their eyes, scanning the row. In a form the same thing would mean
 * "field filled in", which is the norm, not an event: next to ordinary fields an accent pill
 * reads as an alarm on an empty spot.
 */
export const FormAppearance: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col gap-3">
      <Select
        {...args}
        value={null}
        highlightSelected={false}
        triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
      />
      <Select
        {...args}
        value={2}
        highlightSelected={false}
        renderMedia={square}
        triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
      />
      {/* For comparison: the same value with the highlight, as in the filters. */}
      <Select {...args} value={2} renderMedia={square} />
    </div>
  ),
};

/**
 * A disabled field, next to a working one so that the difference is visible.
 *
 * The whole pill is dimmed, not just the label inside it, and the clear button disappears:
 * a field that cannot be changed cannot be cleared either. The consumer dims the form while
 * a request is in flight, and a `Select` left alive among its dimmed neighbors would read
 * as unfinished work.
 */
export const Disabled: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col gap-3">
      <Select
        {...args}
        value={2}
        disabled
        highlightSelected={false}
        renderMedia={square}
        aria-label="Category"
        triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
      />
      <Select
        {...args}
        value={2}
        highlightSelected={false}
        renderMedia={square}
        aria-label="Category"
        triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
      />
      {/* The same pair as a filter pill. */}
      <div className="flex items-start gap-2">
        <Select {...args} value={null} disabled />
        <Select {...args} value={null} />
      </div>
    </div>
  ),
};

/**
 * A long label in a narrow pill and in a wide trigger.
 *
 * The top one is the default: the label is cut at 110px, otherwise one long name would push
 * the neighboring filters in the row apart. The bottom one is the same element in a form field,
 * where the limit is lifted by the `[--select-label-max:none]` class: there is room,
 * so there is no reason to cut the label there.
 */
export const LongLabel: Story = {
  render: (args) => {
    const long = [{ id: 9, label: "Abstract gradients and textures", hue: 280 }];
    return (
      <div className="flex w-[320px] flex-col items-start gap-3">
        <Select {...args} items={long} value={9} renderMedia={square} />
        <Select
          {...args}
          items={long}
          value={9}
          highlightSelected={false}
          renderMedia={square}
          triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5 [--select-label-max:none]"
        />
      </div>
    );
  },
};

/**
 * A label that is not among the items, and the multiple selection counter.
 *
 * Both branches of the label are cut at the same limit as the selected value. Before, the limit
 * applied only to the selected value: a pill with "This project has been deleted" took
 * 170 pixels against 120 for an ordinary one, and one such pill was enough to push the filter
 * panel onto a second row.
 */
export const MissingAndCountLabels: Story = {
  render: (args) => (
    <div className="flex w-[320px] flex-col items-start gap-3">
      <Select
        {...args}
        value={404}
        missingLabel={() => "This project has been deleted"}
        renderMedia={undefined}
      />
      <Select
        {...args}
        multiple
        value={[1, 2, 3]}
        onChange={() => {}}
        countLabel={(count) => `Topics chosen in this filter: ${count}`}
        renderMedia={undefined}
      />
    </div>
  ),
};

/** An expanded list with search: pictures, counters on the right, a mark on the selected item. */
export const Open: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Select {...args} searchable value={2} open renderMedia={square} />
    </div>
  ),
};

/**
 * An expanded list without search: this is the same axis for which the frontend once kept
 * two hand-written dropdowns. Three statuses are not worth searching.
 */
export const OpenWithoutSearch: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Select {...args} value={2} open renderMedia={square} />
    </div>
  ),
};

/** An expanded multiple selection: several options are checked at once. */
export const OpenMultiple: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Select
        {...args}
        multiple
        value={[1, 2, 4]}
        onChange={() => {}}
        countLabel={(n) => `Categories: ${n}`}
        open
        renderMedia={square}
      />
    </div>
  ),
};

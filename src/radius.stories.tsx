import type { Meta, StoryObj } from "@storybook/react-vite";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./components/actions/Button.js";
import { Chip } from "./components/actions/Chip.js";
import { Progress } from "./components/actions/Progress.js";
import { StatusBadge } from "./components/actions/StatusBadge.js";
import { Toggle } from "./components/actions/Toggle.js";
import { Badge } from "./components/content/Badge.js";
import { Card } from "./components/content/Card.js";
import { Checkbox } from "./components/inputs/Checkbox.js";
import { FormField } from "./components/inputs/FormField.js";
import { Radio, RadioGroup } from "./components/inputs/RadioGroup.js";
import { Select, type SelectId } from "./components/inputs/Select.js";
import { TextControl } from "./components/inputs/TextControl.js";
import type { UiRadius } from "./lib/themes.js";

const meta = {
  title: "Foundations/Radius",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/*
 * Presets in the order of the scale, not the order of `UI_RADII` (where the default
 * leads): the table reads from the sharpest corner to the roundest one. Typed as
 * `UiRadius`, so a name that left the registry fails the type check here.
 */
const PRESETS: readonly UiRadius[] = ["none", "small", "medium", "large"];

/*
 * The step classes are written out in full, on purpose: Tailwind generates a
 * utility only when it finds its name in the source (see `motion.stories.tsx`).
 * `rounded-2xs` has no other user than the checkbox, and the swatch row must not
 * depend on that.
 */
const STEPS = [
  { name: "2xs", className: "rounded-2xs" },
  { name: "xs", className: "rounded-xs" },
  { name: "sm", className: "rounded-sm" },
  { name: "control", className: "rounded-control" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "pill", className: "rounded-pill" },
] as const;

const CATEGORIES = [
  { id: "nature", label: "Nature" },
  { id: "city", label: "City" },
  { id: "abstract", label: "Abstract" },
];

/**
 * One swatch with a label that is read back from the browser. The px value is the
 * computed one, so the label cannot drift from the CSS: if a preset block in
 * `styles.css` changes, the table changes with it and no second list needs editing.
 */
function Swatch({ name, className }: { name: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState("");

  useLayoutEffect(() => {
    if (ref.current) setPx(getComputedStyle(ref.current).borderTopLeftRadius);
  }, []);

  return (
    <div className="flex w-[84px] flex-col items-start gap-1.5">
      <div
        ref={ref}
        className={`border-line bg-bg-2 h-14 w-full border-2 ${className}`}
        aria-hidden="true"
      />
      <div>
        <div className="text-fg-1 font-mono text-[13px]">{name}</div>
        <div className="text-fg-3 text-caption">{px}</div>
      </div>
    </div>
  );
}

/**
 * The scale: eight steps for each of the four presets. Every row sits in its own
 * `data-radius` wrapper, so all four are visible at once whatever the toolbar says.
 *
 * `pill` is a role rather than a size: a full pill in `medium` and `large`, a plain
 * `sm` corner in `small`, a square in `none`. Circles (`rounded-full`: avatar,
 * spinner, radio) are not on the axis and are not drawn here.
 */
export const Scale: Story = {
  render: () => (
    <div className="flex max-w-[860px] flex-col gap-6">
      {PRESETS.map((preset) => (
        <section key={preset} data-radius={preset} className="flex flex-col gap-2">
          <h3 className="text-fg-1 font-mono text-[13px]">
            data-radius=&quot;{preset}&quot;
            {preset === "medium" ? " (default)" : ""}
          </h3>
          <div className="flex flex-wrap gap-4">
            {STEPS.map((step) => (
              <Swatch key={step.name} {...step} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

/** The same small form in each preset: only the wrapper's attribute differs. */
function PresetSample({ preset }: { preset: UiRadius }) {
  const id = useId();
  const [category, setCategory] = useState<SelectId | null>("nature");
  const [mode, setMode] = useState("now");
  const [notify, setNotify] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [filter, setFilter] = useState(true);

  return (
    <section data-radius={preset} className="flex min-w-0 flex-col gap-3">
      <h3 className="text-fg-1 font-mono text-[13px]">
        {preset}
        {preset === "medium" ? " (default)" : ""}
      </h3>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="solid" tone="accent">
            Publish
          </Button>
          <Button variant="outline">Save draft</Button>
        </div>
        <FormField label="Album name" htmlFor={`${id}-name`}>
          <TextControl id={`${id}-name`} defaultValue="Summer trip" shellClassName="w-full" />
        </FormField>
        <Select
          aria-label="Category"
          items={CATEGORIES}
          value={category}
          onChange={setCategory}
          placeholder="Category"
          highlightSelected={false}
          triggerClassName="w-full px-3 py-2.5 [--select-label-max:none]"
        />
        <Checkbox checked={pinned} onCheckedChange={setPinned}>
          Pin the album
        </Checkbox>
        <RadioGroup label="When to publish" value={mode} onChange={setMode}>
          <Radio value="now">Right away</Radio>
          <Radio value="later">On schedule</Radio>
        </RadioGroup>
        <Toggle label="Send a report" checked={notify} onCheckedChange={setNotify} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">12</Badge>
          <StatusBadge tone="success">Published</StatusBadge>
          <StatusBadge tone="warning">Draft</StatusBadge>
          <Chip selected={filter} tone="accent" onClick={() => setFilter((v) => !v)}>
            Photos
          </Chip>
        </div>
        <Progress value={72} label="Daily publishing limit" showValue />
      </Card>
    </section>
  );
}

/**
 * The four presets side by side, each a realistic composition of kit components.
 * This is the story to look at when judging how a preset feels as a whole: the
 * corners of the card, the controls inside it and the pills have to read as one
 * shape, not as three unrelated radii.
 */
export const Presets: Story = {
  render: () => (
    <div className="grid max-w-[1280px] grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {PRESETS.map((preset) => (
        <PresetSample key={preset} preset={preset} />
      ))}
    </div>
  ),
};

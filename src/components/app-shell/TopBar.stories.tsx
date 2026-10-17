import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  BellIcon,
  SettingsIcon,
  ThemeAutoIcon,
  ThemeDarkIcon,
  ThemeLightIcon,
} from "../../icons.js";
import { UI_THEMES, type UiTheme } from "../../lib/themes.js";
import { Avatar } from "../content/Avatar.js";
import { Button } from "../actions/Button.js";
import { SearchControl } from "../inputs/SearchControl.js";
import { SelectionBar } from "../navigation/SelectionBar.js";
import { Tooltip, TooltipProvider } from "../overlays/Tooltip.js";
import { TopBar } from "./TopBar.js";

const meta = {
  title: "App shell/TopBar",
  component: TopBar,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TopBar>;

export default meta;
type Story = StoryObj<typeof meta>;

const Brand = () => (
  <div className="flex items-center gap-2.5">
    <div className="bg-accent-strong size-7 shrink-0 rounded-lg" />
    <span className="text-sm font-bold tracking-tight">Olddevs</span>
  </div>
);

const Actions = () => (
  <>
    <Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />
    <Button variant="ghost" iconOnly icon={<SettingsIcon />} aria-label="Settings" />
    <Avatar name="AL" />
  </>
);

/** All three slots: brand, search, and actions. */
export const Playground: Story = {
  args: {
    brand: <Brand />,
    search: (
      <SearchControl
        label="Search this section"
        value=""
        onChange={() => {}}
        placeholder="Search…"
        shellClassName="md:max-w-[460px]"
      />
    ),
    actions: <Actions />,
  },
};

/** Only the brand and actions: a header without search. */
export const WithoutSearch: Story = {
  args: { brand: <Brand />, actions: <Actions /> },
};

/**
 * The full height contract, and exactly what [ADR-0019] was written for.
 *
 * Before 2.1.0 this story's "app" drew its own bar and published its height itself. Here the
 * bar is the kit's `TopBar`, and the kit publishes the variable. The bulk-action bar reads it
 * and sits flush against it, **without a single line of code on the consumer's side**.
 *
 * Verified in a real browser: `tests-visual/interactions.spec.ts`. There is nothing to verify
 * in jsdom: it has no scrolling, no `position: sticky`, and no working `IntersectionObserver`.
 */
export const WithStickyBar: Story = {
  args: { brand: <Brand />, actions: <Actions /> },
  render: (args) => (
    <div className="min-h-[1500px]">
      <TopBar {...args} />
      <div className="px-4 pt-4">
        <SelectionBar count={12} onClear={() => {}}>
          <Button size="sm" variant="outline">
            Start work
          </Button>
        </SelectionBar>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="border-line-soft bg-bg-2 text-fg-2 rounded-lg border px-3.5 py-3 text-[13px]"
            >
              List row {i + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  ),
};

/**
 * The theme switcher comes from the recipe in `docs/theming.md`, not from the kit. The package
 * has no switcher component and never will (ADR-0020). Here it sits in the header's actions
 * slot, because that is where it normally goes.
 *
 * ONE DEVIATION FROM THE RECIPE, and it is forced. The real switcher calls `applyTheme` and
 * writes to `localStorage`, but in the showcase the Storybook toolbar owns the theme: the
 * decorator sets `data-theme` on every render and would immediately override what was applied.
 * So only local state is used here. The story shows the look and the accessible name, and
 * the working plumbing is in the recipe.
 *
 * What is actually verified: the label names both the current state and the next step. A button
 * without state is exactly the defect this requirement was written to prevent.
 */
const THEMES = {
  dark: { name: "dark", target: "dark", icon: <ThemeDarkIcon /> },
  light: { name: "light", target: "light", icon: <ThemeLightIcon /> },
  dim: { name: "dim", target: "dim", icon: <ThemeAutoIcon /> },
} satisfies Record<UiTheme, { name: string; target: string; icon: React.ReactNode }>;

function ThemeCycleButton() {
  const [theme, setTheme] = useState<UiTheme>("dark");
  const next = UI_THEMES[(UI_THEMES.indexOf(theme) + 1) % UI_THEMES.length]!;
  const label = `Theme: ${THEMES[theme].name}. Switch to ${THEMES[next].target}`;

  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        iconOnly
        icon={THEMES[theme].icon}
        aria-label={label}
        onClick={() => setTheme(next)}
      />
    </Tooltip>
  );
}

export const WithThemeSwitcher: Story = {
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
  args: {
    brand: <Brand />,
    actions: (
      <>
        <ThemeCycleButton />
        <Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />
        <Avatar name="AL" />
      </>
    ),
  },
};

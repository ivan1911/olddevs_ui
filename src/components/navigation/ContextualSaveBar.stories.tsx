import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { DashboardIcon, FolderIcon, SettingsIcon } from "../../icons.js";
import { AppShell } from "../app-shell/AppShell.js";
import { MobileTabBar, MobileTabBarItem } from "../app-shell/MobileTabBar.js";
import { ContextualSaveBar, type ContextualSaveBarProps } from "./ContextualSaveBar.js";
import { FormField } from "../inputs/FormField.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Navigation/ContextualSaveBar",
  component: ContextualSaveBar,
  args: {
    visible: true,
    onSave: () => {},
    onCancel: () => {},
  },
} satisfies Meta<ContextualSaveBarProps>;

export default meta;
type Story = StoryObj<ContextualSaveBarProps>;

export const Playground: Story = {};

/** The edit count is shown when the consumer computes it. */
export const WithCount: Story = {
  args: { count: 3 },
};

/** Saving in progress: the button is busy, the Cancel button is disabled, and the state is announced. */
export const Saving: Story = {
  args: { count: 3, saving: true },
};

/** A failed save is shown in the bar itself, not only in a toast. */
export const SaveFailed: Story = {
  args: { count: 3, error: "The server did not answer. Try again." },
};

/**
 * The bar in use: it appears with the first edit and disappears with it.
 *
 * What counts as an edit is the consumer's decision; here it is any difference from the original
 * value.
 *
 * The scroll area is EXPLICIT here, and this is not decoration for the story. The bar sticks to
 * the bottom of the nearest scroll area: the window, or an ancestor with `overflow`. In the
 * showcase the window cannot be used: the showcase's `body` has `overflow: auto` and becomes such
 * an area itself, without actually scrolling. In a real application both cases work: the window,
 * if the page scrolls, and a container, if only the work area scrolls, as in most admin panels.
 */
export const InForm: Story = {
  render: () => {
    const initial = "Sales team";
    const [value, setValue] = useState(initial);
    const [saved, setSaved] = useState(initial);
    const dirty = value !== saved;

    return (
      <div className="border-line h-[420px] overflow-auto rounded-[14px] border p-6">
        <div className="flex flex-col gap-4">
          <FormField label="Group name" hint="Visible to every member" htmlFor="csb-group">
            <TextControl
              id="csb-group"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </FormField>

          <p className="text-fg-2 text-[13px]">
            Scroll the area: the bar stays at its bottom edge until the edit is saved.
          </p>

          <div className="bg-bg-2 h-[600px] rounded-[10px]" aria-hidden />

          <ContextualSaveBar
            visible={dirty}
            count={dirty ? 1 : 0}
            onSave={() => setSaved(value)}
            onCancel={() => setValue(saved)}
          />
        </div>
      </div>
    );
  },
};

/**
 * Above the phone's bottom bar. `AppShell` publishes the height of the `bottomBar` slot in
 * `--bottombar-h`, and the bar sticks that far above the window edge instead of sliding under
 * `MobileTabBar`. Narrow the window below 768px: on a wide screen there is no bar, the variable
 * is zero, and the bar sits at the very bottom.
 *
 * The scroll area is explicit for the same reason as in `InForm`.
 */
export const AboveBottomBar: Story = {
  tags: ["viewport-phone"],
  render: () => {
    const [value, setValue] = useState("Sales team");
    const [saved, setSaved] = useState("Sales team");
    const dirty = value !== saved;

    return (
      <div className="h-[560px] overflow-auto">
        <AppShell
          className="min-h-full"
          bottomBar={
            <MobileTabBar>
              <MobileTabBarItem
                label="Dashboard"
                icon={<DashboardIcon size={20} />}
                href="#home"
                active
              />
              <MobileTabBarItem label="Documents" icon={<FolderIcon size={20} />} href="#docs" />
              <MobileTabBarItem
                label="Settings"
                icon={<SettingsIcon size={20} />}
                href="#settings"
              />
            </MobileTabBar>
          }
        >
          <div className="flex flex-col gap-4 p-4">
            <FormField label="Group name" htmlFor="csb-bottom-group">
              <TextControl
                id="csb-bottom-group"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </FormField>
            <div className="bg-bg-2 h-[640px] rounded-[10px]" aria-hidden />
            <ContextualSaveBar
              visible={dirty}
              count={dirty ? 1 : 0}
              onSave={() => setSaved(value)}
              onCancel={() => setValue(saved)}
            />
          </div>
        </AppShell>
      </div>
    );
  },
};

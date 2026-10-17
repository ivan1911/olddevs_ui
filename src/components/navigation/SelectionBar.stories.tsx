import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import {
  CalendarIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  SearchIcon,
} from "../../icons.js";
import { Button } from "../actions/Button.js";
import { SelectionBar, type SelectionBarProps } from "./SelectionBar.js";

const meta = {
  title: "Navigation/SelectionBar",
  component: SelectionBar,
  parameters: { layout: "padded" },
  args: { count: 12, sticky: false },
} satisfies Meta<SelectionBarProps>;

export default meta;
type Story = StoryObj<SelectionBarProps>;

const actions = (
  <>
    <Button size="sm" icon={<CalendarIcon />}>
      To the schedule
    </Button>
    <Button size="sm" icon={<EditIcon />}>
      Change category
    </Button>
    <Button size="sm" variant="outline" tone="danger" icon={<DeleteIcon />}>
      Delete
    </Button>
  </>
);

export const Playground: Story = {
  args: { onClear: () => {}, children: actions },
};

/** The right edge is a separate slot: it has its own side of the spacer and its own behavior on a narrow screen. */
export const WithSelectAll: Story = {
  args: {
    onClear: () => {},
    children: actions,
    secondary: (
      <button type="button" className="text-accent-strong cursor-pointer text-xs font-semibold">
        Select all (3521)
      </button>
    ),
  },
};

/** A custom count label: the domain nouns need declension, and the package does not know about it. */
export const CustomLabel: Story = {
  args: {
    count: 3,
    onClear: () => {},
    countLabel: (n) => `${n} photos selected`,
    children: (
      <Button size="sm" variant="outline" tone="danger" icon={<DeleteIcon />}>
        Delete
      </Button>
    ),
  },
};

/**
 * Six actions in an 830 px column: the width of an admin panel's content at a window of about
 * 1145 px. The actions do not fit on one line with the counter, so they wrap as whole buttons:
 * labels do not break, and icons do not shrink.
 */
export const ManyActions: Story = {
  args: {
    onClear: () => {},
    children: (
      <>
        <Button size="sm" icon={<CalendarIcon />}>
          To the schedule
        </Button>
        <Button size="sm" icon={<EditIcon />}>
          Change category
        </Button>
        <Button size="sm" icon={<FolderIcon />}>
          To a collection
        </Button>
        <Button size="sm" icon={<SearchIcon />}>
          Find similar
        </Button>
        <Button size="sm" icon={<CopyIcon />}>
          Duplicate
        </Button>
        <Button size="sm" variant="outline" tone="danger" icon={<DeleteIcon />}>
          Delete
        </Button>
      </>
    ),
    secondary: (
      <button type="button" className="text-accent-strong cursor-pointer text-xs font-semibold">
        Select all (12 of 3521)
      </button>
    ),
  },
  render: (args) => (
    <div style={{ width: 830 }}>
      <SelectionBar {...args} />
    </div>
  ),
};

/**
 * With zero, the bar is not rendered at all: that is its own rule, not a concern of the caller.
 *
 * The caption next to it is not there for looks: the axe audit expects a non-empty story canvas,
 * and a story made of a single `null` does not provide one and fails the run by timeout.
 */
export const Empty: Story = {
  args: { count: 0, children: actions },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <span className="text-fg-3 text-xs">Nothing selected — no bar:</span>
      <SelectionBar {...args} />
    </div>
  ),
};

/**
 * Stickiness: the bar sticks under the app's top bar and loses its rounded top corners where it
 * meets that bar.
 *
 * The story reproduces the whole contract: the "app" draws its own bar and publishes its real
 * height in `--topbar-h`, and the bar reads that variable. A hard-coded number does not work here:
 * on narrow screens the top bar is shorter, and a gap remains through which the scrolling content
 * shows ([ADR-0016]).
 *
 * It is checked in a real browser: `tests-visual/interactions.spec.ts`.
 * There is nothing to check in jsdom: it has no scrolling, no `position: sticky`,
 * and no working `IntersectionObserver`.
 */
function StickyDemo() {
  useEffect(() => {
    // The app's `TopBar` does the same: it publishes the measured height.
    document.documentElement.style.setProperty("--topbar-h", `${TOPBAR_HEIGHT}px`);
    return () => {
      document.documentElement.style.removeProperty("--topbar-h");
    };
  }, []);

  return (
    <div className="min-h-[1500px]">
      <div
        className="border-line-soft bg-bg-1 text-fg-2 fixed inset-x-0 top-0 z-30 flex items-center border-b px-4 text-[13px] font-semibold"
        style={{ height: TOPBAR_HEIGHT }}
      >
        An application bar — the consumer publishes its height
      </div>

      <div className="px-4" style={{ paddingTop: TOPBAR_HEIGHT + 16 }}>
        <SelectionBar count={12} onClear={() => {}}>
          {actions}
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
  );
}

const TOPBAR_HEIGHT = 56;

export const Sticky: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <StickyDemo />,
};

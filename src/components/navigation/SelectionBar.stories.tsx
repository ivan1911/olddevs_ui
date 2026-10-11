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

/** Правый край — отдельный слот: у него своя сторона распорки и своё поведение на узком экране. */
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

/** Своя подпись счётчика: предметные единицы требуют склонения, а пакет о нём не знает. */
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
 * Шесть действий в колонке 830 px — ширина содержимого админки при окне около
 * 1145 px. Действия не влезают в одну строку с счётчиком и
 * переносятся целыми кнопками: подписи не ломаются, иконки не сжимаются.
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
 * При нуле полосы нет вовсе — это её собственное правило, а не забота
 * вызывающего.
 *
 * Рядом стоит подпись, и она здесь не для красоты: аудит axe ждёт непустой
 * канвас истории, а история из одного `null` его не даёт и роняет прогон
 * по таймауту.
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
 * Липкость: полоса прижимается под верхнюю панель приложения и теряет верхние
 * скругления, коснувшись её.
 *
 * История воспроизводит контракт целиком: «приложение» рисует свою панель и
 * публикует её настоящую высоту в `--topbar-h`, а полоса эту переменную
 * читает. Зашитое число здесь не годится — на узких экранах панель ниже, и
 * остаётся просвет, сквозь который видно уезжающий контент ([ADR-0016]).
 *
 * Проверяется в настоящем браузере: `tests-visual/interactions.spec.ts`.
 * В jsdom проверить нечего — там нет ни прокрутки, ни `position: sticky`,
 * ни работающего `IntersectionObserver`.
 */
function StickyDemo() {
  useEffect(() => {
    // Так же это делает `TopBar` приложения: публикует измеренную высоту.
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

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

/** Все три слота: бренд, поиск, действия. */
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

/** Только бренд и действия — шапка без поиска. */
export const WithoutSearch: Story = {
  args: { brand: <Brand />, actions: <Actions /> },
};

/**
 * Контракт высоты целиком — и ровно то, ради чего написан [ADR-0019].
 *
 * До 2.1.0 в этой истории «приложение» рисовало свою панель и публиковало её
 * высоту само; здесь панель — `TopBar` кита, и переменную публикует он.
 * Полоса массовых действий её читает и встаёт вплотную, **без единой строки
 * кода у потребителя**.
 *
 * Проверяется в настоящем браузере: `tests-visual/interactions.spec.ts`. В
 * jsdom проверять нечего — там нет ни прокрутки, ни `position: sticky`, ни
 * работающего `IntersectionObserver`.
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
 * Переключатель темы — из рецепта `docs/theming.md`, а не из кита: компонента
 * переключателя в пакете нет и не будет (ADR-0020). Здесь он стоит в слоте
 * действий шапки, потому что это его обычное место.
 *
 * ОДНО ОТСТУПЛЕНИЕ ОТ РЕЦЕПТА, и оно вынужденное: настоящий переключатель
 * зовёт `applyTheme` и пишет в `localStorage`, а в витрине темой владеет
 * тулбар — декоратор выставляет `data-theme` при каждой отрисовке и тут же
 * перебил бы применённое. Поэтому здесь только локальное состояние: история
 * показывает вид и доступное имя, а рабочую обвязку — рецепт.
 *
 * Что проверяется по-настоящему: подпись называет и текущее состояние, и
 * следующий шаг. Кнопка без состояния — ровно тот дефект, ради которого
 * требование записано.
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

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SettingsIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { TablePreferences } from "./TablePreferences.js";
import { TableToolbar } from "./TableToolbar.js";
import type { Density } from "../../lib/variants.js";

const meta = {
  title: "Table/TableToolbar",
  component: TableToolbar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof TableToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const COLUMNS = [
  { id: "name", label: "Name", required: true },
  { id: "section", label: "Section" },
  { id: "updated", label: "Updated" },
];

/** Заголовок, счётчик и действия. Счётчик склоняется каталогом по локали. */
export const Playground: Story = {
  args: {
    title: "Documents",
    count: 12,
    actions: (
      <Button size="sm" tone="accent">
        Upload
      </Button>
    ),
  },
};

/** Только счётчик — полоса не требует ни заголовка, ни действий. */
export const CountOnly: Story = { args: { count: 0 } };

/**
 * Шестерёнка с настройками. `TablePreferences` — панель, а не меню: пункт меню
 * не контейнер для кнопок, и вложенные в него кнопки порядка сломали бы
 * клавиатурную семантику меню. Оболочку выбирает потребитель — здесь `Popover`.
 */
export const WithPreferences: Story = {
  args: { title: "Documents", count: 12 },
  render: function PreferencesSlot(args) {
    const [hidden, setHidden] = useState<Set<string>>(new Set(["updated"]));
    const [order, setOrder] = useState<string[]>(["name", "section", "updated"]);
    const [density, setDensity] = useState<Density>("comfortable");

    return (
      <TableToolbar
        {...args}
        preferences={
          <Popover>
            {/* `asChild` обязателен: без него Radix рисует свою кнопку
                вокруг нашей, и получается кнопка в кнопке. */}
            <PopoverTrigger asChild>
              <Button variant="ghost" iconOnly icon={<SettingsIcon />} aria-label="Settings" />
            </PopoverTrigger>
            <PopoverContent className="p-3">
              <TablePreferences
                columns={COLUMNS}
                hiddenColumns={hidden}
                onHiddenColumnsChange={setHidden}
                columnOrder={order}
                onColumnOrderChange={setOrder}
                density={density}
                onDensityChange={setDensity}
              />
            </PopoverContent>
          </Popover>
        }
      />
    );
  },
};

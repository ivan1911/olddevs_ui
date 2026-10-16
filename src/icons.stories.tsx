import type { Meta, StoryObj } from "@storybook/react-vite";
import * as icons from "./icons.js";

// Вход отдаёт ещё и `LucideProvider` (ADR-0072) — в сетку идут только иконки словаря.
const { LucideProvider, ...dictionary } = icons;

/**
 * Витрина словаря. Её главная работа — не «показать красивое», а дать место,
 * где геометрию lucide можно сверить глазами до того, как она разъедется
 * по полусотне экранов потребителя.
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
 * Весь словарь целиком, с именами. Имя под иконкой — то самое, которым её
 * импортирует потребитель: `import { DeleteIcon } from "@olddevs/ui/icons"`.
 */
export const Catalog: Story = {
  render: () => <Grid />,
};

/**
 * Толщина обводки задаётся у потребителя через `LucideProvider` и наследуется
 * всеми иконками сразу. Здесь три значения рядом: 1.6 — то, что было
 * у самописного набора и что фронт ставит по умолчанию; 2 — дефолт lucide.
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
 * Размерная лестница, которая реально встречается во фронте: 14 в мелких
 * бейджах, 18 в кнопках, 20 в триггерах, 28 в списках.
 *
 * 20, а не 22: строчный бокс контрола задан `leading-5`, и всё, что кладётся
 * в строку триггера, обязано в неё уместиться — иначе триггер растёт и
 * расходится по высоте с соседним полем.
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

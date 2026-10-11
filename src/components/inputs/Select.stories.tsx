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

/** Заглушка картинки: цветной квадрат вместо превью — в витрине нет сети. */
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
 * Аргументы витрины типизируются одиночной ветвью union'а: у `SelectProps`
 * форма зависит от `multiple`, и Storybook не может вывести `args` из союза —
 * `render(args)` получал бы `any`. Мультивыбор показывают отдельные истории,
 * дописывая `multiple` к общим аргументам явно.
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

/** Живой выбор: состояние настоящее, крестик очищает. */
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

/** Живой мультивыбор: панель не закрывается, крестик снимает весь набор. */
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
 * Матрица состояний триггера. Открытый список сюда не входит: он живёт
 * в портале поверх страницы, и два открытых списка перекрыли бы друг друга —
 * ровно как у `Popover` и `ModalOverlay`. Раскрытое состояние снимается
 * отдельными историями ниже.
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
                // По умолчанию иконка берётся из словаря дизайн-системы;
                // последняя строка показывает, что потребитель может его заменить.
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
 * Классы потребителя на триггере. Отдельная история, потому что именно здесь
 * уже была регрессия: `triggerClassName` уезжал на обёртку, отступы удваивались,
 * и контрол вырастал с 36 до 56 пикселей. Классы взяты дословно из вызова
 * во фронте, а не придуманы, — иначе снимок сторожит не то, что ломается.
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
 * Вид формы: `highlightSelected={false}`.
 *
 * Акцентная подсветка выбранного значения означает «фильтр применён» — в панели
 * фильтров её ищут глазами, пробегая ряд. В форме то же самое означало бы
 * «поле заполнено», а это норма, а не событие: рядом с обычными полями
 * акцентная пилюля читается тревогой на пустом месте.
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
      {/* Для сравнения — то же значение с подсветкой, как в фильтрах. */}
      <Select {...args} value={2} renderMedia={square} />
    </div>
  ),
};

/**
 * Выключенное поле — рядом с рабочим, чтобы разница была видна.
 *
 * Гаснет пилюля целиком, а не подпись внутри неё, и крестик очистки исчезает:
 * поле, которое нельзя менять, нельзя и очистить. Потребитель гасит форму на
 * время запроса, и `Select`, оставшийся живым среди погасших соседей, читался
 * бы как недоделка.
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
      {/* Та же пара в виде пилюли фильтра. */}
      <div className="flex items-start gap-2">
        <Select {...args} value={null} disabled />
        <Select {...args} value={null} />
      </div>
    </div>
  ),
};

/**
 * Длинная подпись в узкой пилюле и в широком триггере.
 *
 * Сверху — умолчание: подпись обрезается на 110px, иначе одно длинное название
 * растолкало бы соседние фильтры в ряду. Снизу — тот же элемент в поле формы,
 * где предел снят классом `[--select-label-max:none]`: место есть, и резать
 * подпись там незачем.
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
 * Подпись, которой нет среди элементов, и счётчик множественного выбора.
 *
 * Обе ветки подписи режутся тем же пределом, что и выбранное значение. Раньше
 * предел стоял только у него: пилюля с «This project has been deleted»
 * занимала 170 пикселей против 120 у обычной, и одной такой хватало, чтобы
 * панель фильтров разъехалась на вторую строку.
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

/** Раскрытый список с поиском: картинки, счётчики справа, отметка выбранного. */
export const Open: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Select {...args} searchable value={2} open renderMedia={square} />
    </div>
  ),
};

/**
 * Раскрытый список без поиска — та самая ось, ради которой во фронте жили два
 * рукописных дропдауна: три статуса искать незачем.
 */
export const OpenWithoutSearch: Story = {
  render: (args) => (
    <div className="h-[420px]">
      <Select {...args} value={2} open renderMedia={square} />
    </div>
  ),
};

/** Раскрытый мультивыбор: отмечено несколько сразу. */
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

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { Button } from "../actions/Button.js";
import { SplitPanel } from "./SplitPanel.js";

const ORDERS = ["#4821", "#4820", "#4816", "#4809", "#4802"];

function List() {
  return (
    <ul className="text-fg-1 flex flex-col gap-1 p-3 text-[13px]">
      {ORDERS.map((id) => (
        <li key={id} className="rounded-md px-2 py-1.5">
          Order {id}
        </li>
      ))}
    </ul>
  );
}

function Details() {
  return (
    <div className="text-[13px]">
      {/*
        Заголовок стоит ВНЕ `dl`: список определений допускает прямыми потомками
        только пары `dt`/`dd` и обёртки над ними, и `div` с одним текстом ронял
        аудит axe как `definition-list`.
      */}
      <div className="text-fg-0 mb-3 font-semibold">Order #4821</div>
      <dl>
        {[
          ["Customer", "Veter LLC"],
          ["Total", "148 200 ₽"],
          ["Status", "In assembly"],
        ].map(([key, value]) => (
          <div key={key} className="flex justify-between py-1">
            <dt className="text-fg-2">{key}</dt>
            <dd className="text-fg-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const meta = {
  title: "App shell/SplitPanel",
  component: SplitPanel,
  parameters: { layout: "padded" },
  args: {
    "aria-label": "Order details",
    children: <List />,
    panel: <div className="p-4">{<Details />}</div>,
  },
  decorators: [
    (Story) => (
      <div className="border-line bg-bg-0 h-[260px] overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SplitPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Панель сбоку: тянется ширина, ручка вертикальная. */
export const Side: Story = {
  args: { position: "side", defaultSize: 260 },
};

/**
 * Панель снизу: тянется высота, ручка горизонтальная. Тот же компонент —
 * разница ровно в оси раскладки.
 */
export const Bottom: Story = {
  args: { position: "bottom", defaultSize: 120, minSize: 80, maxSize: 200 },
};

/**
 * Схлопнутая панель. Содержимое остаётся в DOM — состояние формы внутри
 * переживает схлопывание, — но уходит из дерева доступности: панель, до которой
 * доходит Tab и которой не видно, уводит фокус в никуда. Ручка исчезает вместе
 * с ней: тянуть нечего.
 */
export const Collapsed: Story = {
  args: { position: "side", collapsed: true },
};

/**
 * Узкий экран: панель сворачивается ниже `lg`, остаётся одна область. Штатного
 * адаптивного режима у компонента нет — ширину спрашивает `useMediaQuery`, а
 * схлопывает существующий `collapsed`. До гидратации хук отвечает «узко», так что
 * первый кадр на сервере — одна область.
 */
export const Adaptive: Story = {
  render: (args) => {
    const wide = useMediaQuery("(min-width: 1024px)");
    return (
      <SplitPanel
        {...args}
        collapsed={!wide}
        panel={
          <div className="p-3" data-testid="adaptive-panel">
            <Details />
          </div>
        }
      >
        <List />
      </SplitPanel>
    );
  },
  args: { position: "side", defaultSize: 260, "aria-label": "Order details" },
};

/**
 * Управляемый размер. Кит даёт форму, хранит потребитель — то же разделение,
 * что у состояния таблицы: у заказчика размер обычно уже лежит в адресе
 * страницы, и второе хранилище внутри кита разошлось бы с первым молча.
 */
export const Controlled: Story = {
  render: (args) => {
    const [size, setSize] = useState(220);
    return (
      <div className="flex h-full flex-col">
        <div className="border-line flex items-center gap-3 border-b p-2">
          <span className="text-fg-1 text-xs">Size: {size} px</span>
          <Button size="sm" variant="outline" onClick={() => setSize(220)}>
            Reset
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSize(420)}>
            Widen
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <SplitPanel {...args} size={size} onSizeChange={setSize} maxSize={460} />
        </div>
      </div>
    );
  },
};

/**
 * Сворачивание НЕ по щелчку, а по внешнему состоянию.
 *
 * Щелчок по кнопке сам уводит фокус на неё, и переносить становится нечего.
 * Сворачивание бывает и без него — горячей клавишей, ответом сервера, сменой
 * раскладки; именно тогда фокус, стоявший внутри панели, и терялся.
 */
export const CollapseFromOutside: Story = {
  render: (args) => {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div className="flex h-full flex-col">
        <div className="border-line flex items-center gap-3 border-b p-2">
          <span className="text-fg-1 text-xs" data-testid="state">
            {collapsed ? "collapsed" : "open"}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <SplitPanel
            {...args}
            collapsed={collapsed}
            panel={
              <div className="p-3">
                <input aria-label="Note" data-testid="note" className="border-line border" />
                <button
                  type="button"
                  data-testid="collapse-later"
                  onClick={() => setTimeout(() => setCollapsed(true), 50)}
                >
                  Collapse in 50ms
                </button>
              </div>
            }
          />
        </div>
      </div>
    );
  },
};

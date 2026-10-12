import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Drawer, type DrawerProps } from "./Drawer.js";
import { FormField } from "../inputs/FormField.js";
import { Select } from "../inputs/Select.js";
import { Text } from "../content/Text.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Overlays/Drawer",
  component: Drawer,
  parameters: { layout: "centered" },
  tags: ["periphery"],
} satisfies Meta<DrawerProps>;

export default meta;
type Story = StoryObj<DrawerProps>;

function Demo(args: Partial<DrawerProps>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="solid" tone="accent" onClick={() => setOpen(true)}>
        Open the drawer
      </Button>
      <Drawer
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        title={args.title ?? "Editing a photo"}
        subtitle="Changes apply immediately"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="solid" tone="accent" onClick={() => setOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <FormField label="Name" htmlFor="dw-name">
            <TextControl id="dw-name" defaultValue="Night city" shellClassName="w-full" />
          </FormField>
          <FormField label="Description" htmlFor="dw-desc">
            <TextControl id="dw-desc" as="textarea" rows={4} shellClassName="w-full" />
          </FormField>
          <Text size="sm" level={3}>
            On a narrow screen the side drawer slides in from the bottom.
          </Text>
        </div>
      </Drawer>
    </>
  );
}

export const FromRight: Story = { render: (args) => <Demo {...args} /> };
export const FromLeft: Story = { render: (args) => <Demo {...args} side="left" /> };
export const FromBottom: Story = { render: (args) => <Demo {...args} side="bottom" size="sm" /> };

/**
 * Ящик над чужим оверлеем.
 *
 * Приложение со своими слоями держит окна выше умолчания кита, и ящик обязан
 * уметь встать над ними. Слой поднимается ОДНИМ пропом, потому что подложка и
 * панель должны ехать вместе: подними только панель — и затемнение останется
 * под чужим окном, а ящик повиснет над ним без собственного фона.
 */
export const OverForeignOverlay: Story = {
  render: (args) => (
    <>
      <div
        className="bg-bg-2 border-line fixed inset-x-20 inset-y-16 z-95 flex items-start justify-center rounded-2xl border pt-6"
        aria-hidden
      >
        <Text level={3}>A foreign application overlay, layer z-95</Text>
      </div>
      <div className="relative z-100">
        <Demo {...args} zIndex="z-100" />
      </div>
    </>
  ),
};

/**
 * Список, всплывший ИЗНУТРИ ящика: панель `Select` длиннее своей высоты.
 *
 * История нужна замку прокрутки, а не виду. Панель портируется в `body`, то
 * есть лежит вне подложки, на которой висит замок Radix, и попадает в его
 * поддерево только через дерево React — ради этого панель ящика и переехала
 * ВНУТРЬ подложки. Колесо над списком обязано крутить его, пока
 * есть куда, и упираться, когда докрутили до конца.
 *
 * Ящик открыт сразу: тест колеса начинается с открытой панели, а не с кнопки.
 */
export const SelectInside: Story = {
  render: (args) => {
    const items = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, label: `Section ${i + 1}` }));
    return (
      <div className="h-[2400px] p-6">
        <Text size="sm" level={3}>
          A long page behind the drawer.
        </Text>
        <Drawer {...args} open onClose={() => {}} title="Task details">
          <FormField label="Section">
            <Select
              items={items}
              value={null}
              onChange={() => {}}
              placeholder="Pick a section"
              aria-label="Section"
              highlightSelected={false}
              triggerClassName="border-line bg-bg-2 w-full rounded-control px-3 py-2.5"
            />
          </FormField>
        </Drawer>
      </div>
    );
  },
};

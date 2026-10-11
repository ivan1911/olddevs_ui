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

/** Число правок называется, когда потребитель его считает. */
export const WithCount: Story = {
  args: { count: 3 },
};

/** Ход сохранения: кнопка занята, отмена выключена, состояние объявляется. */
export const Saving: Story = {
  args: { count: 3, saving: true },
};

/** Отказ сохранения виден в самой полосе, а не только в тосте. */
export const SaveFailed: Story = {
  args: { count: 3, error: "The server did not answer. Try again." },
};

/**
 * Полоса в работе: появляется с первой правкой и исчезает вместе с ней.
 *
 * Что считать правкой — решение потребителя; здесь это несовпадение с исходным
 * значением.
 *
 * Прокручиваемая область здесь ЯВНАЯ, и это не украшение истории. Полоса липнет
 * к низу ближайшей области прокрутки — окна или предка с `overflow`. В витрине
 * окном воспользоваться нельзя: `body` витрины несёт `overflow: auto` и сам
 * становится такой областью, не прокручиваясь при этом. В настоящем приложении
 * работают оба случая: окно, если прокручивается страница, и контейнер, если
 * прокручивается только рабочая область — как в большинстве админок.
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
 * Над нижней панелью телефона. `AppShell` публикует высоту слота `bottomBar` в
 * `--bottombar-h`, а полоса прилипает на эту высоту выше края окна, вместо того
 * чтобы уйти под `MobileTabBar`. Сузьте окно ниже 768px: на широком экране
 * панели нет, переменная равна нулю, и полоса стоит у самого низа.
 *
 * Прокручиваемая область явная по той же причине, что в `InForm`.
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
              <MobileTabBarItem label="Dashboard" icon={<DashboardIcon />} href="#home" active />
              <MobileTabBarItem label="Documents" icon={<FolderIcon />} href="#docs" />
              <MobileTabBarItem label="Settings" icon={<SettingsIcon />} href="#settings" />
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

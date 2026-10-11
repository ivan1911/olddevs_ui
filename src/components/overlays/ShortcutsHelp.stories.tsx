import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "../actions/Button.js";
import { Kbd } from "../content/Kbd.js";
import { ShortcutsHelp, type ShortcutGroup, type ShortcutsHelpProps } from "./ShortcutsHelp.js";
import { TextControl } from "../inputs/TextControl.js";

const meta = {
  title: "Overlays/ShortcutsHelp",
  component: ShortcutsHelp,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<ShortcutsHelpProps>;

export default meta;
type Story = StoryObj<ShortcutsHelpProps>;

const GROUPS: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    items: [
      { keys: ["Ctrl", "K"], description: "Open the command palette" },
      { keys: ["G", "H"], description: "Go to the home page" },
      { keys: ["G", "S"], description: "Go to settings" },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    items: [
      { keys: ["Ctrl", "Shift", "D"], description: "Duplicate the selection" },
      { keys: ["Delete"], description: "Delete the selection" },
    ],
  },
  {
    id: "general",
    label: "General",
    items: [
      { keys: ["?"], description: "Show this window" },
      { keys: ["Esc"], description: "Close the window" },
    ],
  },
];

/** Открытие кнопкой: после закрытия фокус возвращается на неё. */
export const Playground: Story = {
  args: { open: false, onOpenChange: () => {}, groups: GROUPS },
  render: (args: ShortcutsHelpProps) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Keyboard shortcuts</Button>
        <ShortcutsHelp {...args} open={open} onOpenChange={setOpen} />
      </>
    );
  },
};

/** Окно открыто сразу: так его видно без взаимодействия. */
export const Open: Story = {
  args: { open: true, onOpenChange: () => {}, groups: GROUPS },
};

/**
 * Рецепт: открытие по «?». Кит глобальных клавиш не вешает — обработчик живёт у
 * потребителя, и вот что в нём обязательно:
 *
 * - знак, а не положение клавиши (`event.key`): «?» стоит на разных клавишах
 *   (Shift+/ на латинской раскладке, Shift+7 на русской), а пользователь нажимает
 *   именно знак. Для букв («G, H») — наоборот, положение (`event.code`);
 * - молчать в полях ввода — иначе вопросительный знак нельзя напечатать;
 * - не перехватывать сочетания с Ctrl, Alt и Meta, автоповтор и ввод через IME.
 */
export const OpenWithQuestionMark: Story = {
  args: { open: false, onOpenChange: () => {}, groups: GROUPS },
  render: (args: ShortcutsHelpProps) => {
    const [open, setOpen] = useState(false);

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "?" || event.isComposing || event.repeat) return;
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName))
        ) {
          return;
        }
        event.preventDefault();
        setOpen(true);
      };
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
      <div className="flex max-w-sm flex-col gap-3">
        <p className="text-fg-1 m-0 text-[13px]">
          Press <Kbd>?</Kbd> anywhere on the page to open the window.
        </p>
        <TextControl aria-label="Try typing a question mark" placeholder="Typing here is safe" />
        <ShortcutsHelp {...args} open={open} onOpenChange={setOpen} />
      </div>
    );
  },
};

/** Заголовок из пропа вместо умолчания каталога. */
export const CustomTitle: Story = {
  args: { open: true, onOpenChange: () => {}, title: "Cheat sheet", groups: GROUPS },
};

/** Длинный свод: шапка с крестиком остаётся на месте, прокручивается список. */
export const LongList: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    groups: Array.from({ length: 6 }, (_, groupIndex) => ({
      id: `group-${groupIndex}`,
      label: `Section ${groupIndex + 1}`,
      items: Array.from({ length: 6 }, (_, itemIndex) => ({
        keys: ["Alt", String(itemIndex + 1)],
        description: `Action ${groupIndex + 1}.${itemIndex + 1}`,
      })),
    })),
  },
};

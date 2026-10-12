import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Card } from "../content/Card.js";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "./ContextMenu.js";
import { Menu, MenuButton, MenuItem, MenuSection, MenuSeparator, MenuTrigger } from "./Menu.js";
import { ArchiveIcon, CopyIcon, DeleteIcon, EditIcon, MoreIcon } from "../../icons.js";

const meta = {
  title: "Overlays/ContextMenu",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: function Render() {
    const [dense, setDense] = useState(true);
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card className="flex h-[160px] w-[320px] items-center justify-center select-none">
            Right-click here
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem icon={<EditIcon size={14} />}>Rename</ContextMenuItem>
          <ContextMenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem icon={<ArchiveIcon size={14} />} disabled>
            Archive — no rights
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuCheckboxItem checked={dense} onCheckedChange={setDense}>
            Dense grid
          </ContextMenuCheckboxItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};

/**
 * ОДИНОЧНЫЙ ВЫБОР — не флажки и не пункты с нарисованной галочкой.
 *
 * Значение задано на группе: «выбран ровно один» — свойство группы, и только
 * она может проставить остальным `aria-checked="false"`. Здесь это видно
 * глазами — отмечен один пункт, — а в дереве доступности видно ролью
 * `menuitemradio`, которую и сторожит тест.
 */
export const SingleChoice: Story = {
  render: function Render() {
    const [project, setProject] = useState("none");
    return (
      <ContextMenu>
        <ContextMenuTrigger>
          <Card className="flex h-[160px] w-[320px] items-center justify-center select-none">
            Right-click here
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Project</ContextMenuLabel>
          <ContextMenuRadioGroup value={project} onValueChange={setProject}>
            <ContextMenuRadioItem value="none">No project</ContextMenuRadioItem>
            <ContextMenuSeparator />
            <ContextMenuRadioItem value="kitchen">Kitchen renovation</ContextMenuRadioItem>
            <ContextMenuRadioItem value="taxes">Taxes 2026</ContextMenuRadioItem>
            <ContextMenuRadioItem value="archive" disabled>
              Archive — no rights
            </ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>
    );
  },
};

/**
 * ДВА МЕНЮ РЯДОМ — главная проверка обоих компонентов.
 *
 * Слева `ContextMenu` на Radix, справа `Menu` на react-aria. Библиотеки разные,
 * а выглядеть они обязаны одинаково: пользователь не должен видеть «другое»
 * меню оттого, что открыл его правой кнопкой мыши. Общая таблица вида в
 * `lib/menu.ts` — единственное, что их удерживает, и удерживает она только
 * потому, что говорит на обоих диалектах состояний (`data-focused` у одного,
 * `data-highlighted` у другого, и так далее).
 *
 * Расхождение здесь видно глазами и ловится бейзлайном. Рассуждением оно не
 * ловится вовсе: у одной библиотеки состояние может просто не примениться, и
 * компонент будет выглядеть исправным.
 */
export const TwoMenusSideBySide: Story = {
  render: () => (
    // Панели рисуются в порталах и раскладке не подчиняются: меню react-aria
    // якорится к своей кнопке, меню Radix без указателя встаёт в угол экрана.
    // Поэтому кнопка отодвинута вправо — так обе панели видны рядом, а не одна
    // поверх другой. Фокус при открытии react-aria отключён: у Radix без
    // указателя ни один пункт не подсвечен, и панели должны быть в одном состоянии.
    <div className="h-[420px]">
      <MenuTrigger isOpen>
        <MenuButton
          icon={<MoreIcon size={16} />}
          iconOnly
          aria-label="react-aria menu"
          className="ml-[300px]"
        />
        <Menu autoFocus={false}>
          <MenuSection label="Actions">
            <MenuItem icon={<EditIcon size={14} />}>Rename</MenuItem>
            <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
              Duplicate
            </MenuItem>
            <MenuItem icon={<ArchiveIcon size={14} />} disabled>
              Archive — no rights
            </MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </MenuItem>
        </Menu>
      </MenuTrigger>

      <ContextMenu modal={false} open>
        <ContextMenuTrigger>
          <span className="sr-only">Radix menu</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>Actions</ContextMenuLabel>
          <ContextMenuItem icon={<EditIcon size={14} />}>Rename</ContextMenuItem>
          <ContextMenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem icon={<ArchiveIcon size={14} />} disabled>
            Archive — no rights
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem tone="danger" icon={<DeleteIcon size={14} />}>
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  ),
};

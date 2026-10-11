import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Button } from "../actions/Button.js";
import { Dialog } from "./Dialog.js";
import { Drawer } from "./Drawer.js";
import { FormField } from "../inputs/FormField.js";
import { TextControl } from "../inputs/TextControl.js";
import type { Selection } from "react-aria-components";
import {
  Menu,
  MenuButton,
  MenuItem,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
  SubmenuTrigger,
} from "./Menu.js";
import {
  ArchiveIcon,
  CopyIcon,
  DeleteIcon,
  EditIcon,
  FolderIcon,
  GridDenseIcon,
  MoreIcon,
} from "../../icons.js";

const meta = {
  title: "Overlays/Menu",
  component: Menu,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <MenuTrigger>
      <MenuButton icon={<MoreIcon size={16} />} iconOnly aria-label="Actions" />
      <Menu>
        <MenuItem icon={<EditIcon size={14} />} onAction={() => {}}>
          Rename
        </MenuItem>
        <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D" onAction={() => {}}>
          Duplicate
        </MenuItem>
        <MenuItem icon={<ArchiveIcon size={14} />} disabled>
          Archive — no rights
        </MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" icon={<DeleteIcon size={14} />} onAction={() => {}}>
          Delete
        </MenuItem>
      </Menu>
    </MenuTrigger>
  ),
};

/**
 * Разделы, переключатели и подменю.
 *
 * Переключатели — это выбор на РАЗДЕЛЕ, а не проп `checked` у пункта: роли
 * `menuitemcheckbox`/`menuitemradio` и `aria-checked` react-aria проставляет
 * сам, и подпирать их руками означало бы повторять чужую работу.
 */
export const SectionsAndSubmenus: Story = {
  render: function Render() {
    const [view, setView] = useState<Selection>(new Set(["dense"]));
    const [sort, setSort] = useState<Selection>(new Set(["date"]));

    return (
      <MenuTrigger>
        <MenuButton icon={<MoreIcon size={16} />}>View</MenuButton>
        <Menu>
          <MenuSection
            label="Density"
            selectionMode="multiple"
            selectedKeys={view}
            onSelectionChange={setView}
          >
            <MenuItem id="dense" icon={<GridDenseIcon size={14} />}>
              Dense grid
            </MenuItem>
            <MenuItem id="meta">Show labels</MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuSection
            label="Sort"
            selectionMode="single"
            selectedKeys={sort}
            onSelectionChange={setSort}
          >
            <MenuItem id="date">By date</MenuItem>
            <MenuItem id="name">By name</MenuItem>
          </MenuSection>
          <MenuSeparator />
          <SubmenuTrigger>
            <MenuItem icon={<FolderIcon size={14} />}>Move to…</MenuItem>
            <Menu>
              <MenuItem onAction={() => {}}>Nature</MenuItem>
              <MenuItem onAction={() => {}}>City</MenuItem>
              <MenuItem onAction={() => {}}>Abstract</MenuItem>
            </Menu>
          </SubmenuTrigger>
        </Menu>
      </MenuTrigger>
    );
  },
};

/**
 * Матрица тонов и состояний пункта.
 *
 * Меню открыто принудительно (`isOpen`), иначе снимок показал бы только кнопку.
 * Панель рисуется в портале, поэтому история и центрируется по месту.
 */
export const Matrix: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="h-[420px]">
      <MenuTrigger isOpen>
        <MenuButton icon={<MoreIcon size={16} />} iconOnly aria-label="Actions" />
        <Menu>
          <MenuSection label="Section">
            <MenuItem icon={<EditIcon size={14} />}>Plain</MenuItem>
            <MenuItem icon={<CopyIcon size={14} />} shortcut="⌘D">
              With a shortcut
            </MenuItem>
            <MenuItem disabled icon={<ArchiveIcon size={14} />}>
              Disabled
            </MenuItem>
          </MenuSection>
          <MenuSeparator />
          <MenuSection label="Tones">
            <MenuItem tone="accent">Accent</MenuItem>
            <MenuItem tone="success">Success</MenuItem>
            <MenuItem tone="warning">Warning</MenuItem>
            <MenuItem tone="danger" icon={<DeleteIcon size={14} />}>
              Danger
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
    </div>
  ),
};

/**
 * СТЫК ДВУХ БИБЛИОТЕК: меню react-aria внутри диалога Radix.
 *
 * Единственное место в пакете, где два независимых менеджера фокуса
 * встречаются на одном экране, — и единственный способ узнать, работает ли
 * смешанный кит вообще. Диалог держит ловушку фокуса и слушает Escape; меню
 * держит свою и слушает Escape тоже. Ожидаемое поведение:
 *
 *   — Escape при открытом меню закрывает МЕНЮ, но не диалог;
 *   — Escape повторно закрывает диалог;
 *   — после закрытия меню фокус возвращается в диалог, а не на `<body>`;
 *   — Tab не выпускает за пределы диалога, пока меню открыто.
 *
 * Проверяется в браузере (`tests-visual/interactions.spec.ts`): jsdom не
 * двигает фокус по Tab так, как это делает браузер, и проверка ловушки там
 * прошла бы в любом случае — то есть не проверяла бы ничего (ADR-0012).
 */
export const MenuInsideDialog: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [name, setName] = useState("Daily collection");
    // Строка появляется только после действия: исходный снимок истории не
    // меняется, а щелчок мышью по пункту получает видимое следствие.
    const [action, setAction] = useState<string | null>(null);
    return (
      <div className="h-[420px]">
        <Button onClick={() => setOpen(true)}>Open the window</Button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Collection settings">
          <div className="flex flex-col gap-4">
            <FormField label="Name" htmlFor="md-name">
              <TextControl
                id="md-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                shellClassName="w-full"
              />
            </FormField>
            <div className="flex justify-between">
              <MenuTrigger>
                <MenuButton icon={<MoreIcon size={16} />}>Actions</MenuButton>
                <Menu>
                  <MenuItem icon={<CopyIcon size={14} />} onAction={() => setAction("Duplicate")}>
                    Duplicate
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    tone="danger"
                    icon={<DeleteIcon size={14} />}
                    onAction={() => setAction("Delete")}
                  >
                    Delete
                  </MenuItem>
                </Menu>
              </MenuTrigger>
              <Button variant="solid" tone="accent" onClick={() => setOpen(false)}>
                Save
              </Button>
            </div>
            {action != null ? <p>Last action: {action}</p> : null}
          </div>
        </Dialog>
      </div>
    );
  },
};

/**
 * Меню react-aria внутри ящика — тот же стык, что с `Dialog`: `Drawer` стоит
 * на том же модальном слое Radix.
 *
 * Отдельная история ради щелчка мышью. Модальный Radix гасит `pointer-events`
 * у `<body>`, а панель меню живёт в портале прямо под ним; пока кит не
 * возвращал ей указатель, пункт выбирался только с клавиатуры.
 * Проверяется в `tests-visual/interactions.spec.ts`.
 */
export const MenuInsideDrawer: Story = {
  parameters: { layout: "padded" },
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [action, setAction] = useState<string | null>(null);
    return (
      <div className="h-[420px]">
        <Button onClick={() => setOpen(true)}>Open the panel</Button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Collection settings">
          <div className="flex flex-col items-start gap-4">
            <MenuTrigger>
              <MenuButton icon={<MoreIcon size={16} />}>Actions</MenuButton>
              <Menu>
                <MenuItem icon={<CopyIcon size={14} />} onAction={() => setAction("Duplicate")}>
                  Duplicate
                </MenuItem>
                <MenuItem icon={<ArchiveIcon size={14} />} onAction={() => setAction("Archive")}>
                  Archive
                </MenuItem>
              </Menu>
            </MenuTrigger>
            {action != null ? <p>Last action: {action}</p> : null}
          </div>
        </Drawer>
      </div>
    );
  },
};

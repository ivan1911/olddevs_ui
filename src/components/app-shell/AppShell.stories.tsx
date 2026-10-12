import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  ArchiveIcon,
  BellIcon,
  DashboardIcon,
  FolderIcon,
  SettingsIcon,
  UploadIcon,
} from "../../icons.js";
import { AppShell } from "./AppShell.js";
import { Avatar } from "../content/Avatar.js";
import { Banner } from "../actions/Banner.js";
import { Badge } from "../content/Badge.js";
import { Button } from "../actions/Button.js";
import { MobileTabBar, MobileTabBarItem } from "./MobileTabBar.js";
import { NavItem } from "./NavItem.js";
import { DataTable } from "../table/DataTable.js";
import { FilterBar } from "../table/FilterBar.js";
import { FilterBarAdd, type FilterField } from "../table/FilterBarAdd.js";
import { PageHeader } from "../navigation/PageHeader.js";
import { Pagination } from "../navigation/Pagination.js";
import { TablePreferences } from "../table/TablePreferences.js";
import { TableToolbar } from "../table/TableToolbar.js";
import { useTableState } from "../../hooks/useTableState.js";
import { Popover, PopoverContent, PopoverTrigger } from "../overlays/Popover.js";
import { SearchControl } from "../inputs/SearchControl.js";
import { SelectionBar } from "../navigation/SelectionBar.js";
import { NavGroup, SideNav } from "./SideNav.js";
import { TooltipProvider } from "../overlays/Tooltip.js";
import { TopBar } from "./TopBar.js";

const meta = {
  title: "App shell/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: <DashboardIcon size={20} /> },
  { id: "docs", label: "Documents", icon: <FolderIcon size={20} /> },
  { id: "upload", label: "Uploads", icon: <UploadIcon size={20} /> },
];

const REST = [
  { id: "events", label: "Activity", icon: <BellIcon size={20} />, badge: 7 },
  { id: "archive", label: "Archive", icon: <ArchiveIcon size={20} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={20} /> },
];

const COLUMNS = [
  { id: "name", header: "Name", cell: (row: Row) => row.name },
  { id: "section", header: "Section", cell: (row: Row) => row.section },
  { id: "updated", header: "Updated", cell: (row: Row) => row.updated },
];

const FIELDS: FilterField[] = [
  {
    id: "section",
    label: "Section",
    values: [
      { id: "Contracts", label: "Contracts" },
      { id: "Reports", label: "Reports" },
      { id: "Invoices", label: "Invoices" },
    ],
  },
];

interface Row {
  id: string;
  name: string;
  section: string;
  updated: string;
}

const ROWS: Row[] = Array.from({ length: 18 }, (_, i) => ({
  id: String(i + 1),
  name: `Document ${i + 1}`,
  section: i % 3 === 0 ? "Contracts" : i % 3 === 1 ? "Reports" : "Invoices",
  updated: `${(i % 28) + 1}.09.2026`,
}));

/**
 * Страница-список целиком из кита — **первый критерий успеха спеки, и с 2.2.0
 * он закрыт**: каркас, навигация, шапка, заголовок, прикладная таблица с
 * тулбаром и фильтрами, полоса массовых действий и пагинация. Ни одного
 * локального примитива.
 *
 * До волны 18 здесь стояла низкоуровневая `Table`, и в этой докстроке была
 * оговорка «читать как готовый ответ пока рано». Оговорка снята: видимость
 * колонок, плотность, тулбар и фильтры теперь на месте.
 *
 * Маршрута нет: «переход» — это локальное состояние, которое едет в `routeKey`.
 * Кит о маршрутизаторе не знает вовсе (ADR-0018), а состояние таблицы держит
 * `useTableState` — кит даёт форму, владеет ею потребитель (ADR-0023).
 */
export const AdminEntityList: Story = {
  args: { children: null },
  render: () => {
    const [route, setRoute] = useState("dashboard");
    const [query, setQuery] = useState("");
    const { state, set } = useTableState({ pageSize: 6 });

    /*
      Нарезка на страницы — работа ПОТРЕБИТЕЛЯ: `DataTable` данными не владеет
      и `items` не режет. В приложении здесь был бы запрос к серверу с
      `page` и `pageSize`; в истории — срез массива.

      Раньше история считала `pageCount` и рисовала пагинацию поверх всех
      восемнадцати строк: кнопки переключались, а таблица не менялась —
      демо обещало то, чего не делало.
    */
    const page = ROWS.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);

    const nav = (
      <SideNav
        header={
          <div className="flex items-center gap-2.5 px-[18px] pt-[22px] pb-[14px]">
            <div className="bg-accent-strong size-[34px] shrink-0 rounded-[10px]" />
            <span className="truncate text-sm font-bold tracking-tight">Olddevs</span>
          </div>
        }
        footer={
          <div className="bg-bg-2 mb-2 flex items-center gap-2.5 rounded-[9px] px-2.5 py-2">
            <Avatar name="AL" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">Ada Lovelace</div>
              <div className="text-fg-3 text-[11px]">Full access</div>
            </div>
          </div>
        }
      >
        <NavGroup label="Work">
          {SECTIONS.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={route === item.id}
              href={`#${item.id}`}
              onClick={() => setRoute(item.id)}
            />
          ))}
        </NavGroup>
        <NavGroup label="Other">
          {REST.map((item) => (
            <NavItem
              key={item.id}
              label={item.label}
              icon={item.icon}
              active={route === item.id}
              badge={item.badge ? <Badge tone="danger">{item.badge}</Badge> : undefined}
              href={`#${item.id}`}
              onClick={() => setRoute(item.id)}
            />
          ))}
        </NavGroup>
      </SideNav>
    );

    return (
      <AppShell
        routeKey={route}
        sidebar={nav}
        header={
          <TopBar
            search={
              <SearchControl
                label="Search documents"
                value={query}
                onChange={setQuery}
                placeholder="Search…"
                shellClassName="md:max-w-[460px]"
              />
            }
            actions={
              <>
                <Button variant="ghost" iconOnly icon={<BellIcon />} aria-label="Notifications" />
                <Avatar name="AL" />
              </>
            }
          />
        }
      >
        <div className="flex flex-col gap-4 px-4 py-5 md:px-7">
          <PageHeader
            title="Documents"
            subtitle={`${ROWS.length} documents in this section`}
            actions={<Button tone="accent">Upload</Button>}
          />

          {state.selectedKeys.size > 0 ? (
            <SelectionBar
              count={state.selectedKeys.size}
              onClear={() => set({ selectedKeys: new Set() })}
            >
              <Button size="sm" variant="outline">
                Archive
              </Button>
              <Button size="sm" variant="outline" tone="danger">
                Delete
              </Button>
            </SelectionBar>
          ) : null}

          <DataTable
            aria-label="Section documents"
            columns={COLUMNS}
            items={page}
            state={state}
            onStateChange={set}
            selectable
            rowLabel={(row) => row.name}
            renderDetail={(row) => (
              <dl className="text-fg-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
                <dt className="font-medium">Section</dt>
                <dd>{row.section}</dd>
                <dt className="font-medium">Updated</dt>
                <dd>{row.updated}</dd>
              </dl>
            )}
            toolbar={
              <TableToolbar
                title="Documents"
                count={ROWS.length}
                countLabel={(n) => `${n} documents`}
                filters={
                  <FilterBar
                    filters={state.filters}
                    onFiltersChange={(filters) => set({ filters })}
                  >
                    <FilterBarAdd
                      fields={FIELDS}
                      filters={state.filters}
                      onAdd={(f) => set({ filters: [...state.filters, f] })}
                    />
                  </FilterBar>
                }
                preferences={
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        iconOnly
                        icon={<SettingsIcon />}
                        aria-label="Table settings"
                      />
                    </PopoverTrigger>
                    <PopoverContent className="p-3">
                      <TablePreferences
                        columns={[
                          { id: "name", label: "Name", required: true },
                          { id: "section", label: "Section" },
                          { id: "updated", label: "Updated" },
                        ]}
                        hiddenColumns={state.hiddenColumns}
                        onHiddenColumnsChange={(hiddenColumns) => set({ hiddenColumns })}
                        columnOrder={state.columnOrder}
                        onColumnOrderChange={(columnOrder) => set({ columnOrder })}
                        density={state.density}
                        onDensityChange={(density) => set({ density })}
                      />
                    </PopoverContent>
                  </Popover>
                }
              />
            }
          />

          <Pagination
            page={state.page}
            pageCount={Math.ceil(ROWS.length / state.pageSize)}
            onChange={(page) => set({ page })}
          />
        </div>
      </AppShell>
    );
  },
};

/**
 * Слот нижней панели с `MobileTabBar`. Каркас даёт панели прилипание, высоту в
 * потоке, отступ под вырез экрана и скрытие на `md` и шире — сама панель этого
 * не несёт (ADR-0018). Сузьте окно ниже 768px, чтобы увидеть её.
 *
 * Метка `viewport-phone`: визуальный тест снимает историю на ширине телефона,
 * а не на 1280px, где слот полосу прячет и снимок не показал бы ничего.
 */
export const WithBottomBar: Story = {
  tags: ["viewport-phone"],
  args: { children: null },
  render: () => {
    const [route, setRoute] = useState("dashboard");
    return (
      <AppShell
        routeKey={route}
        header={<TopBar brand={<span className="text-sm font-bold">Olddevs</span>} />}
        bottomBar={
          <MobileTabBar>
            {SECTIONS.map((item) => (
              <MobileTabBarItem
                key={item.id}
                label={item.label}
                icon={item.icon}
                active={route === item.id}
                href={`#${item.id}`}
                onClick={() => setRoute(item.id)}
              />
            ))}
          </MobileTabBar>
        }
      >
        <div className="text-fg-2 px-4 py-5 text-sm">
          Page content. The bottom bar sits in the flow and takes its own height.
        </div>
      </AppShell>
    );
  },
};

/**
 * Баннеры уровня приложения над шапкой.
 *
 * Шапка при этом остаётся липкой на `top: 0`, а `--topbar-h` продолжает
 * означать ровно её высоту: липкая стопка баннеров потребовала бы второй
 * переменной смещения, и всё, что от `--topbar-h` считает, обязано было бы
 * прибавлять её высоту (ADR-0027).
 *
 * Прокрутите страницу: баннеры уезжают, шапка прилипает.
 */
export const WithBanners: Story = {
  args: { children: null },
  render: () => (
    <AppShell
      header={<TopBar brand={<span className="text-sm font-bold">Olddevs</span>} />}
      banners={
        <>
          <Banner tone="danger" title="Service unavailable" onDismiss={() => {}}>
            Publishing is down. We are on it.
          </Banner>
          <Banner tone="accent" title="New version" onDismiss={() => {}}>
            Reload the tab to pick up the changes.
          </Banner>
        </>
      }
    >
      <div className="flex flex-col gap-2 px-4 py-5">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="border-line-soft bg-bg-2 text-fg-2 rounded-lg border p-3 text-sm">
            List row {i + 1}
          </div>
        ))}
      </div>
    </AppShell>
  ),
};

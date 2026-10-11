import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import type { Key, Selection } from "react-aria-components";
import { FavoriteIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Checkbox } from "../inputs/Checkbox.js";
import { ContextMenuItem, ContextMenuSeparator } from "../overlays/ContextMenu.js";
import { EmptyState } from "./EmptyState.js";
import { MediaCard } from "./MediaCard.js";
import { VirtualGrid, type VirtualGridItem, type VirtualGridProps } from "./VirtualGrid.js";

const meta = {
  title: "Content/VirtualGrid",
  component: VirtualGrid,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<VirtualGridProps>;

export default meta;
type Story = StoryObj<VirtualGridProps>;

const PREVIEW = (
  <div className="from-accent-soft to-bg-3 flex h-full w-full items-center justify-center bg-gradient-to-br text-xl">
    ▦
  </div>
);

const CELLS: VirtualGridItem[] = Array.from({ length: 600 }, (_, i) => ({
  id: String(i),
  textValue: `kadr-${String(i).padStart(4, "0")}.png`,
  content: <MediaCard preview={PREVIEW} title={`kadr-${String(i).padStart(4, "0")}.png`} />,
}));

/**
 * Шестьсот ячеек, в DOM — несколько десятков.
 *
 * Высоту контейнера задаёт ПОТРЕБИТЕЛЬ: без неё контейнер растянется по
 * содержимому, виртуализация не включится, и сетка отрисует всё разом.
 */
export const Playground: Story = {
  render: () => (
    <VirtualGrid
      items={CELLS}
      aria-label="Frames"
      minItemWidth={180}
      minItemHeight={220}
      className="h-[520px]"
    />
  ),
};

/** Ячейка — любой узел, не только `MediaCard`. */
export const PlainCells: Story = {
  render: () => (
    <VirtualGrid
      items={Array.from({ length: 300 }, (_, i) => ({
        id: String(i),
        textValue: `Cell ${i}`,
        content: (
          <div className="bg-bg-2 border-line-soft flex h-full items-center justify-center rounded-lg border text-[13px]">
            Cell {i}
          </div>
        ),
      }))}
      aria-label="Cells"
      minItemWidth={120}
      minItemHeight={90}
      className="h-[360px]"
    />
  ),
};

/** С выбором: состояние держит потребитель, как и везде в ките. */
export const WithSelection: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Selection>(new Set<Key>());
    return (
      <VirtualGrid
        items={Array.from({ length: 200 }, (_, i) => {
          const id = String(i);
          return {
            id,
            textValue: `kadr-${id}.png`,
            content: (
              <MediaCard
                preview={PREVIEW}
                title={`kadr-${id}.png`}
                selected={selected === "all" || selected.has(id)}
              />
            ),
          };
        })}
        aria-label="Frames"
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        minItemWidth={180}
        minItemHeight={220}
        className="h-[520px]"
      />
    );
  },
};

/**
 * Действие над ячейкой и контекстное меню — рядом с выбором, но не вместо него.
 *
 * Клик и Enter открывают ячейку (`onAction`), Space выбирает её. Меню ячейки
 * (`contextMenu`) открывается правой кнопкой, долгим нажатием и Shift+F10 на
 * сфокусированной ячейке; пункт меню не выбирает ячейку и не «открывает» её.
 */
export const ActionsAndMenu: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Selection>(new Set<Key>());
    const [opened, setOpened] = useState("none");
    const [picked, setPicked] = useState("none");
    const ids = [...(selected === "all" ? [] : selected)].join(",") || "none";
    return (
      <div className="flex flex-col gap-3">
        <div className="text-fg-2 flex gap-4 text-[13px]">
          <span data-testid="opened">Opened: {opened}</span>
          <span data-testid="picked">Menu: {picked}</span>
          <span data-testid="selected">Selected: {ids}</span>
        </div>
        <VirtualGrid
          items={Array.from({ length: 40 }, (_, i) => {
            const id = String(i);
            return {
              id,
              textValue: `kadr-${id}.png`,
              content: (
                <MediaCard
                  preview={PREVIEW}
                  title={`kadr-${id}.png`}
                  selected={selected === "all" || selected.has(id)}
                />
              ),
              // У ячейки «2» меню нет: на ней видно правило react-aria для касания —
              // долгое нажатие на ячейку без меню начинает выбор.
              contextMenu:
                id === "2" ? undefined : (
                  <>
                    <ContextMenuItem onSelect={() => setPicked(`open ${id}`)}>Open</ContextMenuItem>
                    <ContextMenuItem onSelect={() => setPicked(`rename ${id}`)}>
                      Rename
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem tone="danger" onSelect={() => setPicked(`delete ${id}`)}>
                      Delete
                    </ContextMenuItem>
                  </>
                ),
            };
          })}
          aria-label="Frames"
          selectionMode="multiple"
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onAction={(id) => setOpened(String(id))}
          minItemWidth={180}
          minItemHeight={220}
          className="h-[520px]"
        />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => (
    <VirtualGrid
      items={[]}
      aria-label="Frames"
      emptyText={<EmptyState title="Nothing found" />}
      className="h-[240px]"
    />
  ),
};

const LIBRARY_BAR = 56;
const LIBRARY_PAGE = 120;
const LIBRARY_TOTAL = 1200;

/**
 * Библиотека: сетка на прокрутке окна под липкой шапкой.
 *
 * Здесь всё, ради чего сетка росла: `scroll="window"` (шапка публикует
 * `--topbar-h`, фокус под неё не уходит), кружок выбора и кнопка в ячейке
 * (`gridcell`, а не `option`), подгрузка страниц у конца, протяжка пальцем,
 * Shift только добавляет, крайние ячейки вплотную. По этой истории ходят
 * браузерные проверки.
 */
export const Library: Story = {
  parameters: { layout: "fullscreen" },
  render: function Render() {
    const [count, setCount] = useState(LIBRARY_PAGE);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Selection>(new Set<Key>());
    const [favourites, setFavourites] = useState<Set<string>>(new Set());
    const [opened, setOpened] = useState("none");

    useEffect(() => {
      // Так же это делает `TopBar` приложения: публикует измеренную высоту.
      document.documentElement.style.setProperty("--topbar-h", `${LIBRARY_BAR}px`);
      return () => {
        document.documentElement.style.removeProperty("--topbar-h");
      };
    }, []);

    const loadMore = () => {
      if (loading || count >= LIBRARY_TOTAL) return;
      setLoading(true);
      window.setTimeout(() => {
        setCount((c) => Math.min(LIBRARY_TOTAL, c + LIBRARY_PAGE));
        setLoading(false);
      }, 300);
    };

    const size = selected === "all" ? count : selected.size;
    return (
      <div>
        <div
          className="border-line-soft bg-bg-1 text-fg-2 sticky top-0 z-30 flex items-center gap-4 border-b px-4 text-[13px]"
          style={{ height: LIBRARY_BAR }}
        >
          <span className="font-semibold">Library</span>
          <span data-testid="loaded">Loaded: {count}</span>
          <span data-testid="selected-count">Selected: {size}</span>
          <span data-testid="opened">Opened: {opened}</span>
        </div>
        <div className="p-4">
          <VirtualGrid
            items={Array.from({ length: count }, (_, i) => {
              const id = String(i);
              const title = `poster-${String(i).padStart(4, "0")}.jpg`;
              return {
                id,
                textValue: title,
                content: (
                  <MediaCard
                    preview={PREVIEW}
                    title={title}
                    selected={selected === "all" || selected.has(id)}
                    actions={
                      <>
                        <Checkbox slot="selection" label={`Select ${title}`} />
                        <Button
                          iconOnly
                          size="sm"
                          variant="ghost"
                          icon={
                            <FavoriteIcon fill={favourites.has(id) ? "currentColor" : "none"} />
                          }
                          aria-label={`Favourite ${title}`}
                          aria-pressed={favourites.has(id)}
                          onClick={() =>
                            setFavourites((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) next.delete(id);
                              else next.add(id);
                              return next;
                            })
                          }
                        />
                      </>
                    }
                  />
                ),
                contextMenu: (
                  <ContextMenuItem onSelect={() => setOpened(`rename ${id}`)}>
                    Rename
                  </ContextMenuItem>
                ),
              };
            })}
            aria-label="Posters"
            scroll="window"
            edgeGap={false}
            selectionMode="multiple"
            rangeSelection="add"
            dragToSelect
            selectedKeys={selected}
            onSelectionChange={setSelected}
            onAction={(id, { rect }) => setOpened(`${String(id)} at ${Math.round(rect.top)}`)}
            onLoadMore={loadMore}
            isLoadingMore={loading}
            minItemWidth={180}
            minItemHeight={220}
          />
        </div>
      </div>
    );
  },
};

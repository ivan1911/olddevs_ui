import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { Button } from "../actions/Button.js";
import { CommandPalette, type CommandPaletteProps } from "./CommandPalette.js";
import { Text } from "../content/Text.js";
import { AddIcon, DeleteIcon, SearchIcon, UploadIcon } from "../../icons.js";

const SECTIONS = [
  {
    id: "library",
    label: "Library",
    items: [
      {
        id: "upload",
        label: "Upload photos",
        shortcut: ["⌘", "U"],
        icon: <UploadIcon size={14} />,
      },
      {
        id: "find",
        label: "Find similar",
        keywords: "similar search",
        icon: <SearchIcon size={14} />,
      },
      { id: "delete", label: "Delete selection", icon: <DeleteIcon size={14} /> },
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    items: [
      { id: "new", label: "New campaign", shortcut: ["⌘", "N"], icon: <AddIcon size={14} /> },
      { id: "schedule", label: "Open the schedule", shortcut: ["⌘", "⇧", "S"] },
    ],
  },
];

const meta = {
  title: "Overlays/CommandPalette",
  component: CommandPalette,
  parameters: { layout: "centered" },
  tags: ["periphery"],
} satisfies Meta<CommandPaletteProps>;

export default meta;
type Story = StoryObj<CommandPaletteProps>;

function Demo(args: Partial<CommandPaletteProps>) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button variant="solid" tone="accent" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      <Text size="sm" level={3}>
        Picked: {last ?? "—"}
      </Text>
      <CommandPalette
        {...args}
        open={open}
        onClose={() => setOpen(false)}
        sections={SECTIONS}
        onSelect={setLast}
      />
    </div>
  );
}

/** Пустой запрос показывает весь список разделами — палитра как оглавление. */
export const Playground: Story = { render: (args) => <Demo {...args} /> };

/** Когда действий сотни, пустой список ничего не сообщает — вместо него подсказка. */
export const EmptyHint: Story = {
  render: (args) => <Demo {...args} emptyBehaviour="hint" />,
};

/*
  Ненастоящий сервер: отвечает с задержкой и ищет по основе слова, а не по
  подстроке. Именно ради этой пары строк история и существует — запрос
  «meetings» находит «Schedule a meeting», а локальный `contains` такую пару
  не сматчит никогда.
*/
const TASKS = [
  "Schedule a meeting with the design team",
  "Sign the contract with the contractor",
  "Review meeting notes",
];

function stem(word: string) {
  return word.replace(/(ies|es|s)$/u, "");
}

function searchTasks(query: string): Promise<string[]> {
  const needle = stem(query.trim().toLowerCase());
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve(
          needle === ""
            ? []
            : TASKS.filter((task) =>
                task
                  .toLowerCase()
                  .split(/\s+/u)
                  .some((word) => stem(word) === needle)
              )
        ),
      600
    );
  });
}

function ServerDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim() === "") {
      setFound([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    void searchTasks(query).then((tasks) => {
      if (cancelled) return;
      setFound(tasks);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const sections = [
    ...SECTIONS,
    ...(found.length > 0
      ? [
          {
            id: "tasks",
            label: "Tasks",
            prefiltered: true,
            items: found.map((task) => ({ id: task, label: task })),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <Button variant="solid" tone="accent" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      <Text size="sm" level={3}>
        Try “meetings” — the stem matches, the substring does not
      </Text>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        onQueryChange={setQuery}
        loading={loading}
        sections={sections}
        onSelect={() => setOpen(false)}
      />
    </div>
  );
}

/**
 * Результаты сервера рядом с локальными командами: раздел `prefiltered` не
 * просеивается второй раз, запрос уходит наружу через `onQueryChange`, а на
 * время ответа пустое состояние говорит «загрузка», а не «ничего не найдено».
 */
export const ServerResults: Story = { render: () => <ServerDemo /> };

/**
 * Состояние загрузки — отдельной историей, потому что его нужно МЕРИТЬ.
 *
 * Раньше крутилка была на два пикселя уже лупы, и поле вместе с набранным
 * текстом уезжало на эти два пикселя при каждом включении загрузки. На статичном
 * кадре такое не видно вовсе, поэтому браузерный тест открывает эту историю
 * дважды — с `loading` и без — и сравнивает положение поля.
 */
export const Loading: Story = {
  args: { loading: true },
  render: (args) => (
    <CommandPalette
      open
      onClose={() => {}}
      loading={args.loading}
      sections={SECTIONS}
      onSelect={() => {}}
    />
  ),
};

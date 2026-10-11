import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";
import type { Key } from "react-aria-components";
import { UiProvider } from "../../i18n/UiProvider.js";
import ru from "../../locales/ru.js";
import { MoreIcon } from "../../icons.js";
import { Button } from "../actions/Button.js";
import { Checkbox } from "../inputs/Checkbox.js";
import {
  EditableList,
  type EditableListHandle,
  type EditableListItem,
  type EditableListProps,
} from "./EditableList.js";
import { EmptyState } from "./EmptyState.js";
import { StatusBadge } from "../actions/StatusBadge.js";

const meta = {
  title: "Content/EditableList",
  component: EditableList,
  parameters: { layout: "padded" },
  tags: ["periphery"],
} satisfies Meta<EditableListProps>;

export default meta;
type Story = StoryObj<EditableListProps>;

interface Row extends EditableListItem {
  done: boolean;
  state?: "overdue" | "waiting";
}

const INITIAL: Row[] = [
  { id: "1", value: "Agree the estimate with the contractor", done: false },
  { id: "2", value: "Pay for hosting", done: false, state: "overdue" },
  { id: "3", value: "Wait for the lawyer to reply", done: false, state: "waiting" },
  { id: "4", value: "Send contract amendments", done: false },
  { id: "5", value: "Collect the quarterly budget", done: true },
];

function Demo({
  locale,
  withAdd = true,
  divided,
}: {
  locale?: string;
  withAdd?: boolean;
  divided?: boolean;
}) {
  const [items, setItems] = useState(INITIAL);
  const [nextId, setNextId] = useState(6);

  const list = (
    <div className="w-[420px]">
      <EditableList
        items={items}
        divided={divided}
        aria-label="Tasks"
        editLabel={(item) => `Rename ${item.textValue ?? item.value}`}
        onReorder={(ids: Key[]) =>
          setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
        }
        onValueChange={(id, value) =>
          setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
        }
        add={
          withAdd
            ? {
                label: "New task",
                placeholder: "What needs doing?",
                onAdd: (value) => {
                  setItems([...items, { id: String(nextId), value, done: false }]);
                  setNextId(nextId + 1);
                },
                /*
                  Тот же флажок, что в строке, но невидимый: `visibility:
                  hidden` сохраняет коробку целиком, а из порядка обхода и из
                  дерева доступности элемент убирает. Отмечать у задачи,
                  которой ещё нет, нечего.

                  Зеркало, а не распорка на глаз, и это не педантизм: у
                  `Checkbox size="sm"` рамка 16 пикселей, а занимает он 24 —
                  подпись-обёртка добавляет свои отступы. Распорка `size-4`
                  промахнулась бы на 8.
                */
                leading: (
                  <span className="invisible shrink-0">
                    <Checkbox size="sm" checked={false} label="" onCheckedChange={() => {}} />
                  </span>
                ),
              }
            : undefined
        }
        leading={(item) => (
          <Checkbox
            size="sm"
            checked={(item as Row).done}
            label={`Complete ${item.value}`}
            onCheckedChange={(done) =>
              setItems(items.map((row) => (row.id === item.id ? { ...row, done } : row)))
            }
          />
        )}
        trailing={(item) => {
          const state = (item as Row).state;
          return (
            <>
              {state != null ? (
                <StatusBadge tone={state === "overdue" ? "danger" : "warning"} size="sm" dot>
                  {state === "overdue" ? "Overdue" : "Waiting"}
                </StatusBadge>
              ) : null}
              {/*
                `size="xs"` — единственная ступень, которая не растягивает
                строку: `sm` даёт 30 пикселей против 20 под содержимое, и
                строка на 32 превращается в 42. Зона нажатия у неё всё равно
                24 — расширена псевдоэлементом.
              */}
              <Button
                size="xs"
                variant="ghost"
                iconOnly
                icon={<MoreIcon size={14} />}
                aria-label={`Actions for ${item.value}`}
              />
            </>
          );
        }}
      />
      <p className="text-fg-3 mt-2 text-[11px]" data-testid="order">
        {items.map((item) => item.id).join(",")}
      </p>
    </div>
  );

  return locale ? (
    <UiProvider locale={locale} messages={ru}>
      {list}
    </UiProvider>
  ) : (
    list
  );
}

/**
 * Enter on a focused row opens the field — double-click does the same with a
 * mouse. Enter confirms and returns focus to the row, Escape restores the
 * previous value and the focus, clicking away confirms without taking focus.
 *
 * Arrow down from the last row lands in the add field; Enter there creates a
 * task and keeps the field open, so a series goes in one after another.
 */
export const Playground: Story = { render: () => <Demo /> };

/**
 * `divided` puts a hairline between the rows. Without it a dense list reads as
 * one sheet of text: the only thing breaking the row apart is the drag handle.
 *
 * The line goes BETWEEN the rows, never under the last one, and the row loses
 * its corner radius — under a rounded row the line would bend along the
 * corners and stop being straight. Hover then spans the full width, which is
 * how a divided list is expected to look.
 */
export const Divided: Story = { render: () => <Demo divided /> };

/**
 * The list hands out one imperative handle: `focusAdd()`. It exists for
 * everything that decides from the OUTSIDE where the caret should go — a
 * command palette, a "new item" shortcut, a wizard step that says "fix this
 * field".
 *
 * The handle is narrow on purpose: it does not expose the input element. Hand
 * out the element and the row markup becomes a public contract — consumers
 * start reading `value` and attaching handlers to it.
 *
 * `focusAdd({ select: true })` selects what is already typed, so a repeat call
 * starts the entry over instead of appending to it.
 */
export const FocusFromOutside: Story = {
  render: function FocusFromOutsideDemo() {
    const list = useRef<EditableListHandle>(null);
    const [items, setItems] = useState<EditableListItem[]>([
      { id: "1", value: "Agree the estimate with the contractor" },
      { id: "2", value: "Pay for hosting" },
    ]);

    return (
      <div className="flex w-[420px] flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => list.current?.focusAdd()}>
            Add task
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => list.current?.focusAdd({ select: true })}
          >
            Add task, replacing the draft
          </Button>
        </div>
        <EditableList
          ref={list}
          items={items}
          aria-label="Tasks"
          editLabel={(item) => `Rename ${item.value}`}
          onReorder={(ids) => setItems(ids.map((id) => items.find((i) => i.id === id)!))}
          onValueChange={(id, value) =>
            setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
          }
          add={{
            label: "New task",
            placeholder: "What needs doing?",
            onAdd: (value) => setItems([...items, { id: String(items.length + 1), value }]),
          }}
        />
      </div>
    );
  },
};

/**
 * Without the `add` prop the list is only a list: the entry row does not exist
 * at all, and arrow down from the last row goes nowhere. This is the shape for
 * a list that is edited but not extended.
 */
export const WithoutAddRow: Story = { render: () => <Demo withAdd={false} /> };

/**
 * Под русской локалью объявления о переносе приходят по-русски от самой
 * react-aria: «Начато перетаскивание…», «Вставить между…». Своей живой области
 * у списка нет — она дублировала бы их.
 */
export const RussianLocale: Story = { render: () => <Demo locale="ru-RU" /> };

export const Empty: Story = {
  render: () => (
    <div className="w-[420px]">
      <EditableList
        items={[]}
        onReorder={() => {}}
        onValueChange={() => {}}
        editLabel={() => "Rename"}
        aria-label="Tasks"
        emptyText={<EmptyState title="Nothing to do right now" />}
        add={{ label: "New task", placeholder: "What needs doing?", onAdd: () => {} }}
      />
    </div>
  ),
};

/**
 * Рецепт «действия по наведению» из справочника, целиком и в работе.
 *
 * История существует ради проверки: рецепт, который стоит только в тексте,
 * тихо портится. Предыдущая его версия предписывала `group-focus-within:` на
 * содержимом слота — и утилита не срабатывала НИКОГДА, потому что строка несёт
 * `data-rac`, а плагин react-aria метит такой элемент атрибутом
 * `data-focus-within`, которого строка не выставляет. Кнопка, до которой дошёл
 * таб, оставалась невидимой.
 *
 * Поэтому `focus-within:` здесь — на собственной обёртке потребителя, без
 * `group-`. Обёртка не несёт `data-rac`, попадает во вторую ветку селектора и
 * работает обычным CSS.
 */
export const HoverActions: Story = {
  render: () => {
    const [items, setItems] = useState<Row[]>(INITIAL);
    return (
      <EditableList
        items={items}
        aria-label="Tasks"
        editLabel={(item) => `Rename ${item.value}`}
        onReorder={(ids: Key[]) =>
          setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
        }
        onValueChange={(id, value) =>
          setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
        }
        trailing={(item) => (
          <span
            data-testid="row-actions"
            className={
              "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 " +
              "flex items-center gap-1 transition-opacity duration-150 pointer-fine:focus-within:opacity-100"
            }
          >
            <Button
              size="xs"
              iconOnly
              variant="ghost"
              icon={<MoreIcon />}
              aria-label={`Actions for ${item.value}`}
            />
          </span>
        )}
      />
    );
  },
};

/**
 * Уход строки: пропавшая из `items` доживает свой уход, а место под ней
 * освобождается тем же движением.
 *
 * История нужна браузерным проверкам, а не снимкам: на статичном кадре уход
 * неотличим от его отсутствия. «Done» в строке снимает её так же, как это
 * делает флажок у потребителя, — то есть фокус в момент пропажи стоит ВНУТРИ
 * уходящей строки, и видно, куда он уходит дальше. Кнопка «Remove three»
 * снимает три разом: уходы идут одновременно, без волны с задержками.
 */
export const Leaving: Story = {
  render: () => {
    const [items, setItems] = useState<Row[]>(INITIAL);
    const remove = (ids: string[]) =>
      setItems((current) => current.filter((item) => !ids.includes(String(item.id))));

    return (
      <div className="flex w-[420px] flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => remove(["1", "2", "3"])}>
            Remove three
          </Button>
          <Button size="sm" onClick={() => setItems(INITIAL)}>
            Reset
          </Button>
        </div>
        <EditableList
          items={items}
          aria-label="Tasks"
          editLabel={(item) => `Rename ${item.value}`}
          onReorder={(ids: Key[]) =>
            setItems(ids.map((id) => items.find((item) => item.id === id)!).filter(Boolean))
          }
          onValueChange={(id, value) =>
            setItems(items.map((item) => (item.id === id ? { ...item, value } : item)))
          }
          add={{
            label: "New task",
            placeholder: "Add a task",
            onAdd: () => {},
          }}
          trailing={(item) => (
            <Button size="xs" variant="ghost" onClick={() => remove([String(item.id)])}>
              Done
            </Button>
          )}
        />
      </div>
    );
  },
};
